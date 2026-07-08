import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
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
	// Slice 6 @eval: the live capstone. configureRedTarget arms a real target
	// that starts red and turns green only once the Crew fixes it.
	// runCrewLoopToCompletion drives the whole loop live: the Quartermaster
	// verdict, the Crew fix, and the Boatswain commit, looping until green.
	// crewLoopSeatsRanLive reports which seats produced a live model turn during
	// the run; crewLoopTargetsAllGreen reports the loop's final verdict.
	configureRedTarget(): void;
	runCrewLoopToCompletion(): Promise<void>;
	crewLoopSeatsRanLive(): {
		quartermaster: boolean;
		crew: boolean;
		boatswain: boolean;
	};
	crewLoopTargetsAllGreen(): boolean;
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

Given(
	"a target that is red until the Crew fixes it",
	function (this: EstelleWorld) {
		handle(this).configureRedTarget();
	},
);

When(
	"Estelle runs the crew loop to completion",
	// The live loop drives real provider turns through the Quartermaster, the
	// Crew, and the Boatswain seats, looping until the target turns green. It
	// needs a live-run budget well beyond cucumber's 5000ms default and beyond a
	// single-turn live step.
	{ timeout: 600000 },
	async function (this: EstelleWorld) {
		await handle(this).runCrewLoopToCompletion();
	},
);

Then(
	"the crew loop ran the Quartermaster, the Crew, and the Boatswain live",
	function (this: EstelleWorld) {
		const seats = handle(this).crewLoopSeatsRanLive();
		assert.equal(
			seats.quartermaster,
			true,
			`the Quartermaster did not run live during the loop: ${JSON.stringify(
				seats,
			)}`,
		);
		assert.equal(
			seats.crew,
			true,
			`the Crew did not run live during the loop: ${JSON.stringify(seats)}`,
		);
		assert.equal(
			seats.boatswain,
			true,
			`the Boatswain did not run live during the loop: ${JSON.stringify(seats)}`,
		);
	},
);

Then(
	"the crew loop ended with every target green",
	function (this: EstelleWorld) {
		assert.equal(
			handle(this).crewLoopTargetsAllGreen(),
			true,
			"the crew loop ended with a target still red",
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

Then(
	"Bonny's crew-run report carries a live summary of the run",
	function (this: EstelleWorld) {
		// A live summary is real text Bonny's model voiced for the completed run,
		// not a static template. Require the recorded summary to appear as a
		// non-empty assistant message in Bonny's own live session, the same seam
		// the sibling live-summary and live-reply scenarios read.
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

function operatorAssistantReplies(world: EstelleWorld): string[] {
	return operatorSession(world)
		.messages.filter((message) => message.role === "assistant")
		.map(messageText)
		.filter((text) => text.trim().length > 0);
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

Then(
	"the started session shows live narration of the crew's run",
	function (this: EstelleWorld) {
		// Live narration reaches the operator's session as a display message whose
		// text Bonny's live model voiced. Require a surfaced narration message and
		// require its text to appear among Bonny's own live assistant replies in the
		// operator's session, the same live-proof seam the sibling @eval steps use. A
		// static template pushed straight into the session never appears as a live
		// assistant reply, so this fails rather than passing green without a live run.
		const narration = surfacedMessages(this, "crew-narration");
		assert.ok(
			narration.length > 0,
			"the operator's session shows no live crew narration display message",
		);
		const replies = operatorAssistantReplies(this);
		const narrationTexts = narration.map(messageText);
		assert.ok(
			narrationTexts.some((text) => replies.includes(text)),
			`the operator's crew narration was not voiced by Bonny's live model; narration: ${JSON.stringify(
				narrationTexts,
			)}; Bonny's assistant replies: ${JSON.stringify(replies)}`,
		);
	},
);

Then(
	"the started session shows Bonny's report of the completed run",
	function (this: EstelleWorld) {
		// The completed-run report reaches the operator's session as a display
		// message whose summary Bonny's live model voiced. Require a surfaced report
		// message and require its summary to appear among Bonny's own live assistant
		// replies in the operator's session.
		const reports = surfacedMessages(this, "crew-run-report");
		assert.ok(
			reports.length > 0,
			"the operator's session shows no live crew-run report display message",
		);
		const summary = messageText(reports[reports.length - 1]);
		const replies = operatorAssistantReplies(this);
		assert.ok(
			replies.includes(summary),
			`the operator's crew-run report was not voiced by Bonny's live model; summary: ${JSON.stringify(
				summary,
			)}; Bonny's assistant replies: ${JSON.stringify(replies)}`,
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

// Slice A: embark drives the REAL crew. This scenario reuses the same red
// target and loop-completion signals the Slice 6 capstone proved
// (configureRedTarget, crewLoopSeatsRanLive, crewLoopTargetsAllGreen), but it
// drives them from Bonny's own registered "embark" tool alone, with no
// separate "Estelle runs the crew loop to completion" step in between. A
// vacuous embark that only opens an idle crew session and never drives the
// loop itself leaves these steps red even though the sibling capstone scenario
// is green.

Given(
	"the project carries a verification target that is failing",
	function (this: EstelleWorld) {
		handle(this).configureRedTarget();
	},
);

When(
	"Bonny embarks the crew from their own turn",
	// The embark tool's own run drives the live loop to completion, so this
	// needs the same live-run budget as the Slice 6 capstone's loop-completion
	// step, not cucumber's 5000ms default.
	{ timeout: 600000 },
	async function (this: EstelleWorld) {
		// Settle Bonny's live opening turn before embarking, so the embark seam's
		// own Bonny-voice turns do not collide with a turn already in flight.
		await settleOperatorTurn(
			handle(this).runtime.session as unknown as SessionView,
		);
		// Bonny embarks by calling a real tool registered on their Captain seat,
		// the same tool their live model would call from their own turn.
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

Then(
	"Estelle drives the Quartermaster, the Crew, and the Boatswain against the failing target",
	function (this: EstelleWorld) {
		const seats = handle(this).crewLoopSeatsRanLive();
		assert.equal(
			seats.quartermaster,
			true,
			`embark did not drive a live Quartermaster turn against the failing target: ${JSON.stringify(
				seats,
			)}`,
		);
		assert.equal(
			seats.crew,
			true,
			`embark did not drive a live Crew turn against the failing target: ${JSON.stringify(
				seats,
			)}`,
		);
		assert.equal(
			seats.boatswain,
			true,
			`embark did not drive a live Boatswain turn against the failing target: ${JSON.stringify(
				seats,
			)}`,
		);
	},
);

Then(
	"the failing target passes the project's verification after the run",
	function (this: EstelleWorld) {
		assert.equal(
			handle(this).crewLoopTargetsAllGreen(),
			true,
			"the failing target is still red after embark's run",
		);
	},
);

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
