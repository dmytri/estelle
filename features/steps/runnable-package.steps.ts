import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
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

// The observed run of the estelle command when its launch rejects: exit
// status and stderr, carried between the When and its Then assertions.
type RunnableWorld = EstelleWorld & {
	commandRun?: { status: number | null; stderr: string };
};

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

When(
	"the operator runs the {string} command in a directory whose launch rejects",
	{ timeout: 60000 },
	function (this: RunnableWorld, name: string) {
		// A directory whose launch rejects: its agent dir carries a malformed
		// "estelle.json", so the launch path throws while reading the recorded
		// seat models, before any session opens. The operator-real path is the
		// executable bin declared in package.json, run as a real child process
		// exactly as npx runs it. The disposable agent dir travels through pi's
		// own PI_CODING_AGENT_DIR environment seam, so the host's real ~/.pi is
		// never touched. The spawn timeout is a failure ceiling: a launch that
		// wrongly proceeds into the interactive session is killed and surfaces
		// as a missing exit status.
		this.workspaceDir = mkdtempSync(join(tmpdir(), "estelle-launch-reject-"));
		const agentDir = this.prepareAgentDir({ "estelle.json": "{ not json" });
		const pkg = JSON.parse(
			readFileSync(join(process.cwd(), "package.json"), "utf8"),
		) as { bin?: Record<string, string> };
		const binRel = pkg.bin?.[name];
		assert.ok(binRel, `package.json declares no bin "${name}"`);
		const result = spawnSync(process.execPath, [join(process.cwd(), binRel)], {
			cwd: this.workspaceDir,
			env: { ...process.env, PI_CODING_AGENT_DIR: agentDir },
			encoding: "utf8",
			timeout: 30000,
		});
		this.commandRun = { status: result.status, stderr: result.stderr ?? "" };
	},
);

Then("the command exits with a nonzero status", function (this: RunnableWorld) {
	assert.ok(this.commandRun, "no command was run");
	assert.ok(
		this.commandRun.status !== null && this.commandRun.status !== 0,
		`command did not exit with a nonzero status: ${String(
			this.commandRun.status,
		)}; stderr: ${this.commandRun.stderr}`,
	);
});

Then(
	"the command prints the launch error to stderr",
	function (this: RunnableWorld) {
		assert.ok(this.commandRun, "no command was run");
		assert.ok(
			this.commandRun.stderr.includes("JSON"),
			`stderr carries no launch error naming the malformed configuration: ${this.commandRun.stderr}`,
		);
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
