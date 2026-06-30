import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { Then } from "@cucumber/cucumber";
import type { EstelleWorld } from "../support/world.js";

const CARD_BY_ROLE: Record<string, string> = {
	captain: "bonny.md",
	quartermaster: "misson.md",
	crew: "crew.md",
	boatswain: "bellamy.md",
	shipwright: "johnson.md",
};

Then(
	"the active seat's system prompt includes its character card",
	function (this: EstelleWorld) {
		const role = this.seat?.role ?? "captain";
		const base = this.workspaceDir ?? process.cwd();
		const card = readFileSync(
			join(base, "assets", "characters", CARD_BY_ROLE[role]),
			"utf8",
		).trim();
		const prompt = this.launched!.systemPrompt();
		assert.ok(
			prompt.includes(card),
			`${role} system prompt did not include its character card "${CARD_BY_ROLE[role]}"`,
		);
	},
);
