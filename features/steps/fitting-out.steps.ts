import assert from "node:assert/strict";
import { cpSync, mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Given, Then, When } from "@cucumber/cucumber";
import type { EstelleWorld } from "../support/world.js";

// The operator-visible opening messages the started session posts before the
// operator speaks, read through pi's own live session state. On an unfitted
// project Bonny cannot take a turn without a model, so the opening is the
// fitting-out steer.
interface MessageView {
	role: string;
	content?: unknown;
	display?: boolean;
}

interface SessionRuntimeView {
	session: { messages: MessageView[] };
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

function openingText(world: EstelleWorld): string {
	const runtime = world.interactiveSession!.runtime as SessionRuntimeView;
	const messages = runtime.session.messages;
	const firstUser = messages.findIndex((m) => m.role === "user");
	const opening = firstUser === -1 ? messages : messages.slice(0, firstUser);
	return opening
		.filter((m) => m.display !== false)
		.map(messageText)
		.join("\n");
}

// A disposable operator workspace carrying the shipped Estelle assets so launch
// resolves its roster, characters, skills, and steer. No provider auth is
// configured, so the started session cannot take a turn and falls back to the
// steer, the message the fitting-out scenarios observe.
function seedWorkspace(world: EstelleWorld): string {
	const dir = mkdtempSync(join(tmpdir(), "estelle-fitting-"));
	cpSync(join(process.cwd(), "assets"), join(dir, "assets"), {
		recursive: true,
	});
	world.workspaceDir = dir;
	world.agentDir = mkdtempSync(join(tmpdir(), "estelle-agent-"));
	return dir;
}

Given(
	"a project directory with no {string}",
	function (this: EstelleWorld, name: string) {
		assert.equal(name, "RIGGING.md");
		// The seeded workspace carries no RIGGING.md, so the project is unfitted.
		seedWorkspace(this);
	},
);

Given(
	"a project directory that carries {string}",
	function (this: EstelleWorld, name: string) {
		assert.equal(name, "RIGGING.md");
		const dir = seedWorkspace(this);
		// The real project RIGGING.md marks the workspace fitted out.
		cpSync(join(process.cwd(), "RIGGING.md"), join(dir, name));
	},
);

Given("a model is rigged", function (this: EstelleWorld) {
	// A namespaced verification provider stands in the operator's real agent dir:
	// file-backed auth, a resolvable model, and pi's default model selection. All
	// of it is real pi configuration read from disk, so the started session finds
	// a model available and does not fall through to the no-model steer.
	const provider = "estelle-verify-acme";
	const modelId = "estelle-verify-1";
	this.piDefaultModel = `${provider}/${modelId}`;
	this.prepareAgentDir({
		"auth.json": JSON.stringify({
			[provider]: { type: "api_key", key: "sk-estelle-verify" },
		}),
		"models.json": JSON.stringify({
			providers: {
				[provider]: {
					baseUrl: "https://acme.test/v1",
					apiKey: "sk-estelle-verify",
					api: "openai-completions",
					models: [
						{
							id: modelId,
							name: "Estelle Verify",
							reasoning: false,
							input: ["text"],
							cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
							contextWindow: 1000,
							maxTokens: 100,
						},
					],
				},
			},
		}),
		"settings.json": JSON.stringify({
			defaultProvider: provider,
			defaultModel: modelId,
		}),
	});
});

When(
	"the operator launches Estelle in that directory",
	async function (this: EstelleWorld) {
		const { run, launch } = await import("../../src/index.js");
		await run({
			cwd: this.workspaceDir,
			agentDir: this.agentDir,
			// @exceptional-double: stands in for pi's InteractiveMode/.run(), which
			// drives a real TTY the @logic tier cannot supply. Captures the real
			// Estelle-configured runtime so the started session's opening is observable.
			interactive: (session) => {
				this.interactiveSession = session;
			},
		});
		// The reused seat assertion reads the launched session; launch resolves the
		// active seat from the same workspace the operator opened.
		this.launched = await launch({
			cwd: this.workspaceDir,
			agentDir: this.agentDir,
		});
	},
);

Then(
	"Bonny steers the operator to fit out with the Shipwright {string}",
	function (this: EstelleWorld, shipwright: string) {
		const opening = openingText(this);
		assert.ok(
			opening.includes(shipwright),
			`the opening steer did not name the Shipwright "${shipwright}": ${opening}`,
		);
		assert.ok(
			/fit(?:ting)?\s+out|\/johnson/i.test(opening),
			`the opening steer did not steer the operator to fitting out: ${opening}`,
		);
	},
);
