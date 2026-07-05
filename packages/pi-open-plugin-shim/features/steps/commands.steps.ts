import assert from "node:assert/strict";
import { join } from "node:path";
import { Given, Then, When } from "@cucumber/cucumber";

/**
 * Verification for the pi-open-plugin-shim command-registration seam.
 *
 * Drives the shim against real fixture open-plugins on disk. One fixture ships
 * a real `commands/` directory holding "status" and "doctor"; the other ships
 * no commands directory. The shim reports the plugin's commands from what is
 * really on disk, so this coverage exercises the true reporting path rather
 * than a mocked list.
 *
 * State lives on the per-scenario Cucumber world, so the scenarios stay
 * independent and parallel-safe. The fixtures are read-only, so no scenario
 * creates or mutates a real resource and no teardown is required.
 */
interface CommandsShim {
	reportCommands(): string[];
}

interface CommandsShimWorld {
	commandsShim?: CommandsShim;
	reportedCommands?: string[];
}

const FIXTURES_DIR = join(__dirname, "..", "support", "fixtures");
const COMMANDS_PLUGIN_DIR = join(FIXTURES_DIR, "commands-plugin");
const COMMANDS_EMPTY_PLUGIN_DIR = join(FIXTURES_DIR, "commands-empty-plugin");

Given(
	"the shim runs an open-plugin with the commands {string} and {string}",
	async function (this: CommandsShimWorld, _first: string, _second: string) {
		const { loadOpenPlugin } = await import("../../src/index.js");
		this.commandsShim = loadOpenPlugin(
			COMMANDS_PLUGIN_DIR,
		) as unknown as CommandsShim;
		this.reportedCommands = undefined;
	},
);

Given(
	"the shim runs an open-plugin with no commands directory",
	async function (this: CommandsShimWorld) {
		const { loadOpenPlugin } = await import("../../src/index.js");
		this.commandsShim = loadOpenPlugin(
			COMMANDS_EMPTY_PLUGIN_DIR,
		) as unknown as CommandsShim;
		this.reportedCommands = undefined;
	},
);

When(
	"the shim reports the plugin's commands",
	function (this: CommandsShimWorld) {
		assert.ok(this.commandsShim, "no shim loaded");
		this.reportedCommands = this.commandsShim.reportCommands();
	},
);

Then(
	"the reported commands include {string}",
	function (this: CommandsShimWorld, command: string) {
		assert.ok(this.reportedCommands, "no commands were reported");
		assert.ok(
			this.reportedCommands.includes(command),
			`reported commands did not include "${command}": ${JSON.stringify(
				this.reportedCommands,
			)}`,
		);
	},
);

Then("the reported commands are empty", function (this: CommandsShimWorld) {
	assert.ok(this.reportedCommands, "commands were not reported");
	assert.equal(
		this.reportedCommands.length,
		0,
		`reported commands were not empty: ${JSON.stringify(
			this.reportedCommands,
		)}`,
	);
});
