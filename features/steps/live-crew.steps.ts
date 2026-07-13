import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import {
	mkdirSync,
	mkdtempSync,
	readFileSync,
	symlinkSync,
	writeFileSync,
} from "node:fs";
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
	customType?: string;
}

interface SessionView {
	messages: MessageView[];
	sendCustomMessage(
		message: {
			customType: string;
			content: string;
			display: boolean;
		},
		options?: { triggerTurn?: boolean },
	): Promise<void>;
	sendUserMessage(
		content: string,
		options?: { triggerTurn?: boolean },
	): Promise<unknown>;
	subscribe(
		listener: (event: { type: string; willRetry?: boolean }) => void,
	): () => void;
	readonly isStreaming: boolean;
	abort(): Promise<void>;
}

// Bonny's live opening turn keeps streaming after launch. On the real run the
// operator embarks after that opening settles; the hermetic tier has no opening
// turn at all. So before a step drives the operator's session, settle any turn in
// flight to idle, standing in for the operator waiting for Bonny to finish.
async function settleOperatorTurn(session: SessionView): Promise<void> {
	if (session.isStreaming) {
		await session.abort();
	}
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
	commit(): { allowed: boolean; reason?: string };
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

// Bonny's crew-run report: the distilled summary Estelle reports back into
// Bonny's started session when the crew's run ends. Each entry carries the
// summary line Bonny can speak to. The firewall holds: the report carries the
// distilled summary, never the crew's raw context. The hermetic tier reads the
// recorded summary; the @eval tier reads the live summary Bonny's model voiced.
interface CrewRunReportView {
	summary: string;
}

interface InteractiveHandleView {
	runtime: SessionRuntimeView;
	seat(): { id: string; role: string; name: string };
	crewSession(): CrewSessionView | undefined;
	handOffToCrew(): Promise<void>;
	narrationLog(): NarrationEntryView[];
	reportCrewRun(): Promise<void>;
	crewRunReports(): CrewRunReportView[];
	// Slice 6: the full loop. Estelle drives the run off the Quartermaster's
	// verdict. reportFailingTarget and reportAllGreen seed the current verdict.
	// advanceCrewLoop reads that verdict and either dispatches the Crew to the
	// failing target or ends the run. advanceCrewLoopThroughToBoatswain drives
	// the loop far enough to seat the Boatswain for the commit. crewDispatches
	// records each target the Crew was sent to; crewRunEnded latches when the
	// verdict turned all green and the run closed without a further dispatch.
	reportFailingTarget(target: string): void;
	reportAllGreen(): void;
	advanceCrewLoop(): Promise<void>;
	advanceCrewLoopThroughToBoatswain(): Promise<void>;
	crewDispatches(): { target: string }[];
	crewRunEnded(): boolean;
	awaitCrewRun(): Promise<void>;
	cancelCrewRun(): Promise<void>;
	dispatchBoatswain(job?: string): Promise<string>;
	// Slice 7: Bonny embarks from their own turn. The embark seam is a real
	// Captain-seat tool the seated model can call, not an operator command.
	// captainTools lists the tools registered on Bonny's Captain seat; each run()
	// invokes the real registered tool the way the seated model would. The
	// hermetic tier drives the registered tool directly, standing in for the live
	// model's decision to call it; the @eval tier proves a live Bonny calls it.
	captainTools(): CaptainToolView[];
}

interface CaptainToolView {
	name: string;
	run(): Promise<void>;
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

When(
	"the crew session runs a turn",
	// Under @eval this drives a real provider turn on the crew session's seated
	// model, so it needs the live-step budget the sibling live steps carry, not
	// cucumber's 5000ms default. Under @logic it stays fast.
	{ timeout: 120000 },
	async function (this: EstelleWorld) {
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
	},
);

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
	"the crew session's heartbeat shows the crew is no longer at rest during the run",
	function (this: EstelleWorld) {
		// The resting sign clears once the live run drives the beat off the crew
		// session's real event stream. At rest before the run, atRest is true; a
		// live turn moves the crew, so atRest reads false. A run that never reached
		// the model leaves the beat resting, so this fails rather than passing green.
		const beat = crewSession(this).heartbeat();
		assert.equal(
			beat.atRest,
			false,
			`crew heartbeat is still at rest after the live run: ${JSON.stringify(
				beat,
			)}`,
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
		// so their Captain seat needs the model too, not the Quartermaster seat alone.
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

Given(
	"the live eval model is fitted as the session default",
	async function (this: EstelleWorld) {
		const model = process.env.HARNESS_EVAL_MODEL!;
		const key = process.env.HARNESS_OPENROUTER_API_KEY!;
		// Fit the eval model as the agent's DEFAULT model, with no per-seat override
		// and no estelle.json seats, exactly as a normal operator session is
		// configured. Embark must resolve the crew's model from this default, the
		// way every real turn does, rather than from a per-seat estelle.json a real
		// operator session never writes. A capstone that pre-seeds per-seat models
		// proves nothing about the real path.
		writeFileSync(
			join(this.agentDir!, "settings.json"),
			JSON.stringify({ defaultProvider: "openrouter", defaultModel: model }),
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
	"Bonny's narration for the handoff carries a live line in their voice",
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
			`Bonny's narration line was not voiced by their live model; line: ${JSON.stringify(
				entry.line,
			)}; Bonny's assistant replies: ${JSON.stringify(bonnyReplies)}`,
		);
	},
);

When(
	"Estelle reports the crew's run back to Bonny",
	// Under @eval this seam runs a live provider turn on Bonny's Captain seat to
	// summarize the crew's work, so it needs the live-step budget the sibling live
	// steps carry, not cucumber's 5000ms default. Under @logic it stays fast.
	{ timeout: 120000 },
	async function (this: EstelleWorld) {
		const handle = this.interactiveSession as unknown as InteractiveHandleView;
		await handle.reportCrewRun();
	},
);

function crewRunReport(world: EstelleWorld): CrewRunReportView {
	const handle = world.interactiveSession as unknown as InteractiveHandleView;
	const reports = handle.crewRunReports();
	assert.ok(reports.length > 0, "started session records no crew-run report");
	return reports[reports.length - 1];
}

Then(
	"the started session records a crew-run report",
	function (this: EstelleWorld) {
		const report = crewRunReport(this);
		assert.ok(
			report.summary.trim().length > 0,
			`crew-run report carries no summary: ${JSON.stringify(report)}`,
		);
	},
);

Then(
	"the started session's history excludes the crew's raw message {string}",
	function (this: EstelleWorld, message: string) {
		const handle = this.interactiveSession as unknown as InteractiveHandleView;
		const leaked = handle.runtime.session.messages.filter((m) =>
			messageText(m).includes(message),
		);
		assert.equal(
			leaked.length,
			0,
			`started session's history carries the crew's raw message ${JSON.stringify(
				message,
			)}; leaked messages: ${JSON.stringify(leaked.map(messageText))}`,
		);
	},
);

Then(
	"Bonny's crew-run report carries a live summary of the crew's work",
	function (this: EstelleWorld) {
		// A live summary is real text Bonny's model voiced for the crew-run report,
		// not a static template. Require the recorded summary to be the output of a
		// real provider turn on Bonny's Captain seat: it MUST appear as a non-empty
		// assistant message in Bonny's own live session, the same seam the live
		// narration and live-reply scenarios read. A hardcoded template pushed
		// straight into the log never reaches Bonny's session, so this fails rather
		// than passing green without a live Bonny round trip.
		const report = crewRunReport(this);
		assert.ok(
			report.summary.trim().length > 0,
			`Bonny's crew-run report carries no live summary: ${JSON.stringify(
				report,
			)}`,
		);
		const handle = this.interactiveSession as unknown as InteractiveHandleView;
		const bonnyReplies = handle.runtime.session.messages
			.filter((m) => m.role === "assistant")
			.map(messageText)
			.filter((text) => text.trim().length > 0);
		assert.ok(
			bonnyReplies.includes(report.summary),
			`Bonny's crew-run summary was not voiced by their live model; summary: ${JSON.stringify(
				report.summary,
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

function handle(world: EstelleWorld): InteractiveHandleView {
	return world.interactiveSession as unknown as InteractiveHandleView;
}

When(
	"the Quartermaster reports the failing target {string}",
	function (this: EstelleWorld, target: string) {
		(this as unknown as { reportedTarget?: string }).reportedTarget = target;
		handle(this).reportFailingTarget(target);
	},
);

When(
	"the Quartermaster reports all targets green",
	function (this: EstelleWorld) {
		handle(this).reportAllGreen();
	},
);

When(
	"the Quartermaster then reports all targets green",
	function (this: EstelleWorld) {
		handle(this).reportAllGreen();
	},
);

When("Estelle advances the crew loop", async function (this: EstelleWorld) {
	await handle(this).advanceCrewLoop();
});

When(
	"Estelle advances the crew loop through the Crew to the Boatswain",
	async function (this: EstelleWorld) {
		await handle(this).advanceCrewLoopThroughToBoatswain();
	},
);

Then(
	"Estelle sends the Crew to the target {string}",
	function (this: EstelleWorld, target: string) {
		const dispatches = handle(this).crewDispatches();
		assert.ok(
			dispatches.some((d) => d.target === target),
			`Estelle did not send the Crew to the target ${JSON.stringify(
				target,
			)}; dispatches: ${JSON.stringify(dispatches)}`,
		);
	},
);

Then(
	"the crew run ends without sending the Crew",
	function (this: EstelleWorld) {
		assert.equal(
			handle(this).crewRunEnded(),
			true,
			"crew run did not end when the Quartermaster reported all green",
		);
		const dispatches = handle(this).crewDispatches();
		assert.equal(
			dispatches.length,
			0,
			`crew run sent the Crew despite an all-green verdict; dispatches: ${JSON.stringify(
				dispatches,
			)}`,
		);
	},
);

Then("Estelle sent the Crew exactly once", function (this: EstelleWorld) {
	const dispatches = handle(this).crewDispatches();
	assert.equal(
		dispatches.length,
		1,
		`Estelle sent the Crew ${dispatches.length} times, not exactly once; dispatches: ${JSON.stringify(
			dispatches,
		)}`,
	);
});

Then("the crew run ends", function (this: EstelleWorld) {
	assert.equal(
		handle(this).crewRunEnded(),
		true,
		"crew run did not end after the verdict turned all green",
	);
});

Then(
	"the crew session is seated as the Boatswain {string}",
	function (this: EstelleWorld, name: string) {
		const seat = crewSession(this).seat();
		assert.equal(seat.role, "boatswain");
		assert.equal(seat.name, name);
	},
);

Then(
	"the crew session is seated as the Shipwright {string}",
	function (this: EstelleWorld, name: string) {
		const seat = crewSession(this).seat();
		assert.equal(seat.role, "shipwright");
		assert.equal(seat.name, name);
	},
);

Then(
	"the crew session lets only the Boatswain commit",
	function (this: EstelleWorld) {
		const result = crewSession(this).commit();
		assert.equal(
			result.allowed,
			true,
			`crew session blocked the seated Boatswain's commit: ${
				result.reason ?? ""
			}`,
		);
	},
);

Then(
	"the crew session's message history excludes the Crew's context",
	function (this: EstelleWorld) {
		const target =
			(this as unknown as { reportedTarget?: string }).reportedTarget ?? "";
		assert.ok(
			target.length > 0,
			"no Crew target was reported before seating the Boatswain",
		);
		const leaked = crewSession(this).runtime.session.messages.filter((m) =>
			messageText(m).includes(target),
		);
		assert.equal(
			leaked.length,
			0,
			`Boatswain crew session carries the Crew's context ${JSON.stringify(
				target,
			)}; leaked messages: ${JSON.stringify(leaked.map(messageText))}`,
		);
	},
);

When(
	"Bonny embarks the batch from their turn",
	// Under @eval embark opens the crew session and runs a live provider turn on
	// Bonny's Captain seat to report the run back, so it needs the live-step
	// budget the sibling live steps carry, not cucumber's 5000ms default. Under
	// @logic it stays fast.
	{ timeout: 600000 },
	async function (this: EstelleWorld) {
		// Settle Bonny's live opening turn before embarking, so the embark seam's own
		// Bonny-voice turns do not collide with a turn already in flight.
		await settleOperatorTurn(
			handle(this).runtime.session as unknown as SessionView,
		);
		// Bonny embarks by calling a real tool registered on their Captain seat, the
		// same tool their live model would call from their own turn. Drive the
		// registered tool through the handle, not a direct crew-session open, so a
		// vacuous embark that skips the tool leaves this step red.
		const tools = handle(this).captainTools();
		const embark = tools.find((tool) => tool.name === "embark");
		assert.ok(
			embark,
			`Bonny has no "embark" tool to embark from their turn; Captain-seat tools: ${JSON.stringify(
				tools.map((tool) => tool.name),
			)}`,
		);
		await embark.run();
	},
);

Given(
	"the Quartermaster's verdict reports all targets green",
	function (this: EstelleWorld) {
		handle(this).reportAllGreen();
	},
);

Then(
	"Estelle runs the crew loop to completion without a further operator step",
	function (this: EstelleWorld) {
		// The scenario drives only Bonny's embark; it never advances the loop
		// itself. So a completed run proves embark drove the loop, not the operator
		// nor the harness. crewRunEnded latches only when the verdict turned all
		// green and the run closed.
		assert.equal(
			handle(this).crewRunEnded(),
			true,
			"embark did not run the crew loop to completion; the crew run has not ended",
		);
	},
);

Then(
	"the crew run is reported back into Bonny's session",
	function (this: EstelleWorld) {
		const reports = handle(this).crewRunReports();
		assert.ok(
			reports.length > 0,
			"embark reported no crew run back into Bonny's session",
		);
		assert.ok(
			reports[reports.length - 1].summary.trim().length > 0,
			`crew-run report carries no summary: ${JSON.stringify(reports)}`,
		);
	},
);

// The live opening turn's AgentSession. openWithBonnyVoice triggers Bonny's
// Captain opening turn at startup fire-and-forget, resolving startup once the
// first provider request dispatches. The turn keeps streaming after that: Bonny
// surveys the workspace through real read tools, then voices the opening. The
// @eval opening step awaits agent_end so the full opening reply is observable
// before run() disposes the session. agent_end fires once the model stops
// streaming for the turn.
interface OpeningSessionView {
	messages: MessageView[];
	subscribe(
		listener: (event: { type: string; willRetry?: boolean }) => void,
	): () => void;
}

Given(
	"the specs carry a {string} scenario awaiting the Captain's review",
	function (this: EstelleWorld, tag: string) {
		// Seed a real feature file carrying a real tag-tagged scenario into the
		// started session's project workspace, so Bonny's opening turn discovers it
		// by reading the workspace feature files. The scenario names a distinctive
		// refund behaviour: an opening that never reads the specs cannot surface it.
		const featuresDir = join(this.workspaceDir!, "features");
		mkdirSync(featuresDir, { recursive: true });
		writeFileSync(
			join(featuresDir, "refunds.feature"),
			`${tag}\nFeature: Refunds on shipped orders\n\n  ${tag}\n  Scenario: Refund a fully shipped order to the original card\n    Given a customer paid for order "SO-4417" with a saved card\n    And the order has shipped in full\n    When the operator issues a refund for the order\n    Then the refund returns to the original saved card\n`,
			"utf8",
		);
	},
);

When(
	"Bonny runs their opening turn",
	// The opening turn drives a live provider turn on Bonny's Captain seat, then
	// Bonny surveys the workspace through real read tools before voicing the
	// opening. It needs a live-run budget well beyond cucumber's 5000ms default.
	{ timeout: 600000 },
	async function (this: EstelleWorld) {
		const { run } = await import("../../src/index.js");
		let openingReply = "";
		await run({
			cwd: this.workspaceDir!,
			agentDir: this.agentDir!,
			interactive: async (session) => {
				this.interactiveSession = session;
				const runtime = session.runtime as SessionRuntimeView;
				const opening = runtime.session as unknown as OpeningSessionView;
				// openWithBonnyVoice already triggered the opening turn at startup.
				// Await agent_end so Bonny's full opening reply lands before run()
				// disposes the session; a truncated turn leaves the reply empty and
				// reddens the assertion rather than passing green without a live
				// opening.
				await new Promise<void>((resolve) => {
					const unsubscribe = opening.subscribe((event) => {
						if (event.type === "agent_end" && event.willRetry === false) {
							unsubscribe();
							resolve();
						}
					});
				});
				openingReply = runtime.session.messages
					.filter((m) => m.role === "assistant")
					.map(messageText)
					.filter((text) => text.trim().length > 0)
					.join("\n");
			},
		});
		(this as unknown as { openingReply?: string }).openingReply = openingReply;
	},
);

// Slice 8: the alongside experience in the real run. The loop-driving,
// narration, and report-back must reach the operator's OWN session on the real
// run, not only a handle array a test callback reads. So these steps observe the
// operator's session directly (handle.runtime.session), the same session the
// operator talks to, and read the crew's narration and Bonny's report as display
// messages surfaced there. The core embark seam surfaces each as a custom
// display message: crew progress under the "crew-narration" customType, and
// Bonny's end-of-run report under the "crew-run-report" customType. A run that
// pushes those only into a handle array, and not into the operator's session,
// leaves these steps red.

function operatorSession(world: EstelleWorld): SessionView {
	const handle = world.interactiveSession as unknown as InteractiveHandleView;
	return handle.runtime.session as unknown as SessionView;
}

function surfacedMessages(
	world: EstelleWorld,
	customTypeFragment: string,
): MessageView[] {
	return operatorSession(world).messages.filter(
		(message) =>
			message.role === "custom" &&
			typeof message.customType === "string" &&
			message.customType.includes(customTypeFragment) &&
			message.display !== false &&
			messageText(message).trim().length > 0,
	);
}

Then(
	"the started session receives the crew's narration as the crew runs",
	function (this: EstelleWorld) {
		const narration = surfacedMessages(this, "crew-narration");
		assert.ok(
			narration.length > 0,
			`the operator's own session received no crew narration display message; session custom types: ${JSON.stringify(
				operatorSession(this)
					.messages.filter((m) => m.role === "custom")
					.map((m) => m.customType),
			)}`,
		);
	},
);

Then(
	"the started session receives Bonny's report when the run ends",
	function (this: EstelleWorld) {
		const reports = surfacedMessages(this, "crew-run-report");
		assert.ok(
			reports.length > 0,
			`the operator's own session received no crew-run report display message; session custom types: ${JSON.stringify(
				operatorSession(this)
					.messages.filter((m) => m.role === "custom")
					.map((m) => m.customType),
			)}`,
		);
	},
);

// "a live eval model is configured for Bonny" and "Bonny takes their next turn"
// are shared with the captain-reset-nudge feature. Their single definitions live
// in captain-reset-nudge.steps.ts; both trigger Bonny's turn off the context the
// scenario's own prior steps establish, so this scenario reuses them.

Given(
	"the project carries a batch of specs ready for the crew to build",
	function (this: EstelleWorld) {
		// Seed a real Shipshape project with a ready spec into the workspace BEFORE
		// the session launches, so Bonny surveys a coherent, actionable batch rather
		// than an empty directory. Embark is the sensible next act only when there
		// is a confirmed batch for the crew to build; on an empty workspace Bonny
		// correctly returns to discovery instead.
		this.workspaceDir ??= mkdtempSync(join(tmpdir(), "estelle-live-crew-"));
		writeFileSync(
			join(this.workspaceDir, "RIGGING.md"),
			"# Rigging\n\n## Stack\n\n- language: typescript\n",
			"utf8",
		);
		const featuresDir = join(this.workspaceDir, "features");
		mkdirSync(featuresDir, { recursive: true });
		writeFileSync(
			join(featuresDir, "greeting.feature"),
			"@logic\nFeature: Warm greeting\n\n  Scenario: The store greets the customer warmly\n    Given a customer opens the store\n    When the greeting renders\n    Then it welcomes them with a warm line\n",
			"utf8",
		);
	},
);

Given(
	"the operator confirms the batch is right and tells Bonny to ship it",
	// Settling Bonny's live opening turn to idle can outlast cucumber's 5000ms
	// default, so this step carries a live-run budget.
	{ timeout: 600000 },
	async function (this: EstelleWorld) {
		// A coherent confirmation on the seeded, actionable batch: the spec is ready
		// and the operator says proceed. Bonny's sensible next act is to embark.
		const session = operatorSession(this);
		await settleOperatorTurn(session);
		await session.sendUserMessage(
			"Yes, that greeting spec is exactly what I want. Build it and ship it.",
			{ triggerTurn: false },
		);
	},
);

Then(
	"Bonny embarks the crew rather than instructing the operator to run a role command",
	function (this: EstelleWorld) {
		// Bonny embarking is observed as a crew session opened alongside from Bonny's
		// own turn: the embark tool ran. A turn that instead instructs the operator to
		// run a role command opens no crew session, so this fails. The positive
		// observable proves embark over instruction against the live model.
		const handle = this.interactiveSession as unknown as InteractiveHandleView;
		const crew = handle.crewSession();
		assert.ok(
			crew,
			"Bonny did not embark the crew from their turn; no crew session opened alongside. Bonny instructed a role command instead of embarking.",
		);
	},
);

Then(
	"Bonny's opening surfaces the pending {string} scenario before inviting direction",
	function (this: EstelleWorld, tag: string) {
		const reply =
			(this as unknown as { openingReply?: string }).openingReply ?? "";
		assert.ok(
			reply.trim().length > 0,
			"Bonny produced no opening reply to inspect; the opening turn drove no live model reply",
		);
		const lower = reply.toLowerCase();
		// Surfacing the specific pending scenario: Bonny names the seeded refund
		// scenario, not a generic status line. "refund" is the scenario's domain
		// token; an opening that never read the specs omits it.
		assert.ok(
			lower.includes("refund"),
			`Bonny's opening did not surface the pending refund scenario; opening reply: ${JSON.stringify(
				reply,
			)}`,
		);
		// Flagged as awaiting the Captain's review: Bonny carries the tag or the
		// review language that marks an unpromoted scenario, not a bare mention.
		assert.ok(
			lower.includes(tag.toLowerCase()) ||
				/awaiting|pending|review|promot|unreviewed/.test(lower),
			`Bonny's opening mentioned the scenario but did not flag it as awaiting the Captain's review; opening reply: ${JSON.stringify(
				reply,
			)}`,
		);
		// Before inviting direction: the surfacing precedes Bonny's closing
		// invitation for the operator's next move.
		const refundAt = lower.indexOf("refund");
		const inviteAt = lower.lastIndexOf("?");
		assert.ok(
			inviteAt === -1 || refundAt < inviteAt,
			`Bonny invited direction before surfacing the pending scenario; opening reply: ${JSON.stringify(
				reply,
			)}`,
		);
	},
);

// Slice 9: a manual role command dispatches the role alongside with clean
// context. The operator discusses intent with Bonny in the started session, then
// runs /qm. The alongside Quartermaster session opens isolated from the operator's
// discovery, so a live Quartermaster turn proceeds instead of refusing for
// unclean context. The refusal check reads the alongside session's real reply.

Given(
	"the operator has discussed intent with Bonny in the started session",
	// Settling Bonny's live opening turn to idle can outlast cucumber's 5000ms
	// default, so this step carries a live-run budget.
	{ timeout: 600000 },
	async function (this: EstelleWorld) {
		// Seed the operator's discovery into Bonny's own started session as a real
		// user message without triggering a turn. Human discovery context now lives
		// in the operator's Captain session, ready for the alongside dispatch to
		// isolate the Quartermaster from.
		const session = operatorSession(this);
		await settleOperatorTurn(session);
		await session.sendUserMessage(
			"I have been thinking the greeting is too cold. Let us make it warmer and friendlier for new operators.",
			{ triggerTurn: false },
		);
	},
);

When(
	"the alongside Quartermaster takes a turn",
	// A live provider turn on the alongside Quartermaster seat needs the live-step
	// budget its sibling live steps carry, not cucumber's 5000ms default.
	{ timeout: 600000 },
	async function (this: EstelleWorld) {
		const crew = crewSession(this);
		const session = crew.runtime.session as unknown as SessionView;
		// Drive a real turn on the alongside Quartermaster session and wait for the
		// seated model's live reply. The Quartermaster's own instructions govern
		// whether it proceeds or refuses for unclean context, so the prompt opens
		// the turn without steering that decision. Resolve as soon as a live reply
		// lands or the turn settles.
		await new Promise<void>((resolve) => {
			let done = false;
			const finish = () => {
				if (done) {
					return;
				}
				done = true;
				unsubscribe();
				resolve();
			};
			const unsubscribe = session.subscribe(() => {
				const gotReply = session.messages.some(
					(m) => m.role === "assistant" && messageText(m).trim().length > 0,
				);
				if (gotReply) {
					finish();
				}
			});
			session
				.sendUserMessage(
					"You have been dispatched as the Quartermaster. Take your first turn now and state how you proceed. Reply with plain text only. Do not call any tools.",
				)
				.then(finish, finish);
		});
		await session.abort();
		(this as unknown as { alongsideQmReply?: string }).alongsideQmReply =
			session.messages
				.filter((m) => m.role === "assistant")
				.map(messageText)
				.filter((text) => text.trim().length > 0)
				.pop();
	},
);

Then(
	"the alongside Quartermaster does not refuse for unclean context",
	function (this: EstelleWorld) {
		const reply = (this as unknown as { alongsideQmReply?: string })
			.alongsideQmReply;
		assert.ok(
			reply !== undefined && reply.trim().length > 0,
			"the alongside Quartermaster produced no live reply to inspect; the turn drove no live model reply",
		);
		// The Quartermaster's context-bulkhead refusal DEMANDS clear context before
		// proceeding ("Need clear context, then QM"). An isolated session opens with
		// clean context, so a live Quartermaster proceeds. Match the demand, not a
		// bare mention of Captain context: the proceed voice says "No Captain
		// context visible. Proceeding.", which must not read as a refusal.
		const refusal =
			/(need|require)s? (a |the )?(clean|clear) context|context (is )?not clean|unclean context/i;
		assert.ok(
			!refusal.test(reply),
			`the alongside Quartermaster refused for unclean context instead of proceeding; reply: ${JSON.stringify(
				reply,
			)}`,
		);
	},
);

// A scratch project that does NOT use cucumber: its own verification is a plain
// node script, named in ITS RIGGING.md. A crew loop hardcoded to a cucumber
// runner can never turn this green, and a Boatswain forbidden from calling tools
// can never commit it. This is the shape a real operator's project has, and it is
// the only capstone that cannot pass on a technicality.

Given(
	"a scratch project verified by its own non-cucumber command, with a failing target",
	{ timeout: 120000 },
	function (this: EstelleWorld) {
		const dir = mkdtempSync(join(tmpdir(), "estelle-scratch-plain-"));
		writeFileSync(
			join(dir, "package.json"),
			JSON.stringify({ name: "estelle-scratch-plain", version: "0.0.0" }),
			"utf8",
		);
		// The project's own verification: plain node, no cucumber anywhere.
		writeFileSync(
			join(dir, "verify.js"),
			[
				'const { add } = require("./src/sum.js");',
				"const got = add(2, 2);",
				"if (got !== 4) {",
				'\tconsole.error("FAIL: add(2, 2) must be 4, got " + got);',
				"\tprocess.exit(1);",
				"}",
				'console.log("OK: add(2, 2) is 4");',
				"",
			].join("\n"),
			"utf8",
		);
		writeFileSync(
			join(dir, "RIGGING.md"),
			[
				"# Rigging",
				"",
				"## Stack",
				"",
				"- language: javascript",
				"",
				"## Directories",
				"",
				"- implementation: src",
				"- specs: features",
				"",
				"## Commands",
				"",
				"- broad: `node verify.js`",
				"",
				"## Perturbation",
				"",
				"- message: `PERTURBATION: consider current durable context; remove when fixed`",
				'- perturb: `throw new Error("PERTURBATION: consider current durable context; remove when fixed");`',
				"",
			].join("\n"),
			"utf8",
		);
		mkdirSync(join(dir, "src"), { recursive: true });
		const seededProduction = "exports.add = (a, b) => a - b;\n";
		const productionPath = join(dir, "src", "sum.js");
		writeFileSync(productionPath, seededProduction, "utf8");
		// A real git repo, so the Boatswain can actually commit and we can prove it.
		gitIn(dir, ["init", "-q"]);
		gitIn(dir, ["config", "user.email", "crew@estelle.test"]);
		gitIn(dir, ["config", "user.name", "Estelle Crew"]);
		gitIn(dir, ["add", "-A"]);
		gitIn(dir, ["commit", "-q", "-m", "seed the failing project"]);
		const baseCommits = Number(gitIn(dir, ["rev-list", "--count", "HEAD"]));
		(this as unknown as { scratchProject?: ScratchProject }).scratchProject = {
			dir,
			productionPath,
			seededProduction,
			baseCommits,
		};
		this.workspaceDir = dir;
	},
);

// A project whose verification is ALREADY GREEN. The crew has nothing to fix, so
// only the operator's own named batch can give them work. This is the case that
// used to do nothing at all: the loop chased a red verification, found none, ran
// zero rounds, and the operator waited on nothing while the work they asked for
// never happened.
Given(
	"a scratch project whose verification is already green, in a git repo",
	{ timeout: 120000 },
	function (this: EstelleWorld) {
		const dir = mkdtempSync(join(tmpdir(), "estelle-scratch-green-"));
		writeFileSync(
			join(dir, "package.json"),
			JSON.stringify({ name: "estelle-scratch-green", version: "0.0.0" }),
			"utf8",
		);
		writeFileSync(
			join(dir, "verify.js"),
			[
				'const { add } = require("./src/sum.js");',
				"if (add(2, 2) !== 4) {",
				'\tconsole.error("FAIL: add(2, 2) must be 4");',
				"\tprocess.exit(1);",
				"}",
				'console.log("OK: add(2, 2) is 4");',
				"",
			].join("\n"),
			"utf8",
		);
		writeFileSync(
			join(dir, "RIGGING.md"),
			[
				"# Rigging",
				"",
				"## Stack",
				"",
				"- language: javascript",
				"",
				"## Directories",
				"",
				"- implementation: src",
				"- specs: features",
				"",
				"## Commands",
				"",
				"- broad: `node verify.js`",
				"",
				"## Perturbation",
				"",
				"- message: `PERTURBATION: consider current durable context; remove when fixed`",
				'- perturb: `throw new Error("PERTURBATION: consider current durable context; remove when fixed");`',
				"",
			].join("\n"),
			"utf8",
		);
		mkdirSync(join(dir, "src"), { recursive: true });
		const seededProduction = "exports.add = (a, b) => a + b;\n";
		const productionPath = join(dir, "src", "sum.js");
		writeFileSync(productionPath, seededProduction, "utf8");
		gitIn(dir, ["init", "-q"]);
		gitIn(dir, ["config", "user.email", "crew@estelle.test"]);
		gitIn(dir, ["config", "user.name", "Estelle Crew"]);
		gitIn(dir, ["add", "-A"]);
		gitIn(dir, ["commit", "-q", "-m", "seed a green project"]);
		const baseCommits = Number(gitIn(dir, ["rev-list", "--count", "HEAD"]));
		(this as unknown as { scratchProject?: ScratchProject }).scratchProject = {
			dir,
			productionPath,
			seededProduction,
			baseCommits,
		};
		this.workspaceDir = dir;
	},
);

// A green project with UNCOMMITTED work: exactly the operator's deck after a
// refit. There is no failing target, so the crew loop has nothing to chase and
// seats nobody. The only correct move is a Boatswain custody commit -- and only
// the Boatswain may commit, so if Bonny cannot dispatch Bellamy, the work can
// never be committed at all.
Given(
	"a scratch project whose verification is already green, with uncommitted work",
	{ timeout: 120000 },
	function (this: EstelleWorld) {
		const dir = mkdtempSync(join(tmpdir(), "estelle-scratch-custody-"));
		writeFileSync(
			join(dir, "package.json"),
			JSON.stringify({ name: "estelle-scratch-custody", version: "0.0.0" }),
			"utf8",
		);
		writeFileSync(
			join(dir, "verify.js"),
			[
				'const { add } = require("./src/sum.js");',
				"if (add(2, 2) !== 4) {",
				'\tconsole.error("FAIL: add(2, 2) must be 4");',
				"\tprocess.exit(1);",
				"}",
				'console.log("OK: add(2, 2) is 4");',
				"",
			].join("\n"),
			"utf8",
		);
		writeFileSync(
			join(dir, "RIGGING.md"),
			[
				"# Rigging",
				"",
				"## Stack",
				"",
				"- language: javascript",
				"",
				"## Directories",
				"",
				"- implementation: src",
				"- specs: features",
				"",
				"## Commands",
				"",
				"- broad: `node verify.js`",
				"",
				"## Perturbation",
				"",
				"- message: `PERTURBATION: consider current durable context; remove when fixed`",
				'- perturb: `throw new Error("PERTURBATION: consider current durable context; remove when fixed");`',
				"",
			].join("\n"),
			"utf8",
		);
		mkdirSync(join(dir, "src"), { recursive: true });
		const seededProduction = "exports.add = (a, b) => a + b;\n";
		const productionPath = join(dir, "src", "sum.js");
		writeFileSync(productionPath, seededProduction, "utf8");
		gitIn(dir, ["init", "-q"]);
		gitIn(dir, ["config", "user.email", "crew@estelle.test"]);
		gitIn(dir, ["config", "user.name", "Estelle Crew"]);
		gitIn(dir, ["add", "-A"]);
		gitIn(dir, ["commit", "-q", "-m", "seed a green project"]);
		// The refit: a real, uncommitted change that leaves the project green.
		writeFileSync(
			join(dir, "src", "sum.js"),
			"// refit: documented seam\nexports.add = (a, b) => a + b;\n",
			"utf8",
		);
		const baseCommits = Number(gitIn(dir, ["rev-list", "--count", "HEAD"]));
		assert.notEqual(
			gitIn(dir, ["status", "--porcelain"]),
			"",
			"the scratch project should have uncommitted work for the Boatswain to take custody of",
		);
		(this as unknown as { scratchProject?: ScratchProject }).scratchProject = {
			dir,
			productionPath,
			seededProduction,
			baseCommits,
		};
		this.workspaceDir = dir;
	},
);

When(
	"Bonny dispatches the Boatswain to take custody of the work",
	// Only the Boatswain may commit, and opening a Boatswain session seats an idle
	// Bellamy who commits nothing. This dispatch drives Bellamy to actually work.
	{ timeout: 900000 },
	async function (this: EstelleWorld) {
		const handle = this.interactiveSession as unknown as InteractiveHandleView;
		const report = await handle.dispatchBoatswain("post-implementation");
		(this as unknown as { boatswainReport?: string }).boatswainReport = report;
	},
);

Then(
	"the scratch project's working tree is clean",
	function (this: EstelleWorld) {
		const project = scratch(this);
		assert.equal(
			gitIn(project.dir, ["status", "--porcelain"]),
			"",
			"the Boatswain left uncommitted work behind: custody did not complete",
		);
	},
);

When(
	"the crew run completes",
	// Embark returns the operator's turn as soon as the crew is under way, so the
	// outcome steps wait on the held run rather than reading a half-finished deck.
	{ timeout: 600000 },
	async function (this: EstelleWorld) {
		const handle = this.interactiveSession as unknown as InteractiveHandleView;
		await handle.awaitCrewRun();
	},
);

Then(
	"the scratch project's own non-cucumber verification passes",
	{ timeout: 120000 },
	function (this: EstelleWorld) {
		const project = scratch(this);
		const result = spawnSync("node", ["verify.js"], {
			cwd: project.dir,
			encoding: "utf8",
		});
		assert.equal(
			result.status,
			0,
			`the scratch project's own \`node verify.js\` is still red after the crew run: ${result.stdout}${result.stderr}`,
		);
	},
);

