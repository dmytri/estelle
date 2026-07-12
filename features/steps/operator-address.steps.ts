import assert from "node:assert/strict";
import { Then, When } from "@cucumber/cucumber";
import type { ToolCallEvent } from "@earendil-works/pi-coding-agent";
import type { EstelleWorld } from "../support/world.js";

// The operator-address scenarios drive the running session's real tool_call
// seam, the path a seat takes when it acts. A live seat reaches the operator by
// calling the model-reachable "address-operator" tool, not the launch-time
// sendToOperator test method. Estelle must gate the address on the seat: the
// Captain's message is delivered into the running session and allowed, and an
// internal seat is blocked there. Everything is observed on real session state:
// the running session's own live message list and the gate outcome.

interface MessageView {
	role: string;
	content?: unknown;
}

interface AddressSessionView {
	messages: MessageView[];
	extensionRunner: {
		emitToolCall(
			event: ToolCallEvent,
		): Promise<{ block?: boolean; reason?: string } | undefined>;
	};
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

function addressSession(world: EstelleWorld): AddressSessionView {
	assert.ok(world.launched, "no started Estelle session");
	return world.launched.session as unknown as AddressSessionView;
}

let addressSeq = 0;

// Drive the seat's own address action through the running session's real
// tool_call seam, the live extension runner. Records the gate outcome as the
// observable custody decision, the same shape the write-custody scenarios read.
async function addressOperator(
	world: EstelleWorld,
	message: string,
): Promise<void> {
	addressSeq += 1;
	const outcome = await addressSession(world).extensionRunner.emitToolCall({
		type: "tool_call",
		toolCallId: `estelle-address-${addressSeq}`,
		toolName: "address-operator",
		input: { message },
	} as ToolCallEvent);
	world.result = { allowed: !outcome?.block, reason: outcome?.reason };
}

When(
	"Bonny addresses the operator with {string} in the running session",
	async function (this: EstelleWorld, message: string) {
		await addressOperator(this, message);
	},
);

Then(
	"the operator receives the message {string} in the running session",
	function (this: EstelleWorld, message: string) {
		const delivered = addressSession(this)
			.messages.map(messageText)
			.filter((text) => text.includes(message));
		assert.ok(
			delivered.length > 0,
			`the operator never received "${message}" in the running session; messages: ${JSON.stringify(
				addressSession(this).messages.map(messageText),
			)}`,
		);
	},
);

When(
	"Misson attempts to address the operator in the running session",
	async function (this: EstelleWorld) {
		await addressOperator(this, "Course laid in.");
	},
);

Then(
	"the running session blocks the operator address",
	function (this: EstelleWorld) {
		assert.ok(this.result, "no operator address was attempted");
		assert.equal(
			this.result.allowed,
			false,
			"the operator address was allowed but should have been blocked",
		);
	},
);
