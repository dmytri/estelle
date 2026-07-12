import assert from "node:assert/strict";
import {
	existsSync,
	mkdirSync,
	mkdtempSync,
	readFileSync,
	rmSync,
	writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { After, Given, Then, When } from "@cucumber/cucumber";
import type { EstelleWorld } from "../support/world.js";

// The plugin-rules scenarios prove the installed Shipshape plugin's rule files
// reach the seat. Scenario 1 drives the shim directly against a disposable
// on-disk plugin that really ships "rules/*.mdc". Scenarios 2 and 3 read the
// real installed plugin's rule files, resolved from the launched session's own
// skill paths, and assert the acting seat's system prompt carries them. No
// stand-in: the rule text asserted is the real file's own body.

// The shim's rule-reporting seam. It does not exist yet; the step drives it as
// the verification contract Crew satisfies.
interface RulesShim {
	reportRules(): string[];
}

type RulesWorld = EstelleWorld & {
	rulesShim?: RulesShim;
	reportedRules?: string[];
	ruleFixtureDirs?: string[];
};

// Strip the leading "---...---" frontmatter block and return the first non-empty
// body line, a distinctive marker for the rule's own content. Asserts the
// installed plugin actually ships the rule file first, so a stale plugin install
// that carries no "rules/" surfaces as a clear fitting-out blocker rather than a
// bare ENOENT.
function ruleMarker(pluginDir: string, name: string): string {
	const rulePath = join(pluginDir, "rules", `${name}.mdc`);
	assert.ok(
		existsSync(rulePath),
		`the installed Shipshape plugin at ${pluginDir} ships no "rules/${name}.mdc"; fitting-out installed a plugin version predating the rules surface`,
	);
	const contents = readFileSync(rulePath, "utf8");
	const lines = contents.split("\n");
	let start = 0;
	if (lines[0]?.trim() === "---") {
		const close = lines.indexOf("---", 1);
		start = close === -1 ? 1 : close + 1;
	}
	const marker = lines.slice(start).find((line) => line.trim().length > 0);
	assert.ok(marker, `rule "${name}" carries no body line to match on`);
	return marker.trim();
}

// The installed Shipshape plugin directory the flagship resolves and its
// write-custody shim loads, "<agentDir>/git/github.com/dmytri/shipshape". This
// is the same directory production reads the plugin's hooks and, once wired, its
// "rules/*.mdc" from, so the rule text asserted is the real installed file's own
// body rather than a dev-tree copy.
async function installedPluginDir(): Promise<string> {
	const { getAgentDir } = await import("@earendil-works/pi-coding-agent");
	return join(getAgentDir(), "git", "github.com", "dmytri", "shipshape");
}

Given(
	"the shim runs an open-plugin that ships a rule {string} and an always-apply rule {string}",
	async function (this: RulesWorld, rule: string, alwaysApply: string) {
		const dir = mkdtempSync(join(tmpdir(), "estelle-rules-plugin-"));
		this.ruleFixtureDirs ??= [];
		this.ruleFixtureDirs.push(dir);
		mkdirSync(join(dir, "rules"), { recursive: true });
		writeFileSync(
			join(dir, "rules", `${rule}.mdc`),
			`---\ndescription: ${rule} checklist.\n---\n\n${rule} rule body.\n`,
			"utf8",
		);
		writeFileSync(
			join(dir, "rules", `${alwaysApply}.mdc`),
			`---\ndescription: always.\nalwaysApply: true\n---\n\n${alwaysApply} rule body.\n`,
			"utf8",
		);
		const { loadOpenPlugin } = await import("pi-open-plugin-shim");
		this.rulesShim = loadOpenPlugin(dir) as unknown as RulesShim;
		this.reportedRules = undefined;
	},
);

When("the shim reports the plugin's rules", function (this: RulesWorld) {
	assert.ok(this.rulesShim, "no shim loaded");
	this.reportedRules = this.rulesShim.reportRules();
});

Then(
	"the reported rules include {string}",
	function (this: RulesWorld, rule: string) {
		assert.ok(this.reportedRules, "no rules were reported");
		assert.ok(
			this.reportedRules.includes(rule),
			`reported rules did not include "${rule}": ${JSON.stringify(
				this.reportedRules,
			)}`,
		);
	},
);

Then(
	"the seat system prompt includes the plugin's {string} rule",
	async function (this: EstelleWorld, rule: string) {
		const marker = ruleMarker(await installedPluginDir(), rule);
		const prompt = this.launched!.systemPrompt();
		assert.ok(
			prompt.includes(marker),
			`seat system prompt did not carry the plugin's "${rule}" rule (marker: ${JSON.stringify(
				marker,
			)})`,
		);
	},
);

Then(
	"the seat system prompt includes the plugin's always-apply {string} rule",
	async function (this: EstelleWorld, rule: string) {
		const marker = ruleMarker(await installedPluginDir(), rule);
		const prompt = this.launched!.systemPrompt();
		assert.ok(
			prompt.includes(marker),
			`seat system prompt did not carry the plugin's always-apply "${rule}" rule (marker: ${JSON.stringify(
				marker,
			)})`,
		);
	},
);

Then(
	"the seat system prompt excludes the plugin's {string} rule",
	async function (this: EstelleWorld, rule: string) {
		const marker = ruleMarker(await installedPluginDir(), rule);
		const prompt = this.launched!.systemPrompt();
		assert.ok(
			!prompt.includes(marker),
			`seat system prompt carried the plugin's "${rule}" rule but should exclude it (marker: ${JSON.stringify(
				marker,
			)})`,
		);
	},
);

After(function (this: RulesWorld) {
	for (const dir of this.ruleFixtureDirs ?? []) {
		rmSync(dir, { recursive: true, force: true });
	}
	this.ruleFixtureDirs = undefined;
});
