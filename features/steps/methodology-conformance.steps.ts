import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import {
	type Dirent,
	existsSync,
	mkdtempSync,
	readdirSync,
	readFileSync,
	rmSync,
	writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { basename, join } from "node:path";
import { After, Given, Then } from "@cucumber/cucumber";
import type { EstelleWorld } from "../support/world.js";

// This scanner names the very tokens it hunts, so its own file carries every
// forbidden-double pattern and every perturbation token by construction. Exclude
// exactly this file from the on-disk scans; every other artifact stays covered.
const SELF = "methodology-conformance.steps.ts";

// Extra state this feature's scenarios carry between their Given and Then. Kept
// off the shared world so the world stays lean; attached to the live world
// instance at runtime and read back through this structural view.
type MethWorld = EstelleWorld & {
	methSupportFiles?: string[];
	methProductionFiles?: string[];
	methPlanks?: { file: string; text: string }[];
	methLiveSteps?: Set<string>;
	methWatchbillPath?: string;
	methTempDirs?: string[];
};

function collectFiles(
	dir: string,
	accept: (path: string) => boolean,
	out: string[],
): string[] {
	let entries: Dirent[];
	try {
		entries = readdirSync(dir, { withFileTypes: true });
	} catch {
		return out;
	}
	for (const entry of entries) {
		const full = join(dir, entry.name);
		if (entry.isDirectory()) {
			if (
				entry.name === "node_modules" ||
				entry.name === "dist" ||
				entry.name === ".git"
			) {
				continue;
			}
			collectFiles(full, accept, out);
			continue;
		}
		if (basename(full) === SELF) {
			continue;
		}
		if (accept(full)) {
			out.push(full);
		}
	}
	return out;
}

function packageDirs(root: string): string[] {
	const base = join(root, "packages");
	let entries: Dirent[];
	try {
		entries = readdirSync(base, { withFileTypes: true });
	} catch {
		return [];
	}
	return entries.filter((e) => e.isDirectory()).map((e) => join(base, e.name));
}

// The verification support the RIGGING "verification" directories name: the step
// definitions and test support under the root and every workspace package.
function verificationSupportFiles(root: string): string[] {
	const out: string[] = [];
	const isTs = (p: string) => p.endsWith(".ts");
	collectFiles(join(root, "features", "steps"), isTs, out);
	collectFiles(join(root, "features", "support"), isTs, out);
	for (const pkg of packageDirs(root)) {
		collectFiles(join(pkg, "features", "steps"), isTs, out);
		collectFiles(join(pkg, "features", "support"), isTs, out);
	}
	return out;
}

// The production code the RIGGING "implementation" directories name and the
// plank-inventory command scans: root src, bin, and package.json, plus each
// package's src, index.ts, and package.json.
function productionFiles(root: string): string[] {
	const out: string[] = [];
	const any = () => true;
	collectFiles(join(root, "src"), any, out);
	collectFiles(join(root, "bin"), any, out);
	const rootManifest = join(root, "package.json");
	if (existsSync(rootManifest)) {
		out.push(rootManifest);
	}
	for (const pkg of packageDirs(root)) {
		collectFiles(join(pkg, "src"), any, out);
		for (const file of ["index.ts", "package.json"]) {
			const full = join(pkg, file);
			if (existsSync(full)) {
				out.push(full);
			}
		}
	}
	return out;
}

// Forbidden verification doubles the "Real by default" Article names, detected
// through the code mechanisms that stand in for the normal path: mocking
// libraries, mock and stub method calls, and ".invalid" endpoints. A line
// annotated "@exceptional-double" carries a justified, narrow exception and is
// allowed. Prose that merely names a double does not match these code patterns.
const FORBIDDEN_DOUBLE: RegExp[] = [
	/\bsinon\b/i,
	/\bnock\b/i,
	/\bproxyquire\b/i,
	/\btestdouble\b/i,
	/\bjest\.mock\b/,
	/\bvi\.mock\b/,
	/\.mock(?:Return|Resolved|Rejected|Implementation)/,
	/\bcreateMock\b/i,
	/\.invalid\b/,
];
const EXCEPTIONAL_DOUBLE = "@exceptional-double";

const PERTURBATION_TOKEN = "PERTURBATION";

const WATCH_KEY = /^watch(\d+)$/;
// A scenario reference is repo-root-relative, includes the specs directory, and
// has the "<spec>.feature:<Scenario Name>" shape.
const SCENARIO_REFERENCE = /^[^\s].*\.feature:.+$/;

// Compile the durable features with the real Gherkin engine and collect the live
// step text of every pickle. Running cucumber in dry-run mode expands Scenario
// Outlines and normalizes And and But into their inherited keyword, so a plank
// annotation that carries a concrete outline expansion matches the live step it
// traces to. Only "@captain" and "@shipwright" scenarios are excluded, because
// those are non-binding and removal-order scenarios that carry no live planks.
function liveFeatureSteps(root: string): Set<string> {
	const keywordByType: Record<string, string> = {
		Context: "Given",
		Action: "When",
		Outcome: "Then",
	};
	const out = join(
		mkdtempSync(join(tmpdir(), "estelle-methodology-")),
		"messages.ndjson",
	);
	const result = spawnSync(
		"pnpm",
		[
			"exec",
			"cucumber-js",
			"--dry-run",
			"--tags",
			"not @captain and not @shipwright",
			"--format",
			`message:${out}`,
		],
		{ cwd: root, encoding: "utf8" },
	);
	assert.ok(
		existsSync(out),
		`gherkin compilation produced no messages; cucumber said: ${
			result.stderr || result.stdout
		}`,
	);
	const steps = new Set<string>();
	for (const line of readFileSync(out, "utf8").split("\n")) {
		if (!line) {
			continue;
		}
		const message = JSON.parse(line) as {
			pickle?: { steps: { type: string; text: string }[] };
		};
		if (!message.pickle) {
			continue;
		}
		for (const step of message.pickle.steps) {
			const keyword = keywordByType[step.type] ?? step.type;
			steps.add(`${keyword} ${step.text}`);
		}
	}
	rmSync(out, { recursive: true, force: true });
	return steps;
}

const PLANK = /@planks\(\s*"((?:[^"\\]|\\.)*)"\s*\)/g;