Then("the Boatswain committed the crew's work", function (this: EstelleWorld) {
	const project = scratch(this);
	const now = Number(gitIn(project.dir, ["rev-list", "--count", "HEAD"]));
	assert.ok(
		now > (project.baseCommits ?? 0),
		`the Boatswain made no commit: the scratch project still has ${now} commit(s). A Boatswain that can only narrate cannot commit, so the crew produced no durable outcome.`,
	);
});

Then(
	"the started session receives the crew's narration and Bonny's completed-run report",
	function (this: EstelleWorld) {
		const narration = surfacedMessages(this, "crew-narration");
		assert.ok(
			narration.length > 0,
			"the operator's own session received no crew narration display message from embark's own run",
		);
		const reports = surfacedMessages(this, "crew-run-report");
		assert.ok(
			reports.length > 0,
			"the operator's own session received no crew-run report display message from embark's own run",
		);
	},
);

// The real-project capstone: embark drives the crew to green a genuinely failing
// scenario in a real, self-contained Shipshape project, proven by that project's
// OWN verification command, not the harness verdict. No harness proxy arms the
// target and no proxy file stands in: the crew must edit real production code
// and the project's own cucumber must report the scenario green. The scratch
// project is a real cucumber project seeded with a wrong "add", disposable and
// namespaced in a temp dir. It shares the repo's installed toolchain through a
// node_modules symlink so its own "pnpm exec cucumber-js" resolves the real
// runner, the same command the production crew loop runs to decide green.

