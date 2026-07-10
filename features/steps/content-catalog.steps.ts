import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { Given, Then, When } from "@cucumber/cucumber";
import type { EstelleWorld } from "../support/world.js";

interface CatalogEmbarkEntry {
	description: string;
	promptSnippet: string;
	promptGuidelines: string[];
}

type CatalogWorld = EstelleWorld & {
	catalogEntry?: unknown;
	registeredEmbarkTool?: {
		description?: string;
		promptSnippet?: string;
		promptGuidelines?: string[];
	};
};

// The agent-prompt catalog the seams source their agent-facing copy from.
function agentPromptCatalog(root: string): Record<string, unknown> {
	return JSON.parse(
		readFileSync(join(root, "assets", "agent-prompts.json"), "utf8"),
	) as Record<string, unknown>;
}

Given(
	"the {string} entry in the agent-prompt catalog",
	function (this: CatalogWorld, key: string) {
		const catalog = agentPromptCatalog(process.cwd());
		assert.ok(
			Object.hasOwn(catalog, key),
			`the agent-prompt catalog has no "${key}" entry`,
		);
		this.catalogEntry = catalog[key];
	},
);

When(
	"the Captain seat registers the embark tool",
	async function (this: CatalogWorld) {
		// Launch a real session. The default seat is the Captain Bonny, so the
		// production extension registers the embark tool on the live extension
		// runner. Read the registered tool definition back through the runner, the
		// same real object the seated model receives.
		const estelle = await this.ensureLaunched();
		const runner = (
			estelle.session as unknown as {
				extensionRunner: {
					getToolDefinition(name: string):
						| {
								description?: string;
								promptSnippet?: string;
								promptGuidelines?: string[];
						  }
						| undefined;
				};
			}
		).extensionRunner;
		const definition = runner.getToolDefinition("embark");
		assert.ok(definition, "the Captain seat registered no embark tool");
		this.registeredEmbarkTool = definition;
	},
);

Then(
	"the tool's description, prompt snippet, and prompt guidelines match the catalogued embark entry",
	function (this: CatalogWorld) {
		const entry = this.catalogEntry as CatalogEmbarkEntry;
		const tool = this.registeredEmbarkTool;
		assert.ok(tool, "no registered embark tool was captured");
		assert.equal(
			tool.description,
			entry.description,
			"the embark tool description does not match the catalogued entry",
		);
		assert.equal(
			tool.promptSnippet,
			entry.promptSnippet,
			"the embark tool prompt snippet does not match the catalogued entry",
		);
		assert.deepEqual(
			tool.promptGuidelines,
			entry.promptGuidelines,
			"the embark tool prompt guidelines do not match the catalogued entry",
		);
	},
);
