import assert from "node:assert/strict";
import { Given, Then, When } from "@cucumber/cucumber";
import type { EstelleWorld } from "../support/world.js";

Given("a fresh workspace", function (this: EstelleWorld) {
	// The project repository at process.cwd() is the workspace under test.
});

When(
	"the operator runs {string}",
	async function (this: EstelleWorld, command: string) {
		assert.equal(command, "npx @dk/estelle");
		this.launched = await this.ensureLaunched();
	},
);

Then(
	"the pi session starts with the {string} extension loaded",
	function (this: EstelleWorld, name: string) {
		assert.ok(this.launched, "Estelle did not launch");
		assert.ok(this.launched.session, "no pi session started");
		assert.ok(
			this.launched.extensions.includes(name),
			`extension "${name}" not loaded; loaded: ${this.launched.extensions.join(", ")}`,
		);
	},
);

Then(
	"the active seat is the Captain {string}",
	async function (this: EstelleWorld, name: string) {
		// Captain is the launch default; this asserts that default rather than
		// selecting it. Other roles are selected explicitly in their own steps.
		await this.ensureWorkspace();
		const seat = this.launched!.seat();
		assert.equal(seat.role, "captain");
		assert.equal(seat.name, name);
	},
);

Given("Estelle has launched", async function (this: EstelleWorld) {
	// Launch in a disposable workspace so authoring and other side-effecting
	// scenarios never read or write the real repository. Read-only scenarios
	// see the same shipped assets, mirrored into the workspace.
	this.launched = await this.ensureWorkspace();
});

When(
	"the operator lists the available commands",
	function (this: EstelleWorld) {
		this.commands = this.launched!.commands;
	},
);

Then(
	"the commands {string}, {string}, {string}, {string}, and {string} are present",
	function (
		this: EstelleWorld,
		a: string,
		b: string,
		c: string,
		d: string,
		e: string,
	) {
		const present = new Set(this.commands ?? []);
		for (const command of [a, b, c, d, e]) {
			assert.ok(
				present.has(command),
				`command "${command}" missing; present: ${[...present].join(", ")}`,
			);
		}
	},
);

Then(
	"the skills {string}, {string}, {string}, {string}, and {string} are present",
	function (
		this: EstelleWorld,
		a: string,
		b: string,
		c: string,
		d: string,
		e: string,
	) {
		const present = new Set(this.launched!.skills.map((s) => s.name));
		for (const skill of [a, b, c, d, e]) {
			assert.ok(
				present.has(skill),
				`skill "${skill}" missing; present: ${[...present].join(", ")}`,
			);
		}
	},
);
