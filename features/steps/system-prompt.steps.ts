import assert from "node:assert/strict";
import { Then } from "@cucumber/cucumber";
import type { EstelleWorld } from "../support/world.js";

Then(
	"the seat system prompt addresses the operator as {string}",
	function (this: EstelleWorld, address: string) {
		const prompt = this.launched!.systemPrompt();
		assert.ok(
			prompt.includes(address),
			`seat system prompt does not address the operator as "${address}"`,
		);
	},
);
