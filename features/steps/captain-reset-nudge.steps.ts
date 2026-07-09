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

// The next turn's own observed output and event trail, so the assertion reads
// only the turn under test and a silent turn failure surfaces with the last
// observed state.
type NextTurnWorld = EstelleWorld & {
	nextTurnReplies?: string[];
	nextTurnEvents?: string[];
};

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
	async function (this: NextTurnWorld) {
		const session = startedSession(this);
		// Settle Bonny's live opening turn on its observed signal before triggering
		// the next turn: poll until the opening reply has landed and the stream is
		// idle, bounded by a deadline. Aborting a turn here would kill the opening
		// reply mid-flight or leave a queued opening turn to interleave with the
		// turn under test.
		const settleDeadline = Date.now() + 120000;
		while (Date.now() < settleDeadline) {
			const opened = session.messages.some(
				(message) =>
					message.role === "assistant" &&
					messageText(message).trim().length > 0,
			);
			if (opened && !session.isStreaming) {
				break;
			}
			await new Promise((resolve) => setTimeout(resolve, 250));
		}
		// Record the observed event trail and the pre-turn message boundary, so
		// the assertion reads only what this turn produced.
		const events: string[] = [];
		const recordUnsubscribe = session.subscribe((event) => {
			events.push(
				`${event.type}${
					event.willRetry === undefined ? "" : ` willRetry=${event.willRetry}`
				}`,
			);
		});
		const before = session.messages.length;
		// Trigger Bonny's turn with a neutral operator line that dictates no action
		// and names no reset. Each scenario's own prior context decides what Bonny
		// does: honour the reset nudge here, embark from confirmed intent in
		// live-crew. The wait ends on the turn's own end signal, agent_end with no
		// retry pending; a resolved sendUserMessage alone is a fallback with a
		// short drain, since a turn that fails silently resolves it with no reply.
		try {
			await new Promise<void>((resolve, reject) => {
				let done = false;
				const finish = (error?: unknown) => {
					if (done) {
						return;
					}
					done = true;
					endUnsubscribe();
					if (error) {
						reject(error as Error);
					} else {
						resolve();
					}
				};
				const endUnsubscribe = session.subscribe((event) => {
					if (event.type === "agent_end" && event.willRetry === false) {
						finish();
					}
				});
				session.sendUserMessage("Please carry on.").then(() => {
					// Fallback: the send resolved without an observed agent_end. Give
					// the end signal a short drain, then settle with what was observed.
					setTimeout(finish, 5000);
				}, finish);
			});
		} finally {
			recordUnsubscribe();
		}
		this.nextTurnReplies = session.messages
			.slice(before)
			.filter((message) => message.role === "assistant")
			.map(messageText)
			.filter((text) => text.trim().length > 0);
		this.nextTurnEvents = events;
	},
);

Then(
	"Bonny offers the operator a fresh context for the next batch",
	function (this: NextTurnWorld) {
		const replies = this.nextTurnReplies ?? [];
		assert.ok(
			replies.length > 0,
			`Bonny produced no live assistant reply on their next turn; observed turn events: ${JSON.stringify(
				this.nextTurnEvents ?? [],
			)}; all session replies: ${JSON.stringify(
				startedSession(this)
					.messages.filter((message) => message.role === "assistant")
					.map(messageText),
			)}`,
		);
		const reply = replies.join("\n");
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
