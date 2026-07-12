import assert from "node:assert/strict";
import { writeFileSync } from "node:fs";
import { join } from "node:path";
import { Then, When } from "@cucumber/cucumber";
import type { EstelleWorld } from "../support/world.js";

/**
 * SessionStart reconnection scenarios drive the running session's real
 * session_start seam, pi's SessionStart event. Estelle must run the installed
 * Shipshape plugin's SessionStart hooks through the shim and deliver their
 * combined output into the seat's session context. Everything is observed on
 * real session state: the launched session's live message list and its active
 * seat. No test-facing accessor stands in for the delivery.
 *
 * The installed plugin's session-orient and rigging-validate hooks both gate on
 * "$cwd/RIGGING.md" existing, so a fresh session seeds an incomplete RIGGING.md
 * into the launched workspace first. With it present, session-orient emits the
 * deck-state orientation and rigging-validate reports the missing required
 * values. Both are the real hook output the seat must receive.
 */

interface MessageView {
	role: string;
	content?: unknown;
	display?: boolean;
}

interface SessionView {
	messages: MessageView[];
	extensionRunner: {
		emit(event: { type: string; reason: string }): Promise<unknown>;
	};
}

type SessionStartWorld = EstelleWorld & {
	sessionStartError?: unknown;
};

function sessionOf(world: EstelleWorld): SessionView {
	assert.ok(world.launched, "no launched Estelle session");
	return world.launched.session as unknown as SessionView;
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

function deliveredContext(world: EstelleWorld): string {
	return sessionOf(world).messages.map(messageText).join("\n");
}

async function startNewSession(world: SessionStartWorld): Promise<void> {
	world.sessionStartError = undefined;
	// Seed an incomplete RIGGING.md at the session cwd: the plugin's SessionStart
	// hooks gate on its presence, and its missing required values are what
	// rigging-validate reports.
	assert.ok(world.workspaceDir, "no launched workspace for the session cwd");
	writeFileSync(join(world.workspaceDir, "RIGGING.md"), "# Rigging\n", "utf8");
	try {
		await sessionOf(world).extensionRunner.emit({
			type: "session_start",
			reason: "startup",
		});
	} catch (error) {
		world.sessionStartError = error;
	}
}

When("a new Bonny session starts", async function (this: SessionStartWorld) {
	await startNewSession(this);
});

When(
	"a new Bonny session starts and a SessionStart hook exits non-zero",
	async function (this: SessionStartWorld) {
		await startNewSession(this);
	},
);

Then(
	"the plugin's SessionStart orientation is delivered into the session context",
	function (this: SessionStartWorld) {
		const delivered = deliveredContext(this);
		assert.ok(
			delivered.includes("Deck state, derived now:"),
			`the plugin's SessionStart orientation did not reach the session context; delivered: ${JSON.stringify(
				delivered,
			)}`,
		);
	},
);

Then(
	"the orientation carries the plugin's rigging-validation output",
	function (this: SessionStartWorld) {
		const delivered = deliveredContext(this);
		assert.ok(
			delivered.includes("RIGGING.md is missing required values"),
			`the orientation did not carry the plugin's rigging-validation output; delivered: ${JSON.stringify(
				delivered,
			)}`,
		);
	},
);

Then(
	"the session still opens as the Captain {string}",
	function (this: SessionStartWorld, name: string) {
		assert.equal(
			this.sessionStartError,
			undefined,
			`a non-zero SessionStart hook broke the session open: ${String(
				this.sessionStartError,
			)}`,
		);
		const seat = this.launched!.seat();
		assert.equal(seat.role, "captain", `active seat role is "${seat.role}"`);
		assert.equal(seat.name, name, `active seat name is "${seat.name}"`);
	},
);
