import assert from "node:assert/strict";
import { join } from "node:path";
import { Given, Then } from "@cucumber/cucumber";
import type { OpenPluginShim, WriteCustodyDecision } from "../../src/index.js";

/**
 * Verification for the pi-open-plugin-shim generic hook-dispatch seam.
 *
 * Each scenario drives the shim against a real fixture open-plugin on disk
 * whose hook scripts are real executables. The shim matches the write tool
 * call against the plugin's own matcher patterns, runs every hook a matched
 * entry stacks, and honours each real exit code, so this coverage exercises
 * the true dispatch path rather than a mocked decision.
 *
 * The write action and the block/allow assertions are shared with the
 * write-custody steps through the per-scenario Cucumber world. The role step
 * is shared too. The fixtures are read-only, so no scenario creates or mutates
 * a real resource and no teardown is required.
 */
interface DispatchShimWorld {
	shim?: OpenPluginShim;
	role?: string;
	decision?: WriteCustodyDecision;
	denialMessage?: string;
}

const FIXTURES_DIR = join(__dirname, "..", "support", "fixtures");

const MULTI_MATCHER_PLUGIN_DIR = join(FIXTURES_DIR, "dispatch-multi-matcher");
const STACKED_HOOKS_PLUGIN_DIR = join(FIXTURES_DIR, "dispatch-stacked-hooks");
const NO_MATCH_PLUGIN_DIR = join(FIXTURES_DIR, "dispatch-no-match");

const STACKED_DENIAL_MESSAGE = "stacked custody hook denies the write";

Given(
	"the shim runs an open-plugin whose matcher {string} carries a hook that denies the write",
	async function (this: DispatchShimWorld, _matcher: string) {
		const { loadOpenPlugin } = await import("../../src/index.js");
		this.shim = loadOpenPlugin(MULTI_MATCHER_PLUGIN_DIR);
		this.role = undefined;
		this.decision = undefined;
		this.denialMessage = undefined;
	},
);

Given(
	"the shim runs an open-plugin whose write matcher stacks a hook that permits and a hook that denies",
	async function (this: DispatchShimWorld) {
		const { loadOpenPlugin } = await import("../../src/index.js");
		this.shim = loadOpenPlugin(STACKED_HOOKS_PLUGIN_DIR);
		this.role = undefined;
		this.decision = undefined;
		this.denialMessage = STACKED_DENIAL_MESSAGE;
	},
);

Given(
	"the shim runs an open-plugin whose only matcher is {string}",
	async function (this: DispatchShimWorld, _matcher: string) {
		const { loadOpenPlugin } = await import("../../src/index.js");
		this.shim = loadOpenPlugin(NO_MATCH_PLUGIN_DIR);
		this.role = undefined;
		this.decision = undefined;
		this.denialMessage = undefined;
	},
);

Then(
	"the block reason carries the denying hook's message",
	function (this: DispatchShimWorld) {
		const expected = this.denialMessage ?? "";
		assert.ok(expected, "no denial message expected for this scenario");
		const reason = this.decision?.reason ?? "";
		assert.ok(
			reason.includes(expected),
			`block reason did not carry the denying hook message: ${reason}`,
		);
	},
);
