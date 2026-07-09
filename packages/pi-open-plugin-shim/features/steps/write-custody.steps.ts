import assert from "node:assert/strict";
import { join } from "node:path";
import { Given, Then, When } from "@cucumber/cucumber";
import type { OpenPluginShim, WriteCustodyDecision } from "../../src/index.js";

/**
 * Verification for the pi-open-plugin-shim write-custody seam.
 *
 * Drives the shim against a real fixture open-plugin on disk whose
 * `hooks/write-custody` script is a real executable. The shim invokes that
 * script and honours its real exit code, so this coverage exercises the true
 * custody path rather than a mocked decision.
 *
 * State lives on the per-scenario Cucumber world, so the scenarios stay
 * independent and parallel-safe. The fixture is read-only, so no scenario
 * creates or mutates a real resource and no teardown is required.
 */
interface ShimWorld {
	shim?: OpenPluginShim;
	role?: string;
	decision?: WriteCustodyDecision;
	denialMessage?: string;
}

const FIXTURE_PLUGIN_DIR = join(
	__dirname,
	"..",
	"support",
	"fixtures",
	"custody-plugin",
);

const DENIAL_MESSAGE = 'denies role "crew" writing under "features"';

Given(
	"the shim runs an open-plugin whose write-custody hook denies the role {string} writing under {string} and permits it writing under {string}",
	async function (
		this: ShimWorld,
		_role: string,
		_denied: string,
		_permitted: string,
	) {
		const { loadOpenPlugin } = await import("../../src/index.js");
		this.shim = loadOpenPlugin(FIXTURE_PLUGIN_DIR);
		this.role = undefined;
		this.decision = undefined;
		this.denialMessage = DENIAL_MESSAGE;
	},
);

Given(
	"the host acts as the role {string}",
	function (this: ShimWorld, role: string) {
		this.role = role;
	},
);

Given("the host acts with no plugin role", function (this: ShimWorld) {
	this.role = undefined;
});

When(
	"a write to {string} is attempted",
	async function (this: ShimWorld, path: string) {
		assert.ok(this.shim, "no shim loaded");
		this.decision = await this.shim.checkWrite(this.role, path);
	},
);

When(
	"a write to {string} is synchronously attempted",
	function (this: ShimWorld, path: string) {
		// The synchronous seam: the shim runs the same real hook executable and
		// honours its real exit code, blocking until the decision returns.
		assert.ok(this.shim, "no shim loaded");
		this.decision = this.shim.checkWriteSync(this.role, path);
	},
);

Then("the shim blocks the write", function (this: ShimWorld) {
	assert.ok(this.decision, "no write was attempted");
	assert.equal(
		this.decision.allowed,
		false,
		`write was allowed but should have been blocked: ${this.decision.reason ?? ""}`,
	);
});

Then(
	"the block reason carries the hook's denial message",
	function (this: ShimWorld) {
		const expected = this.denialMessage ?? "";
		assert.ok(expected, "no denial message expected for this scenario");
		const reason = this.decision?.reason ?? "";
		assert.ok(
			reason.includes(expected),
			`block reason did not carry the hook denial message: ${reason}`,
		);
	},
);

Then("the shim allows the write", function (this: ShimWorld) {
	assert.ok(this.decision, "no write was attempted");
	assert.equal(
		this.decision.allowed,
		true,
		`write was blocked: ${this.decision.reason ?? ""}`,
	);
});
