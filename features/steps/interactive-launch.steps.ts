import assert from "node:assert/strict";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Then, When } from "@cucumber/cucumber";
import type { EstelleWorld } from "../support/world.js";

// Structural view of the real pi runtime the interactive handle carries. The
// interactive @exceptional-double captures this runtime, so verification reads
// the started session's live pi state through pi's own public seams: the
// resource loader's registered extension commands, the cwd-bound services
// (file-backed auth and model config), and the session manager's recorded file.
interface RegisteredCommandView {
	handler: (args: string, ctx: unknown) => Promise<void>;
}

interface RuntimeView {
	services: {
		agentDir: string;
		authStorage: { reload(): void; list(): string[] };
		modelRegistry: {
			refresh(): void;
			find(provider: string, id: string): unknown;
		};
		resourceLoader: {
			getExtensions(): {
				extensions: { commands: Map<string, RegisteredCommandView> }[];
			};
		};
	};
	session: { sessionManager: { getSessionFile(): string | undefined } };
}

function registeredCommandNames(runtime: RuntimeView): Set<string> {
	const names = new Set<string>();
	for (const ext of runtime.services.resourceLoader.getExtensions()
		.extensions) {
		for (const name of ext.commands.keys()) {
			names.add(name);
		}
	}
	return names;
}

// The behaviour under test is that Estelle drops the operator into pi's
// INTERACTIVE session as Bonny, instead of configuring a session and returning.
// The real pi TUI needs a live TTY and model the hermetic @logic tier cannot
// provide, so the final terminal-driving call (pi's InteractiveMode/.run()) is
// the only boundary this scenario doubles. The `interactive` runner Estelle
// invokes is the @exceptional-double: it captures the Estelle-configured runtime
// Estelle builds instead of driving a real terminal. Everything the double
// observes is real: the runtime, its loaded extension, and its active seat all
// come from Estelle's normal production configuration path, not a mock.

When(
	"the operator starts Estelle in that directory",
	async function (this: EstelleWorld) {
		// A disposable agent dir keeps runtime construction hermetic and harmless:
		// Estelle resolves its skills and extension without touching the host ~/.pi.
		// A preceding step may have seeded the operator's agent dir already.
		this.agentDir ??= mkdtempSync(join(tmpdir(), "estelle-agent-"));
		const { run } = await import("../../src/index.js");
		await run({
			cwd: this.workspaceDir,
			agentDir: this.agentDir,
			// @exceptional-double: stands in for pi's InteractiveMode/.run(), which
			// drives a real TTY the @logic tier cannot supply. Captures the real
			// Estelle-configured runtime Estelle hands to pi's interactive entry.
			interactive: (session) => {
				this.interactiveSession = session;
			},
		});
	},
);

Then("Estelle runs pi's interactive session", function (this: EstelleWorld) {
	assert.ok(
		this.interactiveSession,
		"Estelle returned without invoking pi's interactive runner",
	);
	assert.ok(
		this.interactiveSession.runtime,
		"Estelle invoked the interactive runner without a runtime",
	);
});

Then(
	"that interactive session boots as the Captain {string}",
	function (this: EstelleWorld, name: string) {
		const seat = this.interactiveSession!.seat();
		assert.equal(seat.role, "captain");
		assert.equal(seat.name, name);
	},
);

Then(
	"that interactive session has the {string} extension loaded",
	function (this: EstelleWorld, extension: string) {
		assert.ok(
			this.interactiveSession!.extensions.includes(extension),
			`extension "${extension}" not loaded; loaded: ${this.interactiveSession!.extensions.join(", ")}`,
		);
	},
);

