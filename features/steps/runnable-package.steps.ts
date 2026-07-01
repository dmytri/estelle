import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Given, Then, When } from "@cucumber/cucumber";
import type { EstelleWorld } from "../support/world.js";

Given("the built Estelle package", function (this: EstelleWorld) {
	// Verify the artifact operators run, not the source tree. Run the real
	// outbound build so the published bin entry and its compiled output exist.
	execFileSync("pnpm", ["build"], { cwd: process.cwd(), stdio: "pipe" });
});

Then(
	"the package provides an executable {string} command",
	function (this: EstelleWorld, name: string) {
		const pkg = JSON.parse(
			readFileSync(join(process.cwd(), "package.json"), "utf8"),
		) as { bin?: Record<string, string> };
		const binRel = pkg.bin?.[name];
		assert.ok(binRel, `package.json declares no bin "${name}"`);
		const binPath = join(process.cwd(), binRel);
		assert.ok(existsSync(binPath), `bin "${name}" file missing: ${binPath}`);
		const contents = readFileSync(binPath, "utf8");
		assert.ok(
			contents.startsWith("#!"),
			`bin "${name}" carries no shebang; operators cannot execute it`,
		);
	},
);

Given(
	"an operator directory that carries no Estelle assets",
	function (this: EstelleWorld) {
		// A bare directory an operator runs npx in: no assets/ travel with it, so
		// the package must resolve its own shipped assets to boot.
		this.workspaceDir = mkdtempSync(join(tmpdir(), "estelle-operator-"));
	},
);

When(
	"the operator runs the Estelle package in that directory",
	async function (this: EstelleWorld) {
		const { launch } = await import("../../src/index.js");
		this.launched = await launch({ cwd: this.workspaceDir });
	},
);

Given("the packaged Estelle artifact", function (this: EstelleWorld) {
	// Verify what npm would publish, not the working tree. Build first so the
	// compiled runtime exists, then let real npm pack logic honour package.json
	// files, .npmignore, and .gitignore to produce the shipped file list.
	execFileSync("pnpm", ["build"], { cwd: process.cwd(), stdio: "pipe" });
	const stdout = execFileSync("npm", ["pack", "--json", "--dry-run"], {
		cwd: process.cwd(),
		encoding: "utf8",
	});
	const packed = JSON.parse(stdout) as Array<{
		files: Array<{ path: string }>;
	}>;
	this.packedFiles = packed[0].files.map((f) => f.path);
});

Then(
	"the artifact includes {string}",
	function (this: EstelleWorld, path: string) {
		assert.ok(this.packedFiles, "no packaged artifact");
		assert.ok(
			this.packedFiles.includes(path),
			`packaged artifact omits "${path}"`,
		);
	},
);

Then(
	"the artifact withholds {string}",
	function (this: EstelleWorld, path: string) {
		assert.ok(this.packedFiles, "no packaged artifact");
		assert.ok(
			!this.packedFiles.includes(path),
			`packaged artifact leaks "${path}"`,
		);
	},
);
