import assert from "node:assert/strict";
import { type Dirent, readdirSync, readFileSync } from "node:fs";
import { basename, join } from "node:path";
import { Given, Then } from "@cucumber/cucumber";
import type { EstelleWorld } from "../support/world.js";

// This invariant's own scanner must name the gendered pronouns it hunts, so its
// file carries the pattern by construction. Exclude exactly this file from the
// scan; every other spec and step definition stays covered.
const SELF = "gender-neutral-crew.steps.ts";

// Gendered third-person pronouns. The Articles require they/them for all roles
// and agents, so any of these in a durable spec or its verification support is a
// regression. Word boundaries keep substrings such as "the", "here", "this", and
// "where" from matching.
const GENDERED_PRONOUN = /\b(he|him|his|himself|she|her|hers|herself)\b/i;

// Scan the durable specs and their verification support on disk, not through
// cucumber discovery. Discovery filters by tier, so a step definition in an
// opt-in tier such as @eval is invisible to a tier-scoped sweep; reading the
// files directly covers every binding regardless of tier.
const SCAN_ROOTS = ["features", "packages"];
const SCANNED_EXTENSIONS = [".feature", ".ts"];

function collectFiles(dir: string, out: string[]): void {
	let entries: Dirent[];
	try {
		entries = readdirSync(dir, { withFileTypes: true });
	} catch {
		return;
	}
	for (const entry of entries) {
		const full = join(dir, entry.name);
		if (entry.isDirectory()) {
			if (entry.name === "node_modules" || entry.name === "dist") {
				continue;
			}
			collectFiles(full, out);
			continue;
		}
		if (basename(full) === SELF) {
			continue;
		}
		if (SCANNED_EXTENSIONS.some((ext) => entry.name.endsWith(ext))) {
			out.push(full);
		}
	}
}

interface PronounViolation {
	file: string;
	line: number;
	text: string;
}

Given(
	"the project's feature files and step definitions",
	function (this: EstelleWorld) {
		const files: string[] = [];
		for (const root of SCAN_ROOTS) {
			collectFiles(join(process.cwd(), root), files);
		}
		assert.ok(
			files.some((f) => f.endsWith(".feature")),
			"no feature files were found to scan",
		);
		assert.ok(
			files.some((f) => f.endsWith(".steps.ts")),
			"no step definition files were found to scan",
		);
		this.scannedFiles = files;
	},
);

Then("none of them contains a gendered pronoun", function (this: EstelleWorld) {
	const violations: PronounViolation[] = [];
	for (const file of this.scannedFiles ?? []) {
		const lines = readFileSync(file, "utf8").split("\n");
		lines.forEach((text, index) => {
			if (GENDERED_PRONOUN.test(text)) {
				violations.push({ file, line: index + 1, text: text.trim() });
			}
		});
	}
	assert.equal(
		violations.length,
		0,
		`gendered pronoun found:\n${violations
			.map((v) => `  ${v.file}:${v.line}: ${v.text}`)
			.join("\n")}`,
	);
});
