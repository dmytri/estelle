import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import {
	mkdirSync,
	mkdtempSync,
	readdirSync,
	readFileSync,
	writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Given, Then, When } from "@cucumber/cucumber";
import type { EstelleWorld } from "../support/world.js";

// The blocker-resolution scenarios drive a real Estelle session on a scratch
// project whose rigging is genuinely faulty: RIGGING.md carries no `focused`
// command. The operator then asks Bonny for a greeting page. A Bonny who
// reports the rigging fault and holds leaves the scratch project untouched, so
// both scenarios read durable files on disk after the turn: the repaired
// RIGGING.md and the written specification. Narration cannot satisfy either.
// Every observation is real production state: files the live run wrote.

interface MessageView {
	role: string;
	content?: unknown;
}

interface SessionView {
	messages: MessageView[];
	sendUserMessage(
		content: string,
		options?: { triggerTurn?: boolean },
	): Promise<unknown>;
	subscribe(
		listener: (event: { type: string; willRetry?: boolean }) => void,
	): () => void;
	readonly isStreaming: boolean;
}

interface SessionRuntimeView {
	session: SessionView;
}

interface InteractiveHandleView {
	runtime: SessionRuntimeView;
	seat(): { id: string; role: string; name: string };
	awaitCrewRun(): Promise<void>;
}

function messageText(message: MessageView): string {
	const content = message.content;
	if (typeof content === "string") {
		return content;
	}
	if (Array.isArray(content)) {
		return content
			.filter(
				(part): part is { type: string; text: string } =>
					typeof part === "object" && part !== null && part.type === "text",
			)
			.map((part) => part.text)
			.join("\n");
	}
	return "";
}

function handle(world: EstelleWorld): InteractiveHandleView {
	const view = world.interactiveSession as unknown as InteractiveHandleView;
	assert.ok(view, "no started Estelle session");
	return view;
}

function operatorSession(world: EstelleWorld): SessionView {
	return handle(world).runtime.session;
}

function gitIn(dir: string, args: string[]): string {
	const result = spawnSync("git", args, { cwd: dir, encoding: "utf8" });
	assert.equal(
		result.status,
		0,
		`git ${args.join(" ")} failed in ${dir}: ${result.stderr}`,
	);
	return result.stdout.trim();
}

// The rigging value key as RIGGING.md records it: a Markdown list item under a
// heading, `- <key>: <value>`. Reading for the key this way distinguishes a real
// recorded value from an incidental mention of the word in prose.
function riggingCarriesKey(riggingText: string, key: string): boolean {
	return riggingText
		.split("\n")
		.some((line) => new RegExp(`^\\s*-\\s*${key}\\s*:\\s*\\S`).test(line));
}

// Every .feature file under the scratch project, at any depth. The project has
// no fixed specs directory before the run: the specs directory RIGGING.md names
// is `features`, but a repaired project may still land the spec elsewhere, so
// the search reads the whole tree and skips only the disposable plumbing.
function featureFiles(dir: string): string[] {
	const found: string[] = [];
	const skip = new Set([".git", "node_modules"]);
	const walk = (current: string) => {
		for (const entry of readdirSync(current, { withFileTypes: true })) {
			if (skip.has(entry.name)) {
				continue;
			}
			const path = join(current, entry.name);
			if (entry.isDirectory()) {
				walk(path);
			} else if (entry.isFile() && entry.name.endsWith(".feature")) {
				found.push(path);
			}
		}
	};
	walk(dir);
	return found;
}

interface ScratchRigging {
	dir: string;
}

function scratch(world: EstelleWorld): ScratchRigging {
	const project = (world as unknown as { scratchRigging?: ScratchRigging })
		.scratchRigging;
	assert.ok(project, "no scratch project was set up for this scenario");
	return project;
}

Given(
	"a scratch project whose {string} carries no {string} command",
	{ timeout: 120000 },
	function (this: EstelleWorld, riggingName: string, commandKey: string) {
		const dir = mkdtempSync(join(tmpdir(), "estelle-scratch-rigging-"));
		writeFileSync(
			join(dir, "package.json"),
			JSON.stringify({ name: "estelle-scratch-rigging", version: "0.0.0" }),
			"utf8",
		);
		// A fitted-looking Shipshape project with one genuine rigging fault: the
		// `focused` command, a required value, is missing. Every other required
		// value is present, so the fault is specific and repairable rather than a
		// wholesale refit of an unfitted project.
		const rigging = [
			"# Rigging",
			"",
			"## Stack",
			"",
			"- language: typescript",
			"",
			"## Directories",
			"",
			"- implementation: src",
			"- specs: features",
			"",
			"## Commands",
			"",
			"- broad: `node verify.js`",
			"",
			"## Perturbation",
			"",
			"- message: `PERTURBATION: consider current durable context; remove when fixed`",
			'- perturb: `throw new Error("PERTURBATION: consider current durable context; remove when fixed");`',
			"",
		].join("\n");
		writeFileSync(join(dir, riggingName), rigging, "utf8");
		mkdirSync(join(dir, "src"), { recursive: true });
		mkdirSync(join(dir, "features"), { recursive: true });
		gitIn(dir, ["init", "-q"]);
		gitIn(dir, ["config", "user.email", "crew@estelle.test"]);
		gitIn(dir, ["config", "user.name", "Estelle Crew"]);
		gitIn(dir, ["add", "-A"]);
		gitIn(dir, ["commit", "-q", "-m", "seed a project with a faulty rigging"]);
		assert.equal(
			riggingCarriesKey(
				readFileSync(join(dir, riggingName), "utf8"),
				commandKey,
			),
			false,
			`the scratch project's ${riggingName} already carries a ${commandKey} command before the run`,
		);
		(this as unknown as { scratchRigging?: ScratchRigging }).scratchRigging = {
			dir,
		};
		// The Estelle session under test launches against this project, so the
		// world's teardown disposes it with the workspace.
		this.workspaceDir = dir;
	},
);

