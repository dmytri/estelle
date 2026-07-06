import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import {
	existsSync,
	mkdirSync,
	mkdtempSync,
	readFileSync,
	writeFileSync,
} from "node:fs";
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

Given(
	"an operator directory that has its own unrelated {string} folder",
	function (this: EstelleWorld, folderName: string) {
		// A directory an operator runs npx in that already carries its own folder
		// of the given name, unrelated to Estelle. Seed it with operator content
		// so the folder genuinely belongs to the operator and holds none of
		// Estelle's shipped assets, forcing the package to resolve its own.
		this.workspaceDir = mkdtempSync(join(tmpdir(), "estelle-operator-assets-"));
		const ownFolder = join(this.workspaceDir, folderName);
		mkdirSync(ownFolder, { recursive: true });
		writeFileSync(
			join(ownFolder, "operator-notes.txt"),
			"operator's own material\n",
			"utf8",
		);
	},
);

When(
	"the operator runs the Estelle package in that directory",
	async function (this: EstelleWorld) {
		const { launch } = await import("../../src/index.js");
		this.launched = await launch({
			cwd: this.workspaceDir,
			agentDir: this.agentDir,
		});
	},
);

When(
	"the operator runs the built package in a directory without Estelle assets",
	async function (this: EstelleWorld) {
		// Boot the compiled dist artifact operators run, not the src seam. A bare
		// directory carries no assets/, so the built package must resolve its own
		// shipped assets to seat the Captain and load the extension. Resolve the
		// built entry by path: the build emits it with no declarations, so type it
		// through the src it compiles from.
		this.workspaceDir = mkdtempSync(join(tmpdir(), "estelle-built-"));
		const builtEntry = join(process.cwd(), "dist", "index.js");
		const { launch } = (await import(
			builtEntry
		)) as typeof import("../../src/index.js");
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
