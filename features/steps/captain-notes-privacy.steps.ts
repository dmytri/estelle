import assert from "node:assert/strict";
import { Given, Then, When } from "@cucumber/cucumber";
import { EstelleWorld } from "../support/world.js";

const CAPTAIN_NOTES = "# Captain notes\n\nPrivate course and intent.\n";

Given("a project with a {string} file", async function (this: EstelleWorld, path: string) {
	await this.ensureWorkspace({ [path]: CAPTAIN_NOTES });
});

Given("the active seat is the Boatswain {string}", async function (this: EstelleWorld, name: string) {
	const estelle = await this.ensureWorkspace();
	this.seat = estelle.selectSeat("boatswain", name);
});

When("{word} reads {string}", function (this: EstelleWorld, _name: string, path: string) {
	this.result = this.launched!.read(path);
});

When("{word} attempts to read {string}", function (this: EstelleWorld, _name: string, path: string) {
	this.result = this.launched!.read(path);
});

Then("Estelle allows the read", function (this: EstelleWorld) {
	assert.ok(this.result, "no read was attempted");
	assert.equal(this.result.allowed, true, `read was blocked: ${this.result.reason ?? ""}`);
});

Then("the contents of {string} are returned", function (this: EstelleWorld, _path: string) {
	assert.equal(this.result?.contents, CAPTAIN_NOTES, "the file contents were not returned");
});

Then("Estelle blocks the read", function (this: EstelleWorld) {
	assert.ok(this.result, "no read was attempted");
	assert.equal(this.result.allowed, false, "read was allowed but should have been blocked");
});

Then(
	"Estelle reports that {string} is private to the Captain",
	function (this: EstelleWorld, target: string) {
		const reason = this.result?.reason ?? "";
		assert.ok(reason.includes(target), `reason did not name "${target}": ${reason}`);
		assert.ok(reason.includes("private to the Captain"), `reason did not state privacy: ${reason}`);
	},
);
