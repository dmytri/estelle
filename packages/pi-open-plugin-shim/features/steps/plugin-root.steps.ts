import { join } from "node:path";
import { Given } from "@cucumber/cucumber";
import type { OpenPluginShim, WriteCustodyDecision } from "../../src/index.js";

/**
 * Verification for the pi-open-plugin-shim plugin-root resolution seam.
 *
 * Drives the shim against a real fixture open-plugin whose write hook command
 * is authored with the neutral "${PLUGIN_ROOT}" variable and whose real script
 * lives at hooks/scripts/write-custody. The shim must resolve ${PLUGIN_ROOT} to
 * the plugin directory to spawn the real script, so this coverage exercises the
 * true resolution path rather than a mocked decision.
 *
 * The role action, write action, and block/allow assertions are shared with the
 * write-custody steps through the per-scenario Cucumber world. The fixture is
 * read-only, so no scenario creates or mutates a real resource and no teardown
 * is required.
 */
interface PluginRootShimWorld {
	shim?: OpenPluginShim;
	role?: string;
	decision?: WriteCustodyDecision;
	denialMessage?: string;
}

const PLUGIN_ROOT_PLUGIN_DIR = join(
	__dirname,
	"..",
	"support",
	"fixtures",
	"plugin-root-plugin",
);

Given(
	"the shim runs an open-plugin whose write hook command is {string} and denies the role {string} writing under {string}",
	async function (
		this: PluginRootShimWorld,
		_command: string,
		_role: string,
		_under: string,
	) {
		const { loadOpenPlugin } = await import("../../src/index.js");
		this.shim = loadOpenPlugin(PLUGIN_ROOT_PLUGIN_DIR);
		this.role = undefined;
		this.decision = undefined;
		this.denialMessage = undefined;
	},
);
