import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { Then, When } from "@cucumber/cucumber";
import type { EstelleWorld } from "../support/world.js";

When(
	"the operator asks Estelle to create a skill named {string} with the body {string}",
	async function (this: EstelleWorld, name: string, body: string) {
		await this.launched!.createSkill(name, body);
	},
);

Then(
	"the {string} skill body is {string}",
	function (this: EstelleWorld, name: string, body: string) {
		const skill = this.launched!.skills.find((s) => s.name === name);
		assert.ok(skill, `skill "${name}" not loaded`);
		const contents = readFileSync(skill.filePath, "utf8");
		assert.ok(
			contents.includes(body),
			`skill "${name}" body did not include "${body}"; got:\n${contents}`,
		);
	},
);
