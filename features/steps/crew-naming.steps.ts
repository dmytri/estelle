import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { Given, Then, When } from "@cucumber/cucumber";
import type { EstelleWorld } from "../support/world.js";

Given(
	"the survivor roster in {string}",
	function (this: EstelleWorld, path: string) {
		const roster = JSON.parse(readFileSync(path, "utf8")) as {
			survivors: string[];
		};
		this.roster = roster.survivors;
		assert.ok(
			Array.isArray(this.roster) && this.roster.length > 0,
			"survivor roster is empty",
		);
	},
);

When("Estelle seats a new Crew hand", async function (this: EstelleWorld) {
	const estelle = await this.ensureLaunched();
	this.seat = estelle.seatCrew();
});

Then(
	"the hand name appears in {string}",
	function (this: EstelleWorld, path: string) {
		const roster = JSON.parse(readFileSync(path, "utf8")) as {
			survivors: string[];
		};
		assert.ok(this.seat, "no Crew hand was seated");
		assert.ok(
			roster.survivors.includes(this.seat.name),
			`hand name "${this.seat.name}" is not in the survivor roster ${path}`,
		);
	},
);

Then("the Estelle extension assigns the name", function (this: EstelleWorld) {
	assert.ok(this.seat, "no Crew hand was seated");
	assert.equal(this.seat.role, "crew");
	assert.ok(this.seat.name.length > 0, "the seated Crew hand has no name");
});

Then(
	"the name is present before the hand first provider request",
	function (this: EstelleWorld) {
		assert.ok(this.seat, "no Crew hand was seated");
		assert.ok(this.seat.name.length > 0, "the seated Crew hand has no name");
		assert.equal(
			this.launched!.providerRequestCount(),
			0,
			"a provider request fired before the Crew name was assigned",
		);
	},
);
