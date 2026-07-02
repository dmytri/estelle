import assert from "node:assert/strict";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Then, When } from "@cucumber/cucumber";
import type { EstelleWorld } from "../support/world.js";

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
		this.agentDir = mkdtempSync(join(tmpdir(), "estelle-agent-"));
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
