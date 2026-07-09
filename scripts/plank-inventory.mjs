// Plank inventory for Shipshape. Lists every @planks(...) trace annotation
// across the RIGGING ## Directories implementation paths, read through the
// TypeScript compiler API rather than a text search. The compiler reads both
// docblock (/** */) and line-comment (//) planks from real comment ranges,
// unescapes embedded quotes correctly, and binds each plank to the declaration
// it annotates. A naive grep truncates a plank's step text at the first escaped
// quote and cannot name the seam; this reads the tokens the language defines.
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import ts from "typescript";

// The implementation paths RIGGING ## Directories names. A plank lives only in
// production code, so these are exactly the directories the inventory scans.
const IMPLEMENTATION_DIRS = ["src", "bin"];
const PACKAGE_SUBDIRS = ["src"];

function tsFilesUnder(dir, out) {
	if (!existsSync(dir)) {
		return out;
	}
	for (const entry of readdirSync(dir, { withFileTypes: true })) {
		if (entry.name === "node_modules") {
			continue;
		}
		const full = join(dir, entry.name);
		if (entry.isDirectory()) {
			tsFilesUnder(full, out);
		} else if (/\.(ts|js)$/.test(entry.name)) {
			out.push(full);
		}
	}
	return out;
}

function implementationFiles() {
	const files = [];
	for (const dir of IMPLEMENTATION_DIRS) {
		tsFilesUnder(dir, files);
	}
	if (existsSync("packages")) {
		for (const pkg of readdirSync("packages", { withFileTypes: true })) {
			if (!pkg.isDirectory()) {
				continue;
			}
			for (const sub of PACKAGE_SUBDIRS) {
				tsFilesUnder(join("packages", pkg.name, sub), files);
			}
			const index = join("packages", pkg.name, "index.ts");
			if (existsSync(index)) {
				files.push(index);
			}
		}
	}
	return files;
}

const PLANK = /@planks\(\s*"((?:[^"\\]|\\.)*)"\s*\)/g;

function extractPlanks(text) {
	const out = [];
	PLANK.lastIndex = 0;
	let match = PLANK.exec(text);
	while (match !== null) {
		out.push(match[1].replace(/\\"/g, '"').replace(/\\\\/g, "\\"));
		match = PLANK.exec(text);
	}
	return out;
}

// Every named declaration that can own a seam, with its start position and a
// readable name. A plank binds to the declaration that follows it (a leading
// comment) or, failing that, the smallest declaration that encloses it.
function declarations(sf) {
	const decls = [];
	function name(node) {
		if (node.name && ts.isIdentifier(node.name)) {
			return node.name.text;
		}
		if (ts.isPropertyAssignment(node) || ts.isMethodDeclaration(node)) {
			return node.name.getText(sf);
		}
		if (ts.isVariableDeclaration(node) && node.name) {
			return node.name.getText(sf);
		}
		return undefined;
	}
	function visit(node) {
		if (
			ts.isFunctionDeclaration(node) ||
			ts.isMethodDeclaration(node) ||
			ts.isPropertyAssignment(node) ||
			ts.isVariableDeclaration(node)
		) {
			const nm = name(node);
			if (nm) {
				decls.push({
					name: nm,
					kind: ts.SyntaxKind[node.kind],
					start: node.getStart(sf),
					end: node.getEnd(),
					line: sf.getLineAndCharacterOfPosition(node.getStart(sf)).line + 1,
				});
			}
		}
		ts.forEachChild(node, visit);
	}
	ts.forEachChild(sf, visit);
	return decls;
}

function bindSeam(decls, commentEnd) {
	// A leading comment sits just before its declaration: bind to the nearest
	// declaration that starts at or after the comment.
	let following;
	for (const d of decls) {
		if (d.start >= commentEnd && (!following || d.start < following.start)) {
			following = d;
		}
	}
	if (following && following.start - commentEnd < 400) {
		return `${following.name} (${following.kind}:${following.line})`;
	}
	// Otherwise an in-body comment: bind to the smallest declaration enclosing it.
	let enclosing;
	for (const d of decls) {
		if (d.start <= commentEnd && d.end >= commentEnd) {
			if (!enclosing || d.end - d.start < enclosing.end - enclosing.start) {
				enclosing = d;
			}
		}
	}
	return enclosing
		? `${enclosing.name} (${enclosing.kind}:${enclosing.line}, in-body)`
		: "(module scope)";
}

const files = implementationFiles();
const planks = [];
let docblock = 0;
let lineComment = 0;

for (const file of files) {
	const src = readFileSync(file, "utf8");
	const sf = ts.createSourceFile(file, src, ts.ScriptTarget.Latest, true);
	const decls = declarations(sf);
	const seen = new Set();
	function scan(node) {
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
			const found = extractPlanks(text);
			if (found.length === 0) {
				continue;
			}
			const isBlock = range.kind === ts.SyntaxKind.MultiLineCommentTrivia;
			if (isBlock) {
				docblock += found.length;
			} else {
				lineComment += found.length;
			}
			const line = sf.getLineAndCharacterOfPosition(range.pos).line + 1;
			const seam = bindSeam(decls, range.end);
			for (const t of found) {
				planks.push({
					file,
					line,
					form: isBlock ? "doc" : "line",
					seam,
					text: t,
				});
			}
		}
	}
	function walk(node) {
		scan(node);
		ts.forEachChild(node, walk);
	}
	walk(sf);
}

planks.sort((a, b) =>
	a.file === b.file ? a.line - b.line : a.file < b.file ? -1 : 1,
);

let currentFile = "";
for (const p of planks) {
	if (p.file !== currentFile) {
		currentFile = p.file;
		process.stdout.write(`\n${p.file}\n`);
	}
	process.stdout.write(
		`  ${String(p.line).padStart(4)} [${p.form}] ${p.seam}\n        ${p.text}\n`,
	);
}

const unique = new Set(planks.map((p) => p.text)).size;
process.stdout.write(
	`\n${planks.length} planks (${docblock} docblock, ${lineComment} line-comment), ${unique} unique step texts, ${files.length} files\n`,
);
