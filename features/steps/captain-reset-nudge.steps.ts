import assert from "node:assert/strict";
import { writeFileSync } from "node:fs";
import { join } from "node:path";
import { Given, Then, When } from "@cucumber/cucumber";
import type { EstelleWorld } from "../support/world.js";

// The reset-nudge scenarios drive a real Estelle session started through run(),
// then exercise the PostToolUse seam pi fires after a tool executes. A real
// outbound-shaped command is pushed through the running session's own
// tool_result event, the same real-plugin path the seat-custody scenarios take
// for tool_call. Estelle must run the installed Shipshape plugin's
// captain-reset-nudge hook through the shim and deliver its additionalContext
// into Bonny's session context. Everything is observed on real session state:
// the started session's live message list.

interface MessageView {
	role: string;
	content?: unknown;
	display?: boolean;
}

interface ToolResultEmitter {
	emitToolResult(event: {
		type: "tool_result";
		toolCallId: string;
		toolName: "bash";
		input: Record<string, unknown>;
		content: { type: "text"; text: string }[];
		isError: boolean;
		details?: unknown;
	}): Promise<unknown>;
}

interface SessionView {
	messages: MessageView[];
	extensionRunner: ToolResultEmitter;
	sendUserMessage(content: string): Promise<void>;
	sendCustomMessage(
		message: { customType: string; content: string; display: boolean },
		options?: { triggerTurn?: boolean },
	): Promise<void>;
	subscribe(
		listener: (event: { type: string; willRetry?: boolean }) => void,
	): () => void;
	readonly isStreaming: boolean;
	abort(): Promise<void>;
}

interface SessionRuntimeView {
	session: SessionView;
}

