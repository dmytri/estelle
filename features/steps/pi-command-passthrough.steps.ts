import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { Then, When } from "@cucumber/cucumber";
import type { EstelleWorld } from "../support/world.js";

// The behaviour under test is CLI pass-through: `estelle install ...` and
// `estelle remove ...` act exactly as the same pi command. The operator-real
// path is the executable bin, so the step builds the outbound artifact and
// runs `bin/estelle.js` as a child process. pi's package command path calls
// process.exit when it completes, which makes a subprocess the only safe real
// seam. The disposable agent dir travels through pi's own PI_CODING_AGENT_DIR
// environment seam, so the scenario never touches the host's real ~/.pi.
When(
	"the operator runs estelle with the arguments {string}",
	{ timeout: 120000 },
	function (this: EstelleWorld, args: string) {
		execFileSync("pnpm", ["build"], { cwd: process.cwd(), stdio: "pipe" });
		execFileSync(
			process.execPath,
			[join(process.cwd(), "bin", "estelle.js"), ...args.split(" ")],
			{
				cwd: this.workspaceDir,
				env: { ...process.env, PI_CODING_AGENT_DIR: this.agentDir },
				stdio: "pipe",
				timeout: 90000,
			},
		);
	},
);

Then(
	"the {string} package is absent from the operator's pi settings",
	function (this: EstelleWorld, pkg: string) {
		const settingsPath = join(this.agentDir!, "settings.json");
		assert.ok(
			existsSync(settingsPath),
			`operator pi settings file does not exist: ${settingsPath}`,
		);
		const settings = JSON.parse(readFileSync(settingsPath, "utf8")) as {
			packages?: Array<string | { source: string }>;
		};
		const sources = (settings.packages ?? []).map((entry) =>
			typeof entry === "string" ? entry : entry.source,
		);
		assert.ok(
			!sources.includes(pkg),
			`package "${pkg}" is still persisted in ${settingsPath}; packages: ${sources.join(", ")}`,
		);
	},
);