interface ScratchProject {
	dir: string;
	productionPath: string;
	seededProduction: string;
	baseCommits?: number;
}

function gitIn(dir: string, args: string[]): string {
	const result = spawnSync("git", args, { cwd: dir, encoding: "utf8" });
	assert.equal(
		result.status,
		0,
		`git ${args.join(" ")} failed in ${dir}: ${result.stderr}`,
	);
	return result.stdout.trim();
}

function scratch(world: EstelleWorld): ScratchProject {
	const project = (world as unknown as { scratchProject?: ScratchProject })
		.scratchProject;
	assert.ok(
		project,
		"no scratch Shipshape project was set up for this scenario",
	);
	return project;
}

// Run the scratch project's own verification command over the named scenario, the
// real "pnpm exec cucumber-js" the production crew loop runs to decide green. A
// zero exit is the project reporting the scenario green.
function runScratchVerification(
	dir: string,
	scenarioName: string,
): { green: boolean; output: string } {
	const result = spawnSync(
		"pnpm",
		["exec", "cucumber-js", "--name", scenarioName],
		{ cwd: dir, encoding: "utf8" },
	);
	return {
		green: result.status === 0,
		output: `${result.stdout ?? ""}${result.stderr ?? ""}`,
	};
}

Given(
	"a scratch Shipshape project whose scenario {string} fails its own verification command",
	{ timeout: 120000 },
	function (this: EstelleWorld, scenarioName: string) {
		const dir = mkdtempSync(join(tmpdir(), "estelle-scratch-proj-"));
		// Share the repo's installed toolchain so the scratch project's own
		// "pnpm exec cucumber-js" resolves the real cucumber and tsx binaries.
		symlinkSync(join(process.cwd(), "node_modules"), join(dir, "node_modules"));
		writeFileSync(
			join(dir, "package.json"),
			JSON.stringify({ name: "estelle-scratch-project", version: "0.0.0" }),
			"utf8",
		);
		writeFileSync(
			join(dir, "cucumber.cjs"),
			[
				'require("tsx/esm/api").register();',
				"module.exports = {",
				"\tdefault: {",
				'\t\trequireModule: ["tsx/cjs"],',
				'\t\trequire: ["features/steps/**/*.ts"],',
				'\t\tpaths: ["features/**/*.feature"],',
				'\t\tformat: ["progress"],',
				"\t},",
				"};",
				"",
			].join("\n"),
			"utf8",
		);
		// A fitted Shipshape project: RIGGING.md present so Bonny embarks the crew
		// rather than steering the operator to fitting out.
		writeFileSync(
			join(dir, "RIGGING.md"),
			[
				"# Rigging",
				"",
				"## Stack",
				"",
				"- language: typescript",
				"",
				"## Directories",
				"",
				"- implementation: src",
				"- specs: features",
				"",
				"## Commands",
				"",
				'- focused: `pnpm exec cucumber-js --name "{scenario}"`',
				"",
				"## Perturbation",
				"",
				"- message: `PERTURBATION: consider current durable context; remove when fixed`",
				'- perturb: `throw new Error("PERTURBATION: consider current durable context; remove when fixed");`',
				"",
			].join("\n"),
			"utf8",
		);
		mkdirSync(join(dir, "features", "steps"), { recursive: true });
		mkdirSync(join(dir, "src"), { recursive: true });
		writeFileSync(
			join(dir, "features", "adding.feature"),
			[
				"@logic",
				"Feature: Adding numbers",
				"",
				`  Scenario: ${scenarioName}`,
				"    When 2 and 2 are added",
				"    Then the sum is 4",
				"",
			].join("\n"),
			"utf8",
		);
		writeFileSync(
			join(dir, "features", "steps", "adding.steps.ts"),
			[
				'import assert from "node:assert/strict";',
				'import { Then, When } from "@cucumber/cucumber";',
				'import { add } from "../../src/add.js";',
				"",
				"let sum: number;",
				'When("2 and 2 are added", function () {',
				"\tsum = add(2, 2);",
				"});",
				'Then("the sum is 4", function () {',
				"\tassert.equal(sum, 4);",
				"});",
				"",
			].join("\n"),
			"utf8",
		);
		// The seeded production is wrong: add subtracts, so the scenario is red until
		// real crew work corrects it. A behaviour-bearing plank ties the seam to the
		// scenario's action step.
		const seededProduction = [
			"/**",
			' * @planks("When 2 and 2 are added")',
			" */",
			"export function add(a: number, b: number): number {",
			"\treturn a - b;",
			"}",
			"",
		].join("\n");
		const productionPath = join(dir, "src", "add.ts");
		writeFileSync(productionPath, seededProduction, "utf8");
		(this as unknown as { scratchProject?: ScratchProject }).scratchProject = {
			dir,
			productionPath,
			seededProduction,
		};
		// The Estelle session under test launches against this project, so teardown
		// disposes it with the workspace. rmSync unlinks the node_modules symlink
		// itself rather than traversing into the shared install.
		this.workspaceDir = dir;
		const probe = runScratchVerification(dir, scenarioName);
		assert.equal(
			probe.green,
			false,
			`scratch project's own verification already reports ${JSON.stringify(
				scenarioName,
			)} green before any crew work: ${probe.output}`,
		);
	},
);

