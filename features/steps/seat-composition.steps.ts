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

// The running interactive session the started-session scenarios drive. It carries
// the real pi AgentSession the seated model runs on: its assembled base system
// prompt, its live extension runner, and the resource loader that resolves the
// upstream role skills. The applied-turn scenarios read the prompt through this
// real turn seam, not through any recompute accessor.
interface StartedSessionView {
	runtime: {
		session: {
			systemPrompt: string;
			extensionRunner: {
				emitBeforeAgentStart(
					prompt: string,
					images: undefined,
					systemPrompt: string,
					systemPromptOptions: { cwd: string },
				): Promise<{ systemPrompt?: string } | undefined>;
			};
		};
		services: {
			resourceLoader: {
				getSkills(): { skills: { name: string; filePath: string }[] };
			};
		};
	};
}

function startedSession(world: EstelleWorld): StartedSessionView {
	return world.interactiveSession as unknown as StartedSessionView;
}

function appliedTurnPrompt(world: EstelleWorld): string {
	const prompt = (world as unknown as { turnSystemPrompt?: string })
		.turnSystemPrompt;
	assert.ok(
		prompt !== undefined,
		"the seated model has not begun its next turn; no applied system prompt captured",
	);
	return prompt;
}

// Read the character card from the shipped assets the running session composes
// from. The started session launches in a bare workspace, so Estelle resolves
// its own shipped assets from the repository root, the same directory the
// before_agent_start seam reads the card from.
function shippedCharacterCard(seat: string): string {
	return readFileSync(
		join(process.cwd(), "assets", "characters", `${seat}.md`),
		"utf8",
	).trim();
}

When(
	"the seated model begins its next turn",
	async function (this: EstelleWorld) {
		const session = startedSession(this).runtime.session;
		// Drive the real turn seam: fire the session's own before_agent_start
		// event, the path pi runs when the seated model begins a turn. The Estelle
		// extension composes the applied system prompt from the live active seat,
		// so the captured prompt is what the seated model actually receives.
		const base = session.systemPrompt;
		const result = await session.extensionRunner.emitBeforeAgentStart(
			"",
			undefined,
			base,
			{ cwd: this.workspaceDir ?? process.cwd() },
		);
		(this as unknown as { turnSystemPrompt?: string }).turnSystemPrompt =
			result?.systemPrompt ?? base;
	},
);

Then(
	"the system prompt applied to the turn includes the {string} character card",
	function (this: EstelleWorld, seat: string) {
		const card = shippedCharacterCard(seat);
		const prompt = appliedTurnPrompt(this);
		assert.ok(
			prompt.includes(card),
			`applied turn system prompt did not include the "${seat}" character card`,
		);
	},
);

Then(
	"the system prompt applied to the turn includes the upstream {string} role instructions",
	function (this: EstelleWorld, role: string) {
		const skill = startedSession(this)
			.runtime.services.resourceLoader.getSkills()
			.skills.find((s) => s.name === role);
		assert.ok(skill, `upstream "${role}" role instructions not loaded`);
		const contents = readFileSync(skill.filePath, "utf8").trim();
		const prompt = appliedTurnPrompt(this);
		assert.ok(
			prompt.includes(contents),
			`applied turn system prompt did not include the upstream "${role}" role instructions from ${skill.filePath}`,
		);
	},
);

Then(
	"the system prompt applied to the turn excludes the {string} character card",
	function (this: EstelleWorld, seat: string) {
		const card = shippedCharacterCard(seat);
		const prompt = appliedTurnPrompt(this);
		assert.ok(
			!prompt.includes(card),
			`applied turn system prompt included the "${seat}" character card but should exclude it`,
		);
	},
);

Then(
	"the system prompt applied to the turn names the Captain {string}, the Quartermaster {string}, the Crew, the Boatswain {string}, and the Shipwright {string}",
	function (
		this: EstelleWorld,
		captain: string,
		quartermaster: string,
		boatswain: string,
		shipwright: string,
	) {
		const prompt = appliedTurnPrompt(this);
		for (const name of [
			captain,
			quartermaster,
			"Crew",
			boatswain,
			shipwright,
		]) {
			assert.ok(
				prompt.includes(name),
				`applied turn system prompt did not name "${name}"`,
			);
		}
	},
);
