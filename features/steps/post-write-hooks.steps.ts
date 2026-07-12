import assert from "node:assert/strict";
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { Then, When } from "@cucumber/cucumber";
import type { EstelleWorld } from "../support/world.js";

// The write-hook scenarios drive the running session's real tool_result seam,
// pi's PostToolUse event, the same real-plugin path the reset-nudge scenarios
// take for a bash command. Estelle must run the installed Shipshape plugin's
// PostToolUse Edit|Write hook (feature-quality) through the shim after a seat
// writes or edits, and deliver its output into the seat's session context.
// Everything is observed on real session state: the launched session's live
// message list.

interface MessageView {
	role?: string;
	content?: unknown;
}

interface WriteHookSession {
	messages: MessageView[];
	extensionRunner: {
		emitToolResult(event: {
			type: "tool_result";
			toolCallId: string;
			toolName: string;
			input: Record<string, unknown>;
			content: { type: "text"; text: string }[];
			isError: boolean;
		}): Promise<unknown>;
	};
}

// The distinctive text the installed plugin's feature-quality PostToolUse hook
// emits when a written .feature file violates the scenario-writing agreement.
// Matching it proves the real hook's own output reached the session context,
// not a hand-written stand-in.
const FEATURE_QUALITY_MARK = "Shipshape feature quality";

let toolResultSeq = 0;

function writeHookSession(world: EstelleWorld): WriteHookSession {
	return world.launched!.session as unknown as WriteHookSession;
}

function messageText(message: MessageView): string {
	const content = message.content;
	if (typeof content === "string") {
		return content;
	}
	if (Array.isArray(content)) {
		return content
			.filter(
				(part): part is { type: string; text: string } =>
					typeof part === "object" && part !== null && part.type === "text",
			)
			.map((part) => part.text)
			.join("\n");
	}
	return "";
}

// Seed the launched workspace so the feature-quality hook actually emits: it
// gates on the written file existing, the path ending ".feature", and a
// RIGGING.md marking the directory a real Shipshape project. The seeded feature
// carries a bare "#" comment and no Feature: declaration, so the hook reports a
// scenario-writing-agreement violation. Then drive the real PostToolUse event
// for the given tool through the running session's own extension runner.
async function completeWriteToolCall(
	world: EstelleWorld,
	toolName: string,
	path: string,
): Promise<void> {
	const workspace = world.workspaceDir;
	assert.ok(workspace, "the running session has no workspace directory");
	writeFileSync(join(workspace, "RIGGING.md"), "# Rigging\n", "utf8");
	const absolute = join(workspace, path);
	mkdirSync(dirname(absolute), { recursive: true });
	writeFileSync(absolute, "# scratch\n", "utf8");
	toolResultSeq += 1;
	await writeHookSession(world).extensionRunner.emitToolResult({
		type: "tool_result",
		toolCallId: `estelle-postwrite-${toolResultSeq}`,
		toolName,
		input: { file_path: path },
		content: [{ type: "text", text: "" }],
		isError: false,
	});
}

When(
	"Bonny's write tool call to {string} completes in the running session",
	async function (this: EstelleWorld, path: string) {
		await completeWriteToolCall(this, "write", path);
	},
);

When(
	"Bonny's edit tool call to {string} completes in the running session",
	async function (this: EstelleWorld, path: string) {
		await completeWriteToolCall(this, "edit", path);
	},
);

Then(
	"the plugin's PostToolUse feature-quality output is delivered into the session context",
	function (this: EstelleWorld) {
		const delivered = writeHookSession(this)
			.messages.map(messageText)
			.filter((text) => text.includes(FEATURE_QUALITY_MARK));
		assert.ok(
			delivered.length > 0,
			`no feature-quality output reached the session context; messages: ${JSON.stringify(
				writeHookSession(this).messages.map(messageText),
			)}`,
		);
	},
);
