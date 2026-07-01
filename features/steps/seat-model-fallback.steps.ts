import assert from "node:assert/strict";
import { Then } from "@cucumber/cucumber";
import type { EstelleWorld } from "../support/world.js";

Then(
	"the provider request uses an available model",
	function (this: EstelleWorld) {
		// A resolved pi model carries a provider and a bare id; its presence means
		// the registry could resolve it, so it is an available model. The fallback
		// must land on a real model, not the id the operator mistyped.
		const model = this.launched!.session.model;
		const actual = model ? `${model.provider}/${model.id}` : undefined;
		assert.ok(actual, "provider request uses no model");
		assert.notEqual(
			actual,
			this.requestedSeatModel,
			`provider request still uses the unavailable model "${this.requestedSeatModel}"`,
		);
	},
);

Then(
	"Estelle reports that the model {string} is unavailable",
	function (this: EstelleWorld, id: string) {
		const reported = this.launched!.unavailableModels();
		assert.ok(
			reported.includes(id),
			`Estelle did not report model "${id}" as unavailable; reported: ${reported.join(", ")}`,
		);
	},
);
