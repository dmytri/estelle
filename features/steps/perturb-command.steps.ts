import assert from "node:assert/strict";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { Then, When } from "@cucumber/cucumber";
import type { EstelleWorld } from "../support/world.js";

// The Captain-only perturbation seam the scenarios exercise. Estelle exposes a
// perturb action on the running session: it stamps the RIGGING fail-fast
// statement into a named production seam when the Captain acts, and blocks every
// internal seat. The seam does not exist yet; the step definitions drive it as
// the verification contract Crew satisfies.
interface Perturbable {
	perturb(relPath: string): { allowed: boolean; reason?: string };
}

type PerturbWorld = EstelleWorld & {
	perturbSeamPath?: string;
	perturbSeamOriginal?: string;
	perturbResult?: { allowed: boolean; reason?: string };
};

// The fail-fast statement is durable configuration, read from RIGGING.md so the
// assertion tracks the project value rather than a copy pinned in the test.
function failFastStatement(root: string): string {
	const rigging = readFileSync(join(root, "RIGGING.md"), "utf8");
	const match = rigging.match(/-\s*fail-fast:\s*`([^`]+)`/);
	assert.ok(match, 'RIGGING.md "## Perturbation" carries no "fail-fast" value');
	return match[1].trim();
}

// Seed a named production seam in the running session's workspace, capture its
// original text, then drive the seat's perturb action against it. A disposable
// workspace keeps the real repository untouched.
function perturbNamedSeam(world: PerturbWorld): void {
	const workspace = world.workspaceDir;
	assert.ok(workspace, "no launched workspace to carry a production seam");
	const relPath = join("src", "sample-seam.ts");
	const absolute = join(workspace, relPath);
	const original = [
		"export function computeTotal(first: number, second: number): number {",
		"\treturn first + second;",
		"}",
		"",
	].join("\n");
	mkdirSync(join(workspace, "src"), { recursive: true });
	writeFileSync(absolute, original, "utf8");
	world.perturbSeamPath = absolute;
	world.perturbSeamOriginal = original;
	const session = world.launched as unknown as Perturbable;
	world.perturbResult = session.perturb(relPath);
}

When("Bonny perturbs a named production seam", function (this: PerturbWorld) {
	perturbNamedSeam(this);
});

When(
	"Misson attempts to perturb a named production seam",
	function (this: PerturbWorld) {
		perturbNamedSeam(this);
	},
);

Then(
	"the seam carries the fail-fast statement from {string}",
	function (this: PerturbWorld, source: string) {
		assert.equal(source, "RIGGING.md");
		assert.equal(
			this.perturbResult?.allowed,
			true,
			`the perturbation was blocked: ${this.perturbResult?.reason ?? ""}`,
		);
		const statement = failFastStatement(process.cwd());
		const contents = readFileSync(this.perturbSeamPath!, "utf8");
		assert.ok(
			contents.includes(statement),
			`the perturbed seam does not carry the fail-fast statement:\n${contents}`,
		);
	},
);

Then(
	"the perturbed seam carries no step text, scenario name, or rationale",
	function (this: PerturbWorld) {
		const statement = failFastStatement(process.cwd());
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
			`the perturbation added text beyond the bare fail-fast statement:\n${added.join(
				"\n",
			)}`,
		);
	},
);

Then("Estelle blocks the perturbation", function (this: PerturbWorld) {
	assert.equal(
		this.perturbResult?.allowed,
		false,
		"the perturbation was allowed but should have been blocked",
	);
	const contents = readFileSync(this.perturbSeamPath!, "utf8");
	assert.equal(
		contents,
		this.perturbSeamOriginal,
		"the blocked perturbation still altered the seam",
	);
});

Then(
	"Estelle reports that only the Captain perturbs",
	function (this: PerturbWorld) {
		const reason = this.perturbResult?.reason ?? "";
		assert.ok(
			/only the Captain/i.test(reason) && /perturb/i.test(reason),
			`the block reason did not report that only the Captain perturbs: ${reason}`,
		);
	},
);
