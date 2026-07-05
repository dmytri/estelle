import assert from "node:assert/strict";
import { join } from "node:path";
import { Given, Then, When } from "@cucumber/cucumber";

/**
 * Verification for the pi-open-plugin-shim agent-definition seam.
 *
 * Drives the shim against real fixture open-plugins on disk. One fixture ships
 * a real `agents/` directory holding "qm.md" with YAML frontmatter and a prompt
 * body; the other ships no agents directory. The shim reports the plugin's
 * agents from what is really on disk, so this coverage exercises the true
 * parsing path rather than a mocked read.
 *
 * State lives on the per-scenario Cucumber world, so the scenarios stay
 * independent and parallel-safe. The fixtures are read-only, so no scenario
 * creates or mutates a real resource and no teardown is required.
 */
interface ReportedAgent {
	name: string;
	prompt: string;
}

interface AgentsShim {
	reportAgents(): ReportedAgent[];
}

interface AgentsShimWorld {
	agentsShim?: AgentsShim;
	reportedAgents?: ReportedAgent[];
}

const FIXTURES_DIR = join(__dirname, "..", "support", "fixtures");
const AGENTS_PLUGIN_DIR = join(FIXTURES_DIR, "agents-plugin");
const AGENTS_EMPTY_PLUGIN_DIR = join(FIXTURES_DIR, "agents-empty-plugin");

Given(
	"the shim runs an open-plugin with an agent {string} described as {string} whose prompt is {string}",
	async function (
		this: AgentsShimWorld,
		_name: string,
		_description: string,
		_prompt: string,
	) {
		const { loadOpenPlugin } = await import("../../src/index.js");
		this.agentsShim = loadOpenPlugin(
			AGENTS_PLUGIN_DIR,
		) as unknown as AgentsShim;
		this.reportedAgents = undefined;
	},
);

Given(
	"the shim runs an open-plugin with no agents directory",
	async function (this: AgentsShimWorld) {
		const { loadOpenPlugin } = await import("../../src/index.js");
		this.agentsShim = loadOpenPlugin(
			AGENTS_EMPTY_PLUGIN_DIR,
		) as unknown as AgentsShim;
		this.reportedAgents = undefined;
	},
);

When("the shim reports the plugin's agents", function (this: AgentsShimWorld) {
	assert.ok(this.agentsShim, "no shim loaded");
	this.reportedAgents = this.agentsShim.reportAgents();
});

Then(
	"the reported agents include an agent named {string}",
	function (this: AgentsShimWorld, name: string) {
		assert.ok(this.reportedAgents, "no agents were reported");
		assert.ok(
			this.reportedAgents.some((agent) => agent.name === name),
			`reported agents did not include "${name}": ${JSON.stringify(
				this.reportedAgents,
			)}`,
		);
	},
);

Then(
	"the {string} agent's prompt is {string}",
	function (this: AgentsShimWorld, name: string, prompt: string) {
		assert.ok(this.reportedAgents, "no agents were reported");
		const agent = this.reportedAgents.find((entry) => entry.name === name);
		assert.ok(agent, `reported agents did not include "${name}"`);
		assert.equal(
			agent.prompt,
			prompt,
			`"${name}" agent's prompt was not "${prompt}": ${JSON.stringify(
				agent.prompt,
			)}`,
		);
	},
);

Then("the reported agents are empty", function (this: AgentsShimWorld) {
	assert.ok(this.reportedAgents, "agents were not reported");
	assert.equal(
		this.reportedAgents.length,
		0,
		`reported agents were not empty: ${JSON.stringify(this.reportedAgents)}`,
	);
});
