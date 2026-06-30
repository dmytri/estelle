import assert from "node:assert/strict";
import { Given, Then, When } from "@cucumber/cucumber";
import type { EstelleWorld } from "../support/world.js";

Given(
	"Estelle config sets the Captain model to {string}",
	async function (this: EstelleWorld, id: string) {
		const estelle = await this.ensureWorkspace();
		estelle.setSeatModel("captain", id);
	},
);

Given(
	"Estelle config sets the Quartermaster model to {string}",
	async function (this: EstelleWorld, id: string) {
		const estelle = await this.ensureWorkspace();
		estelle.setSeatModel("quartermaster", id);
	},
);

When(
	"{word} begins a turn",
	async function (this: EstelleWorld, _name: string) {
		await this.launched!.beginTurn();
	},
);

Then(
	"the provider request uses the model {string}",
	function (this: EstelleWorld, id: string) {
		const actual = this.launched!.session.model?.id;
		assert.equal(
			actual,
			id,
			`active seat provider request uses model "${actual}", expected "${id}"`,
		);
	},
);
