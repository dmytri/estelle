import assert from "node:assert/strict";
import { existsSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Given, Then, When } from "@cucumber/cucumber";
import type { EstelleWorld } from "../support/world.js";

// Upstream Shipshape role that owns each seat's instructions. Seat id maps to
// the upstream role skill name, which the launch seam exposes through skills.
const ROLE_BY_SEAT: Record<string, string> = {
	bonny: "captain",
	misson: "qm",
	crew: "crew",
	bellamy: "boatswain",
	johnson: "shipwright",
};

function upstreamRoleInstructions(
	world: EstelleWorld,
	role: string,
): { filePath: string; contents: string } {
	const skill = world.launched!.skills.find((s) => s.name === role);
	assert.ok(skill, `upstream "${role}" role instructions not loaded`);
	return {
		filePath: skill.filePath,
		contents: readFileSync(skill.filePath, "utf8").trim(),
	};
}

function characterCard(world: EstelleWorld, seat: string): string {
	const base = world.workspaceDir ?? process.cwd();
	return readFileSync(
		join(base, "assets", "characters", `${seat}.md`),
		"utf8",
	).trim();
}

When(
	"the operator runs the command {string}",
	function (this: EstelleWorld, command: string) {
		this.commandRun = true;
		this.launched!.runCommand(command);
	},
);

// Serves both uses of the same Gherkin phrase. As a Then after an explicit
// command (outline 1) it strictly asserts the command activated this seat. As
// a Given precondition (outline 2) no command ran, so it establishes the seat
// through the same command seam, then asserts.
Then(
	"the active seat is the {string} seat",
	async function (this: EstelleWorld, seat: string) {
		const estelle = await this.ensureLaunched();
		if (!this.commandRun) {
			estelle.runCommand(`/${seat}`);
		}
		const actual = estelle.seat().id;
		assert.equal(
			actual,
			seat,
			`active seat is "${actual}", expected "${seat}"`,
		);
	},
);

Then(
	"the seat system prompt includes the upstream {string} role instructions",
	function (this: EstelleWorld, role: string) {
		const upstream = upstreamRoleInstructions(this, role);
		const prompt = this.launched!.systemPrompt();
		assert.ok(
			prompt.includes(upstream.contents),
			`seat system prompt did not include the upstream "${role}" role instructions from ${upstream.filePath}`,
		);
	},
);

Then(
	"the seat system prompt includes the {string} character card",
	function (this: EstelleWorld, seat: string) {
		const card = characterCard(this, seat);
		const prompt = this.launched!.systemPrompt();
		assert.ok(
			prompt.includes(card),
			`seat system prompt did not include the "${seat}" character card`,
		);
	},
);

Then(
	"the upstream Shipshape role instructions resolve from outside the Estelle repository",
	function (this: EstelleWorld) {
		for (const role of Object.values(ROLE_BY_SEAT)) {
			const upstream = upstreamRoleInstructions(this, role);
			assert.ok(
				existsSync(upstream.filePath),
				`upstream "${role}" role instructions file does not exist: ${upstream.filePath}`,
			);
			assert.ok(
				!upstream.filePath.startsWith(process.cwd()),
				`upstream "${role}" role instructions are vendored inside the repository at ${upstream.filePath}`,
			);
		}
	},
);

// The running interactive session the started-session scenarios drive. It carries
// the real pi AgentSession the seated model runs on: its assembled base system
// prompt, its live extension runner, and the resource loader that resolves the
// upstream role skills. The applied-turn scenarios read the prompt through this
// real turn seam, not through any recompute accessor.
interface StartedSessionView {
	runtime: {
		session: {
			systemPrompt: string;
			extensionRunner: {
				emitBeforeAgentStart(
					prompt: string,
					images: undefined,
					systemPrompt: string,
					systemPromptOptions: { cwd: string },
				): Promise<{ systemPrompt?: string } | undefined>;
			};
		};
		services: {
			resourceLoader: {
				getSkills(): { skills: { name: string; filePath: string }[] };
			};
		};
	};
}

function startedSession(world: EstelleWorld): StartedSessionView {
	return world.interactiveSession as unknown as StartedSessionView;
}

function appliedTurnPrompt(world: EstelleWorld): string {
	const prompt = (world as unknown as { turnSystemPrompt?: string })
		.turnSystemPrompt;
	assert.ok(
		prompt !== undefined,
		"the seated model has not begun its next turn; no applied system prompt captured",
	);
	return prompt;
}

