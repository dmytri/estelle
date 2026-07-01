import { cpSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { After, setWorldConstructor, World } from "@cucumber/cucumber";
import type { EstelleSession, LaunchOptions } from "../../src/index.js";

/**
 * Shared Cucumber world for Estelle verification.
 *
 * Holds the real launched pi session and the observable Estelle state a
 * scenario asserts against. The launch seam is the production-shaped entry
 * the bin wraps; verification drives it directly with an in-memory session
 * manager so the default tier stays hermetic and needs no provider account.
 *
 * Custody and privacy scenarios run against a disposable temp workspace so the
 * real repository CAPTAIN.md and watchbill.json are never read or written, and
 * scenario-created files are removed on teardown.
 */
export class EstelleWorld extends World {
	launched?: EstelleSession;
	workspaceDir?: string;
	agentDir?: string;
	roster?: string[];
	seat?: { role: string; name: string };
	requestedSeatModel?: string;
	skills?: { name: string; filePath: string }[];
	commands?: string[];
	commandRun?: boolean;
	result?: { allowed: boolean; reason?: string; contents?: string };

	async ensureLaunched(options?: LaunchOptions): Promise<EstelleSession> {
		if (!this.launched) {
			const { launch } = await import("../../src/index.js");
			this.launched = await launch({ cwd: process.cwd(), ...options });
		}
		return this.launched;
	}

	/**
	 * Launch Estelle in a disposable temp workspace seeded with the given files.
	 * Used by custody and privacy scenarios. Idempotent within a scenario.
	 */
	async ensureWorkspace(
		seed: Record<string, string> = {},
	): Promise<EstelleSession> {
		if (!this.launched) {
			this.workspaceDir = mkdtempSync(join(tmpdir(), "estelle-verify-"));
			// Mirror a freshly cloned Estelle workspace: the Captain-owned assets
			// travel with the clone, so seat naming and model selection resolve.
			cpSync(join(process.cwd(), "assets"), join(this.workspaceDir, "assets"), {
				recursive: true,
			});
			for (const [relPath, contents] of Object.entries(seed)) {
				writeFileSync(join(this.workspaceDir, relPath), contents, "utf8");
			}
			const { launch } = await import("../../src/index.js");
			this.launched = await launch({ cwd: this.workspaceDir });
		}
		return this.launched;
	}

	/**
	 * Launch Estelle in a disposable workspace with a disposable agent dir, so
	 * install scenarios start from a clean slate: no host-global skill or
	 * extension leaks in, and every package the scenario installs is removed on
	 * teardown. This is what makes an install observable rather than pre-present.
	 */
	async ensureFreshWorkspace(): Promise<EstelleSession> {
		if (!this.launched) {
			this.workspaceDir = mkdtempSync(join(tmpdir(), "estelle-fresh-"));
			this.agentDir = mkdtempSync(join(tmpdir(), "estelle-agent-"));
			cpSync(join(process.cwd(), "assets"), join(this.workspaceDir, "assets"), {
				recursive: true,
			});
			const { launch } = await import("../../src/index.js");
			this.launched = await launch({
				cwd: this.workspaceDir,
				agentDir: this.agentDir,
			});
		}
		return this.launched;
	}
}

setWorldConstructor(EstelleWorld);

After(function (this: EstelleWorld) {
	this.launched?.dispose();
	this.launched = undefined;
	if (this.workspaceDir) {
		rmSync(this.workspaceDir, { recursive: true, force: true });
		this.workspaceDir = undefined;
	}
	if (this.agentDir) {
		rmSync(this.agentDir, { recursive: true, force: true });
		this.agentDir = undefined;
	}
});
