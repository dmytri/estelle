import assert from "node:assert/strict";
import { cpSync, mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
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
	"Bonny begins their Captain opening turn before the operator speaks",
	function (this: EstelleWorld) {
		// A Captain opening turn drives the model: it fires a provider request, the
		// same seam the launch-path scenarios count. A canned greeting posts a
		// display message and drives no request. The scenario configures a model and
		// never lets the operator speak, so a provider request observed right after
		// start is Bonny's opening turn, not the operator's.
		const handle = this.interactiveSession as unknown as {
			providerRequestCount?: () => number;
		};
		assert.equal(
			typeof handle.providerRequestCount,
			"function",
			"started session exposes no provider-request count, so whether Bonny's opening turn drove the model cannot be observed",
		);
		assert.ok(
			handle.providerRequestCount!() > 0,
			"Bonny drove no provider request before the operator spoke: startup posted a canned message rather than actuating a Captain opening turn",
		);
	},
);

// The pending review the opening must surface. A real feature file carrying a
// real tagged scenario is seeded into the operator's own directory, so the
// opening has to read the workspace specs to find it. The title is distinctive:
// an opening that never derived the pending scenario cannot name it.
const PENDING_SCENARIO = "Refund a fully shipped order to the original card";

Given(
	"an operator directory whose specs carry a {string} scenario awaiting the Captain's review",
	function (this: EstelleWorld, tag: string) {
		// A bare operator directory carrying no Estelle assets, so the package
		// resolves its own shipped assets, with real specs of the operator's own.
		// One scenario is tagged and awaits the Captain's review; the other is
		// binding and settled, so surfacing the pending one is a derivation and not
		// a listing of every scenario in the file.
		this.workspaceDir ??= mkdtempSync(join(tmpdir(), "estelle-operator-"));
		const featuresDir = join(this.workspaceDir, "features");
		mkdirSync(featuresDir, { recursive: true });
		writeFileSync(
			join(featuresDir, "refunds.feature"),
			[
				"@logic",
				"Feature: Refunds on shipped orders",
				"",
				"  Scenario: A refund is refused on an unpaid order",
				'    Given a customer has not paid for order "SO-4418"',
				"    When the operator issues a refund for the order",
				"    Then the refund is refused",
				"",
				`  ${tag}`,
				`  Scenario: ${PENDING_SCENARIO}`,
				'    Given a customer paid for order "SO-4417" with a saved card',
				"    And the order has shipped in full",
				"    When the operator issues a refund for the order",
				"    Then the refund returns to the original saved card",
				"",
			].join("\n"),
			"utf8",
		);
	},
);

Then(
	"the session's opening carries the pending {string} scenario to the operator",
	function (this: EstelleWorld, tag: string) {
		// Estelle derives the pending review from the workspace specs and carries it
		// into the opening itself, so it reaches the operator whether or not a model
		// speaks. Read the opening the operator actually sees: the display messages
		// the session opens with, before the operator has spoken.
		const opening = openingMessages(this)
			.map(messageText)
			.filter((text) => text.trim().length > 0);
		assert.ok(
			opening.length > 0,
			"the started session opened with no operator-visible message at all",
		);
		const text = opening.join("\n");
		const lower = text.toLowerCase();
		// Naming the pending scenario: the opening carries the awaiting scenario's
		// own title. An opening that never read the specs cannot produce it.
		assert.ok(
			lower.includes(PENDING_SCENARIO.toLowerCase()),
			`the session's opening did not carry the pending scenario ${JSON.stringify(
				PENDING_SCENARIO,
			)} to the operator; opening messages: ${JSON.stringify(opening)}`,
		);
		// Carried as pending: the opening marks it as awaiting the Captain's review,
		// by its tag or by the review language, rather than mentioning it bare.
		assert.ok(
			lower.includes(tag.toLowerCase()) ||
				/awaiting|pending|review|promot|unreviewed/.test(lower),
			`the session's opening named the scenario but did not carry it as awaiting the Captain's review; opening messages: ${JSON.stringify(
				opening,
			)}`,
		);
		// The settled binding scenario is not a pending review, so an opening that
		// lists every scenario in the specs has derived nothing.
		assert.ok(
			!lower.includes("a refund is refused on an unpaid order"),
			`the session's opening listed the settled binding scenario alongside the pending one, so it carried the specs rather than the derived pending review; opening messages: ${JSON.stringify(
				opening,
			)}`,
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
