import assert from "node:assert/strict";
import { Given, Then, When } from "@cucumber/cucumber";
import type { EstelleWorld } from "../support/world.js";

Given(
	"a started Estelle session with the Shipshape plugin installed",
	async function (this: EstelleWorld) {
		await this.ensureWorkspace();
	},
);

Given("the active seat is a Crew hand", async function (this: EstelleWorld) {
	const estelle = await this.ensureWorkspace();
	this.seat = estelle.selectSeat("crew", "Belka");
});

Given(
	"the active seat is the Quartermaster {string}",
	async function (this: EstelleWorld, name: string) {
		const estelle = await this.ensureWorkspace();
		this.seat = estelle.selectSeat("quartermaster", name);
	},
);

When(
	"the Crew hand writes {string} in the running session",
	async function (this: EstelleWorld, path: string) {
		await this.runningSessionToolCall("write", {
			path,
			content: "estelle verification\n",
		});
	},
);

When(
	"{word} writes {string} in the running session",
	async function (this: EstelleWorld, _name: string, path: string) {
		await this.runningSessionToolCall("write", {
			path,
			content: "estelle verification\n",
		});
	},
);

Then("the running session allows the write", function (this: EstelleWorld) {
	assert.ok(this.result, "no write was attempted");
	assert.equal(
		this.result.allowed,
		true,
		`write was blocked: ${this.result.reason ?? ""}`,
	);
});

Then("the running session blocks the write", function (this: EstelleWorld) {
	assert.ok(this.result, "no write was attempted");
	assert.equal(
		this.result.allowed,
		false,
		"write was allowed but should have been blocked",
	);
});

Then(
	"the block reason carries the Shipshape plugin's denial {string}",
	function (this: EstelleWorld, denial: string) {
		const reason = this.result?.reason ?? "";
		assert.ok(
			reason.includes(denial),
			`reason did not carry the plugin's denial "${denial}": ${reason}`,
		);
	},
);

Then(
	"the block reason names the Captain's write scope",
	function (this: EstelleWorld) {
		const reason = this.result?.reason ?? "";
		assert.ok(
			reason.includes("Captain"),
			`reason did not name the Captain: ${reason}`,
		);
		assert.ok(
			/specif|assets|CAPTAIN\.md|watchbill/.test(reason),
			`reason did not name the Captain's write scope: ${reason}`,
		);
	},
);
