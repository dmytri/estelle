import assert from "node:assert/strict";
import { join } from "node:path";
import { Given, Then, When } from "@cucumber/cucumber";

/**
 * Verification for the pi-open-plugin-shim SessionStart seam.
 *
 * Each scenario drives the shim against a real fixture open-plugin whose
 * SessionStart hooks are real executables. One fixture stacks an orient hook and
 * a validate hook; one exits non-zero. The shim runs every SessionStart hook the
 * plugin stacks when a session starts and honours their real exit codes and real
 * stdout, so this coverage exercises the true lifecycle path rather than a mocked
 * decision. A SessionStart hook never gates the session.
 *
 * State lives on the per-scenario Cucumber world, so the scenarios stay
 * independent and parallel-safe. The fixtures are read-only, so no scenario
 * creates or mutates a real resource and no teardown is required.
 */
interface SessionStartResult {
	output: string;
}

interface SessionStartShim {
	runSessionStart(): Promise<SessionStartResult>;
}

interface SessionStartShimWorld {
	sessionShim?: SessionStartShim;
	sessionResult?: SessionStartResult;
}

const FIXTURES_DIR = join(__dirname, "..", "support", "fixtures");
const STACK_PLUGIN_DIR = join(FIXTURES_DIR, "sessionstart-stack");
const NONZERO_PLUGIN_DIR = join(FIXTURES_DIR, "sessionstart-nonzero");

async function loadSessionStartShim(dir: string): Promise<SessionStartShim> {
	const { loadOpenPlugin } = await import("../../src/index.js");
	return loadOpenPlugin(dir) as unknown as SessionStartShim;
}

Given(
	"the shim runs an open-plugin whose SessionStart entry stacks a hook that emits {string} and a hook that emits {string}",
	async function (
		this: SessionStartShimWorld,
		_first: string,
		_second: string,
	) {
		this.sessionShim = await loadSessionStartShim(STACK_PLUGIN_DIR);
		this.sessionResult = undefined;
	},
);

Given(
	"the shim runs an open-plugin whose SessionStart hook exits non-zero",
	async function (this: SessionStartShimWorld) {
		this.sessionShim = await loadSessionStartShim(NONZERO_PLUGIN_DIR);
		this.sessionResult = undefined;
	},
);

When("a pi session starts", async function (this: SessionStartShimWorld) {
	assert.ok(this.sessionShim, "no shim loaded");
	this.sessionResult = await this.sessionShim.runSessionStart();
});

Then(
	"the SessionStart hook output carries {string}",
	function (this: SessionStartShimWorld, expected: string) {
		assert.ok(this.sessionResult, "no session started");
		assert.ok(
			this.sessionResult.output.includes(expected),
			`SessionStart output did not carry "${expected}": ${this.sessionResult.output}`,
		);
	},
);

Then("the session is not blocked", function (this: SessionStartShimWorld) {
	assert.ok(
		this.sessionResult,
		"session did not start: the SessionStart hook blocked it",
	);
});
