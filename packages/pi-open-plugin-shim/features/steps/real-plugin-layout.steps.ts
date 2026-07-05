import { join } from "node:path";
import { Given } from "@cucumber/cucumber";
import type { OpenPluginShim, WriteCustodyDecision } from "../../src/index.js";

/**
 * Verification for the pi-open-plugin-shim real-open-plugin-layout seam.
 *
 * A real open-plugin declares its components as directories, not manifest
 * fields. Hooks live in "hooks/hooks.json" under a top-level "hooks" key, and
 * agents and commands live in their own directories. These fixtures are shaped
 * like real open-plugins: their manifests declare no component fields. The shim
 * must discover the components by convention from what is really on disk, so
 * this coverage exercises the true discovery path rather than a mocked read.
 *
 * State lives on the per-scenario Cucumber world, so the scenarios stay
 * independent and parallel-safe. The fixtures are read-only, so no scenario
 * creates or mutates a real resource and no teardown is required.
 */
interface ReportedAgent {
	name: string;
	prompt: string;
}

interface LayoutShimWorld {
	shim?: OpenPluginShim;
	role?: string;
	decision?: WriteCustodyDecision;
	denialMessage?: string;
	agentsShim?: { reportAgents(): ReportedAgent[] };
	reportedAgents?: ReportedAgent[];
	commandsShim?: { reportCommands(): string[] };
	reportedCommands?: string[];
}

const FIXTURES_DIR = join(__dirname, "..", "support", "fixtures");
const HOOKS_LAYOUT_PLUGIN_DIR = join(FIXTURES_DIR, "real-layout-hooks-plugin");
const COMPONENTS_LAYOUT_PLUGIN_DIR = join(
	FIXTURES_DIR,
	"real-layout-components-plugin",
);

const DENIAL_MESSAGE = 'denies role "crew" writing under "features"';

Given(
	"the shim runs an open-plugin whose manifest declares no hooks and whose {string} nests a write hook under a top-level {string} key, denying the role {string} writing under {string}",
	async function (
		this: LayoutShimWorld,
		_hooksFile: string,
		_hooksKey: string,
		_role: string,
		_denied: string,
	) {
		const { loadOpenPlugin } = await import("../../src/index.js");
		this.shim = loadOpenPlugin(HOOKS_LAYOUT_PLUGIN_DIR);
		this.role = undefined;
		this.decision = undefined;
		this.denialMessage = DENIAL_MESSAGE;
	},
);

Given(
	"the shim runs an open-plugin whose manifest declares no components and which ships an agent {string} and a command {string}",
	async function (this: LayoutShimWorld, _agent: string, _command: string) {
		const { loadOpenPlugin } = await import("../../src/index.js");
		const shim = loadOpenPlugin(COMPONENTS_LAYOUT_PLUGIN_DIR);
		this.agentsShim = shim;
		this.commandsShim = shim;
		this.reportedAgents = undefined;
		this.reportedCommands = undefined;
	},
);