Given(
	"a started Estelle session in the scratch project",
	// Starting a session on a project with a faulty rigging resolves the fault
	// before the helm opens, and that resolution is a live model run against a
	// real refit. The budget is a failure ceiling sized to that real latency; the
	// step resolves the moment the session hands back.
	{ timeout: 1800000 },
	async function (this: EstelleWorld) {
		const project = scratch(this);
		// Fit the live eval model as the agent's default, with no per-seat override,
		// exactly as a real operator session is configured. This tier requires the
		// model credential as fitting-out and assumes it present.
		this.agentDir ??= mkdtempSync(join(tmpdir(), "estelle-agent-"));
		const model = process.env.HARNESS_EVAL_MODEL!;
		const key = process.env.HARNESS_OPENROUTER_API_KEY!;
		writeFileSync(
			join(this.agentDir, "settings.json"),
			JSON.stringify({ defaultProvider: "openrouter", defaultModel: model }),
			"utf8",
		);
		writeFileSync(
			join(this.agentDir, "auth.json"),
			JSON.stringify({ openrouter: { type: "api_key", key } }),
			"utf8",
		);
		const { run } = await import("../../src/index.js");
		await run({
			cwd: project.dir,
			agentDir: this.agentDir,
			interactive: (session) => {
				this.interactiveSession = session;
			},
		});
		const seat = handle(this).seat();
		assert.equal(seat.role, "captain");
	},
);

// Wait for the session's opening turn to settle on its own observed signal: the
// reply lands and the stream goes idle. This is a readiness gate, so the budget
// is a failure ceiling, never a fallback: the operator can only speak to an idle
// session, and sending into a live stream is a runtime error. A turn still
// streaming at the deadline fails loudly with the last observed state.
async function settle(session: SessionView, budgetMs: number): Promise<void> {
	const deadline = Date.now() + budgetMs;
	while (Date.now() < deadline) {
		const replied = session.messages.some(
			(message) =>
				message.role === "assistant" && messageText(message).trim().length > 0,
		);
		if (replied && !session.isStreaming) {
			return;
		}
		await new Promise((resolve) => setTimeout(resolve, 250));
	}
	assert.fail(
		`the started session never settled to idle within ${budgetMs}ms, so the operator could not speak to it; streaming: ${
			session.isStreaming
		}; assistant replies observed: ${JSON.stringify(
			session.messages
				.filter((message) => message.role === "assistant")
				.map(messageText),
		)}`,
	);
}

When(
	"the operator asks Bonny to specify a greeting page for the project",
	// A live Captain turn that must survey the project, hit the rigging fault,
	// resolve or route it, and land a durable spec. It needs a live-run budget
	// well beyond cucumber's default.
	{ timeout: 3600000 },
	async function (this: EstelleWorld) {
		const session = operatorSession(this);
		await settle(session, 900000);
		// The operator's ask names the product intent only. It says nothing about
		// the rigging, so Bonny discovers the fault themselves and decides, on
		// their own, whether to resolve it or hold it as a blocker.
		await new Promise<void>((resolve, reject) => {
			let done = false;
			const finish = (error?: unknown) => {
				if (done) {
					return;
				}
				done = true;
				unsubscribe();
				if (error) {
					reject(error as Error);
				} else {
					resolve();
				}
			};
			const unsubscribe = session.subscribe((event) => {
				if (event.type === "agent_end" && event.willRetry === false) {
					finish();
				}
			});
			session
				.sendUserMessage(
					"I want a greeting page for this project: it welcomes a first-time visitor by name. Please specify it.",
				)
				.then(() => {
					// Fallback: the send resolved with no observed agent_end. Give the end
					// signal a short drain, then settle with what was observed.
					setTimeout(finish, 5000);
				}, finish);
		});
		// Bonny may set the crew working from their own turn, which returns as soon
		// as the crew is under way. Await the held run so the durable outcomes are
		// read off a completed deck.
		await handle(this).awaitCrewRun();
	},
);

Then(
	"the scratch project's {string} carries a {string} command",
	function (this: EstelleWorld, riggingName: string, commandKey: string) {
		const project = scratch(this);
		const rigging = readFileSync(join(project.dir, riggingName), "utf8");
		assert.ok(
			riggingCarriesKey(rigging, commandKey),
			`the scratch project's ${riggingName} still carries no ${commandKey} command after the turn: Bonny reported the rigging fault and held it rather than repairing or routing it. Current ${riggingName}:\n${rigging}`,
		);
	},
);

Then(
	"the scratch project carries a specification for the greeting page",
	function (this: EstelleWorld) {
		const project = scratch(this);
		const specs = featureFiles(project.dir);
		assert.ok(
			specs.length > 0,
			"the scratch project carries no .feature specification at all after the turn: the confirmed intent never reached a durable artifact",
		);
		// The spec is the greeting page's own: its text names the greeting
		// behaviour the operator asked for. A spec about anything else does not
		// carry this intent.
		const greeting = specs.filter((path) =>
			/greet|welcome/i.test(readFileSync(path, "utf8")),
		);
		assert.ok(
			greeting.length > 0,
			`the scratch project carries no specification for the greeting page; .feature files found: ${JSON.stringify(
				specs,
			)}`,
		);
	},
);
