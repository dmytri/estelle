import assert from "node:assert/strict";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Given, Then } from "@cucumber/cucumber";
import type { EstelleWorld } from "../support/world.js";

Given(
	"a fresh operator directory with no Estelle assets or installed skills",
	function (this: EstelleWorld) {
		// Bare directory an operator runs the package in: no assets/ travel with it
		// and no skills are installed. Isolate the agent dir too so no host-global
		// skill leaks in, making any skill present one the package itself serves.
		this.workspaceDir = mkdtempSync(join(tmpdir(), "estelle-builtin-"));
		// The isolated agent dir resolves the upstream Shipshape package from the
		// run's one shared clone: the package is ambient state here, and the skills
		// this scenario asserts are the ones the package itself serves.
		this.prepareAgentDir();
	},
);

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
