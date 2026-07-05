import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { Given, Then, When } from "@cucumber/cucumber";
import type { EstelleWorld } from "../support/world.js";

Given(
	"the active seat is the Crew hand {string}",
	async function (this: EstelleWorld, name: string) {
		const estelle = await this.ensureWorkspace();
		this.seat = estelle.selectSeat("crew", name);
	},
);

Given(
	"the active seat is the Quartermaster {string}",
	async function (this: EstelleWorld, name: string) {
		const estelle = await this.ensureWorkspace();
		this.seat = estelle.selectSeat("quartermaster", name);
	},
);

When(
	"{word} writes the file {string}",
	function (this: EstelleWorld, _name: string, path: string) {
		this.result = this.launched!.write(path, "estelle verification\n");
	},
);

When(
	"{word} attempts to write the file {string}",
	function (this: EstelleWorld, _name: string, path: string) {
		this.result = this.launched!.write(path, "estelle verification\n");
	},
);

Then("Estelle allows the write", function (this: EstelleWorld) {
	assert.ok(this.result, "no write was attempted");
	assert.equal(
		this.result.allowed,
		true,
		`write was blocked: ${this.result.reason ?? ""}`,
	);
});

Then("the file {string} exists", function (this: EstelleWorld, path: string) {
	assert.ok(
		existsSync(join(this.workspaceDir!, path)),
		`file "${path}" was not written`,
	);
});

Then("Estelle blocks the write", function (this: EstelleWorld) {
	assert.ok(this.result, "no write was attempted");
	assert.equal(
		this.result.allowed,
		false,
		"write was allowed but should have been blocked",
	);
});

Then(
	"Estelle reports that the Crew may write only {string}",
	function (this: EstelleWorld, scope: string) {
		assert.ok(
			this.result?.reason?.includes(scope),
			`reason did not name "${scope}": ${this.result?.reason ?? ""}`,
		);
	},
);

Then(
	"Estelle reports that the Captain writes specs, assets, {string}, and {string}",
	function (this: EstelleWorld, a: string, b: string) {
		const reason = this.result?.reason ?? "";
		assert.ok(reason.includes(a), `reason did not name "${a}": ${reason}`);
		assert.ok(reason.includes(b), `reason did not name "${b}": ${reason}`);
	},
);

Then(
	"Estelle reports that only the Captain may write {string}",
	function (this: EstelleWorld, target: string) {
		assert.ok(
			this.result?.reason?.includes(target),
			`reason did not name "${target}": ${this.result?.reason ?? ""}`,
		);
	},
);
