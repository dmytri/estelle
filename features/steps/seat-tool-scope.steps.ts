import assert from "node:assert/strict";
import { Then, When } from "@cucumber/cucumber";
import type { EstelleWorld } from "../support/world.js";

When(
	"{word} sends a message to the operator",
	function (this: EstelleWorld, _name: string) {
		this.result = this.launched!.sendToOperator("Course laid in.");
	},
);

When(
	"{word} attempts to send a message to the operator",
	function (this: EstelleWorld, _name: string) {
		this.result = this.launched!.sendToOperator("Course laid in.");
	},
);

Then(
	"Estelle delivers the message to the operator",
	function (this: EstelleWorld) {
		assert.ok(this.result, "no message was sent");
		assert.equal(
			this.result.allowed,
			true,
			`message was blocked: ${this.result.reason ?? ""}`,
		);
	},
);

Then("Estelle blocks the message", function (this: EstelleWorld) {
	assert.ok(this.result, "no message was sent");
	assert.equal(
		this.result.allowed,
		false,
		"message was delivered but should have been blocked",
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