Given(
	"a started Estelle session seated as the Captain {string} on the scratch project",
	async function (this: EstelleWorld, name: string) {
		// Reuse the scratch project as the session's workspace: startSession honours
		// an already-set workspaceDir, so Bonny surveys the real failing project.
		scratch(this);
		await startSession(this);
		const seat = this.interactiveSession!.seat();
		assert.equal(seat.role, "captain");
		assert.equal(seat.name, name);
	},
);

Given(
	"the operator tells Bonny to embark the crew on the failing scenario",
	{ timeout: 600000 },
	async function (this: EstelleWorld) {
		const session = operatorSession(this);
		await settleOperatorTurn(session);
		await session.sendUserMessage(
			"The failing scenario is confirmed. Please embark the crew now to fix it.",
			{ triggerTurn: false },
		);
	},
);

When(
	"Bonny embarks the crew as an ordinary act of their own turn",
	// Triggers Bonny's real turn on the live model. Whichever tool the live model
	// calls from this turn is the real path; no captainTools().run() stand-in
	// drives embark for it.
	{ timeout: 600000 },
	async function (this: EstelleWorld) {
		const session = operatorSession(this);
		await session.sendUserMessage("Please carry on.");
		// Embark returns Bonny's turn as soon as the crew is under way; await the
		// held crew run so the outcome steps read a completed build.
		const handle = this.interactiveSession as unknown as InteractiveHandleView;
		await handle.awaitCrewRun();
	},
);

