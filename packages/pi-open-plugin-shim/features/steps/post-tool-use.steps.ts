import assert from "node:assert/strict";
import { join } from "node:path";
import { Given, Then, When } from "@cucumber/cucumber";

/**
 * Verification for the pi-open-plugin-shim PostToolUse seam.
 *
 * Each scenario drives the shim against a real fixture open-plugin whose
 * PostToolUse hook is a real executable. One fixture emits "batch shipped" on a
 * push, one exits non-zero, and one carries only a Bash matcher. The shim runs
 * the matching PostToolUse hooks after the tool call and honours their real
 * exit codes and real stdout, so this coverage exercises the true after-the-fact
 * path rather than a mocked decision. A PostToolUse hook never gates the call.
 *
 * State lives on the per-scenario Cucumber world, so the scenarios stay
 * independent and parallel-safe. The fixtures are read-only, so no scenario
 * creates or mutates a real resource and no teardown is required.
 */
interface PostToolUseResult {
	output: string;
}

interface PostToolUseShim {
	runPostToolUse(
		toolName: string,
		toolInput: Record<string, string>,
	): Promise<PostToolUseResult>;
}

interface PostToolUseShimWorld {
	postShim?: PostToolUseShim;
	postResult?: PostToolUseResult;
}

const FIXTURES_DIR = join(__dirname, "..", "support", "fixtures");
const EMIT_PLUGIN_DIR = join(FIXTURES_DIR, "posttooluse-emit");
const NONZERO_PLUGIN_DIR = join(FIXTURES_DIR, "posttooluse-nonzero");
const ONLY_BASH_PLUGIN_DIR = join(FIXTURES_DIR, "posttooluse-only-bash");

async function loadPostToolUseShim(dir: string): Promise<PostToolUseShim> {
	const { loadOpenPlugin } = await import("../../src/index.js");
	return loadOpenPlugin(dir) as unknown as PostToolUseShim;
}

Given(
	"the shim runs an open-plugin whose PostToolUse {string} hook emits {string} on a push command",
	async function (
		this: PostToolUseShimWorld,
		_matcher: string,
		_emitted: string,
	) {
		this.postShim = await loadPostToolUseShim(EMIT_PLUGIN_DIR);
		this.postResult = undefined;
	},
);

Given(
	"the shim runs an open-plugin whose PostToolUse {string} hook exits non-zero",
	async function (this: PostToolUseShimWorld, _matcher: string) {
		this.postShim = await loadPostToolUseShim(NONZERO_PLUGIN_DIR);
		this.postResult = undefined;
	},
);

Given(
	"the shim runs an open-plugin whose only PostToolUse matcher is {string}",
	async function (this: PostToolUseShimWorld, _matcher: string) {
		this.postShim = await loadPostToolUseShim(ONLY_BASH_PLUGIN_DIR);
		this.postResult = undefined;
	},
);

When(
	"a Bash tool call {string} completes",
	async function (this: PostToolUseShimWorld, command: string) {
		assert.ok(this.postShim, "no shim loaded");
		this.postResult = await this.postShim.runPostToolUse("bash", { command });
	},
);

When(
	"a write tool call to {string} completes",
	async function (this: PostToolUseShimWorld, path: string) {
		assert.ok(this.postShim, "no shim loaded");
		this.postResult = await this.postShim.runPostToolUse("write", {
			file_path: path,
		});
	},
);

Then(
	"the plugin's PostToolUse hook output carries {string}",
	function (this: PostToolUseShimWorld, expected: string) {
		assert.ok(this.postResult, "no tool call completed");
		assert.ok(
			this.postResult.output.includes(expected),
			`PostToolUse output did not carry "${expected}": ${this.postResult.output}`,
		);
	},
);

Then("the tool call is not blocked", function (this: PostToolUseShimWorld) {
	assert.ok(
		this.postResult,
		"tool call did not complete: the PostToolUse hook blocked it",
	);
});

Then("no PostToolUse hook runs", function (this: PostToolUseShimWorld) {
	assert.ok(this.postResult, "no tool call completed");
	assert.equal(
		this.postResult.output,
		"",
		`a PostToolUse hook ran when none should: ${this.postResult.output}`,
	);
});
