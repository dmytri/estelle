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
import { basename, dirname, join, resolve } from "node:path";
import { After, Given, Then } from "@cucumber/cucumber";
import ts from "typescript";
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
	methLiveTurnSteps?: StepRegistration[];
	methImplementationPaths?: string[];
	methPlankPlacements?: PlankPlacement[];
	methRegistrations?: Registration[];
	methShimImports?: ImportSpecifier[];
	methCatalogTexts?: string[];
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

// Scenario: The implementation passes the project code lint.

// The implementation paths the RIGGING "implementation" directories name,
// repo-root-relative so the linter reports readable paths: root src, bin, and
// package.json, plus each workspace package's src, index.ts, and package.json.
function implementationPaths(root: string): string[] {
	const out: string[] = [];
	for (const candidate of ["src", "bin", "package.json"]) {
		if (existsSync(join(root, candidate))) {
			out.push(candidate);
		}
	}
	for (const pkg of packageDirs(root)) {
		for (const candidate of ["src", "index.ts", "package.json"]) {
			if (existsSync(join(pkg, candidate))) {
				out.push(join("packages", basename(pkg), candidate));
			}
		}
	}
	return out;
}

Given(
	"the project's implementation directories and the code lint configuration",
	function (this: MethWorld) {
		const paths = implementationPaths(process.cwd());
		assert.ok(paths.length > 0, "no implementation paths were found to lint");
		assert.ok(
			existsSync(join(process.cwd(), "biome.json")),
			'the code lint configuration "biome.json" is absent',
		);
		this.methImplementationPaths = paths;
	},
);

Then("the code linter reports no violation", function (this: MethWorld) {
	// "No violation" means no diagnostic at all: biome exits zero while still
	// reporting warnings, and a reported warning is a reported violation, so
	// the run escalates warnings to the exit code.
	const paths = this.methImplementationPaths ?? [];
	const result = spawnSync(
		"pnpm",
		["exec", "biome", "check", "--error-on-warnings", ...paths],
		{
			cwd: process.cwd(),
			encoding: "utf8",
		},
	);
	assert.equal(
		result.status,
		0,
		`the code linter reported a violation or could not run:\n${
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

// Scenario: Every live crew-session step carries a live-step timeout budget.

// Markers naming a genuine live crew-session turn: the crew-session and
// interactive-handle seams the live-crew feature documents as running a real
// provider turn under "@eval". A step definition whose body calls one of these
// awaits a live crew-session turn, and must carry an explicit timeout at least
// as long as the smallest live-step budget already proven in this codebase.
const LIVE_TURN_MARKER: RegExp[] = [
	/\.runTurn\(/,
	/\.handOffToCrew\(/,
	/\.reportCrewRun\(/,
	/\bembark\.run\(/,
	/agent_end/,
];
const LIVE_STEP_BUDGET_MS = 120000;

interface StepRegistration {
	file: string;
	line: number;
	callText: string;
}

// Blank every comment to spaces, preserving line breaks and every string and
// template literal untouched. A prose comment's possessive apostrophe, such as
// "the operator's message", would otherwise read as a string delimiter to the
// balanced-paren scan below and desync it across the rest of the file.
function stripComments(source: string): string {
	let out = "";
	let inString: string | null = null;
	let inLineComment = false;
	let inBlockComment = false;
	for (let i = 0; i < source.length; i++) {
		const ch = source[i];
		const next = source[i + 1];
		if (inLineComment) {
			if (ch === "\n") {
				inLineComment = false;
				out += ch;
			} else {
				out += " ";
			}
			continue;
		}
		if (inBlockComment) {
			if (ch === "*" && next === "/") {
				inBlockComment = false;
				out += "  ";
				i++;
			} else {
				out += ch === "\n" ? "\n" : " ";
			}
			continue;
		}
		if (inString) {
			out += ch;
			if (ch === "\\") {
				out += next ?? "";
				i++;
				continue;
			}
			if (ch === inString) {
				inString = null;
			}
			continue;
		}
		if (ch === '"' || ch === "'" || ch === "`") {
			inString = ch;
			out += ch;
			continue;
		}
		if (ch === "/" && next === "/") {
			inLineComment = true;
			out += "  ";
			i++;
			continue;
		}
		if (ch === "/" && next === "*") {
			inBlockComment = true;
			out += "  ";
			i++;
			continue;
		}
		out += ch;
	}
	return out;
}

