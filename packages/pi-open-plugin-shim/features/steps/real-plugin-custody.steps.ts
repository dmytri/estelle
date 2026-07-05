import assert from "node:assert/strict";
import { join } from "node:path";
import { Given, Then, When } from "@cucumber/cucumber";
import type { OpenPluginShim, WriteCustodyDecision } from "../../src/index.js";

/**
 * Verification for the pi-open-plugin-shim running a real Shipshape hook.
 *
 * Drives the shim against a real fixture open-plugin whose write hook is a real
 * copy of the Shipshape write-custody script. The plugin's hooks.json references
 * that script with a quoted "${PLUGIN_ROOT}" command, so the shim must strip the
 * quotes and resolve the plugin root to spawn it. The real script reads the
 * project's RIGGING.md for its directory scopes, so the shim must run the hook
 * with the project as its working directory. This coverage exercises the true
 * custody path against the real script rather than a mocked decision.
 *
 * The role's runtime identity is the "shipshape:<role>" agent_type the real
 * script keys off, so the step supplies that concrete identity for the domain
 * role. The block and allow assertions are shared with the write-custody steps
 * through the per-scenario Cucumber world. State lives on the per-scenario world
 * and both fixtures are read-only, so the scenarios stay independent and
 * parallel-safe and no scenario creates or mutates a real resource.
 */
interface RealCustodyShimWorld {
	shim?: OpenPluginShim;
	role?: string;
	projectDir?: string;
	decision?: WriteCustodyDecision;
	denialMessage?: string;
}

const FIXTURES_DIR = join(__dirname, "..", "support", "fixtures");
const REAL_CUSTODY_PLUGIN_DIR = join(FIXTURES_DIR, "real-custody-plugin");
const REAL_CUSTODY_PROJECT_DIR = join(FIXTURES_DIR, "real-custody-project");

Given(
	"the shim runs an open-plugin whose write hook is the real Shipshape write-custody script, its hooks.json command quoted and rooted at {string}",
	async function (this: RealCustodyShimWorld, _pluginRoot: string) {
		const { loadOpenPlugin } = await import("../../src/index.js");
		this.shim = loadOpenPlugin(REAL_CUSTODY_PLUGIN_DIR);
		this.role = undefined;
		this.projectDir = undefined;
		this.decision = undefined;
		this.denialMessage = undefined;
	},
);

Given(
	"a project whose RIGGING.md scopes implementation to {string} and specs to {string}",
	function (this: RealCustodyShimWorld, _impl: string, _specs: string) {
		this.projectDir = REAL_CUSTODY_PROJECT_DIR;
	},
);

Given(
	"the host acts as the role {string} in that project",
	function (this: RealCustodyShimWorld, role: string) {
		this.role = `shipshape:${role}`;
	},
);

When(
	"a write to {string} in that project is attempted",
	async function (this: RealCustodyShimWorld, path: string) {
		assert.ok(this.shim, "no shim loaded");
		assert.ok(this.projectDir, "no project set");
		this.decision = await this.shim.checkWrite(
			this.role,
			path,
			this.projectDir,
		);
	},
);

Then(
	"the block reason carries {string}",
	function (this: RealCustodyShimWorld, expected: string) {
		const reason = this.decision?.reason ?? "";
		assert.ok(
			reason.includes(expected),
			`block reason did not carry the expected message: ${reason}`,
		);
	},
);
