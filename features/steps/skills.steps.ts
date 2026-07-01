import assert from "node:assert/strict";
import { Then } from "@cucumber/cucumber";
import type { EstelleWorld } from "../support/world.js";

Then(
	"the {string} skill is present",
	function (this: EstelleWorld, name: string) {
		const present = new Set(this.launched!.skills.map((s) => s.name));
		assert.ok(
			present.has(name),
			`skill "${name}" is not present; present: ${[...present].join(", ")}`,
		);
	},
);