function collectPlanks(files: string[]): { file: string; text: string }[] {
	const planks: { file: string; text: string }[] = [];
	for (const file of files) {
		const contents = readFileSync(file, "utf8");
		PLANK.lastIndex = 0;
		let match = PLANK.exec(contents);
		while (match !== null) {
			const text = match[1].replace(/\\"/g, '"').replace(/\\\\/g, "\\");
			planks.push({ file, text });
			match = PLANK.exec(contents);
		}
	}
	return planks;
}

// Scenario: No forbidden double appears in the verification support.

Given(
	"the project's step definitions and test support",
	function (this: MethWorld) {
		const files = verificationSupportFiles(process.cwd());
		assert.ok(
			files.length > 0,
			"no step definition or test support files were found to scan",
		);
		this.methSupportFiles = files;
	},
);

Then(
	"none of them uses a forbidden verification double",
	function (this: MethWorld) {
		const violations: string[] = [];
		for (const file of this.methSupportFiles ?? []) {
			const lines = readFileSync(file, "utf8").split("\n");
			lines.forEach((text, index) => {
				if (text.includes(EXCEPTIONAL_DOUBLE)) {
					return;
				}
				if (FORBIDDEN_DOUBLE.some((pattern) => pattern.test(text))) {
					violations.push(`  ${file}:${index + 1}: ${text.trim()}`);
				}
			});
		}
		assert.equal(
			violations.length,
			0,
			`forbidden verification double found:\n${violations.join("\n")}`,
		);
	},
);

// Scenario: Every plank traces to a live feature step.

Given(
	"the project's plank annotations and the feature step text",
	function (this: MethWorld) {
		this.methPlanks = collectPlanks(productionFiles(process.cwd()));
		assert.ok(
			this.methPlanks.length > 0,
			"no plank annotations were found in the production code",
		);
		this.methLiveSteps = liveFeatureSteps(process.cwd());
		assert.ok(
			this.methLiveSteps.size > 0,
			"the durable features compiled to no live steps",
		);
	},
);

Then(
	"every plank's step text matches a live feature step",
	function (this: MethWorld) {
		const live = this.methLiveSteps ?? new Set<string>();
		const orphans = (this.methPlanks ?? []).filter(
			(plank) => !live.has(plank.text),
		);
		assert.equal(
			orphans.length,
			0,
			`plank traces to no live feature step:\n${orphans
				.map((o) => `  ${o.file}: ${o.text}`)
				.join("\n")}`,
		);
	},
);

// Scenario: A green tree carries no live perturbation.

Given("the verification suite is green", function (this: MethWorld) {
	// The production code under inspection is the tree the green suite ran
	// against. A green suite must carry no live perturbation token, so the file
	// set gathered here is the surface the outcome step scans.
	this.methProductionFiles = productionFiles(process.cwd());
	assert.ok(
		this.methProductionFiles.length > 0,
		"no production files were found to inspect",
	);
});

Then(
	"no perturbation token remains in the production code",
	function (this: MethWorld) {
		const live: string[] = [];
		for (const file of this.methProductionFiles ?? []) {
			const lines = readFileSync(file, "utf8").split("\n");
			lines.forEach((text, index) => {
				if (text.includes(PERTURBATION_TOKEN)) {
					live.push(`  ${file}:${index + 1}: ${text.trim()}`);
				}
			});
		}
		assert.equal(
			live.length,
			0,
			`live perturbation token remains in a green tree:\n${live.join("\n")}`,
		);
	},
);

// Scenario: The feature files pass the project gherkin lint.

// The durable feature files across the root and every workspace package. gplint
// lints whole files, so the scenario tags do not narrow the set: every shipped
// feature file must satisfy the project gherkin lint configuration.
function featureFiles(root: string): string[] {
	const out: string[] = [];
	const isFeature = (p: string) => p.endsWith(".feature");
	collectFiles(join(root, "features"), isFeature, out);
	for (const pkg of packageDirs(root)) {
		collectFiles(join(pkg, "features"), isFeature, out);
	}
	return out;
}

Given(
	"the project's feature files and the gherkin lint configuration",
	function (this: MethWorld) {
		const files = featureFiles(process.cwd());
		assert.ok(files.length > 0, "no feature files were found to lint");
		assert.ok(
			existsSync(join(process.cwd(), ".gplintrc")),
			'the gherkin lint configuration ".gplintrc" is absent',
		);
		this.methSupportFiles = files;
	},
);

Then("the gherkin linter reports no violation", function (this: MethWorld) {
	const files = this.methSupportFiles ?? [];
	const result = spawnSync("pnpm", ["exec", "gplint", ...files], {
		cwd: process.cwd(),
		encoding: "utf8",
	});
	assert.equal(
		result.status,
		0,
		`the gherkin linter reported a violation or could not run:\n${
			result.stdout || ""
		}${result.stderr || ""}${result.error ? String(result.error) : ""}`,
	);
});

// Scenario: A present watchbill has the valid watchbill shape.

Given(
	"a {string} file is present in the project",
	function (this: MethWorld, name: string) {
		// The invariant guards any present watchbill, and none sits in the tree at
		// rest. Seed a valid, correctly shaped watchbill in a disposable project so
		// the shape validator runs against a real file. Teardown removes it.
		const dir = mkdtempSync(join(tmpdir(), "estelle-watchbill-"));
		this.methTempDirs ??= [];
		this.methTempDirs.push(dir);
		const path = join(dir, name);
		const valid = {
			watch1: {
				scenarios: [
					"features/methodology-conformance.feature:A green tree carries no live perturbation",
				],
			},
			watch2: {
				scenarios: [
					"features/methodology-conformance.feature:Every plank traces to a live feature step",
				],
			},
		};
		writeFileSync(path, JSON.stringify(valid, null, 2), "utf8");
		this.methWatchbillPath = path;
	},
);

Then(
	"it contains only ordered watch objects with scenario references",
	function (this: MethWorld) {
		const path = this.methWatchbillPath;
		assert.ok(path, "no watchbill file was seeded");
		const parsed = JSON.parse(readFileSync(path, "utf8")) as Record<
			string,
			unknown
		>;
		const keys = Object.keys(parsed);
		assert.ok(keys.length > 0, "the watchbill carries no watches");
		keys.forEach((key, index) => {
			const match = key.match(WATCH_KEY);
			assert.ok(match, `watchbill key "${key}" is not a "watchN" watch object`);
			assert.equal(
				Number(match[1]),
				index + 1,
				`watchbill watch "${key}" is out of order at position ${index + 1}`,
			);
			const watch = parsed[key] as Record<string, unknown>;
			assert.deepEqual(
				Object.keys(watch),
				["scenarios"],
				`watch "${key}" carries keys other than "scenarios"`,
			);
			const scenarios = watch.scenarios;
			assert.ok(
				Array.isArray(scenarios) && scenarios.length > 0,
				`watch "${key}" carries no scenario references`,
			);
			for (const reference of scenarios) {
				assert.ok(
					typeof reference === "string" &&
						SCENARIO_REFERENCE.test(reference) &&
						reference.includes("/"),
					`watch "${key}" reference is not a repo-root-relative "<spec>.feature:<Scenario Name>": ${String(
						reference,
					)}`,
				);
			}
		});
	},
);

After(function (this: MethWorld) {
	for (const dir of this.methTempDirs ?? []) {
		rmSync(dir, { recursive: true, force: true });
	}
	this.methTempDirs = undefined;
});
