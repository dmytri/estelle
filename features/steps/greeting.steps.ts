import assert from "node:assert/strict";
import { cpSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Given, Then } from "@cucumber/cucumber";
import type { EstelleWorld } from "../support/world.js";

// Structural view of the real pi session the interactive handle carries. The
// greeting scenarios read the started session's live message list through pi's
// own public seam, so "Bonny speaks first" is observed on real session state.
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

/**
 * The operator-visible messages that open the started session: everything
 * before the first user message. If the operator has already spoken, the
 * session did not open with Estelle's voice.
 */
function openingMessages(world: EstelleWorld): MessageView[] {
	const runtime = world.interactiveSession!.runtime as SessionRuntimeView;
	const messages = runtime.session.messages;
	const firstUser = messages.findIndex((m) => m.role === "user");
	const opening = firstUser === -1 ? messages : messages.slice(0, firstUser);
	return opening.filter((m) => m.display !== false);
}

Given(
	"provider auth and a default model are configured in the operator's agent directory",
	function (this: EstelleWorld) {
		// A namespaced verification provider stands in the operator's real agent
		// dir files: file-backed auth, a resolvable model, and pi's default model
		// selection. All of it is real pi configuration read from disk.
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
	},
);

Given(
	"an operator directory whose Bonny greeting asset reads {string}",
	function (this: EstelleWorld, greeting: string) {
		// A disposable operator workspace carrying the full Estelle assets so launch
		// resolves its roster, characters, and skills, with the Bonny greeting asset
		// overwritten to the operator-owned text this scenario pins. The started
		// session must open with this asset content, not a built-in string.
		this.workspaceDir ??= mkdtempSync(join(tmpdir(), "estelle-operator-"));
		cpSync(join(process.cwd(), "assets"), join(this.workspaceDir, "assets"), {
			recursive: true,
		});
		writeFileSync(
			join(this.workspaceDir, "assets", "greeting.md"),
			greeting,
			"utf8",
		);
	},
);

Given(
	"an operator directory whose Bonny fitting-out steer asset reads {string}",
	function (this: EstelleWorld, steer: string) {
		// A disposable operator workspace carrying the full Estelle assets so launch
		// resolves its roster, characters, and skills, with the Bonny fitting-out
		// steer asset overwritten to the operator-owned text this scenario pins. When
		// no model is rigged, the started session must open with this asset content,
		// not a built-in string.
		this.workspaceDir ??= mkdtempSync(join(tmpdir(), "estelle-operator-"));
		cpSync(join(process.cwd(), "assets"), join(this.workspaceDir, "assets"), {
			recursive: true,
		});
		writeFileSync(join(this.workspaceDir, "assets", "steer.md"), steer, "utf8");
	},
);

Given(
	"no provider auth is configured in the operator's agent directory",
	function (this: EstelleWorld) {
		// A bare agent directory: no auth.json, no models.json, no default model.
		this.prepareAgentDir();
	},
);

Then(
	"Bonny opens the session with a greeting before the operator speaks",
	function (this: EstelleWorld) {
		const opening = openingMessages(this);
		const greeting = opening.find((m) => messageText(m).trim().length > 0);
		assert.ok(
			greeting,
			"started session carries no operator-visible message before the operator speaks",
		);
	},
);

Then(
	"Bonny opens the session with the greeting {string}",
	function (this: EstelleWorld, greeting: string) {
		const opening = openingMessages(this);
		const match = opening.find(
			(m) => messageText(m).trim() === greeting.trim(),
		);
		assert.ok(
			match,
			`started session did not open with the greeting ${JSON.stringify(
				greeting,
			)}; opening messages: ${JSON.stringify(opening.map(messageText))}`,
		);
	},
);

Then(
	"Bonny opens the session with the guidance {string}",
	function (this: EstelleWorld, guidance: string) {
		const opening = openingMessages(this);
		const match = opening.find(
			(m) => messageText(m).trim() === guidance.trim(),
		);
		assert.ok(
			match,
			`started session did not open with the guidance ${JSON.stringify(
				guidance,
			)}; opening messages: ${JSON.stringify(opening.map(messageText))}`,
		);
	},
);

Then(
	"the started session presents fitting-out guidance naming {string} and {string}",
	function (this: EstelleWorld, first: string, second: string) {
		const opening = openingMessages(this);
		const guidance = opening.find((m) => {
			const text = messageText(m);
			return text.includes(first) && text.includes(second);
		});
		assert.ok(
			guidance,
			`started session presents no opening message naming ${first} and ${second}; opening messages: ${JSON.stringify(
				opening.map(messageText),
			)}`,
		);
	},
);
