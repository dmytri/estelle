import assert from "node:assert/strict";
import { join } from "node:path";
import { Given, Then, When } from "@cucumber/cucumber";

/**
 * Verification for the pi-open-plugin-shim command-custody seam.
 *
 * Drives the shim against a real fixture open-plugin on disk whose
 * `hooks/command-custody` script is a real executable. The shim invokes that
 * script and honours its real exit code, so this coverage exercises the true
 * custody path rather than a mocked decision.
 *
 * The role and outcome steps are shared with the write-custody steps through
 * the per-scenario Cucumber world. The fixture is read-only, so no scenario
 * creates or mutates a real resource and no teardown is required.
 */
interface CommandCustodyDecision {
	allowed: boolean;
	reason?: string;
}

interface CommandShimWorld {
	shim?: {
		checkCommand(
			role: string | undefined,
			command: string,
		): Promise<CommandCustodyDecision>;
	};
	role?: string;
	decision?: CommandCustodyDecision;
	denialMessage?: string;
}

const FIXTURE_PLUGIN_DIR = join(
	__dirname,
	"..",
	"support",
	"fixtures",
	"custody-plugin",
);

const DENIAL_MESSAGE = 'lets only role "boatswain" commit';

Given(
	"the shim runs an open-plugin whose command-custody hook lets only the role {string} commit and denies every role a push",
	async function (this: CommandShimWorld, _role: string) {
		const { loadOpenPlugin } = await import("../../src/index.js");
		this.shim = loadOpenPlugin(FIXTURE_PLUGIN_DIR) as CommandShimWorld["shim"];
		this.role = undefined;
		this.decision = undefined;
		this.denialMessage = DENIAL_MESSAGE;
	},
);

When(
	"a Bash tool call runs {string}",
	async function (this: CommandShimWorld, command: string) {
		assert.ok(this.shim, "no shim loaded");
		this.decision = await this.shim.checkCommand(this.role, command);
	},
);

Then("the shim blocks the command", function (this: CommandShimWorld) {
	assert.ok(this.decision, "no command was attempted");
	assert.equal(
		this.decision.allowed,
		false,
		`command was allowed but should have been blocked: ${this.decision.reason ?? ""}`,
	);
});

Then("the shim allows the command", function (this: CommandShimWorld) {
	assert.ok(this.decision, "no command was attempted");
	assert.equal(
		this.decision.allowed,
		true,
		`command was blocked: ${this.decision.reason ?? ""}`,
	);
});
