import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { Then, When } from "@cucumber/cucumber";
import type { EstelleWorld } from "../support/world.js";

// Upstream Shipshape role that owns each seat's instructions. Seat id maps to
// the upstream role skill name, which the launch seam exposes through skills.
const ROLE_BY_SEAT: Record<string, string> = {
	bonny: "captain",
	misson: "qm",
	crew: "crew",
	bellamy: "boatswain",
	johnson: "shipwright",
};

function upstreamRoleInstructions(
	world: EstelleWorld,
	role: string,
): { filePath: string; contents: string } {
	const skill = world.launched!.skills.find((s) => s.name === role);
	assert.ok(skill, `upstream "${role}" role instructions not loaded`);
	return {
		filePath: skill.filePath,
		contents: readFileSync(skill.filePath, "utf8").trim(),
	};
}

function characterCard(world: EstelleWorld, seat: string): string {
	const base = world.workspaceDir ?? process.cwd();
	return readFileSync(
		join(base, "assets", "characters", `${seat}.md`),
		"utf8",
	).trim();
}

When(
	"the operator runs the command {string}",
	function (this: EstelleWorld, command: string) {
		this.commandRun = true;
		this.launched!.runCommand(command);
	},
);

// Serves both uses of the same Gherkin phrase. As a Then after an explicit
// command (outline 1) it strictly asserts the command activated this seat. As
// a Given precondition (outline 2) no command ran, so it establishes the seat
// through the same command seam, then asserts.
Then(
	"the active seat is the {string} seat",
	async function (this: EstelleWorld, seat: string) {
		const estelle = await this.ensureLaunched();
		if (!this.commandRun) {
			estelle.runCommand(`/${seat}`);
		}
		const actual = estelle.seat().id;
		assert.equal(
			actual,
			seat,
			`active seat is "${actual}", expected "${seat}"`,
		);
	},
);

Then(
	"the seat system prompt includes the upstream {string} role instructions",
	function (this: EstelleWorld, role: string) {
		const upstream = upstreamRoleInstructions(this, role);
		const prompt = this.launched!.systemPrompt();
		assert.ok(
			prompt.includes(upstream.contents),
			`seat system prompt did not include the upstream "${role}" role instructions from ${upstream.filePath}`,
		);
	},
);

Then(
	"the seat system prompt includes the {string} character card",
	function (this: EstelleWorld, seat: string) {
		const card = characterCard(this, seat);
		const prompt = this.launched!.systemPrompt();
		assert.ok(
			prompt.includes(card),
			`seat system prompt did not include the "${seat}" character card`,
		);
	},
);

Then(
	"the upstream Shipshape role instructions resolve from outside the Estelle repository",
	function (this: EstelleWorld) {
		for (const role of Object.values(ROLE_BY_SEAT)) {
			const upstream = upstreamRoleInstructions(this, role);
			assert.ok(
				existsSync(upstream.filePath),
				`upstream "${role}" role instructions file does not exist: ${upstream.filePath}`,
			);
			assert.ok(
				!upstream.filePath.startsWith(process.cwd()),
				`upstream "${role}" role instructions are vendored inside the repository at ${upstream.filePath}`,
			);
		}
	},
);