// Read the character card from the shipped assets the running session composes
// from. The started session launches in a bare workspace, so Estelle resolves
// its own shipped assets from the repository root, the same directory the
// before_agent_start seam reads the card from.
function shippedCharacterCard(seat: string): string {
	return readFileSync(
		join(process.cwd(), "assets", "characters", `${seat}.md`),
		"utf8",
	).trim();
}

When(
	"the seated model begins its next turn",
	async function (this: EstelleWorld) {
		const session = startedSession(this).runtime.session;
		// Drive the real turn seam: fire the session's own before_agent_start
		// event, the path pi runs when the seated model begins a turn. The Estelle
		// extension composes the applied system prompt from the live active seat,
		// so the captured prompt is what the seated model actually receives.
		const base = session.systemPrompt;
		const result = await session.extensionRunner.emitBeforeAgentStart(
			"",
			undefined,
			base,
			{ cwd: this.workspaceDir ?? process.cwd() },
		);
		(this as unknown as { turnSystemPrompt?: string }).turnSystemPrompt =
			result?.systemPrompt ?? base;
	},
);

Then(
	"the system prompt applied to the turn includes the {string} character card",
	function (this: EstelleWorld, seat: string) {
		const card = shippedCharacterCard(seat);
		const prompt = appliedTurnPrompt(this);
		assert.ok(
			prompt.includes(card),
			`applied turn system prompt did not include the "${seat}" character card`,
		);
	},
);

Then(
	"the system prompt applied to the turn includes the upstream {string} role instructions",
	function (this: EstelleWorld, role: string) {
		const skill = startedSession(this)
			.runtime.services.resourceLoader.getSkills()
			.skills.find((s) => s.name === role);
		assert.ok(skill, `upstream "${role}" role instructions not loaded`);
		const contents = readFileSync(skill.filePath, "utf8").trim();
		const prompt = appliedTurnPrompt(this);
		assert.ok(
			prompt.includes(contents),
			`applied turn system prompt did not include the upstream "${role}" role instructions from ${skill.filePath}`,
		);
	},
);

Then(
	"the system prompt applied to the turn excludes the {string} character card",
	function (this: EstelleWorld, seat: string) {
		const card = shippedCharacterCard(seat);
		const prompt = appliedTurnPrompt(this);
		assert.ok(
			!prompt.includes(card),
			`applied turn system prompt included the "${seat}" character card but should exclude it`,
		);
	},
);

Then(
	"the system prompt applied to the turn names the Captain {string}, the Quartermaster {string}, the Crew, the Boatswain {string}, and the Shipwright {string}",
	function (
		this: EstelleWorld,
		captain: string,
		quartermaster: string,
		boatswain: string,
		shipwright: string,
	) {
		const prompt = appliedTurnPrompt(this);
		for (const name of [
			captain,
			quartermaster,
			"Crew",
			boatswain,
			shipwright,
		]) {
			assert.ok(
				prompt.includes(name),
				`applied turn system prompt did not name "${name}"`,
			);
		}
	},
);

// The running interactive session the operator/TUI actually talks to. It is the
// real pi AgentSession the started session drives: its own composed system
// prompt string, its live message history, and the live turn seam a live model
// answers on. A seat-switch scenario reads the seat-switch behaviour off this
// object, never off a recompute accessor and never off a manual emit of the
// composing hook, because both report the switched seat while the running
// session still holds the launch seat.
interface RunningSessionView {
	systemPrompt: string;
	messages: { role: string; content?: unknown }[];
	sendUserMessage(text: string): Promise<unknown>;
	subscribe(callback: () => void): () => void;
	abort(): Promise<void>;
}

interface RunningRuntimeView {
	session: RunningSessionView;
	services: {
		resourceLoader: {
			getSkills(): { skills: { name: string; filePath: string }[] };
		};
	};
}

function runningRuntime(world: EstelleWorld): RunningRuntimeView {
	return world.interactiveSession!.runtime as unknown as RunningRuntimeView;
}

