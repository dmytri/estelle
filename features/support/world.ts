import { cpSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { After, Before, setWorldConstructor, World } from "@cucumber/cucumber";
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
	packedFiles?: string[];
	workspaceDir?: string;
	agentDir?: string;
	piDefaultModel?: string;
	roster?: string[];
	seat?: { role: string; name: string };
	requestedSeatModel?: string;
	commands?: string[];
	commandRun?: boolean;
	result?: { allowed: boolean; reason?: string; contents?: string };
	interactiveSession?: {
		runtime: unknown;
		extensions: string[];
		seat(): { id: string; role: string; name: string };
		crewSession():
			| {
					runtime: unknown;
					seat(): { id: string; role: string; name: string };
			  }
			| undefined;
	};

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
			const { launch } = await import("../../src/index.js");
			this.launched = await launch({
				cwd: this.workspaceDir,
				agentDir: this.agentDir,
			});
		}
		// Seed after any launch too: a Background may start the session first and
		// declare project files in a later step, so the file must still land in
		// the workspace the launched session reads.
		for (const [relPath, contents] of Object.entries(seed)) {
			writeFileSync(join(this.workspaceDir!, relPath), contents, "utf8");
		}
		return this.launched;
	}

	/**
	 * Create a disposable operator agent directory seeded with the given files,
	 * so scenarios that observe or configure the operator's agent directory
	 * never touch the host's real pi agent directory. Idempotent within a
	 * scenario; teardown removes the directory.
	 */
	prepareAgentDir(files: Record<string, string> = {}): string {
		if (!this.agentDir) {
			this.agentDir = mkdtempSync(join(tmpdir(), "estelle-agent-"));
		}
		for (const [relPath, contents] of Object.entries(files)) {
			writeFileSync(join(this.agentDir, relPath), contents, "utf8");
		}
		return this.agentDir;
	}

	/**
	 * Launch Estelle in a disposable workspace with a disposable agent dir, so
	 * install scenarios start from a clean slate: no host-global skill or
	 * extension leaks in, and every package the scenario installs is removed on
	 * teardown. This is what makes an install observable rather than pre-present.
	 */
	/**
	 * Create the disposable workspace and empty agent dir without launching, so
	 * a scenario can assert what launch itself installs into a clean slate.
	 * Idempotent within a scenario; teardown removes both directories.
	 */
	prepareFreshWorkspace(): { workspaceDir: string; agentDir: string } {
		if (!this.workspaceDir) {
			this.workspaceDir = mkdtempSync(join(tmpdir(), "estelle-fresh-"));
			cpSync(join(process.cwd(), "assets"), join(this.workspaceDir, "assets"), {
				recursive: true,
			});
		}
		if (!this.agentDir) {
			this.agentDir = mkdtempSync(join(tmpdir(), "estelle-agent-"));
		}
		return { workspaceDir: this.workspaceDir, agentDir: this.agentDir };
	}

	async ensureFreshWorkspace(): Promise<EstelleSession> {
		if (!this.launched) {
			this.prepareFreshWorkspace();
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

// Seat-model scenarios observe the operator's agent directory (recorded seat
// models, the pi default model), so they run against a disposable agent dir
// seeded with a known pi default model instead of the host's real ~/.pi.
Before(function (this: EstelleWorld, { pickle }) {
	if (!pickle.uri.includes("seat-model")) {
		return;
	}
	this.piDefaultModel = "opencode-go/deepseek-v4-flash";
	this.prepareAgentDir({
		"settings.json": JSON.stringify({
			defaultProvider: "opencode-go",
			defaultModel: "deepseek-v4-flash",
		}),
	});
});

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