// Extract each Given/When/Then registration's full call text through a
// balanced-paren scan that tracks string and template literal content, so a
// paren inside a quoted step pattern or a template literal never desyncs the
// match. The scan starts at the keyword's own call, not at nested calls the
// step body may make, so each registration is captured whole. Comments are
// blanked first, so a possessive apostrophe in prose never misreads as a
// string delimiter.
function extractStepRegistrations(
	file: string,
	rawSource: string,
): StepRegistration[] {
	const source = stripComments(rawSource);
	const out: StepRegistration[] = [];
	for (const keyword of ["Given", "When", "Then"]) {
		const marker = `${keyword}(`;
		let idx = 0;
		while (true) {
			const found = source.indexOf(marker, idx);
			if (found === -1) {
				break;
			}
			const before = source[found - 1];
			if (before !== undefined && /[A-Za-z0-9_$]/.test(before)) {
				idx = found + marker.length;
				continue;
			}
			let i = found + keyword.length; // positioned at the call's "("
			let depth = 0;
			let inString: string | null = null;
			const start = i;
			for (; i < source.length; i++) {
				const ch = source[i];
				if (inString) {
					if (ch === "\\") {
						i++;
						continue;
					}
					if (ch === inString) {
						inString = null;
					}
					continue;
				}
				if (ch === '"' || ch === "'" || ch === "`") {
					inString = ch;
					continue;
				}
				if (ch === "(") {
					depth++;
				} else if (ch === ")") {
					depth--;
					if (depth === 0) {
						i++;
						break;
					}
				}
			}
			out.push({
				file,
				line: source.slice(0, found).split("\n").length,
				callText: source.slice(start, i),
			});
			idx = i;
		}
	}
	return out;
}