interface InteractiveHandleView {
	runtime: SessionRuntimeView;
	seat(): { id: string; role: string; name: string };
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

function startedSession(world: EstelleWorld): SessionView {
	const handle = world.interactiveSession as unknown as InteractiveHandleView;
	assert.ok(handle, "no started Estelle session");
	return handle.runtime.session;
}

// The distinctive text of the installed plugin's reset nudge additionalContext.
// Matching it proves the real captain-reset-nudge hook's own output reached the
// session, not a hand-written stand-in.
const NUDGE_MARK = "Batch shipped";
const NUDGE_GUIDANCE = "Offer the operator a fresh context for the next batch";

let toolResultSeq = 0;

// Drive the real command through the running session's tool_result seam, pi's
// after-the-fact PostToolUse event. Seed a RIGGING.md into the session's
// workspace first, so the session's directory is a real Shipshape project, the
// condition the installed nudge hook gates on. The command string is the real
// tool input the plugin hook inspects.
async function runCommandInStartedSession(
	world: EstelleWorld,
	command: string,
): Promise<void> {
	assert.ok(world.workspaceDir, "started session has no workspace directory");
	writeFileSync(join(world.workspaceDir, "RIGGING.md"), "# Rigging\n", "utf8");
	toolResultSeq += 1;
	await startedSession(world).extensionRunner.emitToolResult({
		type: "tool_result",
		toolCallId: `estelle-nudge-${toolResultSeq}`,
		toolName: "bash",
		input: { command },
		content: [{ type: "text", text: "" }],
		isError: false,
		details: undefined,
	});
}

When(
	"an outbound command runs in the started session and the Shipshape captain-reset-nudge fires",
	{ timeout: 120000 },
	async function (this: EstelleWorld) {
		await runCommandInStartedSession(this, "git push origin main");
	},
);

When(
	"a non-outbound command runs in the started session",
	{ timeout: 120000 },
	async function (this: EstelleWorld) {
		await runCommandInStartedSession(this, "ls -la");
	},
);

Then(
	"the reset nudge's guidance is delivered into Bonny's session context",
	function (this: EstelleWorld) {
		const delivered = startedSession(this)
			.messages.map(messageText)
			.filter((text) => text.includes(NUDGE_MARK));
		assert.ok(
			delivered.length > 0,
			`no reset nudge reached Bonny's session context; messages: ${JSON.stringify(
				startedSession(this).messages.map(messageText),
			)}`,
		);
		assert.ok(
			delivered.some((text) => text.includes(NUDGE_GUIDANCE)),
			`the delivered context did not carry the installed plugin's reset-nudge guidance ${JSON.stringify(
				NUDGE_GUIDANCE,
			)}; delivered: ${JSON.stringify(delivered)}`,
		);
	},
);

Then(
	"no reset nudge guidance is delivered into Bonny's session context",
	function (this: EstelleWorld) {
		const delivered = startedSession(this)
			.messages.map(messageText)
			.filter((text) => text.includes(NUDGE_MARK));
		assert.equal(
			delivered.length,
			0,
			`a reset nudge reached Bonny's session context on a non-outbound command; delivered: ${JSON.stringify(
				delivered,
			)}`,
		);
	},
);

// @eval: the live acceptance proof. Configure the eval model on Bonny's Captain
// seat and relaunch, so Bonny's next turn runs against a real model.
Given(
	"a live eval model is configured for Bonny",
	{ timeout: 120000 },
	async function (this: EstelleWorld) {
		const model = process.env.HARNESS_EVAL_MODEL!;
		const key = process.env.HARNESS_OPENROUTER_API_KEY!;
		writeFileSync(
			join(this.agentDir!, "estelle.json"),
			JSON.stringify({ seats: { captain: `openrouter/${model}` } }),
			"utf8",
		);
		writeFileSync(
			join(this.agentDir!, "auth.json"),
			JSON.stringify({ openrouter: { type: "api_key", key } }),
			"utf8",
		);
		const { run } = await import("../../src/index.js");
		this.interactiveSession = undefined;
		await run({
			cwd: this.workspaceDir,
			agentDir: this.agentDir,
			interactive: (session) => {
				this.interactiveSession = session;
			},
		});
	},
);

// Bonny takes their next turn off the context already in their session. This step
// is shared with the live-crew feature, so it injects no operator-visible content:
// each scenario's own prior steps establish what Bonny decides from. Here the
// reset nudge is already in context, so a live Bonny must decide, on their own,
// whether to offer a fresh context; any fresh-context offer comes from the nudge
// they honour. A hidden trigger starts the turn without naming a reset. The step
// awaits agent_end so the full turn lands before assertions read the session.
When(
	"Bonny takes their next turn",
	{ timeout: 600000 },
	async function (this: EstelleWorld) {
		const session = startedSession(this);
		// Settle Bonny's live opening turn before triggering their next turn, so the
		// trigger does not collide with a turn already in flight.
		if (session.isStreaming) {
			await session.abort();
		}
		// Trigger Bonny's turn with a neutral operator line that dictates no action
		// and names no reset. Each scenario's own prior context decides what Bonny
		// does: honour the reset nudge here, embark from confirmed intent in
		// live-crew. sendUserMessage resolves once the turn completes.
		await session.sendUserMessage("Please carry on.");
	},
);

Then(
	"Bonny offers the operator a fresh context for the next batch",
	function (this: EstelleWorld) {
		const replies = startedSession(this)
			.messages.filter((message) => message.role === "assistant")
			.map(messageText)
			.filter((text) => text.trim().length > 0);
		assert.ok(
			replies.length > 0,
			"Bonny produced no live assistant reply on their next turn",
		);
		const reply = replies[replies.length - 1];
		const offersFresh =
			/fresh context|fresh session|fresh start|start fresh|start anew|clean slate|new context|new session|reset (the |your |our |this )?(context|session)|clear (the |your |our )?context/i.test(
				reply,
			);
		assert.ok(
			offersFresh,
			`Bonny did not offer the operator a fresh context for the next batch; their reply: ${JSON.stringify(
				reply,
			)}`,
		);
	},
);
