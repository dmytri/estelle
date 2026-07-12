import assert from "node:assert/strict";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { Then, When } from "@cucumber/cucumber";
import type { ToolCallEvent } from "@earendil-works/pi-coding-agent";
import type { EstelleWorld } from "../support/world.js";

// The Captain-only perturbation seam the scenarios exercise through the running
// session. A live seat reaches the seam the way it acts, through a tool call on
// the running session's real tool_call hook, not a test-facing method. Estelle
// must stamp the RIGGING perturbation statement into a named production seam when
// the Captain acts and block every internal seat. The seam does not exist yet;
// these step definitions drive it as the verification contract Crew satisfies.
type PerturbWorld = EstelleWorld & {
	perturbSeamPath?: string;
	perturbSeamOriginal?: string;
};

// The perturbation statement is durable configuration, read from RIGGING.md so
// the assertion tracks the project value rather than a copy pinned in the test.
function perturbStatement(root: string): string {
	const rigging = readFileSync(join(root, "RIGGING.md"), "utf8");
	const match = rigging.match(/-\s*perturb:\s*`([^`]+)`/);
	assert.ok(match, 'RIGGING.md "## Perturbation" carries no "perturb" value');
	return match[1].trim();
}

let perturbSeq = 0;

// Seed a named production seam in the running session's workspace, capture its
// original text, then drive the seat's perturb tool call against it through the
// running session's real tool_call hook. A disposable workspace keeps the real
// repository untouched.
async function runPerturbCommand(
	world: PerturbWorld,
	seam: string,
): Promise<void> {
	const workspace = world.workspaceDir;
	assert.ok(workspace, "no launched workspace to carry a production seam");
	const absolute = resolve(workspace, seam);
	const original = [
		"export function computeTotal(first: number, second: number): number {",
		"\treturn first + second;",
		"}",
		"",
	].join("\n");
	mkdirSync(dirname(absolute), { recursive: true });
	writeFileSync(absolute, original, "utf8");
	world.perturbSeamPath = absolute;
	world.perturbSeamOriginal = original;
	perturbSeq += 1;
	const outcome = await world.launched!.session.extensionRunner.emitToolCall({
		type: "tool_call",
		toolCallId: `estelle-perturb-${perturbSeq}`,
		toolName: "perturb",
		input: { path: seam },
	} as unknown as ToolCallEvent);
	world.result = { allowed: !outcome?.block, reason: outcome?.reason };
}

When(
	"Bonny runs the {string} command on the seam {string} in the running session",
	async function (this: PerturbWorld, _command: string, seam: string) {
		await runPerturbCommand(this, seam);
	},
);

When(
	"Misson runs the {string} command on the seam {string} in the running session",
	async function (this: PerturbWorld, _command: string, seam: string) {
		await runPerturbCommand(this, seam);
	},
);

Then(
	"the seam {string} carries the perturbation statement from {string}",
	function (this: PerturbWorld, _seam: string, source: string) {
		assert.equal(source, "RIGGING.md");
		assert.equal(
			this.result?.allowed,
			true,
			`the perturbation was blocked: ${this.result?.reason ?? ""}`,
		);
		const statement = perturbStatement(process.cwd());
		const contents = readFileSync(this.perturbSeamPath!, "utf8");
		assert.ok(
			contents.includes(statement),
			`the perturbed seam does not carry the perturbation statement:\n${contents}`,
		);
	},
);

Then(
	"the perturbed seam carries no step text, scenario name, or rationale",
	function (this: PerturbWorld) {
		const statement = perturbStatement(process.cwd());
		const original = new Set(
			(this.perturbSeamOriginal ?? "").split("\n").map((line) => line.trim()),
		);
		const added = readFileSync(this.perturbSeamPath!, "utf8")
			.split("\n")
			.map((line) => line.trim())
			.filter((line) => line.length > 0 && !original.has(line));
		assert.deepEqual(
			added,
			[statement],
			`the perturbation added text beyond the bare perturbation statement:\n${added.join(
				"\n",
			)}`,
		);
	},
);

Then(
	"the running session blocks the perturbation",
	function (this: PerturbWorld) {
		assert.equal(
			this.result?.allowed,
			false,
			"the perturbation was allowed but should have been blocked",
		);
	},
);

Then(
	"the seam {string} is unchanged",
	function (this: PerturbWorld, _seam: string) {
		const contents = readFileSync(this.perturbSeamPath!, "utf8");
		assert.equal(
			contents,
			this.perturbSeamOriginal,
			"the blocked perturbation still altered the seam",
		);
	},
);