Then(
	"the crew runs on while Bonny's turn stays live",
	function (this: EstelleWorld) {
		// Non-blocking embark: Bonny's turn returns while the crew loop is still
		// under way, so the run has not yet ended. A blocking embark would return
		// only once the whole loop finished, latching crewRunEnded first.
		const handle = this.interactiveSession as unknown as InteractiveHandleView;
		assert.equal(
			handle.crewRunEnded(),
			false,
			"embark blocked Bonny's turn on the full crew run: the run had already ended when the turn returned, so the conversation did not stay live while the crew ran",
		);
	},
);

Then(
	"the crew edits production code in the scratch project during the run",
	function (this: EstelleWorld) {
		const project = scratch(this);
		const current = readFileSync(project.productionPath, "utf8");
		assert.notEqual(
			current,
			project.seededProduction,
			"the crew left the scratch project's production code untouched; embark drove no real crew edit",
		);
	},
);

Then(
	"the scratch project's own verification command reports the scenario {string} green",
	{ timeout: 120000 },
	function (this: EstelleWorld, scenarioName: string) {
		const project = scratch(this);
		const result = runScratchVerification(project.dir, scenarioName);
		assert.equal(
			result.green,
			true,
			`the scratch project's own verification still reports ${JSON.stringify(
				scenarioName,
			)} red after the run: ${result.output}`,
		);
	},
);
