import assert from "node:assert/strict";
import { join } from "node:path";
import { Given, Then, When } from "@cucumber/cucumber";

/**
 * Verification for the pi-open-plugin-shim read-custody seam.
 *
 * Drives the shim against a real fixture open-plugin on disk whose
 * `hooks/read-custody` script is a real executable. The shim invokes that
 * script and honours its real exit code, so this coverage exercises the true
 * custody path rather than a mocked decision.
 *
 * The role and denial-message steps are shared with the write-custody steps
 * through the per-scenario Cucumber world. The fixture is read-only, so no
 * scenario creates or mutates a real resource and no teardown is required.
 */
interface ReadCustodyDecision {
	allowed: boolean;
	reason?: string;
}

interface ReadShimWorld {
	shim?: {
		checkRead(
			role: string | undefined,
			path: string,
		): Promise<ReadCustodyDecision>;
	};
	role?: string;
	decision?: ReadCustodyDecision;
	denialMessage?: string;
}

const FIXTURE_PLUGIN_DIR = join(
	__dirname,
	"..",
	"support",
	"fixtures",
	"custody-plugin",
);

const DENIAL_MESSAGE = 'denies role "crew" reading "CAPTAIN.md"';

Given(
	"the shim runs an open-plugin whose read-custody hook denies the role {string} reading {string} and permits the role {string}",
	async function (
		this: ReadShimWorld,
		_denied: string,
		_path: string,
		_permitted: string,
	) {
		const { loadOpenPlugin } = await import("../../src/index.js");
		this.shim = loadOpenPlugin(FIXTURE_PLUGIN_DIR) as ReadShimWorld["shim"];
		this.role = undefined;
		this.decision = undefined;
		this.denialMessage = DENIAL_MESSAGE;
	},
);

When(
	"a read tool call opens {string}",
	async function (this: ReadShimWorld, path: string) {
		assert.ok(this.shim, "no shim loaded");
		this.decision = await this.shim.checkRead(this.role, path);
	},
);

Then("the shim blocks the read", function (this: ReadShimWorld) {
	assert.ok(this.decision, "no read was attempted");
	assert.equal(
		this.decision.allowed,
		false,
		`read was allowed but should have been blocked: ${this.decision.reason ?? ""}`,
	);
});

Then("the shim allows the read", function (this: ReadShimWorld) {
	assert.ok(this.decision, "no read was attempted");
	assert.equal(
		this.decision.allowed,
		true,
		`read was blocked: ${this.decision.reason ?? ""}`,
	);
});
