import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { Given, Then, When } from "@cucumber/cucumber";
import type { EstelleWorld } from "../support/world.js";

const CAPTAIN_NOTES = "# Captain notes\n\nPrivate course and intent.\n";

Given(
	"a project with a {string} file",
	async function (this: EstelleWorld, path: string) {
		await this.ensureWorkspace({ [path]: CAPTAIN_NOTES });
	},
);

Given(
	"the active seat is the Boatswain {string}",
	async function (this: EstelleWorld, name: string) {
		const estelle = await this.ensureWorkspace();
		this.seat = estelle.selectSeat("boatswain", name);
	},
);

When(
	"{word} reads {string} in the running session",
	async function (this: EstelleWorld, _name: string, path: string) {
		await this.runningSessionToolCall("read", { path });
		if (this.result?.allowed) {
			this.result.contents = readFileSync(
				join(this.workspaceDir!, path),
				"utf8",
			);
		}
	},
);

Then("the running session allows the read", function (this: EstelleWorld) {
	assert.ok(this.result, "no read was attempted");
	assert.equal(
		this.result.allowed,
		true,
		`read was blocked: ${this.result.reason ?? ""}`,
	);
});

Then("the running session blocks the read", function (this: EstelleWorld) {
	assert.ok(this.result, "no read was attempted");
	assert.equal(
		this.result.allowed,
		false,
		"read was allowed but should have been blocked",
	);
});

Then(
	"the contents of {string} are returned",
	function (this: EstelleWorld, _path: string) {
		assert.equal(
			this.result?.contents,
			CAPTAIN_NOTES,
			"the file contents were not returned",
		);
	},
);