// A step's explicit timeout lives in an options object argument between the
// pattern string and the handler function, the shape every live step in this
// codebase already uses: `Given(text, { timeout: N }, async function ...)`.
// Search only that prefix, so a coincidental "timeout" mention inside the
// handler body never satisfies the check.
function declaredTimeoutMs(callText: string): number | undefined {
	const handlerAt = callText.search(/(?:async\s+)?function\s*\(/);
	const prefix = handlerAt === -1 ? callText : callText.slice(0, handlerAt);
	const match = prefix.match(/\{\s*timeout:\s*(\d+)/);
	return match ? Number(match[1]) : undefined;
}

function awaitsLiveCrewTurn(callText: string): boolean {
	return LIVE_TURN_MARKER.some((pattern) => pattern.test(callText));
}

Given(
	"the project's step definitions that await a live crew-session turn",
	function (this: MethWorld) {
		const registrations = verificationSupportFiles(process.cwd()).flatMap(
			(file) => extractStepRegistrations(file, readFileSync(file, "utf8")),
		);
		const liveSteps = registrations.filter((registration) =>
			awaitsLiveCrewTurn(registration.callText),
		);
		assert.ok(
			liveSteps.length > 0,
			"no step definition was found that awaits a live crew-session turn",
		);
		this.methLiveTurnSteps = liveSteps;
	},
);

Then(
	"each one declares an explicit timeout at least as long as the live-step budget",
	function (this: MethWorld) {
		const violations = (this.methLiveTurnSteps ?? []).filter((step) => {
			const timeout = declaredTimeoutMs(step.callText);
			return timeout === undefined || timeout < LIVE_STEP_BUDGET_MS;
		});
		assert.equal(
			violations.length,
			0,
			`step definition awaits a live crew-session turn without the live-step budget:\n${violations
				.map((v) => `  ${v.file}:${v.line}`)
				.join("\n")}`,
		);
	},
);

// Scenario: Every plank annotates a seam declaration in docblock form.

interface PlankPlacement {
	file: string;
	line: number;
	text: string;
	docblock: boolean;
	attached: boolean;
}

// Declarations that can own a seam, the same set the plank inventory binds to.
function seamDeclarations(sf: ts.SourceFile): { start: number; end: number }[] {
	const decls: { start: number; end: number }[] = [];
	function visit(node: ts.Node) {
		if (
			ts.isFunctionDeclaration(node) ||
			ts.isMethodDeclaration(node) ||
			ts.isPropertyAssignment(node) ||
			ts.isVariableDeclaration(node) ||
			ts.isClassDeclaration(node)
		) {
			decls.push({ start: node.getStart(sf), end: node.getEnd() });
		}
		ts.forEachChild(node, visit);
	}
	ts.forEachChild(sf, visit);
	return decls;
}

// Read every @planks annotation with the comment kind that carries it and
// whether it leads a seam declaration. A docblock is a MultiLineCommentTrivia;
// a leading docblock is attached when a seam declaration begins right after it,
// the same 400-character binding the plank inventory uses.
function collectPlankPlacements(files: string[]): PlankPlacement[] {
	const out: PlankPlacement[] = [];
	for (const file of files) {
		const src = readFileSync(file, "utf8");
		const sf = ts.createSourceFile(file, src, ts.ScriptTarget.Latest, true);
		const decls = seamDeclarations(sf);
		const seen = new Set<string>();
		function scan(node: ts.Node) {
			const ranges = [
				...(ts.getLeadingCommentRanges(src, node.getFullStart()) ?? []),
				...(ts.getTrailingCommentRanges(src, node.getEnd()) ?? []),
			];
			for (const range of ranges) {
				const key = `${range.pos}:${range.end}`;
				if (seen.has(key)) {
					continue;
				}
				seen.add(key);
				const text = src.slice(range.pos, range.end);
				PLANK.lastIndex = 0;
				let match = PLANK.exec(text);
				if (match === null) {
					continue;
				}
				const docblock = range.kind === ts.SyntaxKind.MultiLineCommentTrivia;
				const attached = decls.some(
					(d) => d.start >= range.end && d.start - range.end < 400,
				);
				const line = sf.getLineAndCharacterOfPosition(range.pos).line + 1;
				while (match !== null) {
					const t = match[1].replace(/\\"/g, '"').replace(/\\\\/g, "\\");
					out.push({ file, line, text: t, docblock, attached });
					match = PLANK.exec(text);
				}
			}
		}
		function walk(node: ts.Node) {
			scan(node);
			ts.forEachChild(node, walk);
		}
		walk(sf);
	}
	return out;
}

function tsProductionFiles(root: string): string[] {
	return productionFiles(root).filter(
		(f) => f.endsWith(".ts") || f.endsWith(".js"),
	);
}

Given(
	"the project's plank annotations and their placement",
	function (this: MethWorld) {
		this.methPlankPlacements = collectPlankPlacements(
			tsProductionFiles(process.cwd()),
		);
		assert.ok(
			this.methPlankPlacements.length > 0,
			"no plank annotations were found in the production code",
		);
	},
);

Then(
	"every plank is a docblock tag attached to a seam declaration",
	function (this: MethWorld) {
		const violations = (this.methPlankPlacements ?? []).filter(
			(p) => !p.docblock || !p.attached,
		);
		assert.equal(
			violations.length,
			0,
			`plank is not a docblock tag on a seam declaration:\n${violations
				.map(
					(v) =>
						`  ${v.file}:${v.line}: ${
							v.docblock
								? "docblock not leading a declaration"
								: "line-comment plank"
						}: ${v.text}`,
				)
				.join("\n")}`,
		);
	},
);

// Scenario: Every registered command, seat, and tool name has one implementation.

interface Registration {
	registry: "command" | "tool" | "seat";
	name: string;
}

// Names from a repeated array literal such as SEAT_COMMANDS, with the leading
// slash the loop strips before registering.
function arrayLiteralNames(src: string, constName: string): string[] {
	const match = src.match(
		new RegExp(`const ${constName}\\s*=\\s*\\[([^\\]]*)\\]`),
	);
	if (!match) {
		return [];
	}
	return [...match[1].matchAll(/"([^"]+)"/g)].map((m) =>
		m[1].replace(/^\//, ""),
	);
}

// The named-registration mechanism the flagship uses: slash commands and the
// model tool are registered in createEstelleExtension; seats are the SEATS map.
// A name registered twice in one registry resolves ambiguously. The command and
// tool registries are distinct namespaces, so a name may name both a command and
// a tool without conflict; the check runs per registry.
function collectRegistrations(root: string): Registration[] {
	const src = readFileSync(join(root, "src", "index.ts"), "utf8");
	const out: Registration[] = [];
	for (const name of arrayLiteralNames(src, "SEAT_COMMANDS")) {
		out.push({ registry: "command", name });
	}
	for (const name of arrayLiteralNames(src, "ALONGSIDE_COMMANDS")) {
		out.push({ registry: "command", name });
	}
	for (const m of src.matchAll(/registerCommand\(\s*"([^"]+)"/g)) {
		out.push({ registry: "command", name: m[1] });
	}
	for (const m of src.matchAll(
		/registerTool\(\s*\{[\s\S]*?name:\s*"([^"]+)"/g,
	)) {
		out.push({ registry: "tool", name: m[1] });
	}
	const seatsBlock = src.match(/const SEATS[\s\S]*?\n\};/);
	if (seatsBlock) {
		for (const m of seatsBlock[0].matchAll(/id:\s*"([^"]+)"/g)) {
			out.push({ registry: "seat", name: m[1] });
		}
	}
	return out;
}

Given(
	"the project's command, seat, and tool registrations",
	function (this: MethWorld) {
		this.methRegistrations = collectRegistrations(process.cwd());
		assert.ok(
			this.methRegistrations.length > 0,
			"no command, seat, or tool registrations were found",
		);
	},
);

Then(
	"each registered name resolves to exactly one implementation",
	function (this: MethWorld) {
		const byRegistry = new Map<string, Map<string, number>>();
		for (const reg of this.methRegistrations ?? []) {
			const counts = byRegistry.get(reg.registry) ?? new Map<string, number>();
			counts.set(reg.name, (counts.get(reg.name) ?? 0) + 1);
			byRegistry.set(reg.registry, counts);
		}
		const duplicates: string[] = [];
		for (const [registry, counts] of byRegistry) {
			for (const [name, count] of counts) {
				if (count > 1) {
					duplicates.push(`  ${registry} "${name}" registered ${count} times`);
				}
			}
		}
		assert.equal(
			duplicates.length,
			0,
			`registered name resolves to more than one implementation:\n${duplicates.join(
				"\n",
			)}`,
		);
	},
);

// Scenario: The shim seam does not import the flagship.

interface ImportSpecifier {
	file: string;
	line: number;
	specifier: string;
}

function shimSourceFiles(root: string): string[] {
	const out: string[] = [];
	collectFiles(
		join(root, "packages", "pi-open-plugin-shim", "src"),
		(p) => p.endsWith(".ts"),
		out,
	);
	return out;
}

// Every module specifier the shim source imports: static import, side-effect
// import, dynamic import(), and require().
function extractImports(file: string): ImportSpecifier[] {
	const src = readFileSync(file, "utf8");
	const out: ImportSpecifier[] = [];
	const patterns = [
		/import\s[^"';]*?from\s*["']([^"']+)["']/g,
		/import\s*["']([^"']+)["']/g,
		/import\s*\(\s*["']([^"']+)["']\s*\)/g,
		/require\s*\(\s*["']([^"']+)["']\s*\)/g,
	];
	for (const pattern of patterns) {
		for (const m of src.matchAll(pattern)) {
			const line = src.slice(0, m.index ?? 0).split("\n").length;
			out.push({ file, line, specifier: m[1] });
		}
	}
	return out;
}

function flagshipPackageName(root: string): string {
	return (
		JSON.parse(readFileSync(join(root, "package.json"), "utf8")) as {
			name: string;
		}
	).name;
}

// A specifier resolves to the flagship when it names the flagship package, a
// subpath of it, or a relative path that climbs out of the shim package into the
// flagship source tree.
function resolvesToFlagship(
	spec: ImportSpecifier,
	root: string,
	flagship: string,
): boolean {
	if (
		spec.specifier === flagship ||
		spec.specifier.startsWith(`${flagship}/`)
	) {
		return true;
	}
	if (spec.specifier.startsWith(".")) {
		const resolved = resolve(dirname(spec.file), spec.specifier);
		const flagshipSrc = resolve(root, "src");
		const shimRoot = resolve(root, "packages", "pi-open-plugin-shim");
		if (
			(resolved === flagshipSrc || resolved.startsWith(`${flagshipSrc}/`)) &&
			!resolved.startsWith(`${shimRoot}/`)
		) {
			return true;
		}
	}
	return false;
}

Given("the shim's source imports", function (this: MethWorld) {
	const files = shimSourceFiles(process.cwd());
	assert.ok(files.length > 0, "no shim source files were found");
	this.methShimImports = files.flatMap((f) => extractImports(f));
	assert.ok(
		this.methShimImports.length > 0,
		"the shim source declares no imports",
	);
});

Then(
	"none of them resolves to the flagship package",
	function (this: MethWorld) {
		const root = process.cwd();
		const flagship = flagshipPackageName(root);
		const violations = (this.methShimImports ?? []).filter((spec) =>
			resolvesToFlagship(spec, root, flagship),
		);
		assert.equal(
			violations.length,
			0,
			`shim source imports the flagship package "${flagship}":\n${violations
				.map((v) => `  ${v.file}:${v.line}: ${v.specifier}`)
				.join("\n")}`,
		);
	},
);

// Scenario: Catalogued agent-prompt copy is not duplicated in the implementation.

// Every string value in the agent-prompt catalog, flattened. The catalog holds
// the agent-facing copy the seams present; none of it may also appear as a
// string literal in the implementation, or the copy is duplicated rather than
// sourced.
function catalogTexts(root: string): string[] {
	const raw = JSON.parse(
		readFileSync(join(root, "assets", "agent-prompts.json"), "utf8"),
	);
	const out: string[] = [];
	function walk(value: unknown) {
		if (typeof value === "string") {
			out.push(value);
		} else if (Array.isArray(value)) {
			value.forEach(walk);
		} else if (value && typeof value === "object") {
			for (const nested of Object.values(value)) {
				walk(nested);
			}
		}
	}
	walk(raw);
	return out;
}

Given(
	"the agent-prompt catalog and the project's implementation",
	function (this: MethWorld) {
		this.methCatalogTexts = catalogTexts(process.cwd());
		assert.ok(
			this.methCatalogTexts.length > 0,
			"the agent-prompt catalog carries no copy",
		);
		this.methProductionFiles = productionFiles(process.cwd());
		assert.ok(
			this.methProductionFiles.length > 0,
			"no implementation files were found to scan",
		);
	},
);

Then(
	"no catalogued prompt text appears as a string literal in the implementation",
	function (this: MethWorld) {
		const texts = this.methCatalogTexts ?? [];
		const violations: string[] = [];
		for (const file of this.methProductionFiles ?? []) {
			const contents = readFileSync(file, "utf8");
			for (const text of texts) {
				if (contents.includes(text)) {
					violations.push(
						`  ${file}: catalogued copy embedded: ${JSON.stringify(
							`${text.slice(0, 60)}...`,
						)}`,
					);
				}
			}
		}
		assert.equal(
			violations.length,
			0,
			`catalogued prompt copy is duplicated in the implementation:\n${violations.join(
				"\n",
			)}`,
		);
	},
);

After(function (this: MethWorld) {
	for (const dir of this.methTempDirs ?? []) {
		rmSync(dir, { recursive: true, force: true });
	}
	this.methTempDirs = undefined;
});

// Scenario: The crew loop decides green by the project's real verification.
//
// The crew-loop driver is the production seam that repeats the QM, Crew, and
// Boatswain seat turns until its target is green. The scenario pins how that
// green is decided: by running the project's real verification command, never by
// treating a written file's existence or contents as proof. These steps scan the
// implementation for the driver and inspect its green-decision, name-agnostically
// so the check survives a rebuild of the loop under a different identifier.

type CrewLoopWorld = MethWorld & {
	methCrewLoopDrivers?: { file: string; source: string }[];
};

// Brace-matched function/arrow bodies in a source file. Depth counting keeps a
// nested inner function whole inside its enclosing body, so the driver body is
// captured entire rather than truncated at the first inner close.
function functionBodies(contents: string): string[] {
	const header =
		/(?:const|let|var)\s+[A-Za-z0-9_$]+\s*=\s*(?:async\s*)?\([^)]*\)\s*(?::[^=]+)?=>\s*\{|(?:async\s+)?function\s+[A-Za-z0-9_$]+\s*\([^)]*\)\s*\{/g;
	const bodies: string[] = [];
	let match = header.exec(contents);
	while (match !== null) {
		const braceStart = match.index + match[0].length - 1;
		let depth = 0;
		let end = braceStart;
		for (let i = braceStart; i < contents.length; i += 1) {
			const ch = contents[i];
			if (ch === "{") {
				depth += 1;
			} else if (ch === "}") {
				depth -= 1;
				if (depth === 0) {
					end = i + 1;
					break;
				}
			}
		}
		bodies.push(contents.slice(braceStart, end));
		match = header.exec(contents);
	}
	return bodies;
}

// A crew-loop driver drives seat turns in a loop gated on a target-green decision.
// Detected by a loop whose continuation is decided by a "green" gate, the stable
// shape of "keep running the crew until the target is green".
// The crew-loop driver: a loop that drives the crew's seats against the project's
// own verification. Keying on the word "green" inside the loop condition would be
// brittle -- the completion test is a named predicate once a batch can end a run --
// so identify the driver by what it actually is: a loop, the project's verify
// command, and real seat turns.
function isCrewLoopDriver(body: string): boolean {
	return (
		/\b(?:while|for)\s*\(/.test(body) &&
		/verifyCommand|projectVerifyCommand/.test(body) &&
		/runSeatTurn|SEATS\./.test(body)
	);
}

// The green gate derives its truth from reading the target file itself: an
// existsSync or readFileSync feeding a "green" predicate. This is the
// file-contents-as-proof shape the scenario forbids.
function greenReadsTargetFile(body: string): boolean {
	return /[A-Za-z0-9_$]*[Gg]reen[A-Za-z0-9_$]*\s*=\s*(?:async\s*)?\([^)]*\)\s*=>[^;]*(?:existsSync|readFileSync)\s*\(/.test(
		body,
	);
}

// The green decision runs THIS PROJECT'S own verification command, read from its
// RIGGING.md, through a child process. Naming a runner here would re-introduce the
// defect: a loop hardcoded to one runner never turns green on a project that
// verifies with anything else, so it spins through seats forever with no outcome.
// The driver must spawn the resolved project command, not a literal runner.
function greenRunsVerification(body: string): boolean {
	return (
		/(?:spawnSync|spawn|execFileSync|execFile|execSync|exec)\s*\(/.test(body) &&
		/verifyCommand|projectVerifyCommand/.test(body)
	);
}

// A crew-loop driver that spawns a hardcoded test runner rather than the project's
// own command. This is the shape that spun the crew without outcomes.
function greenHardcodesRunner(body: string): boolean {
	return /(?:spawnSync|spawn|execFileSync|execFile|execSync|exec)\s*\(\s*["'`](?:pnpm|npm|npx|yarn|node)?["'`]?[^)]*["'`](?:cucumber|cucumber-js|jest|vitest|mocha|pytest|rspec)/i.test(
		body,
	);
}

Given(
	"the crew-loop driver in the implementation",
	function (this: CrewLoopWorld) {
		const drivers: { file: string; source: string }[] = [];
		for (const file of productionFiles(process.cwd())) {
			for (const body of functionBodies(readFileSync(file, "utf8"))) {
				if (isCrewLoopDriver(body)) {
					drivers.push({ file, source: body });
				}
			}
		}
		assert.ok(
			drivers.length > 0,
			"no crew-loop driver was found in the implementation",
		);
		this.methCrewLoopDrivers = drivers;
	},
);

Then(
	"the loop decides a target green by running the project's verification command",
	function (this: CrewLoopWorld) {
		const drivers = this.methCrewLoopDrivers ?? [];
		const deciding = drivers.filter((d) => greenRunsVerification(d.source));
		assert.ok(
			deciding.length > 0,
			`no crew-loop driver decides a target green by running the project's verification command:\n${drivers
				.map((d) => `  ${d.file}`)
				.join("\n")}`,
		);
	},
);

Then(
	"no crew-loop driver hardcodes a test runner",
	function (this: CrewLoopWorld) {
		const drivers = this.methCrewLoopDrivers ?? [];
		const hardcoded = drivers.filter((d) => greenHardcodesRunner(d.source));
		assert.equal(
			hardcoded.length,
			0,
			`a crew-loop driver spawns a hardcoded test runner instead of the project's own verification command, so it can never turn a project that verifies differently green:\n${hardcoded
				.map((d) => `  ${d.file}`)
				.join("\n")}`,
		);
	},
);

Then(
	"no crew-loop seam treats a written file's contents as proof of a target green",
	function (this: CrewLoopWorld) {
		const violations = (this.methCrewLoopDrivers ?? []).filter((d) =>
			greenReadsTargetFile(d.source),
		);
		assert.equal(
			violations.length,
			0,
			`crew-loop seam decides green from a written file's contents:\n${violations
				.map((d) => `  ${d.file}`)
				.join("\n")}`,
		);
	},
);