Then(
	"the started session registers the commands {string}, {string}, {string}, {string}, {string}, and {string}",
	function (
		this: EstelleWorld,
		first: string,
		second: string,
		third: string,
		fourth: string,
		fifth: string,
		sixth: string,
	) {
		const runtime = this.interactiveSession!.runtime as RuntimeView;
		const registered = registeredCommandNames(runtime);
		for (const command of [first, second, third, fourth, fifth, sixth]) {
			const name = command.replace(/^\//, "");
			assert.ok(
				registered.has(name),
				`command "${command}" not registered as a live pi command; registered: ${[...registered].join(", ")}`,
			);
		}
	},
);

When(
	"the operator runs the {string} command in the started session",
	async function (this: EstelleWorld, command: string) {
		const runtime = this.interactiveSession!.runtime as RuntimeView;
		// Record the running session object the operator talks to before the switch,
		// so a seat-switch scenario can observe whether the switch recreated it.
		(
			this as unknown as { sessionBeforeCommand?: unknown }
		).sessionBeforeCommand = (
			this.interactiveSession!.runtime as { session: unknown }
		).session;
		const name = command.replace(/^\//, "");
		let handler: RegisteredCommandView["handler"] | undefined;
		for (const ext of runtime.services.resourceLoader.getExtensions()
			.extensions) {
			const registered = ext.commands.get(name);
			if (registered) {
				handler = registered.handler;
				break;
			}
		}
		assert.ok(
			handler,
			`command "${command}" not registered as a live pi command`,
		);
		// Exercise the real registered handler; seat-switch handlers read no ctx.
		await handler("", {});
	},
);

Then(
	"the started session's active seat is the Quartermaster {string}",
	function (this: EstelleWorld, name: string) {
		const seat = this.interactiveSession!.seat();
		assert.equal(seat.role, "quartermaster");
		assert.equal(seat.name, name);
	},
);

Then(
	"the started session's active seat is the Captain {string}",
	function (this: EstelleWorld, name: string) {
		const seat = this.interactiveSession!.seat();
		assert.equal(seat.role, "captain");
		assert.equal(seat.name, name);
	},
);

Then(
	"the started session resolves provider auth from the operator's agent directory",
	function (this: EstelleWorld) {
		const runtime = this.interactiveSession!.runtime as RuntimeView;
		// Seed a namespaced credential into the operator's agent directory and
		// reload: a file-backed AuthStorage bound to agentDir/auth.json resolves
		// it; an in-memory store ignores the file. The temp agent dir is disposed
		// on teardown.
		const provider = "estelle-verify-acme";
		writeFileSync(
			join(this.agentDir!, "auth.json"),
			JSON.stringify({
				[provider]: { type: "api_key", key: "sk-estelle-verify" },
			}),
			"utf8",
		);
		runtime.services.authStorage.reload();
		assert.ok(
			runtime.services.authStorage.list().includes(provider),
			"provider auth did not resolve from the operator's agent directory",
		);
	},
);

Then(
	"the started session resolves model configuration from the operator's agent directory",
	function (this: EstelleWorld) {
		const runtime = this.interactiveSession!.runtime as RuntimeView;
		// Seed a namespaced model config into the operator's agent directory and
		// refresh: a file-backed ModelRegistry bound to agentDir/models.json
		// resolves it; an in-memory registry does not.
		const provider = "estelle-verify-acme";
		const modelId = "estelle-verify-1";
		writeFileSync(
			join(this.agentDir!, "models.json"),
			JSON.stringify({
				providers: {
					[provider]: {
						baseUrl: "https://acme.test/v1",
						apiKey: "sk-estelle-verify",
						api: "openai-completions",
						models: [
							{
								id: modelId,
								name: "Estelle Verify",
								reasoning: false,
								input: ["text"],
								cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
								contextWindow: 1000,
								maxTokens: 100,
							},
						],
					},
				},
			}),
			"utf8",
		);
		runtime.services.modelRegistry.refresh();
		assert.ok(
			runtime.services.modelRegistry.find(provider, modelId),
			"model configuration did not resolve from the operator's agent directory",
		);
	},
);

Then(
	"the started session is recorded under the operator's agent directory so the operator can resume it",
	function (this: EstelleWorld) {
		const runtime = this.interactiveSession!.runtime as RuntimeView;
		const sessionFile = runtime.session.sessionManager.getSessionFile();
		assert.ok(
			sessionFile,
			"started session has no recorded session file; an in-memory session cannot be resumed",
		);
		assert.ok(
			sessionFile.startsWith(this.agentDir!),
			`session recorded outside the operator's agent directory: ${sessionFile}`,
		);
	},
);
