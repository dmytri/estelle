import { execFileSync } from "node:child_process";
import {
	cpSync,
	existsSync,
	mkdirSync,
	readFileSync,
	renameSync,
	rmSync,
	writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";

/**
 * The upstream Shipshape package every Estelle launch resolves. A launch into an
 * agent directory that does not already persist this package installs it with a
 * real git clone, about five seconds each. Every scenario that launches against a
 * disposable agent directory pays that cost again, and none of them asserts the
 * install: the package is ambient state, so it is provisioned once and shared.
 *
 * The install itself is behaviour under assertion in the install scenarios. Those
 * launch against a genuinely empty agent directory and clone for real; this shared
 * clone serves every other scenario, for which the package is setup cost.
 */
export const SHIPSHAPE_PACKAGE_SOURCE = "https://github.com/dmytri/shipshape";

const CACHE_ROOT = join(tmpdir(), "estelle-upstream-clone");
const CLONE_DIR = join(CACHE_ROOT, "shipshape");
// The clone lands in a staging directory and is renamed into place, so a killed
// run never leaves a half-cloned tree that a later run would read as ready.
const READY_MARKER = join(CACHE_ROOT, "clone-ready");

let cloneCount = 0;

/**
 * The one shared clone. Provisioned on first use and reused for the rest of the
 * run, and by a later run that finds it already on disk.
 */
export function sharedUpstreamClone(): string {
	if (existsSync(READY_MARKER) && existsSync(CLONE_DIR)) {
		return CLONE_DIR;
	}
	mkdirSync(CACHE_ROOT, { recursive: true });
	const staging = `${CLONE_DIR}.partial-${process.pid}`;
	rmSync(staging, { recursive: true, force: true });
	rmSync(CLONE_DIR, { recursive: true, force: true });
	execFileSync(
		"git",
		["clone", "--depth", "1", SHIPSHAPE_PACKAGE_SOURCE, staging],
		{ stdio: "pipe" },
	);
	renameSync(staging, CLONE_DIR);
	writeFileSync(READY_MARKER, new Date().toISOString(), "utf8");
	cloneCount += 1;
	return CLONE_DIR;
}

/** Real clones this process performed. One, at most, for the whole run. */
export function upstreamCloneCount(): number {
	return cloneCount;
}

export function upstreamClonePath(): string {
	return CLONE_DIR;
}

/** The installed plugin path inside an agent directory, as production resolves it. */
export function installedPluginPath(agentDir: string): string {
	return join(agentDir, "git", "github.com", "dmytri", "shipshape");
}

/**
 * Resolve the upstream package into a disposable agent directory from the shared
 * clone: copy the plugin into the path production reads it from, and persist the
 * package in the operator's pi settings so launch finds it already installed. The
 * settings merge preserves whatever the scenario configured, such as a provider
 * or a default model.
 */
export function seedUpstreamPackage(agentDir: string): void {
	const clone = sharedUpstreamClone();
	const target = installedPluginPath(agentDir);
	if (!existsSync(target)) {
		mkdirSync(dirname(target), { recursive: true });
		cpSync(clone, target, { recursive: true });
	}
	const settingsPath = join(agentDir, "settings.json");
	const settings = (
		existsSync(settingsPath)
			? JSON.parse(readFileSync(settingsPath, "utf8"))
			: {}
	) as { packages?: Array<string | { source: string }> };
	const packages = settings.packages ?? [];
	const present = packages.some(
		(entry) =>
			(typeof entry === "string" ? entry : entry.source) ===
			SHIPSHAPE_PACKAGE_SOURCE,
	);
	if (!present) {
		packages.push(SHIPSHAPE_PACKAGE_SOURCE);
	}
	settings.packages = packages;
	writeFileSync(settingsPath, JSON.stringify(settings), "utf8");
}
