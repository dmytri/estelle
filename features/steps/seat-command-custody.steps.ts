import assert from "node:assert/strict";
import { Then, When } from "@cucumber/cucumber";
import type { EstelleWorld } from "../support/world.js";

When(
	"{word} runs {string} in the running session",
	async function (this: EstelleWorld, _name: string, command: string) {
		await this.runningSessionToolCall("bash", { command });
	},
);

When(
	"the Crew hand runs {string} in the running session",
	async function (this: EstelleWorld, command: string) {
		await this.runningSessionToolCall("bash", { command });
	},
);

Then("the running session allows the command", function (this: EstelleWorld) {
	assert.ok(this.result, "no command was attempted");
	assert.equal(
		this.result.allowed,
		true,
		`command was blocked: ${this.result.reason ?? ""}`,
	);
});

Then("the running session blocks the command", function (this: EstelleWorld) {
	assert.ok(this.result, "no command was attempted");
	assert.equal(
		this.result.allowed,
		false,
		"command was allowed but should have been blocked",
	);
});
