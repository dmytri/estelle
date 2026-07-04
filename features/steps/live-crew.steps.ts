import assert from "node:assert/strict";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Given, Then } from "@cucumber/cucumber";
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
interface CrewSessionView {
	runtime: SessionRuntimeView;
	seat(): { id: string; role: string; name: string };
}

interface InteractiveHandleView {
	runtime: SessionRuntimeView;
	seat(): { id: string; role: string; name: string };
	crewSession(): CrewSessionView | undefined;
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
