import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { relative, resolve } from "node:path";
import { After, Given, Then, When } from "@cucumber/cucumber";
import type { EstelleWorld } from "../support/world.js";

// Extra state this feature's one scenario carries between its steps. Kept off the
// shared world; attached to the live world instance and read back structurally.
type ShapeWorld = EstelleWorld & {
	shapeSeamPaths?: string[];
	shapeTempDir?: string;
	shapeVerifier?: { status: number | null; output: string };
};

// Turn a repo-root-relative artifact path into an import specifier usable from a
// sibling temp directory placed directly under the repo root. The real seams are
// TypeScript sources imported with a ".js" specifier, the convention the existing
// support code uses; the scantling is a ".d.ts" declaration imported extensionless.
function seamSpecifier(root: string, tmpDir: string, artifact: string): string {
	const rel = relative(tmpDir, resolve(root, artifact));
	return rel.replace(/\.ts$/, ".js");
}

function scantlingSpecifier(
	root: string,
	tmpDir: string,
	artifact: string,
): string {
	const rel = relative(tmpDir, resolve(root, artifact));
	return rel.replace(/\.d\.ts$/, "").replace(/\.ts$/, "");
}

Given(
	"the flagship seam at {string} and the shim seam at {string}",
	function (this: ShapeWorld, flagship: string, shim: string) {
		this.shapeSeamPaths = [flagship, shim];
	},
);

When(
	"the verifier checks each seam against the {string} scantling in {string}",
	function (this: ShapeWorld, _name: string, scantlingPath: string) {
		const root = process.cwd();
		const [flagship, shim] = this.shapeSeamPaths ?? [];
		assert.ok(
			flagship && shim,
			"the seam paths were not set by the preceding step",
		);

		// A disposable directory directly under the repo root, so its relative
		// imports reach the real seams and the scantling, and the project tsconfig
		// resolves the same way it does for the checked-in support code. Teardown
		// removes it. The generated module discharges the scantling structurally:
		// the two real seams together must provide every value export the contract
		// declares, with assignable signatures. tsc is the verifier; a seam that
		// drops or narrows a pinned member reddens it as a counterexample.
		const tmpDir = mkdtempSync(resolve(root, ".estelle-conformance-"));
		this.shapeTempDir = tmpDir;

		const contractSpec = scantlingSpecifier(root, tmpDir, scantlingPath);
		const flagshipSpec = seamSpecifier(root, tmpDir, flagship);
		const shimSpec = seamSpecifier(root, tmpDir, shim);

		const conformance = [
			`type Contract = typeof import(${JSON.stringify(contractSpec)});`,
			`import * as flagship from ${JSON.stringify(flagshipSpec)};`,
			`import * as shim from ${JSON.stringify(shimSpec)};`,
			"const _discharge: Contract = { ...flagship, ...shim };",
			"void _discharge;",
			"",
		].join("\n");
		writeFileSync(resolve(tmpDir, "conformance.ts"), conformance, "utf8");

		const tsconfig = {
			extends: resolve(root, "tsconfig.json"),
			compilerOptions: { noEmit: true },
			files: ["./conformance.ts"],
		};
		writeFileSync(
			resolve(tmpDir, "tsconfig.json"),
			JSON.stringify(tsconfig, null, 2),
			"utf8",
		);

		const result = spawnSync(
			"pnpm",
			["exec", "tsc", "-p", resolve(tmpDir, "tsconfig.json")],
			{ cwd: root, encoding: "utf8" },
		);
		this.shapeVerifier = {
			status: result.status,
			output: `${result.stdout || ""}${result.stderr || ""}${
				result.error ? String(result.error) : ""
			}`,
		};
	},
);

Then("no counterexample is found", function (this: ShapeWorld) {
	const verifier = this.shapeVerifier;
	assert.ok(verifier, "the verifier did not run");
	assert.equal(
		verifier.status,
		0,
		`the seams do not discharge against the scantling:\n${verifier.output}`,
	);
});

After(function (this: ShapeWorld) {
	if (this.shapeTempDir) {
		rmSync(this.shapeTempDir, { recursive: true, force: true });
		this.shapeTempDir = undefined;
	}
});
