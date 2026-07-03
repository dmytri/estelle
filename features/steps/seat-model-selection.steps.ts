import assert from "node:assert/strict";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { Given, Then, When } from "@cucumber/cucumber";
import type { EstelleWorld } from "../support/world.js";

/**
 * Seed or assert a recorded seat model in the named file in the operator's
 * agent directory. Before launch the step is starting state, so it seeds the
 * file; after launch it is an assertion on what Estelle recorded.
 */
function recordedSeatModel(
	world: EstelleWorld,
	file: string,
	role: string,
	id: string,
): void {
	if (!world.launched) {
		const dir = world.prepareAgentDir();
		const path = join(dir, file);
		const current = existsSync(path)
			? (JSON.parse(readFileSync(path, "utf8")) as {
					seats?: Record<string, string>;
				})
			: {};
		current.seats = { ...current.seats, [role]: id };
		writeFileSync(path, JSON.stringify(current), "utf8");
		return;
	}
	const path = join(world.agentDir!, file);
	assert.ok(existsSync(path), `"${file}" is absent from the agent directory`);
	const recorded = JSON.parse(readFileSync(path, "utf8")) as {
		seats?: Record<string, string>;
	};
	assert.equal(
		recorded.seats?.[role],
		id,
		`"${file}" records ${role} model "${recorded.seats?.[role]}", expected "${id}"`,
	);
}

Given(
	"Estelle config sets the Captain model to {string}",
	async function (this: EstelleWorld, id: string) {
		const estelle = await this.ensureWorkspace();
		this.requestedSeatModel = id;
		estelle.setSeatModel("captain", id);
	},
);

Given(
	"Estelle config sets the Quartermaster model to {string}",
	async function (this: EstelleWorld, id: string) {
		const estelle = await this.ensureWorkspace();
		this.requestedSeatModel = id;
		estelle.setSeatModel("quartermaster", id);
	},
);

When(
	"{word} begins a turn",
	async function (this: EstelleWorld, _name: string) {
		await this.launched!.beginTurn();
	},
);

Given(
	"the {string} file in the operator's agent directory records the captain model {string}",
	function (this: EstelleWorld, file: string, id: string) {
		recordedSeatModel(this, file, "captain", id);
	},
);

Given(
	"the {string} file in the operator's agent directory records the quartermaster model {string}",
	function (this: EstelleWorld, file: string, id: string) {
		recordedSeatModel(this, file, "quartermaster", id);
	},
);

Then(
	"the provider request uses the operator's pi default model",
	function (this: EstelleWorld) {
		const model = this.launched!.session.model;
		const actual = model ? `${model.provider}/${model.id}` : undefined;
		assert.equal(
			actual,
			this.piDefaultModel,
			`active seat provider request uses model "${actual}", expected the operator's pi default "${this.piDefaultModel}"`,
		);
	},
);

Then(
	"the started session runs the active seat on the model {string}",
	function (this: EstelleWorld, id: string) {
		// The interactive handle carries the real Estelle-configured runtime; the
		// started session's bound model is observable as provider/id on it.
		const runtime = this.interactiveSession!.runtime as {
			session: { model?: { provider: string; id: string } };
		};
		const model = runtime.session.model;
		const actual = model ? `${model.provider}/${model.id}` : undefined;
		assert.equal(
			actual,
			id,
			`started session runs the active seat on model "${actual}", expected "${id}"`,
		);
	},
);

Then(
	"the provider request uses the model {string}",
	function (this: EstelleWorld, id: string) {
		// A pi model carries a bare id and a separate provider, so the operator's
		// qualified "provider/model" selection is observable only as provider/id.
		const model = this.launched!.session.model;
		const actual = model ? `${model.provider}/${model.id}` : undefined;
		assert.equal(
			actual,
			id,
			`active seat provider request uses model "${actual}", expected "${id}"`,
		);
	},
);
