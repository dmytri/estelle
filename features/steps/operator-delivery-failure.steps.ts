import assert from "node:assert/strict";
import { Then, When } from "@cucumber/cucumber";
import type { ToolCallEvent } from "@earendil-works/pi-coding-agent";
import type { EstelleWorld } from "../support/world.js";

// Read the text of a running-session message, whether its content is a plain
// string or an array of text parts.
function messageText(message: { content?: unknown }): string {
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

function sessionMessages(world: EstelleWorld): { content?: unknown }[] {
	return (
		world.launched!.session as unknown as { messages: { content?: unknown }[] }
	).messages;
}

When(
	"{word} sends a message to the operator",
	function (this: EstelleWorld, _name: string) {
		this.result = this.launched!.sendToOperator("Course laid in.");
	},
);

When("the pending deliveries settle", async function (this: EstelleWorld) {
	await this.launched!.settleDeliveries();
});

Then("Estelle records one delivery failure", function (this: EstelleWorld) {
	const failures = this.launched!.deliveryFailures();
	assert.equal(
		failures,
		1,
		`expected one delivery failure, recorded ${failures}`,
	);
});

Then(
	"Estelle reports that only the Captain addresses the operator",
	function (this: EstelleWorld) {
		const reason = this.result?.reason ?? "";
		assert.ok(
			reason.includes("only the Captain addresses the operator"),
			`reason did not state the rule: ${reason}`,
		);
	},
);

// Scenario: A failed operator delivery in the running session surfaces in
// session state. The seat addresses the operator through the running session's
// real tool_call seam, the delivery fails, and Estelle records the failure in
// its own session state where it is observable without the test-facing
// deliveryFailures() counter. The failing path does not exist yet; these steps
// drive it as the contract Crew satisfies.
let addressFailSeq = 0;
const FAILURE_MARK = /deliver\w*\s+fail|fail\w*\s+deliver|delivery failure/i;

When(
	"Bonny addresses the operator in the running session and the delivery fails",
	async function (this: EstelleWorld) {
		addressFailSeq += 1;
		await this.launched!.session.extensionRunner.emitToolCall({
			type: "tool_call",
			toolCallId: `estelle-address-fail-${addressFailSeq}`,
			toolName: "address-operator",
			input: { message: "Course laid in.", failDelivery: true },
		} as unknown as ToolCallEvent);
		await this.launched!.settleDeliveries();
	},
);

Then(
	"the running session records the delivery failure in its own session state",
	function (this: EstelleWorld) {
		const recorded = sessionMessages(this)
			.map(messageText)
			.filter((text) => FAILURE_MARK.test(text));
		assert.ok(
			recorded.length > 0,
			`no delivery-failure record reached the running session's own state; messages: ${JSON.stringify(
				sessionMessages(this).map(messageText),
			)}`,
		);
	},
);

Then(
	"the recorded failure is observable without a test-facing method",
	function (this: EstelleWorld) {
		// The failure is read from the running session's own real message state,
		// not from the test-facing deliveryFailures() counter.
		const recorded = sessionMessages(this)
			.map(messageText)
			.filter((text) => FAILURE_MARK.test(text));
		assert.ok(
			recorded.length > 0,
			"the delivery failure was not observable in the running session's own state",
		);
	},
);
