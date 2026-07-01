import assert from "node:assert/strict";
import { Given, Then, When } from "@cucumber/cucumber";
import type { EstelleWorld } from "../support/world.js";

Given(
	"Estelle has launched in a fresh workspace",
	async function (this: EstelleWorld) {
		await this.ensureFreshWorkspace();
	},
);

When(
	"Estelle installs the upstream skill package {string}",
	{ timeout: 120000 },
	async function (this: EstelleWorld, source: string) {
		await this.launched!.installSkill(source);
	},
);

When(
	"Estelle installs the pi extension package {string}",
	{ timeout: 120000 },
	async function (this: EstelleWorld, source: string) {
		await this.launched!.installExtension(source);
	},
);

Then(
	"the command {string} is present",
	function (this: EstelleWorld, command: string) {
		const present = new Set(this.launched!.commands);
		assert.ok(
			present.has(command),
			`command "${command}" is not present; present: ${[...present].join(", ")}`,
		);
	},
);
