import assert from "node:assert/strict";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { Given, Then, When } from "@cucumber/cucumber";
import type { EstelleWorld } from "../support/world.js";

Given(
	"Estelle has launched in a fresh workspace",
	async function (this: EstelleWorld) {
		await this.ensureFreshWorkspace();
	},
);

Given(
	"a fresh workspace with no installed pi packages",
	function (this: EstelleWorld) {
		this.prepareFreshWorkspace();
	},
);

Given(
	"a fresh workspace whose pi settings already persist the {string} package",
	function (this: EstelleWorld, pkg: string) {
		const { agentDir } = this.prepareFreshWorkspace();
		writeFileSync(
			join(agentDir, "settings.json"),
			JSON.stringify({ packages: [pkg] }),
			"utf8",
		);
	},
);

When(
	"the operator starts Estelle in that workspace",
	{ timeout: 120000 },
	async function (this: EstelleWorld) {
		await this.ensureFreshWorkspace();
	},
);

Then(
	"the {string} package is persisted in the operator's pi settings",
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
			sources.includes(pkg),
			`package "${pkg}" is not persisted as an exact entry in ${settingsPath}; packages: ${sources.join(", ")}`,
		);
	},
);

When(
	"Estelle installs the upstream skill package {string}",
	{ timeout: 120000 },
	async function (this: EstelleWorld, source: string) {
		await this.launched!.installSkill(source);
	},
);

When(
	"Estelle installs the pi extension package {string}",
	{ timeout: 120000 },
	async function (this: EstelleWorld, source: string) {
		await this.launched!.installExtension(source);
	},
);

Then(
	"the command {string} is present",
	function (this: EstelleWorld, command: string) {
		const present = new Set(this.launched!.commands);
		assert.ok(
			present.has(command),
			`command "${command}" is not present; present: ${[...present].join(", ")}`,
		);
	},
);
