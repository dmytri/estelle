import assert from "node:assert/strict";
import { Then } from "@cucumber/cucumber";
import type { EstelleWorld } from "../support/world.js";

// Structural view of the real pi session the interactive handle carries. The
// clear scenarios read the started session's live message list through pi's
// own public seam, so "the session is fresh" is observed on real session state.
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

Then(
	"the started session's message history excludes the operator's message {string}",
	function (this: EstelleWorld, message: string) {
		const runtime = this.interactiveSession!.runtime as SessionRuntimeView;
		const leaked = runtime.session.messages.filter((m) =>
			messageText(m).includes(message),
		);
		assert.equal(
			leaked.length,
			0,
			`started session's message history still carries the operator's message ${JSON.stringify(
				message,
			)}; leaked messages: ${JSON.stringify(leaked.map(messageText))}`,
		);
	},
);

Then(
	"the started session carries no greeting before the operator speaks",
	function (this: EstelleWorld) {
		const runtime = this.interactiveSession!.runtime as SessionRuntimeView;
		const messages = runtime.session.messages;
		const firstUser = messages.findIndex((m) => m.role === "user");
		const opening = firstUser === -1 ? messages : messages.slice(0, firstUser);
		const visible = opening.filter(
			(m) => m.display !== false && messageText(m).trim().length > 0,
		);
		assert.equal(
			visible.length,
			0,
			`started session carries a greeting before the operator speaks: ${JSON.stringify(
				visible.map(messageText),
			)}`,
		);
	},
);
