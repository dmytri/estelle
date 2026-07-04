import assert from "node:assert/strict";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Given, Then, When } from "@cucumber/cucumber";
import type { EstelleWorld } from "../support/world.js";

// Structural view of the real pi session the interactive handle carries. The
// live-crew scenarios start a real Estelle session through run(), then read and
// seed its live message list through pi's own public seams. Sealing a batch is
// observed on real session state: the started session's seat and its messages.
interface MessageView {
	role: string;
	content?: unknown;
	display?: boolean;
}

interface SessionView {
	messages: MessageView[];
	sendCustomMessage(message: {
		customType: string;
		content: string;
		display: boolean;
	}): Promise<void>;
}

interface SessionRuntimeView {
	session: SessionView;
}

// The crew session the batch seal opens alongside the started session. The
// interactive handle exposes it as a distinct session with its own seat and
// live message list, so verification observes the started session and the crew
// session as two separate real sessions.
// The crew's heartbeat: the operator-visible sign the crew is alive. At rest it
// names the seated Quartermaster and reports no live activity yet. A live run
// drives the beat off the crew session's real event stream, latching
// sawActivity once the stream emits during the run.
interface HeartbeatView {
	name: string;
	atRest: boolean;
	sawActivity: boolean;
}

interface CrewSessionView {
	runtime: SessionRuntimeView;
	seat(): { id: string; role: string; name: string };
	heartbeat(): HeartbeatView;
	runTurn(): Promise<void>;
	write(path: string, contents: string): { allowed: boolean; reason?: string };
}

// Bonny's narration log: the recorded seat transitions Bonny voices. Each entry
// names the seat handed off from and the seat handed off to, and carries the
// line Bonny voiced for the transition. The hermetic tier reads the recorded
// from/to; the @eval tier reads the live line Bonny's model voiced.
interface NarrationEntryView {
	from: string;
	to: string;
	line: string;
}

