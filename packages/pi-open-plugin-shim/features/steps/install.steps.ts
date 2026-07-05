import assert from "node:assert/strict";
import { cpSync, mkdtempSync, readdirSync, rmSync, statSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
	After,
	AfterAll,
	BeforeAll,
	Given,
	Then,
	When,
} from "@cucumber/cucumber";
import type { OpenPluginShim, WriteCustodyDecision } from "../../src/index.js";

/**
 * Verification for the pi-open-plugin-shim install seam.
 *
 * Drives the shim's real install path on the real filesystem. Each scenario
 * copies a real fixture open-plugin into a disposable source directory, then
 * relocates it into a namespaced temporary pi plugin directory through the
 * production install seam. The relocated plugin's hooks are the real fixture
 * scripts, so discovery and custody run against the true installed location
 * rather than a mocked install.
 *
 * Every created directory lives under the shared install prefix in the OS
 * temp directory and is tracked on the per-scenario Cucumber world. Teardown
 * removes them best-effort, and suite start reclaims any leftover namespaced
 * directory from an earlier interrupted run.
 */
interface InstallShimWorld {
	shim?: OpenPluginShim;
	role?: string;
	decision?: WriteCustodyDecision;
	denialMessage?: string;
	sourceDir?: string;
	piPluginDir?: string;
	installTempDirs?: string[];
}

const FIXTURES_DIR = join(__dirname, "..", "support", "fixtures");
const INSTALL_TMP_PREFIX = "pi-open-plugin-shim-install-";

function reclaimLeftoverTempDirs(): void {
	const base = tmpdir();
	for (const entry of readdirSync(base)) {
		if (!entry.startsWith(INSTALL_TMP_PREFIX)) {
			continue;
		}
		removeBestEffort(join(base, entry));
	}
}

function removeBestEffort(dir: string): void {
	for (let attempt = 0; attempt < 3; attempt++) {
		try {
			rmSync(dir, { recursive: true, force: true });
			return;
		} catch {
			// transient teardown failure; retry
		}
	}
}

function makeTempDir(world: InstallShimWorld, suffix: string): string {
	const dir = mkdtempSync(join(tmpdir(), `${INSTALL_TMP_PREFIX}${suffix}-`));
	world.installTempDirs ??= [];
	world.installTempDirs.push(dir);
	return dir;
}

// Stage a real, disposable copy of a fixture open-plugin so the install seam
// relocates a throwaway source and never mutates the tracked fixture.
function stageSource(world: InstallShimWorld, fixtureName: string): string {
	const sourceRoot = makeTempDir(world, "source");
	cpSync(join(FIXTURES_DIR, fixtureName), sourceRoot, { recursive: true });
	world.sourceDir = sourceRoot;
	return sourceRoot;
}

function collectFiles(dir: string, acc: string[]): string[] {
	for (const entry of readdirSync(dir)) {
		const full = join(dir, entry);
		if (statSync(full).isDirectory()) {
			collectFiles(full, acc);
		} else {
			acc.push(full);
		}
	}
	return acc;
}

BeforeAll(() => {
	reclaimLeftoverTempDirs();
});

AfterAll(() => {
	reclaimLeftoverTempDirs();
});

// Teardown registered before any scenario creates a real directory.
After(function (this: InstallShimWorld) {
	for (const dir of this.installTempDirs ?? []) {
		removeBestEffort(dir);
	}
	this.installTempDirs = undefined;
});

Given(
	"an open-plugin at a source directory",
	function (this: InstallShimWorld) {
		stageSource(this, "custody-plugin");
	},
);

When(
	"the plugin is installed into a pi plugin directory",
	async function (this: InstallShimWorld) {
		assert.ok(this.sourceDir, "no source open-plugin was staged");
		const { installOpenPlugin } = await import("../../src/index.js");
		this.piPluginDir = makeTempDir(this, "pi");
		installOpenPlugin(this.sourceDir, this.piPluginDir);
	},
);

Then(
	"the plugin's files are present under that directory",
	function (this: InstallShimWorld) {
		assert.ok(this.piPluginDir, "no pi plugin directory was created");
		const files = collectFiles(this.piPluginDir, []);
		assert.ok(
			files.some((path) => path.endsWith(join(".plugin", "plugin.json"))),
			`installed tree carries no .plugin/plugin.json: ${files.join(", ")}`,
		);
		assert.ok(
			files.some((path) => path.split("/").includes("hooks")),
			`installed tree carries no hooks script: ${files.join(", ")}`,
		);
	},
);

Then(
	"the installed plugin is registered for discovery",
	async function (this: InstallShimWorld) {
		assert.ok(this.piPluginDir, "no pi plugin directory was created");
		const { discoverInstalledPlugins } = await import("../../src/index.js");
		const discovered = discoverInstalledPlugins(this.piPluginDir);
		assert.ok(
			discovered.length >= 1,
			"install left no plugin registered for discovery",
		);
	},
);

Given(
	"an installed open-plugin whose write hook denies the role {string} writing under {string}",
	async function (this: InstallShimWorld, _role: string, _under: string) {
		const { installOpenPlugin, discoverInstalledPlugins } = await import(
			"../../src/index.js"
		);
		stageSource(this, "custody-plugin");
		this.piPluginDir = makeTempDir(this, "pi");
		installOpenPlugin(this.sourceDir as string, this.piPluginDir);
		const discovered = discoverInstalledPlugins(this.piPluginDir);
		assert.ok(discovered.length >= 1, "install registered no plugin");
		this.shim = discovered[0];
		this.role = undefined;
		this.decision = undefined;
		this.denialMessage = undefined;
	},
);

Given(
	"an installed open-plugin whose write hook command uses {string}",
	async function (this: InstallShimWorld, _variable: string) {
		const { installOpenPlugin, discoverInstalledPlugins } = await import(
			"../../src/index.js"
		);
		stageSource(this, "plugin-root-plugin");
		this.piPluginDir = makeTempDir(this, "pi");
		installOpenPlugin(this.sourceDir as string, this.piPluginDir);
		const discovered = discoverInstalledPlugins(this.piPluginDir);
		assert.ok(discovered.length >= 1, "install registered no plugin");
		this.shim = discovered[0];
		this.role = undefined;
		this.decision = undefined;
		this.denialMessage = undefined;
	},
);
