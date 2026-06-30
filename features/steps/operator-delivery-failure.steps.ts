import assert from "node:assert/strict";
import { Then, When } from "@cucumber/cucumber";
import type { EstelleWorld } from "../support/world.js";

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