interface InteractiveHandleView {
	runtime: SessionRuntimeView;
	seat(): { id: string; role: string; name: string };
	crewSession(): CrewSessionView | undefined;
	handOffToCrew(): Promise<void>;
	narrationLog(): NarrationEntryView[];
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

// Start a real Estelle session through the production run() entry, capturing the
// Estelle-configured runtime the same way the interactive-launch scenarios do.
// A bare operator workspace and a disposable agent dir keep the launch hermetic
// and harmless: Estelle resolves its own shipped assets and never touches the
// host ~/.pi. The interactive @exceptional-double stands in for pi's terminal
// runner; everything it captures is real production state.
async function startSession(world: EstelleWorld): Promise<void> {
	world.workspaceDir ??= mkdtempSync(join(tmpdir(), "estelle-live-crew-"));
	world.agentDir ??= mkdtempSync(join(tmpdir(), "estelle-agent-"));
	const { run } = await import("../../src/index.js");
	await run({
		cwd: world.workspaceDir,
		agentDir: world.agentDir,
		interactive: (session) => {
			world.interactiveSession = session;
		},
	});
}

Given(
	"a started Estelle session seated as the Captain {string}",
	async function (this: EstelleWorld, name: string) {
		await startSession(this);
		const seat = this.interactiveSession!.seat();
		assert.equal(seat.role, "captain");
		assert.equal(seat.name, name);
	},
);

Given(
	"a started Estelle session carrying the operator's message {string} to Bonny",
	async function (this: EstelleWorld, message: string) {
		await startSession(this);
		const runtime = this.interactiveSession!.runtime as SessionRuntimeView;
		// Seed the operator's conversation with Bonny into the started session's live
		// history. A custom message appends to the session without a provider turn,
		// so the hermetic tier needs no model. The operator's words are now carried
		// by the Captain session, ready for the batch seal to isolate the crew from.
		await runtime.session.sendCustomMessage({
			customType: "operator-message",
			content: message,
			display: true,
		});
		assert.ok(
			runtime.session.messages.some((m) => messageText(m).includes(message)),
			`started session did not carry the operator's message ${JSON.stringify(
				message,
			)}`,
		);
	},
);

function crewSession(world: EstelleWorld): CrewSessionView {
	const handle = world.interactiveSession as unknown as InteractiveHandleView;
	const crew = handle.crewSession();
	assert.ok(crew, "no crew session opened alongside the started session");
	return crew;
}

Then(
	"a crew session opens alongside the started session",
	function (this: EstelleWorld) {
		const handle = this.interactiveSession as unknown as InteractiveHandleView;
		const crew = handle.crewSession();
		assert.ok(crew, "no crew session opened alongside the started session");
		assert.notEqual(
			crew.runtime,
			handle.runtime,
			"crew session is the started session itself, not a session alongside it",
		);
	},
);

Then(
	"the crew session opens alongside the started session",
	function (this: EstelleWorld) {
		const handle = this.interactiveSession as unknown as InteractiveHandleView;
		const crew = handle.crewSession();
		assert.ok(crew, "no crew session opened alongside the started session");
		assert.notEqual(
			crew.runtime,
			handle.runtime,
			"crew session is the started session itself, not a session alongside it",
		);
	},
);

Then(
	"the crew session is seated as the Quartermaster {string}",
	function (this: EstelleWorld, name: string) {
		const seat = crewSession(this).seat();
		assert.equal(seat.role, "quartermaster");
		assert.equal(seat.name, name);
	},
);

Then(
	"the started session stays seated as the Captain {string}",
	function (this: EstelleWorld, name: string) {
		const seat = this.interactiveSession!.seat();
		assert.equal(seat.role, "captain");
		assert.equal(seat.name, name);
	},
);

Then(
	"the started session still carries the operator's message {string}",
	function (this: EstelleWorld, message: string) {
		const runtime = this.interactiveSession!.runtime as SessionRuntimeView;
		assert.ok(
			runtime.session.messages.some((m) => messageText(m).includes(message)),
			`started session no longer carries the operator's message ${JSON.stringify(
				message,
			)}`,
		);
	},
);

Given(
	"a live eval model is configured for the crew",
	async function (this: EstelleWorld) {
		const model = process.env.HARNESS_EVAL_MODEL!;
		const key = process.env.HARNESS_OPENROUTER_API_KEY!;
		// Record the eval model as the crew's seat model and seed the OpenRouter
		// provider key into the operator's agent dir, then relaunch so the crew
		// session the /embark seal opens inherits the live model. The started
		// session captured by the prior Given was seat-only; the eval run needs a
		// real model configured before the crew session opens.
		writeFileSync(
			join(this.agentDir!, "estelle.json"),
			JSON.stringify({ seats: { quartermaster: `openrouter/${model}` } }),
			"utf8",
		);
		writeFileSync(
			join(this.agentDir!, "auth.json"),
			JSON.stringify({ openrouter: { type: "api_key", key } }),
			"utf8",
		);
		this.interactiveSession = undefined;
		await startSession(this);
	},
);

When("the crew session runs a turn", async function (this: EstelleWorld) {
	const crew = crewSession(this);
	await crew.runTurn();
	// Capture what the Quartermaster's turn left in the crew session's live
	// history, so a later hand-off scenario can assert the fresh Crew session
	// carries none of it. Empty and whitespace-only entries are dropped so the
	// exclusion check has real content to match against.
	(this as unknown as { qmTurnTexts?: string[] }).qmTurnTexts =
		crew.runtime.session.messages
			.map(messageText)
			.filter((text) => text.trim().length > 0);
});

Then(
	"the crew session received a live reply from the Quartermaster's model",
	function (this: EstelleWorld) {
		// A live reply is an assistant-role message the model produced during the
		// turn, carrying real text. Read the crew session's live history and require
		// at least one assistant message with non-empty content. A vacuous turn that
		// never reached the model leaves no such message, so this fails rather than
		// passing green without a live model round trip.
		const replies = crewSession(this)
			.runtime.session.messages.filter((m) => m.role === "assistant")
			.map(messageText)
			.filter((text) => text.trim().length > 0);
		assert.ok(
			replies.length > 0,
			"crew session received no live assistant reply from the Quartermaster's model",
		);
	},
);

Then(
	"the crew session's heartbeat reflected live activity during the run",
	function (this: EstelleWorld) {
		const beat = crewSession(this).heartbeat();
		assert.equal(
			beat.sawActivity,
			true,
			`crew heartbeat recorded no live activity during the run: ${JSON.stringify(
				beat,
			)}`,
		);
	},
);

Then(
	"the crew session reports a heartbeat naming the Quartermaster {string}",
	function (this: EstelleWorld, name: string) {
		const beat = crewSession(this).heartbeat();
		assert.equal(beat.name, name);
	},
);

Then(
	"the crew session's heartbeat shows the crew at rest before it runs",
	function (this: EstelleWorld) {
		const beat = crewSession(this).heartbeat();
		assert.equal(
			beat.atRest,
			true,
			`crew heartbeat is not at rest: ${JSON.stringify(beat)}`,
		);
	},
);

Then(
	"the crew session's message history excludes the operator's message {string}",
	function (this: EstelleWorld, message: string) {
		const leaked = crewSession(this).runtime.session.messages.filter((m) =>
			messageText(m).includes(message),
		);
		assert.equal(
			leaked.length,
			0,
			`crew session's message history carries the operator's message ${JSON.stringify(
				message,
			)}; leaked messages: ${JSON.stringify(leaked.map(messageText))}`,
		);
	},
);

When(
	"the Quartermaster's crew session carries the message {string}",
	async function (this: EstelleWorld, message: string) {
		const runtime = crewSession(this).runtime as SessionRuntimeView;
		// Seed the Quartermaster's working note into the crew session's live
		// history through pi's own custom-message seam, the same way the operator's
		// message is seeded into the started session. The crew session now carries
		// the Quartermaster's context, ready for the hand-off to isolate the Crew
		// from.
		await runtime.session.sendCustomMessage({
			customType: "quartermaster-message",
			content: message,
			display: true,
		});
		assert.ok(
			runtime.session.messages.some((m) => messageText(m).includes(message)),
			`crew session did not carry the Quartermaster's message ${JSON.stringify(
				message,
			)}`,
		);
	},
);

When(
	"Estelle hands the crew off from the Quartermaster to the Crew",
	// Under @eval this seam runs a live provider turn on Bonny's Captain seat to
	// voice the handoff line, so it needs the live-step budget the sibling live
	// steps carry, not cucumber's 5000ms default. Under @logic it stays fast.
	{ timeout: 120000 },
	async function (this: EstelleWorld) {
		const handle = this.interactiveSession as unknown as InteractiveHandleView;
		await handle.handOffToCrew();
	},
);

Then(
	"the crew session is seated as a Crew hand",
	function (this: EstelleWorld) {
		const seat = crewSession(this).seat();
		assert.equal(seat.role, "crew");
	},
);

Then(
	"the crew session's message history excludes the Quartermaster's message {string}",
	function (this: EstelleWorld, message: string) {
		const leaked = crewSession(this).runtime.session.messages.filter((m) =>
			messageText(m).includes(message),
		);
		assert.equal(
			leaked.length,
			0,
			`crew session's message history carries the Quartermaster's message ${JSON.stringify(
				message,
			)}; leaked messages: ${JSON.stringify(leaked.map(messageText))}`,
		);
	},
);

Then(
	"the crew session's message history excludes the Quartermaster's turn",
	function (this: EstelleWorld) {
		const captured =
			(this as unknown as { qmTurnTexts?: string[] }).qmTurnTexts ?? [];
		assert.ok(
			captured.length > 0,
			"no Quartermaster turn was captured before the hand-off",
		);
		const freshHistory =
			crewSession(this).runtime.session.messages.map(messageText);
		const leaked = captured.filter((text) =>
			freshHistory.some((message) => message.includes(text)),
		);
		assert.equal(
			leaked.length,
			0,
			`fresh Crew session carries the Quartermaster's turn end; leaked: ${JSON.stringify(
				leaked,
			)}`,
		);
	},
);

function handoffNarration(world: EstelleWorld): NarrationEntryView {
	const handle = world.interactiveSession as unknown as InteractiveHandleView;
	const entry = handle
		.narrationLog()
		.find((e) => e.from === "quartermaster" && e.to === "crew");
	assert.ok(
		entry,
		`Bonny's narration log records no handoff from the Quartermaster to the Crew: ${JSON.stringify(
			handle.narrationLog(),
		)}`,
	);
	return entry;
}

Then(
	"Bonny's narration log records a handoff from the Quartermaster to the Crew",
	function (this: EstelleWorld) {
		handoffNarration(this);
	},
);

Given(
	"a live eval model is configured for the crew and Bonny",
	async function (this: EstelleWorld) {
		const model = process.env.HARNESS_EVAL_MODEL!;
		const key = process.env.HARNESS_OPENROUTER_API_KEY!;
		// Record the eval model as both the crew's Quartermaster seat model and
		// Bonny's Captain seat model, then relaunch so the crew session and Bonny's
		// narration both run against the live model. Bonny voices the handoff line,
		// so her Captain seat needs the model too, not the Quartermaster seat alone.
		writeFileSync(
			join(this.agentDir!, "estelle.json"),
			JSON.stringify({
				seats: {
					quartermaster: `openrouter/${model}`,
					captain: `openrouter/${model}`,
				},
			}),
			"utf8",
		);
		writeFileSync(
			join(this.agentDir!, "auth.json"),
			JSON.stringify({ openrouter: { type: "api_key", key } }),
			"utf8",
		);
		this.interactiveSession = undefined;
		await startSession(this);
	},
);

Then(
	"Bonny's narration for the handoff carries a live line in her voice",
	function (this: EstelleWorld) {
		// A live line is real text Bonny's model voiced for the handoff, not a
		// static template. Require the recorded QM -> Crew narration line to be the
		// output of a real provider turn on Bonny's Captain seat: it MUST appear as
		// a non-empty assistant message in Bonny's own live session, the same seam
		// the Quartermaster's live-reply scenario reads. A hardcoded template pushed
		// straight into the log never reaches Bonny's session, so this fails rather
		// than passing green without a live Bonny round trip.
		const entry = handoffNarration(this);
		assert.ok(
			entry.line.trim().length > 0,
			`Bonny's narration for the handoff carries no live line: ${JSON.stringify(
				entry,
			)}`,
		);
		const handle = this.interactiveSession as unknown as InteractiveHandleView;
		const bonnyReplies = handle.runtime.session.messages
			.filter((m) => m.role === "assistant")
			.map(messageText)
			.filter((text) => text.trim().length > 0);
		assert.ok(
			bonnyReplies.includes(entry.line),
			`Bonny's narration line was not voiced by her live model; line: ${JSON.stringify(
				entry.line,
			)}; Bonny's assistant replies: ${JSON.stringify(bonnyReplies)}`,
		);
	},
);

Then(
	"the crew session allows a Crew hand to write {string}",
	function (this: EstelleWorld, path: string) {
		const result = crewSession(this).write(path, "estelle verification\n");
		assert.equal(
			result.allowed,
			true,
			`crew session blocked the write to ${JSON.stringify(path)}: ${
				result.reason ?? ""
			}`,
		);
	},
);

Then(
	"the crew session blocks a Crew hand from writing {string}",
	function (this: EstelleWorld, path: string) {
		const result = crewSession(this).write(path, "estelle verification\n");
		assert.equal(
			result.allowed,
			false,
			`crew session allowed the write to ${JSON.stringify(
				path,
			)} but Crew custody should block it`,
		);
	},
);