function assistantText(message: { content?: unknown }): string {
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

Then(
	"the interactive session the operator talks to is a fresh session seated as the Boatswain {string}",
	function (this: EstelleWorld, name: string) {
		const before = (this as unknown as { sessionBeforeCommand?: unknown })
			.sessionBeforeCommand;
		assert.ok(
			before !== undefined,
			"no running interactive session was captured before the switch",
		);
		const after = runningRuntime(this).session;
		assert.ok(
			after !== before,
			"the /command switch did not recreate the running interactive session; the operator still talks to the launch seat's session",
		);
		const seat = this.interactiveSession!.seat();
		assert.equal(
			seat.role,
			"boatswain",
			`the running session's seat is "${seat.role}", expected the Boatswain`,
		);
		assert.equal(seat.name, name);
	},
);

Then(
	"that session's system prompt includes the {string} character card",
	function (this: EstelleWorld, seat: string) {
		const card = shippedCharacterCard(seat);
		const prompt = runningRuntime(this).session.systemPrompt;
		assert.ok(
			prompt.includes(card),
			`the recreated interactive session's system prompt did not include the "${seat}" character card`,
		);
	},
);

Then(
	"that session's system prompt includes the upstream {string} role instructions",
	function (this: EstelleWorld, role: string) {
		const runtime = runningRuntime(this);
		const skill = runtime.services.resourceLoader
			.getSkills()
			.skills.find((s) => s.name === role);
		assert.ok(skill, `upstream "${role}" role instructions not loaded`);
		const contents = readFileSync(skill.filePath, "utf8").trim();
		assert.ok(
			runtime.session.systemPrompt.includes(contents),
			`the recreated interactive session's system prompt did not include the upstream "${role}" role instructions from ${skill.filePath}`,
		);
	},
);

Then(
	"that session's system prompt excludes the {string} character card",
	function (this: EstelleWorld, seat: string) {
		const card = shippedCharacterCard(seat);
		const prompt = runningRuntime(this).session.systemPrompt;
		assert.ok(
			!prompt.includes(card),
			`the recreated interactive session's system prompt included the "${seat}" character card but should exclude it`,
		);
	},
);

// Start a real Estelle session through the production run() entry, capturing the
// operator-facing interactive handle. A bare workspace and disposable agent dir
// keep the launch hermetic and harmless; the interactive @exceptional-double
// stands in for pi's terminal runner and captures real production state.
async function startSession(world: EstelleWorld): Promise<void> {
	world.workspaceDir ??= mkdtempSync(join(tmpdir(), "estelle-seat-switch-"));
	world.agentDir ??= mkdtempSync(join(tmpdir(), "estelle-agent-"));
	const { run } = await import("../../src/index.js");
	await run({
		cwd: world.workspaceDir,
		agentDir: world.agentDir,
		interactive: (session) => {
			world.interactiveSession = session;
		},
	});
}

Given(
	"a live eval model is configured for the seat",
	async function (this: EstelleWorld) {
		const model = process.env.HARNESS_EVAL_MODEL!;
		const key = process.env.HARNESS_OPENROUTER_API_KEY!;
		// Record the eval model for the seat the switch lands on, the Boatswain, and
		// for the launch Captain seat the started session boots on, then relaunch so
		// the running session resolves the live model. The switched seat speaks on
		// the live model; the Captain seat carries it too so the launch session on
		// current production answers as its launch seat instead of erroring.
		writeFileSync(
			join(this.agentDir!, "estelle.json"),
			JSON.stringify({
				seats: {
					boatswain: `openrouter/${model}`,
					captain: `openrouter/${model}`,
				},
			}),
			"utf8",
		);
		writeFileSync(
			join(this.agentDir!, "auth.json"),
			JSON.stringify({ openrouter: { type: "api_key", key } }),
			"utf8",
		);
		this.interactiveSession = undefined;
		await startSession(this);
	},
);

When(
	"the operator asks the seated model {string}",
	{ timeout: 120000 },
	async function (this: EstelleWorld, question: string) {
		const session = runningRuntime(this).session;
		// Drive a real turn on the running session the operator talks to and wait for
		// the seated model's live assistant reply. Resolve as soon as a live reply
		// lands or the turn settles, so a slow or replyless turn surfaces the seated
		// model's actual output instead of hanging the step.
		await new Promise<void>((resolve) => {
			let done = false;
			const finish = () => {
				if (done) {
					return;
				}
				done = true;
				unsubscribe();
				resolve();
			};
			const unsubscribe = session.subscribe(() => {
				const gotReply = session.messages.some(
					(m) => m.role === "assistant" && assistantText(m).trim().length > 0,
				);
				if (gotReply) {
					finish();
				}
			});
			session.sendUserMessage(question).then(finish, finish);
		});
		await session.abort();
		(this as unknown as { seatReply?: string }).seatReply = session.messages
			.filter((m) => m.role === "assistant")
			.map(assistantText)
			.filter((text) => text.trim().length > 0)
			.pop();
	},
);

Then(
	"the seated model's live reply names the Boatswain {string}",
	function (this: EstelleWorld, name: string) {
		const reply = (this as unknown as { seatReply?: string }).seatReply;
		assert.ok(
			reply !== undefined && reply.trim().length > 0,
			"the seated model produced no live reply",
		);
		assert.ok(
			reply.includes(name),
			`the seated model's live reply did not name the Boatswain "${name}"; reply: ${JSON.stringify(
				reply,
			)}`,
		);
	},
);
