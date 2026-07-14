import { spawn, spawnSync } from "node:child_process";
import {
	existsSync,
	mkdirSync,
	readdirSync,
	readFileSync,
	writeFileSync,
} from "node:fs";
import { basename, dirname, join, relative, resolve } from "node:path";
import type {
	AgentSession,
	AgentSessionRuntime,
	ExtensionAPI,
} from "@earendil-works/pi-coding-agent";
import { loadOpenPlugin, type OpenPluginShim } from "pi-open-plugin-shim";

export interface LaunchOptions {
	cwd?: string;
	agentDir?: string;
}

interface InteractiveHandle {
	runtime: AgentSessionRuntime;
	extensions: string[];
	seat(): { id: string; role: string; name: string };
	crewSession():
		| {
				runtime: AgentSessionRuntime;
				seat(): { id: string; role: string; name: string };
				heartbeat(): { name: string; atRest: boolean; sawActivity: boolean };
				runTurn(): Promise<void>;
				write(
					path: string,
					contents: string,
				): { allowed: boolean; reason?: string };
				commit(): { allowed: boolean; reason?: string };
		  }
		| undefined;
	handOffToCrew(): Promise<void>;
	narrationLog(): { from: string; to: string; line: string }[];
	reportCrewRun(): Promise<void>;
	captainTools(): { name: string; run(): Promise<void> }[];
	crewRunReports(): { summary: string }[];
	reportFailingTarget(target: string): void;
	reportAllGreen(): void;
	advanceCrewLoop(): Promise<void>;
	advanceCrewLoopThroughToBoatswain(): Promise<void>;
	crewDispatches(): { target: string }[];
	crewRunEnded(): boolean;
	awaitCrewRun(): Promise<void>;
	cancelCrewRun(): Promise<void>;
	dispatchBoatswain(job?: string): Promise<string>;
	providerRequestCount(): number;
}

export interface RunOptions extends LaunchOptions {
	argv?: string[];
	interactive?: (handle: InteractiveHandle) => void | Promise<void>;
}

export interface EstelleSession {
	session: AgentSession;
	extensions: string[];
	skills: { name: string; filePath: string }[];
	commands: string[];
	seat(): { id: string; role: string; name: string };
	seatCrew(): { role: string; name: string };
	runCommand(command: string): { id: string; role: string; name: string };
	selectSeat(
		role: "captain" | "quartermaster" | "crew" | "boatswain" | "shipwright",
		name: string,
	): { role: string; name: string };
	createSkill(
		name: string,
		body: string,
	): Promise<{ name: string; filePath: string }>;
	installSkill(source: string): Promise<void>;
	installExtension(source: string): Promise<void>;
	write(path: string, contents: string): { allowed: boolean; reason?: string };
	perturb(relPath: string): { allowed: boolean; reason?: string };
	sendToOperator(message: string): { allowed: boolean; reason?: string };
	setSeatModel(
		role: "captain" | "quartermaster" | "crew" | "boatswain" | "shipwright",
		id: string,
	): void;
	beginTurn(): Promise<void>;
	unavailableModels(): string[];
	providerRequestCount(): number;
	systemPrompt(): string;
	settleDeliveries(): Promise<void>;
	deliveryFailures(): number;
	dispose(): void;
}

interface EstelleState {
	providerRequestCount: number;
	activeSeat: Seat;
	skillPaths: Record<string, string>;
	seatModels: Record<string, string>;
	unavailableModels: string[];
	pendingDeliveries: Promise<void>[];
	deliveryFailures: number;
	pi?: ExtensionAPI;
	getSession?: () => AgentSession;
	runtime?: AgentSessionRuntime;
	crewRuntime?: AgentSessionRuntime;
	openCrewSession?: (seat?: Seat) => Promise<void>;
	embark?: () => Promise<void>;
	// Dispatch a single role to actually DO its job, rather than seating it idle.
	// The dispatch is thin by contract: the role, the base commit, and for the
	// Boatswain the job. The role works from the repository and its own role skill.
	// No operator conversation crosses this line. A floated dispatch is Estelle's
	// own startup routing rather than a crew run the operator embarked, so it keeps
	// its work off the crew's live status.
	dispatchRole?: (
		seat: Seat,
		job?: string,
		floated?: boolean,
	) => Promise<string>;
	crewStatus?: CrewRunStatus;
	riggingRefitting?: boolean;
	onProviderRequest?: () => void;
}

/**
 * The authoritative live state of the crew's run. Bonny reads this to answer the
 * operator's "who is working, and what are they doing?" from fact. Without it
 * Bonny can only guess from chat lines, or go digging through processes and git
 * for forensics, which is not knowing.
 */
interface CrewRunStatus {
	active: boolean;
	seat?: string;
	round: number;
	maxRounds: number;
	verifyCommand?: string;
	verification?: { green: boolean; output: string };
	reports: { seat: string; report: string }[];
	stoppedBecause?: string;
}

const CHARACTER_CARDS: Record<string, string> = {
	captain: "bonny.md",
	quartermaster: "misson.md",
	crew: "crew.md",
	boatswain: "bellamy.md",
	shipwright: "johnson.md",
};

interface Seat {
	id: string;
	role: string;
	name: string;
	skill: string;
}

const SEATS: Record<string, Seat> = {
	bonny: {
		id: "bonny",
		role: "captain",
		name: "Bonny",
		skill: "captain",
	},
	misson: {
		id: "misson",
		role: "quartermaster",
		name: "Misson",
		skill: "qm",
	},
	crew: {
		id: "crew",
		role: "crew",
		name: "Crew",
		skill: "crew",
	},
	bellamy: {
		id: "bellamy",
		role: "boatswain",
		name: "Bellamy",
		skill: "boatswain",
	},
	johnson: {
		id: "johnson",
		role: "shipwright",
		name: "Johnson",
		skill: "shipwright",
	},
};

const SEAT_BY_COMMAND: Record<string, string> = {
	"/bonny": "bonny",
	"/captain": "bonny",
	"/misson": "misson",
	"/quartermaster": "misson",
	"/qm": "misson",
	"/bellamy": "bellamy",
	"/boatswain": "bellamy",
	"/johnson": "johnson",
	"/shipwright": "johnson",
	"/crew": "crew",
};

const SEAT_COMMANDS = ["/bonny", "/captain"];
const ALONGSIDE_COMMANDS = [
	"/misson",
	"/quartermaster",
	"/bellamy",
	"/boatswain",
	"/johnson",
	"/shipwright",
	"/crew",
];

const SEAT_BY_ROLE: Record<string, Seat> = Object.fromEntries(
	Object.values(SEATS).map((seat) => [seat.role, seat]),
);

// Estelle's re-ask. A live seat asked to act sometimes answers in prose instead,
// and where the missing artifact is machine-detectable by its absence, the seat is
// asked once more before the turn reaches the operator. The alongside Quartermaster
// omits the artifact by refusing for unclean context on a session Estelle opened
// clean. The re-ask states the fact the seat got wrong and takes whatever the second
// turn answers.
const UNCLEAN_CONTEXT_REASK =
	"Your context here is clean: Estelle opened this session alongside, and no Captain conversation reached it. Take the turn again and do your role's work.";

/**
 * @planks("When the alongside Quartermaster's turn ends by refusing for unclean context")
 */
function refusedForUncleanContext(reply: string): boolean {
	return /unclean context|clean context|clear context/i.test(reply);
}

// Bonny omits the artifact by ending a turn that sends the operator to a role
// command while embarking no crew. Estelle sets the crew to work from Bonny's own
// turn, so a turn that routes the operator to a role command instead has left the
// embark undone, and the absence of the crew is what Estelle detects.
const OMITTED_EMBARK_REASK =
	"You ended your turn by sending the operator to a role command. Estelle sets the crew to work from your own turn: call the embark tool now, in this turn, rather than telling the operator to run a role command. Take the turn again.";

// The role commands Bonny can send the operator to. The Captain's own seat
// commands are not among them: they seat the operator with Bonny, who is already
// seated, so they route no work away from Bonny's turn.
const ROLE_COMMANDS = Object.keys(SEAT_BY_COMMAND).filter(
	(command) => !SEAT_COMMANDS.includes(command),
);

/**
 * @planks("When Bonny's turn ends by instructing the operator to run {string} and embarks no crew")
 * @planks("When Bonny's re-asked turn ends by instructing the operator to run {string} and embarks no crew")
 */
function instructedARoleCommand(reply: string): boolean {
	return ROLE_COMMANDS.some((command) =>
		new RegExp(`${command}\\b`, "i").test(reply),
	);
}

/**
 * @planks("Given Estelle has re-asked Bonny once for the turn")
 * @planks("Then Estelle re-asks Bonny once before the turn reaches the operator")
 * @planks("Then the started session receives Bonny's reply")
 * @planks("Then Estelle re-asks Bonny no further for the turn")
 */
function reAskBonnyOnOmittedEmbark(
	session: AgentSession,
	state: EstelleState,
): void {
	// Bounded at one. The flag is set on the re-ask and cleared when the re-asked
	// turn ends, so the re-asked turn's own reply reaches the operator rather than
	// driving a second re-ask: a repair that retries until it succeeds is the
	// unended turn wearing a repair's coat.
	let reAsked = false;
	session.subscribe((event) => {
		if (event.type !== "agent_end" || event.willRetry) {
			return;
		}
		if (reAsked) {
			reAsked = false;
			return;
		}
		// Estelle's own opening turn rides a custom message, so the turn the operator
		// asked for is the one a user message prompted. A turn the operator never
		// asked for was not for the artifact.
		const prompt = [...session.messages]
			.reverse()
			.find((message) => message.role !== "assistant");
		if (prompt?.role !== "user") {
			return;
		}
		const answered =
			session.messages
				.filter((message) => message.role === "assistant")
				.map(assistantText)
				.filter((text) => text.trim().length > 0)
				.pop() ?? "";
		if (state.crewRuntime || !instructedARoleCommand(answered)) {
			return;
		}
		reAsked = true;
		// The turn's end signal fires while the run is still processing, so the
		// re-ask is queued as that run's follow-up: it is served after the turn's
		// own end, inside the operator's one turn, with no further operator message
		// to prompt it.
		void session.sendUserMessage(OMITTED_EMBARK_REASK, {
			deliverAs: "followUp",
		});
	});
}

/**
 * @planks("When the operator runs the Estelle package in that directory")
 */
function assetsDir(cwd: string): string {
	const local = join(cwd, "assets");
	if (existsSync(join(local, "crew-roster.json"))) {
		return local;
	}
	return join(__dirname, "..", "assets");
}

/**
 * @planks("Then the seat system prompt addresses the operator as \"Commodore\"")
 * @planks("Then the seat system prompt includes the upstream \"captain\" role instructions")
 * @planks("Then the seat system prompt includes the \"bonny\" character card")
 * @planks("Then the alongside Quartermaster does not refuse for unclean context")
 * @planks("Then Bonny embarks the crew rather than instructing the operator to run a role command")
 * @planks("Then the seat system prompt includes the plugin's \"captain\" rule")
 * @planks("Then the seat system prompt includes the plugin's always-apply \"shipshape\" rule")
 * @planks("Then the seat system prompt includes the plugin's \"qm\" rule")
 * @planks("Then the seat system prompt excludes the plugin's \"captain\" rule")
 * @planks("Then the scratch project's \"RIGGING.md\" carries a \"focused\" command")
 * @planks("Then the scratch project carries a specification for the greeting page")
 */
function seatSystemPrompt(
	base: string,
	seat: Seat,
	cwd: string,
	skillPaths: Record<string, string>,
	pluginDir: string,
): string {
	const assets = assetsDir(cwd);
	const houseRules = readFileSync(join(assets, "system-prompt.md"), "utf8");
	const roleInstructions = readFileSync(skillPaths[seat.skill], "utf8");
	// The installed plugin ships "rules/*.mdc", one checklist per role plus
	// always-apply checklists. The acting seat carries its own role rule and
	// every always-apply rule; other roles' rules stay out.
	const rulesDir = join(pluginDir, "rules");
	const pluginRules = readdirSync(rulesDir)
		.filter((entry) => entry.endsWith(".mdc"))
		.map((entry) => basename(entry, ".mdc"))
		.filter(
			(name) =>
				name === seat.skill ||
				/^\s*alwaysApply:\s*true\s*$/m.test(
					readFileSync(join(rulesDir, `${name}.mdc`), "utf8"),
				),
		)
		.map((name) => readFileSync(join(rulesDir, `${name}.mdc`), "utf8"))
		.join("\n\n");
	const card = readFileSync(
		join(assets, "characters", CHARACTER_CARDS[seat.role]),
		"utf8",
	);
	// An internal role runs only in a session Estelle opened alongside as an
	// isolated dispatch. The runtime builds that session fresh, so its context
	// is mechanically clean; the seat context declares the dispatch so a live
	// role trusts the runtime-cleared context and proceeds instead of refusing
	// for unclean context.
	const dispatch =
		seat.role === "captain"
			? ""
			: `\n\nDispatch: Estelle opened this session as an isolated ${seat.role} dispatch alongside the operator's Captain session. The runtime created this session fresh: no Captain discovery, operator conversation, or prior turn output crossed into it. Treat this context as clean and runtime auto-cleared. Messages arriving in this session are dispatch traffic from the harness, not operator discovery. Proceed with your role's duties.`;
	// The Captain seat prompt ends on the catalogued embark guidance. The base
	// prompt's Guidelines section carries the same guidance, but it sits far
	// from the end of a long seat prompt. The seat prompt is applied last on
	// the turn, so anchoring the catalogued copy here keeps embark the
	// Captain's next act once the operator confirms. The copy is read from the
	// catalog at runtime and stays owned as product material.
	const embarkSteer =
		seat.role === "captain"
			? `\n\n${(
					JSON.parse(
						readFileSync(join(assets, "agent-prompts.json"), "utf8"),
					) as { embark: { promptGuidelines: string[] } }
				).embark.promptGuidelines.join("\n")}`
			: "";
	// The Captain holds the only seat facing the operator, so a blocker Bonny
	// reports and holds is a blocker nobody is working. The rigging blocker is the
	// one Bonny meets first on a faulty project, and it is Bonny's to repair or to
	// route to Johnson. Anchored at the end of the seat prompt for the same reason
	// the embark steer is: guidance far from the end of a long prompt is lost.
	const blockerSteer =
		seat.role === "captain"
			? "\n\nBlocker rule: a blocker is yours to resolve or to route, never to hold. When you find a fault in this project's rigging, a missing or malformed value in RIGGING.md such as no `focused` command under `## Commands`, resolve it in the same turn: write the missing tooling value into RIGGING.md yourself, or call dispatch_shipwright to send Johnson to refit it. Then carry on with the operator's work in that same turn. Never end a turn by reporting a rigging fault and waiting."
			: "";
	// The crew works from durable artifacts alone, so intent that never reaches a
	// .feature file never reaches the crew. Discovery is the Captain's craft, and
	// a turn spent entirely on questions leaves the operator's ask nowhere: the
	// question ends the turn, the intent stays in chat, and chat is discarded. So
	// the write comes first and the questions ride on top of it, where a wrong
	// assumption is visible in a file the operator can correct. Anchored at the
	// end of the seat prompt for the same reason the embark steer is: guidance far
	// from the end of a long prompt is lost.
	const specSteer =
		seat.role === "captain"
			? "\n\nSpecification rule: when the operator asks you to specify, build, or add something, your FIRST act in that same turn is to write a Gherkin `.feature` file, with your write tool, under this project's specs directory, the `specs` value in RIGGING.md. Write it before you reply, and before you ask anything. Where a detail is unsettled, choose the most reasonable option, write it into the scenario as a concrete example, and then tell the operator what you assumed and offer to change it. Asking the operator a question instead of writing costs a whole turn and leaves the intent in chat, which is discarded: a turn that ends in questions with no `.feature` file written is a failed turn, however good the questions were. Every refinement the operator asks for afterwards is an edit to the file you already wrote."
			: "";
	return `${base}\n\n${houseRules}\n\n${roleInstructions}\n\n${pluginRules}\n\n${card}${dispatch}${embarkSteer}${blockerSteer}${specSteer}`;
}

/**
 * @planks("Then the provider request uses the operator's pi default model")
 * @planks("Then the provider request uses an available model")
 */
function piDefaultModel(agentDir: string): string {
	const settings = JSON.parse(
		readFileSync(join(agentDir, "settings.json"), "utf8"),
	) as { defaultProvider: string; defaultModel: string };
	return `${settings.defaultProvider}/${settings.defaultModel}`;
}

function relativeToCwd(cwd: string, path: string): string {
	return relative(cwd, resolve(cwd, path));
}

/**
 * The base commit a dispatch is made against. The Dispatch contract carries the
 * role and the base commit, nothing more: the role reads the repository itself.
 */
function headCommit(cwd: string): string {
	const result = spawnSync("git", ["rev-parse", "--short", "HEAD"], {
		cwd,
		encoding: "utf8",
	});
	return result.status === 0 ? result.stdout.trim() : "(no commit)";
}

/**
 * The rigging values the Rigging read contract requires: a project whose
 * RIGGING.md carries every one of these is riggable, and a project missing any
 * of them carries a rigging fault. Bonny holds the only operator-facing seat, so
 * a rigging fault Bonny reports and holds is a fault nobody is working: the
 * faults are routed to Johnson for a refit instead.
 *
 * @planks("Then the scratch project's \"RIGGING.md\" carries a \"focused\" command")
 */
const REQUIRED_RIGGING_VALUES = [
	"language",
	"implementation",
	"specs",
	"focused",
	"perturb",
];

/**
 * The rigging values this project's RIGGING.md does not carry. Each value is a
 * Markdown list item `- <key>: <value>` under its heading, so a key with no
 * recorded value is missing.
 *
 * @planks("Then the scratch project's \"RIGGING.md\" carries a \"focused\" command")
 */
function missingRiggingValues(cwd: string): string[] {
	const rigging = readFileSync(join(cwd, "RIGGING.md"), "utf8");
	return REQUIRED_RIGGING_VALUES.filter(
		(key) => !new RegExp(`^\\s*-\\s*${key}\\s*:\\s*\\S`, "m").test(rigging),
	);
}

/**
 * The project's own verification command, read from ITS RIGGING.md under
 * "## Commands". The crew loop decides green by running this, never a hardcoded
 * runner: a project that verifies with anything else would never turn green, and
 * the loop would spin forever without an outcome.
 *
 * @planks("Then the loop decides a target green by running the project's verification command")
 * @planks("Then no crew-loop driver hardcodes a test runner")
 */
function projectVerifyCommand(cwd: string): string | undefined {
	let rigging: string;
	try {
		rigging = readFileSync(join(cwd, "RIGGING.md"), "utf8");
	} catch {
		return undefined;
	}
	const broad = rigging.match(/^\s*-\s*broad:\s*`([^`]+)`/m)?.[1];
	if (broad) {
		return broad.trim();
	}
	// A project with no broad sweep is still verifiable by its focused command with
	// the scenario placeholder dropped, which runs the tier unfiltered.
	const focused = rigging.match(/^\s*-\s*focused:\s*`([^`]+)`/m)?.[1];
	if (!focused) {
		return undefined;
	}
	return focused
		.replace(/--name\s*"?\{scenario\}"?/g, "")
		.replace(/\{scenario\}/g, "")
		.replace(/\s+/g, " ")
		.trim();
}

/**
 * The perturbation statement is durable configuration under "## Perturbation"
 * in RIGGING.md, read from the project root so the stamped seam tracks the
 * project value.
 *
 * @planks("Then the seam \"src/pay.ts\" carries the perturbation statement from \"RIGGING.md\"")
 * @planks("Then the perturbed seam carries no step text, scenario name, or rationale")
 */
function riggingPerturbStatement(): string {
	const rigging = readFileSync(join(__dirname, "..", "RIGGING.md"), "utf8");
	const statement = rigging.match(/-\s*perturb:\s*`([^`]+)`/)?.[1];
	if (statement === undefined) {
		throw new Error(
			"RIGGING.md carries no perturb value under ## Perturbation",
		);
	}
	return statement.trim();
}

/**
 * @planks("Then the crew session received a live reply from the Quartermaster's model")
 */
function assistantText(message: { content?: unknown }): string {
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

/**
 * @planks("Then the name is present before the hand first provider request")
 * @planks("Then the running session blocks the write")
 * @planks("Then the running session blocks the read")
 * @planks("Then the started session registers the commands \"/bonny\", \"/captain\", \"/misson\", \"/crew\", \"/bellamy\", and \"/johnson\"")
 * @planks("When the operator runs the \"/captain\" command in the started session")
 * @planks("When the operator runs the \"/bellamy\" command in the started session")
 * @planks("When the operator runs the \"/johnson\" command in the started session")
 * @planks("When the operator runs the \"/crew\" command in the started session")
 * @planks("When the operator runs the \"/misson\" command in the started session")
 * @planks("When the operator runs the \"/quartermaster\" command in the started session")
 * @planks("When the operator runs the \"/boatswain\" command in the started session")
 * @planks("When the operator runs the \"/shipwright\" command in the started session")
 * @planks("Then the started session's active seat is the Captain \"Bonny\"")
 * @planks("When the operator runs the \"/embark\" command in the started session")
 * @planks("When the operator runs the \"/qm\" command in the started session")
 * @planks("When the operator runs the \"/clear\" command in the started session")
 * @planks("Then the started session's message history excludes the operator's message \"make the greeting warmer\"")
 * @planks("Then the started session stays seated as the Captain \"Bonny\"")
 * @planks("Then the started session carries no greeting before the operator speaks")
 * @planks("Then Bonny embarks the crew rather than instructing the operator to run a role command")
 * @planks("Then the scratch project's \"RIGGING.md\" carries a \"focused\" command")
 * @planks("Given the operator tells Bonny to embark the crew on the failing scenario")
 * @planks("When Bonny embarks the crew as an ordinary act of their own turn")
 */
function createEstelleExtension(
	state: EstelleState,
	cwd: string,
	custody: OpenPluginShim,
	pluginDir: string,
) {
	return (pi: ExtensionAPI) => {
		state.pi = pi;
		for (const command of SEAT_COMMANDS) {
			const id = SEAT_BY_COMMAND[command];
			pi.registerCommand(command.slice(1), {
				description: `Switch to the ${SEATS[id].role} ${SEATS[id].name} seat`,
				handler: async () => {
					state.activeSeat = SEATS[id];
					await state.runtime?.newSession();
				},
			});
		}
		for (const command of ALONGSIDE_COMMANDS) {
			const id = SEAT_BY_COMMAND[command];
			pi.registerCommand(command.slice(1), {
				description: `Dispatch the ${SEATS[id].role} ${SEATS[id].name} to work in a crew session alongside, keeping you seated with Bonny`,
				handler: async () => {
					// Drive the role, do not merely seat it. Opening a session seats an
					// idle role that never works: a seated Boatswain never commits and a
					// seated Shipwright never refits.
					if (state.dispatchRole) {
						await state.dispatchRole(SEATS[id]);
						return;
					}
					await state.openCrewSession?.(SEATS[id]);
				},
			});
		}
		pi.registerCommand("embark", {
			description:
				"Embark the batch: set the crew working on the confirmed batch in a session alongside",
			handler: async () => {
				// The operator's own deterministic path to a working crew: drive the
				// real crew loop, exactly as Bonny's embark tool does. Opening an idle
				// crew session here would seat the Quartermaster and do no work, which
				// is the whole defect.
				await (state.embark ?? state.openCrewSession)?.();
			},
		});
		pi.registerCommand("qm", {
			description:
				"Dispatch the Quartermaster Misson in a crew session alongside, keeping you seated with Bonny",
			handler: async () => {
				await state.openCrewSession?.();
			},
		});
		if (state.activeSeat.role === "captain") {
			const embarkCatalog = JSON.parse(
				readFileSync(join(assetsDir(cwd), "agent-prompts.json"), "utf8"),
			) as {
				embark: {
					description: string;
					promptSnippet: string;
					promptGuidelines: string[];
				};
				embarkComplete: string;
			};
			const embarkPrompts = embarkCatalog.embark;
			pi.registerTool({
				name: "embark",
				label: "Embark the crew",
				description: embarkPrompts.description,
				promptSnippet: embarkPrompts.promptSnippet,
				promptGuidelines: embarkPrompts.promptGuidelines,
				// No intent parameter. The crew works from durable artifacts only:
				// watchbill.json and the specs, which the Captain writes. Passing the
				// operator's conversation into the dispatch would carry discovery
				// context across the Captain-to-Quartermaster bulkhead, and a
				// conforming Quartermaster must refuse a dispatch beyond its contract.
				parameters: {
					type: "object",
					properties: {},
					additionalProperties: false,
				} as unknown as Parameters<typeof pi.registerTool>[0]["parameters"],
				execute: async () => {
					if (state.embark) {
						await state.embark();
					} else {
						await state.openCrewSession?.();
					}
					return {
						content: [
							{
								type: "text",
								text: embarkCatalog.embarkComplete,
							},
						],
						details: undefined,
					};
				},
			});
			// Bonny reads the crew's authoritative live state rather than guessing from
			// chat lines or digging through processes and git for forensics. This is
			// how Bonny answers "who is working, and what are they doing?" from fact.
			pi.registerTool({
				name: "crew_status",
				label: "Read the crew's live status",
				description:
					"Report what the crew is actually doing right now: whether a run is active, which seat is working, which round it is on, what the project's verification command last said, and what each seat reported. Call this whenever the operator asks about the crew, rather than guessing or inspecting processes and git.",
				promptSnippet:
					"crew_status: read what the crew is actually doing right now",
				promptGuidelines: [
					"When the operator asks what the crew is doing, who is working, or whether the run is progressing, call crew_status and answer from what it returns. Never guess, and never go digging through the process table or git history to infer it.",
				],
				parameters: {
					type: "object",
					properties: {},
					additionalProperties: false,
				} as unknown as Parameters<typeof pi.registerTool>[0]["parameters"],
				execute: async () => {
					const status = state.crewStatus;
					if (!status) {
						// The startup rigging refit floats past the helm on its own. Reported
						// as a running crew it reads as work to wait for, and Bonny holds
						// their turn polling this tool until the refit lands. It blocks
						// nothing, so it is reported as what it is: work running alongside.
						return {
							content: [
								{
									type: "text" as const,
									text: state.riggingRefitting
										? `No crew run has been embarked in this session. ${SEATS.johnson.name} (${SEATS.johnson.role}) is refitting the rigging alongside. The refit blocks nothing and needs no waiting: carry on with your turn, and set the crew to work when the operator asks.`
										: "No crew run has been embarked in this session.",
								},
							],
							details: undefined,
						};
					}
					const lines = [
						status.active
							? `The crew is RUNNING. ${status.seat ?? "A seat"} is working right now, on round ${status.round} of ${status.maxRounds}.`
							: `The crew is NOT running.${status.stoppedBecause ? ` It stopped because: ${status.stoppedBecause}` : ""}`,
						status.verifyCommand
							? `Verification command: \`${status.verifyCommand}\``
							: "",
						status.verification
							? `Last verification: ${status.verification.green ? "GREEN" : "RED"}\n${status.verification.output}`
							: "Verification has not run yet.",
						status.reports.length > 0
							? `What each seat reported:\n${status.reports
									.map((entry) => `- ${entry.seat}: ${entry.report}`)
									.join("\n")}`
							: "No seat has reported yet.",
					].filter((line) => line.length > 0);
					return {
						content: [{ type: "text" as const, text: lines.join("\n\n") }],
						details: undefined,
					};
				},
			});
			// Bonny can dispatch a single role to DO its job, not merely seat it. The
			// Boatswain is the only seat that may commit, so without this dispatch
			// there is no path to a commit at all: opening a Boatswain session seats
			// an idle Bellamy who never takes custody. Thin by contract: the job or
			// scope and the base commit, never the operator's conversation.
			pi.registerTool({
				name: "dispatch_boatswain",
				label: "Dispatch the Boatswain",
				description:
					"Dispatch Bellamy, the Boatswain, to take custody: recheck the project's verification, make hygiene edits only, and COMMIT the work. Bellamy is the only seat that may commit. Use this whenever the work needs committing, including on a project whose verification is already green.",
				promptSnippet:
					"dispatch_boatswain: send Bellamy to verify and commit the work",
				promptGuidelines: [
					"When the operator wants work committed, dispatch the Boatswain. Bellamy is the only seat that may commit: you must never commit yourself, and there is no Captain-side commit path. Opening a Boatswain session commits nothing; only this dispatch puts Bellamy to work.",
				],
				parameters: {
					type: "object",
					properties: {
						job: {
							type: "string",
							description:
								'The job only, per the Dispatch contract: "post-implementation" to take custody and commit, or "pre-clean" to clean a dirty deck before work begins. Never the operator\'s conversation.',
						},
					},
					additionalProperties: false,
				} as unknown as Parameters<typeof pi.registerTool>[0]["parameters"],
				execute: async (input) => {
					const job = (input as { job?: unknown } | undefined)?.job;
					const report = await state.dispatchRole?.(
						SEATS.bellamy,
						typeof job === "string" && job.trim().length > 0
							? job.trim()
							: undefined,
					);
					return {
						content: [
							{
								type: "text" as const,
								text: report ?? "The Boatswain could not be dispatched.",
							},
						],
						details: undefined,
					};
				},
			});
			pi.registerTool({
				name: "dispatch_shipwright",
				label: "Dispatch the Shipwright",
				description:
					"Dispatch Johnson, the Shipwright, for harbour work: inspect the code, repair the rigging (RIGGING.md) and the trace, and report findings. Use this for a refit or a harbour inventory, not for building new behaviour.",
				promptSnippet:
					"dispatch_shipwright: send Johnson to harbour for a refit or inventory",
				promptGuidelines: [
					"When the operator asks for a refit, a harbour inventory, or a rigging repair, dispatch the Shipwright. Opening a Shipwright session does no work; only this dispatch puts Johnson to work.",
					"When you find a rigging fault yourself, a missing or malformed value in RIGGING.md such as no `focused` command, that blocker is yours to resolve or to route in the same turn: repair RIGGING.md yourself, or dispatch the Shipwright to refit it. Never report a rigging fault to the operator and end your turn holding it.",
				],
				parameters: {
					type: "object",
					properties: {
						scope: {
							type: "string",
							description:
								"Optional scope only, per the Dispatch contract: the module, directory, or artifact to work. A path or area, never the operator's conversation.",
						},
					},
					additionalProperties: false,
				} as unknown as Parameters<typeof pi.registerTool>[0]["parameters"],
				execute: async (input) => {
					const scope = (input as { scope?: unknown } | undefined)?.scope;
					const report = await state.dispatchRole?.(
						SEATS.johnson,
						typeof scope === "string" && scope.trim().length > 0
							? scope.trim()
							: undefined,
					);
					return {
						content: [
							{
								type: "text" as const,
								text: report ?? "The Shipwright could not be dispatched.",
							},
						],
						details: undefined,
					};
				},
			});
			// The session's active tool set defaults to the built-in tools, so a
			// registered tool stays hidden from the model until activated. Activate
			// the crew tools on session_start, after the default set is applied, so
			// Bonny's live model can call them from their own turn.
			pi.on("session_start", () => {
				pi.setActiveTools([
					...pi.getActiveTools(),
					"embark",
					"crew_status",
					"dispatch_boatswain",
					"dispatch_shipwright",
				]);
			});
		}
		pi.registerCommand("clear", {
			description:
				"Start a fresh Bonny session, dropping the conversation without re-greeting",
			handler: async () => {
				await state.runtime?.newSession();
			},
		});
		pi.on("before_provider_request", () => {
			state.providerRequestCount += 1;
			state.onProviderRequest?.();
		});
		/**
		 * @planks("When a new Bonny session starts")
		 * @planks("Then the plugin's SessionStart orientation is delivered into the session context")
		 * @planks("Then the orientation carries the plugin's rigging-validation output")
		 * @planks("When a new Bonny session starts and a SessionStart hook exits non-zero")
		 * @planks("Then the session still opens as the Captain \"Bonny\"")
		 */
		pi.on("session_start", async () => {
			const { output } = await custody.runSessionStart(cwd);
			const session = state.getSession?.() ?? state.runtime?.session;
			await session?.sendCustomMessage({
				customType: "shipshape-session-start",
				content: output,
				display: false,
			});
		});
		/**
		 * @planks("Then the system prompt applied to the turn names the Captain \"Bonny\", the Quartermaster \"Misson\", the Crew, the Boatswain \"Bellamy\", and the Shipwright \"Johnson\"")
		 * @planks("Then the system prompt applied to the turn includes the \"bonny\" character card")
		 * @planks("Then the system prompt applied to the turn includes the upstream \"captain\" role instructions")
		 * @planks("Then the system prompt applied to the turn excludes the \"bellamy\" character card")
		 */
		pi.on("before_agent_start", (event) => {
			return {
				systemPrompt: seatSystemPrompt(
					event.systemPrompt,
					state.activeSeat,
					cwd,
					state.skillPaths,
					pluginDir,
				),
			};
		});
		/**
		 * @planks("When the Crew hand writes \"src/pay.ts\" in the running session")
		 * @planks("When Misson writes \"src/pay.ts\" in the running session")
		 * @planks("When Misson writes \"watchbill.json\" in the running session")
		 * @planks("When Bonny writes \"src/pay.ts\" in the running session")
		 * @planks("Then the running session allows the write")
		 * @planks("Then the running session blocks the write")
		 * @planks("Then the block reason carries the Shipshape plugin's denial \"Captain writes specs\"")
		 * @planks("Then the block reason carries the Shipshape plugin's denial \"Production code belongs to Crew\"")
		 * @planks("Then the block reason carries the Shipshape plugin's denial \"Captain-custodied or configuration artifact\"")
		 * @planks("When Bonny writes \"features/steps/pay.steps.ts\" in the running session")
		 * @planks("Then the block reason carries the Shipshape plugin's denial for the Captain writing verification support")
		 * @planks("When Bonny addresses the operator with \"Batch confirmed, Commodore.\" in the running session")
		 * @planks("Then the operator receives the message \"Batch confirmed, Commodore.\" in the running session")
		 * @planks("When Misson attempts to address the operator in the running session")
		 * @planks("Then the running session blocks the operator address")
		 * @planks("Then Estelle reports that only the Captain addresses the operator")
		 * @planks("When Bonny addresses the operator in the running session and the delivery fails")
		 * @planks("Then the running session records the delivery failure in its own session state")
		 * @planks("Then the recorded failure is observable without a test-facing method")
		 * @planks("When Bonny runs the \"/perturb\" command on the seam \"src/pay.ts\" in the running session")
		 * @planks("Then the seam \"src/pay.ts\" carries the perturbation statement from \"RIGGING.md\"")
		 * @planks("Then the perturbed seam carries no step text, scenario name, or rationale")
		 * @planks("When Misson runs the \"/perturb\" command on the seam \"src/pay.ts\" in the running session")
		 * @planks("Then the running session blocks the perturbation")
		 * @planks("Then the seam \"src/pay.ts\" is unchanged")
		 * @planks("When Bonny reads \"CAPTAIN.md\" in the running session")
		 * @planks("When Bellamy reads \"CAPTAIN.md\" in the running session")
		 * @planks("When Misson reads \"CAPTAIN.md\" in the running session")
		 * @planks("Then the running session allows the read")
		 * @planks("Then the running session blocks the read")
		 * @planks("Then the block reason carries the Shipshape plugin's denial \"MUST NOT read CAPTAIN.md\"")
		 * @planks("When Bellamy runs \"git commit -m batch\" in the running session")
		 * @planks("When Misson runs \"git commit -m batch\" in the running session")
		 * @planks("When the Crew hand runs \"git push origin main\" in the running session")
		 * @planks("When Bellamy runs \"git push origin main\" in the running session")
		 * @planks("Then the running session allows the command")
		 * @planks("Then the running session blocks the command")
		 * @planks("Then the block reason carries the Shipshape plugin's denial \"Boatswain holds local commit custody\"")
		 * @planks("Then the block reason carries the Shipshape plugin's denial \"Outbound is Captain-only and requires explicit user approval\"")
		 */
		pi.on("tool_call", async (event) => {
			const seat = `shipshape:${state.activeSeat.skill}`;
			if (event.toolName === "address-operator") {
				if (state.activeSeat.role !== "captain") {
					return {
						block: true,
						reason: "only the Captain addresses the operator",
					};
				}
				const session = state.getSession?.() ?? state.runtime?.session;
				const address = event.input as {
					message: string;
					failDelivery?: boolean;
				};
				if (address.failDelivery) {
					await session?.sendCustomMessage({
						customType: "estelle-delivery-failure",
						content: "operator delivery failure",
						display: true,
					});
					return;
				}
				await session?.sendCustomMessage({
					customType: "estelle-operator-address",
					content: address.message,
					display: true,
				});
				return;
			}
			if (event.toolName === "perturb") {
				if (state.activeSeat.role !== "captain") {
					return { block: true, reason: "only the Captain perturbs a seam" };
				}
				const statement = riggingPerturbStatement();
				const absolute = resolve(cwd, (event.input as { path: string }).path);
				const original = readFileSync(absolute, "utf8");
				writeFileSync(absolute, `${original}${statement}\n`, "utf8");
				return;
			}
			if (event.toolName === "write" || event.toolName === "edit") {
				const relPath = relativeToCwd(
					cwd,
					(event.input as { path: string }).path,
				);
				const decision = custody.checkWriteSync(seat, relPath, process.cwd());
				if (!decision.allowed) {
					return { block: true, reason: decision.reason };
				}
				return;
			}
			if (event.toolName === "read") {
				const relPath = relativeToCwd(
					cwd,
					(event.input as { path: string }).path,
				);
				const decision = custody.checkReadSync(seat, relPath, process.cwd());
				if (!decision.allowed) {
					return { block: true, reason: decision.reason };
				}
				return;
			}
			if (event.toolName === "bash") {
				const decision = await custody.checkCommand(
					seat,
					(event.input as { command: string }).command,
				);
				if (!decision.allowed) {
					return { block: true, reason: decision.reason };
				}
			}
		});
		/**
		 * @planks("When an outbound command runs in the started session and the Shipshape captain-reset-nudge fires")
		 * @planks("Then the reset nudge's guidance is delivered into Bonny's session context")
		 * @planks("When a non-outbound command runs in the started session")
		 * @planks("Then no reset nudge guidance is delivered into Bonny's session context")
		 * @planks("Then the started session offers the operator a fresh context for the next batch")
		 * @planks("When Bonny's write tool call to \"features/login.feature\" completes in the running session")
		 * @planks("When Bonny's edit tool call to \"features/login.feature\" completes in the running session")
		 * @planks("Then the plugin's PostToolUse feature-quality output is delivered into the session context")
		 */
		pi.on("tool_result", async (event) => {
			if (event.toolName === "write" || event.toolName === "edit") {
				const { output } = await custody.runPostToolUse(
					event.toolName,
					event.input as Record<string, string>,
					cwd,
				);
				const trimmed = output.trim();
				if (trimmed.length === 0) {
					return;
				}
				const session = state.getSession?.() ?? state.runtime?.session;
				if (!session) {
					return;
				}
				await session.sendCustomMessage({
					customType: "shipshape-feature-quality",
					content: trimmed,
					display: true,
				});
				return;
			}
			if (event.toolName !== "bash") {
				return;
			}
			const { output } = await custody.runPostToolUse(
				"bash",
				event.input as Record<string, string>,
				cwd,
			);
			const trimmed = output.trim();
			if (trimmed.length === 0) {
				return;
			}
			const parsed = JSON.parse(trimmed) as {
				hookSpecificOutput?: { additionalContext?: string };
			};
			const additionalContext = parsed.hookSpecificOutput?.additionalContext;
			if (!additionalContext) {
				return;
			}
			const session = state.runtime?.session;
			if (!session) {
				return;
			}
			// The nudge is about the next batch, so it belongs at the next turn
			// boundary. While a turn is streaming, a default send steers the nudge
			// into the middle of that in-flight turn, where the model buries it
			// under the turn's own work; deliver it as next-turn context instead,
			// so it reaches Bonny alongside the operator's next message and Bonny
			// honours it. On an idle session, the plain append already lands it as
			// the latest context for the next turn.
			await session.sendCustomMessage(
				{
					customType: "shipshape-reset-nudge",
					content: additionalContext,
					display: true,
				},
				session.isStreaming ? { deliverAs: "nextTurn" } : undefined,
			);
			// The nudge above is guidance addressed to Bonny. The offer of a fresh
			// context belongs to the operator, and it is a duty, so Estelle emits it
			// itself: the operator receives it with no model rigged to voice it.
			await session.sendCustomMessage({
				customType: "estelle-reset-offer",
				content: RESET_OFFER,
				display: true,
			});
		});
	};
}

/**
 * @planks("When Estelle seats a new Crew hand")
 * @planks("Then the hand name appears in \"assets/crew-roster.json\"")
 * @planks("Then the Estelle extension assigns the name")
 */
function assignCrewSeat(survivors: string[]): { role: string; name: string } {
	const name = survivors[Math.floor(Math.random() * survivors.length)];
	return { role: "crew", name };
}

// Estelle's own offer to the operator once a batch ships. Bonny may voice the
// same offer in their own words; this line is the guarantee under that voice.
const RESET_OFFER =
	"That batch is away, Commodore. Captain context is bounded to a batch, so I can give you a fresh context for the next one, rehydrated from the durable artifacts and CAPTAIN.md. Use /clear when you want it. You may also carry on in this one.";

const SHIPSHAPE_PACKAGE_SOURCE = "https://github.com/dmytri/shipshape";

/**
 * @planks("When the operator starts Estelle in that workspace")
 * @planks("Then the \"https://github.com/dmytri/shipshape\" package is persisted in the operator's pi settings")
 */
async function ensureShipshapePackage(options: {
	cwd: string;
	agentDir: string;
	settingsManager: import("@earendil-works/pi-coding-agent").SettingsManager;
	DefaultPackageManager: typeof import("@earendil-works/pi-coding-agent").DefaultPackageManager;
}): Promise<void> {
	const { cwd, agentDir, settingsManager, DefaultPackageManager } = options;
	const packages = settingsManager.getGlobalSettings().packages ?? [];
	const present = packages.some((entry) => {
		const source = typeof entry === "string" ? entry : entry.source;
		return source === SHIPSHAPE_PACKAGE_SOURCE;
	});
	if (present) {
		return;
	}
	const packageManager = new DefaultPackageManager({
		cwd,
		agentDir,
		settingsManager,
	});
	await packageManager.installAndPersist(SHIPSHAPE_PACKAGE_SOURCE);
}

/**
 * The scenarios in the workspace specs that await the Captain's review: a
 * scenario tagged "@captain" is a skeleton the Captain has not yet promoted.
 * Derived from the specs themselves, so a pending review reaches the operator
 * whether or not a model speaks.
 *
 * @planks("Then the session's opening carries the pending {string} scenario to the operator")
 */
function pendingCaptainReviews(
	cwd: string,
): { spec: string; scenario: string }[] {
	const specsRoot = join(cwd, "features");
	if (!existsSync(specsRoot)) {
		return [];
	}
	const pending: { spec: string; scenario: string }[] = [];
	for (const entry of readdirSync(specsRoot, {
		recursive: true,
		withFileTypes: true,
	})) {
		if (!entry.isFile() || !entry.name.endsWith(".feature")) {
			continue;
		}
		const specPath = join(entry.parentPath, entry.name);
		let tagged = false;
		for (const line of readFileSync(specPath, "utf8").split("\n")) {
			const text = line.trim();
			if (text.startsWith("@")) {
				tagged = text.split(/\s+/).includes("@captain");
				continue;
			}
			const scenario = /^Scenario(?: Outline)?:\s*(.+)$/.exec(text);
			if (scenario && tagged) {
				pending.push({
					spec: relative(cwd, specPath),
					scenario: scenario[1].trim(),
				});
			}
			if (scenario) {
				tagged = false;
			}
		}
	}
	return pending;
}

/**
 * @planks("Then Bonny begins their Captain opening turn before the operator speaks")
 * @planks("Then Bonny opens the session with the guidance \"Commodore, no model is rigged yet. Use /login, then /model.\"")
 * @planks("Then Bonny steers the operator to fit out with the Shipwright \"Johnson\"")
 * @planks("Then the session's opening carries the pending {string} scenario to the operator")
 * @planks("When Bonny takes their next turn")
 */
async function openWithBonnyVoice(
	state: EstelleState,
	session: AgentSession,
	modelRegistry: { getAvailable(): unknown[] },
	cwd: string,
): Promise<void> {
	const pending = pendingCaptainReviews(cwd);
	if (pending.length > 0) {
		await session.sendCustomMessage({
			customType: "estelle-pending-review",
			content: [
				'Pending review: the specs carry "@captain" scenarios awaiting the Captain\'s review.',
				...pending.map((item) => `- ${item.scenario} (${item.spec})`),
			].join("\n"),
			display: true,
		});
	}
	if (modelRegistry.getAvailable().length === 0) {
		const content = readFileSync(
			join(assetsDir(cwd), "steer.md"),
			"utf8",
		).trim();
		await session.sendCustomMessage({
			customType: "estelle-greeting",
			content,
			display: true,
		});
		return;
	}
	// A project workspace carries its own assets. When that workspace holds no
	// RIGGING.md it is unfitted, so Bonny steers the operator to the Shipwright
	// rather than opening at the helm.
	const isProject = existsSync(join(cwd, "assets", "crew-roster.json"));
	if (isProject && !existsSync(join(cwd, "RIGGING.md"))) {
		const content = readFileSync(
			join(assetsDir(cwd), "unfitted-steer.md"),
			"utf8",
		).trim();
		await session.sendCustomMessage({
			customType: "estelle-greeting",
			content,
			display: true,
		});
		return;
	}
	// Actuate Bonny's Captain opening turn: fire a real turn so the seat runs
	// its opening instructions. The interactive session streams the turn, so
	// startup returns once the opening turn has dispatched its provider request
	// rather than blocking on the full turn.
	const requestDispatched = new Promise<void>((resolve) => {
		state.onProviderRequest = resolve;
	});
	// The opening turn floats past startup by design. Its failure is recorded
	// as a delivery failure, the same observable state sendToOperator keeps, so
	// a failed opening turn surfaces in session state instead of an unhandled
	// rejection outliving the session's owner.
	const openingTurn = (
		JSON.parse(
			readFileSync(join(assetsDir(cwd), "agent-prompts.json"), "utf8"),
		) as { openingTurn: string }
	).openingTurn;
	state.pendingDeliveries.push(
		session
			.sendCustomMessage(
				{
					customType: "estelle-opening",
					content: openingTurn,
					display: false,
				},
				{ triggerTurn: true },
			)
			.then(
				() => {},
				() => {
					state.deliveryFailures += 1;
				},
			),
	);
	await requestDispatched;
}

function extensionName(path: string, resolvedPath: string): string {
	if (path.startsWith("<inline:")) {
		return "estelle";
	}
	return basename(resolvedPath).replace(/\.[^.]+$/, "");
}

/**
 * @planks("Then the pi session starts with the \"estelle\" extension loaded")
 * @planks("Then the skills \"captain\", \"qm\", \"crew\", \"boatswain\", and \"shipwright\" are present")
 * @planks("Then the upstream Shipshape role instructions resolve from outside the Estelle repository")
 * @planks("Then the \"update-config\" skill is present")
 * @planks("Then the \"find-skills\" skill is present")
 * @planks("Given the \"estelle.json\" file in the operator's agent directory records the captain model \"opencode-go/glm-5.2\"")
 */
export async function launch(options?: LaunchOptions): Promise<EstelleSession> {
	const cwd = options?.cwd ?? process.cwd();
	const roster = JSON.parse(
		readFileSync(join(assetsDir(cwd), "crew-roster.json"), "utf8"),
	) as { survivors: string[] };
	const survivors = roster.survivors;
	const state: EstelleState = {
		providerRequestCount: 0,
		activeSeat: SEATS.bonny,
		skillPaths: {},
		seatModels: {},
		unavailableModels: [],
		pendingDeliveries: [],
		deliveryFailures: 0,
	};

	const {
		createAgentSession,
		DefaultResourceLoader,
		DefaultPackageManager,
		SettingsManager,
		getAgentDir,
		SessionManager,
		ModelRegistry,
		AuthStorage,
	} = await import("@earendil-works/pi-coding-agent");

	const agentDir = options?.agentDir ?? getAgentDir();
	const estelleConfigPath = join(agentDir, "estelle.json");
	if (existsSync(estelleConfigPath)) {
		const recorded = JSON.parse(readFileSync(estelleConfigPath, "utf8")) as {
			seats?: Record<string, string>;
		};
		state.seatModels = { ...recorded.seats };
	}
	const settingsManager = SettingsManager.create(cwd, agentDir, {
		projectTrusted: true,
	});
	await ensureShipshapePackage({
		cwd,
		agentDir,
		settingsManager,
		DefaultPackageManager,
	});
	const shipshapeUrl = new URL(SHIPSHAPE_PACKAGE_SOURCE);
	const shipshapePluginDir = join(
		agentDir,
		"git",
		shipshapeUrl.host,
		...shipshapeUrl.pathname.split("/").filter(Boolean),
	);
	const shipshapeCustody = loadOpenPlugin(shipshapePluginDir);
	const extensionFactories = [
		createEstelleExtension(state, cwd, shipshapeCustody, shipshapePluginDir),
	];
	const skillsRoot = join(assetsDir(cwd), "skills");
	const additionalSkillPaths = [
		join(skillsRoot, "update-config", "SKILL.md"),
		join(skillsRoot, "find-skills", "SKILL.md"),
	];
	const buildResourceLoader = (noExtensions: boolean) =>
		new DefaultResourceLoader({
			cwd,
			agentDir,
			settingsManager,
			noExtensions,
			extensionFactories,
			additionalSkillPaths,
		});

	let resourceLoader = buildResourceLoader(true);
	await resourceLoader.reload();

	const modelRegistry = ModelRegistry.create(AuthStorage.inMemory());

	let session = (
		await createAgentSession({
			resourceLoader,
			sessionManager: SessionManager.inMemory(),
			modelRegistry,
		})
	).session;
	// The extension's tool_call seam runs after this session exists and reaches
	// it through this closure over the live binding, so a later session swap is
	// reflected without rewiring. The launch path sets no runtime, so the seam
	// resolves the running session here rather than through state.runtime.
	state.getSession = () => session;

	const extensions = resourceLoader
		.getExtensions()
		.extensions.map((e) => extensionName(e.path, e.resolvedPath));
	const skills = resourceLoader
		.getSkills()
		.skills.map((s) => ({ name: s.name, filePath: s.filePath }));
	state.skillPaths = Object.fromEntries(
		skills.map((s) => [s.name, s.filePath]),
	);
	const commands = [...SEAT_COMMANDS, ...ALONGSIDE_COMMANDS];

	return {
		get session() {
			return session;
		},
		extensions,
		skills,
		/**
		 * @planks("Then the commands \"/bonny\", \"/captain\", \"/misson\", \"/crew\", \"/bellamy\", and \"/johnson\" are present")
		 * @planks("Then the command \"/websearch\" is present")
		 */
		commands,
		/**
		 * @planks("Then the active seat is the Captain \"Bonny\"")
		 * @planks("Given the active seat is the \"bonny\" seat")
		 */
		seat: () => state.activeSeat,
		seatCrew: () => assignCrewSeat(survivors),
		/**
		 * @planks("Given the active seat is the \"bonny\" seat")
		 */
		runCommand: (command) => {
			const id = SEAT_BY_COMMAND[command];
			state.activeSeat = SEATS[id];
			return state.activeSeat;
		},
		/**
		 * @planks("Given the active seat is a Crew hand")
		 * @planks("Given the active seat is the Quartermaster \"Misson\"")
		 * @planks("Given the active seat is the Boatswain \"Bellamy\"")
		 */
		selectSeat: (role, name) => {
			state.activeSeat = { ...SEAT_BY_ROLE[role], name };
			return state.activeSeat;
		},
		/**
		 * @planks("When the operator asks Estelle to create a skill named \"deploy-notes\" with the body \"Record deploy notes for the current release.\"")
		 * @planks("Then the \"deploy-notes\" skill is present")
		 * @planks("Then the \"deploy-notes\" skill body is \"Record deploy notes for the current release.\"")
		 */
		createSkill: async (name, body) => {
			const relPath = join("assets", "skills", name, "SKILL.md");
			const absolute = resolve(cwd, relPath);
			mkdirSync(dirname(absolute), { recursive: true });
			writeFileSync(
				absolute,
				`---\nname: ${name}\ndescription: ${body}\n---\n\n${body}\n`,
				"utf8",
			);
			resourceLoader.extendResources({
				skillPaths: [
					{
						path: relPath,
						metadata: {
							source: "estelle",
							scope: "temporary",
							origin: "top-level",
						},
					},
				],
			});
			const created = resourceLoader
				.getSkills()
				.skills.find((s) => s.name === name);
			if (!created) {
				throw new Error(`authored skill "${name}" did not load`);
			}
			const entry = { name: created.name, filePath: created.filePath };
			skills.push(entry);
			return entry;
		},
		/**
		 * @planks("When Estelle installs the upstream skill package \"dmytri/shipshape\"")
		 * @planks("Then the \"captain\" skill is present")
		 */
		installSkill: async (source) => {
			const packageManager = new DefaultPackageManager({
				cwd,
				agentDir,
				settingsManager,
			});
			await packageManager.installAndPersist(`https://github.com/${source}`, {
				local: true,
			});
			await resourceLoader.reload();
			const reloaded = resourceLoader
				.getSkills()
				.skills.map((s) => ({ name: s.name, filePath: s.filePath }));
			skills.length = 0;
			skills.push(...reloaded);
		},
		/**
		 * @planks("When Estelle installs the pi extension package \"npm:pi-web-access\"")
		 * @planks("Then the command \"/websearch\" is present")
		 */
		installExtension: async (source) => {
			const packageManager = new DefaultPackageManager({
				cwd,
				agentDir,
				settingsManager,
			});
			await packageManager.installAndPersist(source, { local: true });
			resourceLoader = buildResourceLoader(false);
			await resourceLoader.reload();
			session.dispose();
			session = (
				await createAgentSession({
					resourceLoader,
					sessionManager: SessionManager.inMemory(),
					modelRegistry,
				})
			).session;
			const extCommands =
				state.pi?.getCommands().map((c) => `/${c.name}`) ?? [];
			const merged = [...new Set([...SEAT_COMMANDS, ...extCommands])];
			commands.length = 0;
			commands.push(...merged);
		},
		/**
		 * @planks("Then the crew session allows a Crew hand to write \"src/handoff.ts\"")
		 * @planks("Then the crew session blocks a Crew hand from writing \"features/new.feature\"")
		 * @planks("Then the block reason carries the Shipshape plugin's denial \"Captain writes specs\"")
		 * @planks("Then the block reason carries the Shipshape plugin's denial \"Production code belongs to Crew\"")
		 * @planks("Then the block reason carries the Shipshape plugin's denial \"Captain-custodied or configuration artifact\"")
		 * @planks("When Bonny writes \"features/steps/pay.steps.ts\" through the Estelle session write seam")
		 * @planks("When Bonny writes \"RIGGING.md\" through the Estelle session write seam")
		 * @planks("When Bonny writes \"src/pay.ts\" through the Estelle session write seam")
		 * @planks("Then the session write seam allows the write")
		 * @planks("Then the session write seam blocks the write")
		 * @planks("Then the block reason carries the Shipshape plugin's denial for the Captain writing verification support")
		 */
		write: (path, contents) => {
			const relPath = relativeToCwd(cwd, path);
			const decision = shipshapeCustody.checkWriteSync(
				`shipshape:${state.activeSeat.skill}`,
				relPath,
				process.cwd(),
			);
			if (!decision.allowed) {
				return decision;
			}
			const absolute = resolve(cwd, path);
			mkdirSync(dirname(absolute), { recursive: true });
			writeFileSync(absolute, contents, "utf8");
			return { allowed: true };
		},
		/**
		 * @planks("When Bonny runs the \"/perturb\" command on the seam \"src/pay.ts\" in the running session")
		 * @planks("Then the seam \"src/pay.ts\" carries the perturbation statement from \"RIGGING.md\"")
		 * @planks("Then the perturbed seam carries no step text, scenario name, or rationale")
		 * @planks("When Misson runs the \"/perturb\" command on the seam \"src/pay.ts\" in the running session")
		 * @planks("Then the running session blocks the perturbation")
		 * @planks("Then the seam \"src/pay.ts\" is unchanged")
		 */
		perturb: (relPath) => {
			if (state.activeSeat.role !== "captain") {
				return { allowed: false, reason: "only the Captain perturbs a seam" };
			}
			const decision = shipshapeCustody.checkWriteSync(
				`shipshape:${state.activeSeat.skill}`,
				relPath,
				process.cwd(),
			);
			if (!decision.allowed) {
				return decision;
			}
			const statement = riggingPerturbStatement();
			const absolute = resolve(cwd, relPath);
			const original = readFileSync(absolute, "utf8");
			writeFileSync(absolute, `${original}${statement}\n`, "utf8");
			return { allowed: true };
		},
		/**
		 * @planks("When Bonny sends a message to the operator")
		 * @planks("Then Estelle reports that only the Captain addresses the operator")
		 */
		sendToOperator: (message) => {
			if (state.activeSeat.role !== "captain") {
				return {
					allowed: false,
					reason: "only the Captain addresses the operator",
				};
			}
			state.pendingDeliveries.push(
				session.sendUserMessage(message).then(
					() => {},
					() => {
						state.deliveryFailures += 1;
					},
				),
			);
			return { allowed: true };
		},
		/**
		 * @planks("Given Estelle config sets the Captain model to \"opencode-go/glm-5.2\"")
		 * @planks("Given Estelle config sets the Quartermaster model to \"opencode-go/glm-5.2\"")
		 * @planks("Then the \"estelle.json\" file in the operator's agent directory records the captain model \"opencode-go/glm-5.2\"")
		 * @planks("Then the \"estelle.json\" file in the operator's agent directory records the quartermaster model \"opencode-go/deepseek-v4-flash\"")
		 */
		setSeatModel: (role, id) => {
			state.seatModels[role] = id;
			writeFileSync(
				estelleConfigPath,
				JSON.stringify({ seats: state.seatModels }),
				"utf8",
			);
		},
		/**
		 * @planks("When Bonny begins a turn")
		 * @planks("When Misson begins a turn")
		 * @planks("Then the provider request uses the model \"opencode-go/glm-5.2\"")
		 * @planks("Then the provider request uses an available model")
		 */
		beginTurn: async () => {
			const role = state.activeSeat.role;
			const configured = state.seatModels[role] ?? piDefaultModel(agentDir);
			const resolveModel = (qualified: string) => {
				const slash = qualified.indexOf("/");
				return modelRegistry.find(
					qualified.slice(0, slash),
					qualified.slice(slash + 1),
				);
			};
			let model = resolveModel(configured);
			if (!model) {
				state.unavailableModels.push(configured);
				model = resolveModel(piDefaultModel(agentDir));
			}
			session.dispose();
			session = (
				await createAgentSession({
					resourceLoader,
					sessionManager: SessionManager.inMemory(),
					modelRegistry,
					model,
				})
			).session;
		},
		/**
		 * @planks("Then Estelle reports that the model \"opencode-go/nonexistent-model-9000\" is unavailable")
		 */
		unavailableModels: () => state.unavailableModels,
		providerRequestCount: () => state.providerRequestCount,
		/**
		 * @planks("Then the seat system prompt addresses the operator as \"Commodore\"")
		 */
		systemPrompt: () =>
			seatSystemPrompt(
				session.systemPrompt,
				state.activeSeat,
				cwd,
				state.skillPaths,
				shipshapePluginDir,
			),
		/**
		 * @planks("When the pending deliveries settle")
		 */
		settleDeliveries: async () => {
			await Promise.all(state.pendingDeliveries);
			state.pendingDeliveries = [];
		},
		/**
		 * @planks("Then Estelle records one delivery failure")
		 */
		deliveryFailures: () => state.deliveryFailures,
		dispose: () => session.dispose(),
	};
}

/**
 * @planks("When the operator starts Estelle in that directory")
 * @planks("Given the \"estelle.json\" file in the operator's agent directory records the captain model \"opencode-go/glm-5.2\"")
 * @planks("Then the started session runs the active seat on the model \"opencode-go/glm-5.2\"")
 * @planks("Then Estelle runs pi's interactive session")
 * @planks("Then that interactive session boots as the Captain \"Bonny\"")
 * @planks("Then that interactive session has the \"estelle\" extension loaded")
 * @planks("Then the started session is recorded under the operator's agent directory so the operator can resume it")
 * @planks("When the operator runs estelle with the arguments \"install npm:pi-web-access\"")
 * @planks("Then the \"npm:pi-web-access\" package is persisted in the operator's pi settings")
 * @planks("Then a crew session opens alongside the started session")
 * @planks("Then the crew session opens alongside the started session")
 * @planks("Then the crew session is seated as the Quartermaster \"Misson\"")
 * @planks("Then the started session stays seated as the Captain \"Bonny\"")
 * @planks("Then the started session still carries the operator's message \"make the greeting warmer\"")
 * @planks("Then the crew session's message history excludes the operator's message \"make the greeting warmer\"")
 * @planks("Then the crew session reports a heartbeat naming the Quartermaster \"Misson\"")
 * @planks("Then the crew session's heartbeat shows the crew at rest before it runs")
 * @planks("When the crew session runs a turn")
 * @planks("Then the crew session received a live reply from the Quartermaster's model")
 * @planks("Then the crew session's heartbeat reflected live activity during the run")
 */
export async function run(options?: RunOptions): Promise<void> {
	if (options?.argv?.length) {
		const { main } = await import("@earendil-works/pi-coding-agent");
		await main(options.argv);
		return;
	}
	const cwd = options?.cwd ?? process.cwd();
	const crewRunPrompts = JSON.parse(
		readFileSync(join(assetsDir(cwd), "agent-prompts.json"), "utf8"),
	) as {
		noVerifyCommand: string;
		crewRunSummary: string;
		crewRunNarration: string;
		crewLoopPrompts: {
			quartermaster: string;
			crew: string;
			boatswain: string;
			crewReady: string;
		};
		roleDispatch: {
			verifyLine: string;
			noVerifyLine: string;
			boatswain: string;
			boatswainDefaultJob: string;
			shipwright: string;
			shipwrightScope: string;
			seat: string;
			seatJob: string;
		};
	};
	// Prompt copy is catalogued, not written into the implementation. The catalog
	// carries `{placeholder}` slots the dispatch fills at the seam.
	const fillPrompt = (
		template: string,
		slots: Record<string, string>,
	): string =>
		Object.entries(slots).reduce(
			(text, [slot, value]) => text.split(`{${slot}}`).join(value),
			template,
		);
	const state: EstelleState = {
		providerRequestCount: 0,
		activeSeat: SEATS.bonny,
		skillPaths: {},
		seatModels: {},
		unavailableModels: [],
		pendingDeliveries: [],
		deliveryFailures: 0,
	};

	const {
		createAgentSessionRuntime,
		createAgentSessionServices,
		createAgentSessionFromServices,
		DefaultPackageManager,
		InteractiveMode,
		SessionManager,
		SettingsManager,
		getAgentDir,
	} = await import("@earendil-works/pi-coding-agent");

	const agentDir = options?.agentDir ?? getAgentDir();
	const estelleConfigPath = join(agentDir, "estelle.json");
	if (existsSync(estelleConfigPath)) {
		const recorded = JSON.parse(readFileSync(estelleConfigPath, "utf8")) as {
			seats?: Record<string, string>;
		};
		state.seatModels = { ...recorded.seats };
	}
	const settingsManager = SettingsManager.create(cwd, agentDir, {
		projectTrusted: true,
	});
	await ensureShipshapePackage({
		cwd,
		agentDir,
		settingsManager,
		DefaultPackageManager,
	});
	const shipshapeUrl = new URL(SHIPSHAPE_PACKAGE_SOURCE);
	const shipshapePluginDir = join(
		agentDir,
		"git",
		shipshapeUrl.host,
		...shipshapeUrl.pathname.split("/").filter(Boolean),
	);
	const shipshapeCustody = loadOpenPlugin(shipshapePluginDir);
	const skillsRoot = join(assetsDir(cwd), "skills");
	const additionalSkillPaths = [
		join(skillsRoot, "update-config", "SKILL.md"),
		join(skillsRoot, "find-skills", "SKILL.md"),
	];

	const seatBaseAppend = (seat: Seat, runtimeCwd: string): string =>
		seatSystemPrompt(
			"",
			seat,
			runtimeCwd,
			{
				[seat.skill]: join(
					shipshapePluginDir,
					"skills",
					seat.skill,
					"SKILL.md",
				),
			},
			shipshapePluginDir,
		);
	// Seat sessions run with thinking off. pi's default thinking level clamps
	// upward on reasoning models whose lower levels are unsupported, and a
	// reasoning-heavy live turn can land its reply in the thinking channel,
	// leaving no visible assistant text for the operator.
	/**
	 * @planks("When Bonny takes their next turn")
	 */
	const buildRuntime = (runtimeState: EstelleState) =>
		createAgentSessionRuntime(
			async ({ cwd: runtimeCwd, sessionManager, sessionStartEvent }) => {
				const services = await createAgentSessionServices({
					cwd: runtimeCwd,
					agentDir,
					settingsManager,
					resourceLoaderOptions: {
						extensionFactories: [
							createEstelleExtension(
								runtimeState,
								runtimeCwd,
								shipshapeCustody,
								shipshapePluginDir,
							),
						],
						additionalSkillPaths,
						appendSystemPrompt: [
							seatBaseAppend(runtimeState.activeSeat, runtimeCwd),
						],
						noExtensions: false,
					},
				});
				runtimeState.skillPaths = Object.fromEntries(
					services.resourceLoader
						.getSkills()
						.skills.map((s) => [s.name, s.filePath]),
				);
				const recorded = runtimeState.seatModels[runtimeState.activeSeat.role];
				const slash = recorded?.indexOf("/") ?? -1;
				const seatModel = recorded
					? services.modelRegistry.find(
							recorded.slice(0, slash),
							recorded.slice(slash + 1),
						)
					: undefined;
				return {
					...(await createAgentSessionFromServices({
						services,
						sessionManager,
						sessionStartEvent,
						model: seatModel,
						thinkingLevel: "off",
					})),
					services,
					diagnostics: services.diagnostics,
				};
			},
			{
				cwd,
				agentDir,
				sessionManager: SessionManager.create(cwd, join(agentDir, "sessions")),
			},
		);

	const runtime = await buildRuntime(state);

	state.runtime = runtime;
	let crewSawActivity = false;
	let crewSeat: Seat = SEATS.misson;
	const narrationLog: { from: string; to: string; line: string }[] = [];
	const crewRunReports: { summary: string }[] = [];
	let currentVerdict: { failingTarget?: string; allGreen?: boolean } = {};
	const crewDispatches: { target: string }[] = [];
	let crewRunEnded = false;
	let crewRun: Promise<void> | undefined;
	let crewRunCancelled = false;
	let activeVerification: ReturnType<typeof spawn> | undefined;
	/**
	 * @planks("Then a crew session opens alongside the started session")
	 * @planks("Then the crew session opens alongside the started session")
	 * @planks("Then the crew session is seated as the Boatswain \"Bellamy\"")
	 * @planks("Then the crew session is seated as the Shipwright \"Johnson\"")
	 * @planks("Then the crew session is seated as a Crew hand")
	 */
	state.openCrewSession = async (seat: Seat = SEATS.misson) => {
		const crewState: EstelleState = {
			providerRequestCount: 0,
			activeSeat: seat,
			skillPaths: {},
			seatModels: state.seatModels,
			unavailableModels: [],
			pendingDeliveries: [],
			deliveryFailures: 0,
		};
		crewSawActivity = false;
		crewSeat = seat;
		state.crewRuntime = await buildRuntime(crewState);
	};

	// Seating the crew session: a fresh, context-isolated runtime on the new seat.
	// One implementation, so the seat a decision names is the seat the crew session
	// actually takes, on the live run and on the fast tier alike. The live status
	// names the seat the moment it is taken, so Bonny can answer who is working.
	const seatCrewOn = async (
		seat: Seat,
		seatModels: Record<string, string> = state.seatModels,
	) => {
		if (state.crewStatus) {
			state.crewStatus.seat = `${seat.name} (${seat.role})`;
		}
		crewSawActivity = false;
		crewSeat = seat;
		state.crewRuntime = await buildRuntime({
			providerRequestCount: 0,
			activeSeat: seat,
			skillPaths: {},
			seatModels,
			unavailableModels: [],
			pendingDeliveries: [],
			deliveryFailures: 0,
		});
	};

	// The one decision seam: the next seat is a pure function of the Quartermaster's
	// verdict. All green ends the run and seats nobody; a named failing target seats
	// the Crew on it. The live loop and the fast tier drive this same seam, so a
	// second copy of the decision cannot pass while the real loop is broken.
	/**
	 * @planks("When Estelle advances the crew loop")
	 * @planks("Then the crew session is seated as the Crew")
	 * @planks("Then the Crew's dispatch names the target \"greeting.md\"")
	 * @planks("Then the crew loop seats no further seat")
	 * @planks("Then the crew loop seated the Crew exactly once")
	 * @planks("Then the crew run ends")
	 */
	const advanceCrewLoop = async (
		seatModels: Record<string, string> = state.seatModels,
	): Promise<Seat | undefined> => {
		if (currentVerdict.allGreen) {
			crewRunEnded = true;
			return undefined;
		}
		const { failingTarget } = currentVerdict;
		if (failingTarget === undefined) {
			throw new Error("crew loop advanced without a reported failing target");
		}
		crewDispatches.push({ target: failingTarget });
		await seatCrewOn(SEATS.crew, seatModels);
		return SEATS.crew;
	};

	/**
	 * @planks("When Estelle advances the crew loop through the Crew to the Boatswain")
	 * @planks("Then the crew session is seated as the Boatswain \"Bellamy\"")
	 * @planks("Then the crew session lets only the Boatswain commit")
	 * @planks("Then the crew session's message history excludes the Crew's context")
	 */
	const advanceCrewLoopThroughToBoatswain = async () => {
		const seat = await advanceCrewLoop();
		if (seat === undefined) {
			return;
		}
		await seatCrewOn(SEATS.bellamy);
	};

	/**
	 * @planks("When Estelle reports the crew's run back to Bonny")
	 * @planks("Then the started session records a crew-run report")
	 * @planks("Then the started session's history excludes the crew's raw message \"greeting.md warmer; three planks green\"")
	 * @planks("Then the crew run is reported back into Bonny's session")
	 * @planks("Then the started session receives Bonny's report when the run ends")
	 * @planks("Then the started session receives a report of the crew's run")
	 */
	const reportCrewRun = async (viaBonnyTurn = false) => {
		let summary = `${SEATS.crew.name}'s run is reported to ${SEATS.bonny.name}`;
		const captainModelId = state.seatModels[SEATS.bonny.role];
		const captainSlash = captainModelId?.indexOf("/") ?? -1;
		const captainModel = captainModelId
			? runtime.services.modelRegistry.find(
					captainModelId.slice(0, captainSlash),
					captainModelId.slice(captainSlash + 1),
				)
			: undefined;
		// Embark can be driven from inside Bonny's own live tool call. Sending
		// Bonny another user message mid-turn throws, and aborting would kill the
		// very turn that invoked embark, so keep the default summary in that case.
		if (captainModel && !viaBonnyTurn) {
			const bonnySession = runtime.session;
			// Bonny's live opening turn floats past startup, so it can still be
			// streaming when the report runs. The voiced summary must be a real
			// assistant message in Bonny's own session, and sending mid-stream
			// throws instead of voicing, so interrupt the in-flight turn; the
			// crew-run report is Bonny's next act.
			if (bonnySession.isStreaming) {
				await bonnySession.abort();
			}
			await bonnySession.sendUserMessage(crewRunPrompts.crewRunSummary);
			const voiced = bonnySession.messages
				.filter((message) => message.role === "assistant")
				.map(assistantText)
				.filter((text) => text.trim().length > 0);
			// Bonny supplies the prose, never the guarantee: a model that voices no
			// summary costs the operator prose, and the default summary carries the
			// report to them.
			if (voiced.length > 0) {
				summary = voiced[voiced.length - 1];
			}
		}
		crewRunReports.push({ summary });
		await runtime.session.sendCustomMessage({
			customType: "crew-run-report",
			content: summary,
			display: true,
		});
	};

	/**
	 * @planks("Then the started session receives the crew's narration as the crew runs")
	 */
	const narrateCrewRun = async () => {
		let line = `${SEATS.misson.name} sets the crew to work`;
		const captainModelId = state.seatModels[SEATS.bonny.role];
		const captainSlash = captainModelId?.indexOf("/") ?? -1;
		const captainModel = captainModelId
			? runtime.services.modelRegistry.find(
					captainModelId.slice(0, captainSlash),
					captainModelId.slice(captainSlash + 1),
				)
			: undefined;
		// Bonny's own turn may already be streaming when this runs: embark can be
		// driven from inside Bonny's own live tool call. Sending Bonny another user
		// message while that turn is still streaming throws, so skip the live
		// voice line and keep the default narration in that case.
		if (captainModel && !runtime.session.isStreaming) {
			const bonnySession = runtime.session;
			await bonnySession.sendUserMessage(crewRunPrompts.crewRunNarration);
			const voiced = bonnySession.messages
				.filter((message) => message.role === "assistant")
				.map(assistantText)
				.filter((text) => text.trim().length > 0);
			line = voiced[voiced.length - 1];
		}
		await runtime.session.sendCustomMessage({
			customType: "crew-narration",
			content: line,
			display: true,
		});
	};

	const extensions = runtime.services.resourceLoader
		.getExtensions()
		.extensions.map((e) => extensionName(e.path, e.resolvedPath));

	// The live model the crew runs on: an explicit per-seat model when the
	// operator set one, otherwise the session's own default model, the same
	// resolution every real turn uses. Returns an id only when it resolves to an
	// available model, so an unfitted session drives no crew instead of seating an
	// idle one.
	const liveCrewModel = (): string | undefined => {
		let id =
			state.seatModels[SEATS.misson.role] ?? state.seatModels[SEATS.bonny.role];
		if (!id) {
			try {
				id = piDefaultModel(agentDir);
			} catch {
				return undefined;
			}
		}
		const slash = id.indexOf("/");
		if (slash < 0) {
			return undefined;
		}
		return runtime.services.modelRegistry.find(
			id.slice(0, slash),
			id.slice(slash + 1),
		)
			? id
			: undefined;
	};

	/**
	 * @planks("Then Estelle runs the crew loop to completion without a further operator step")
	 * @planks("Then the crew edits production code in the scratch project during the run")
	 * @planks("Then the scratch project's own verification command reports the scenario \"adds two numbers\" green")
	 * @planks("Then the started session receives the crew's narration as the crew runs")
	 */
	const driveCrewLoopToCompletion = async (viaBonnyTurn = false) => {
		// Green is decided by THIS project's own verification command, read from its
		// RIGGING.md. A hardcoded runner would never go green on a project that runs
		// anything else, and the loop would spin forever.
		const verifyCommand = projectVerifyCommand(cwd);
		if (!verifyCommand) {
			throw new Error(crewRunPrompts.noVerifyCommand);
		}
		// Every seat is a real working turn with real tools, and every seat works from
		// the DURABLE artifacts alone: watchbill.json and the specs, which the Captain
		// writes. The operator's conversation never crosses this line; carrying it
		// into a dispatch would breach the Captain-to-Quartermaster bulkhead, and a
		// conforming Quartermaster must refuse a dispatch beyond its contract.
		const quartermasterDispatch = fillPrompt(
			crewRunPrompts.crewLoopPrompts.quartermaster,
			{ verifyCommand },
		);
		const crewDispatch = fillPrompt(crewRunPrompts.crewLoopPrompts.crew, {
			verifyCommand,
		});
		const boatswainDispatch = fillPrompt(
			crewRunPrompts.crewLoopPrompts.boatswain,
			{ verifyCommand },
		);
		// Run the project's own verification and keep what it SAID, not just whether
		// it passed. The output is what names the failure, and Bonny needs it to
		// answer the operator's "what is the crew doing?" from fact.
		const runVerification = () =>
			new Promise<{ green: boolean; output: string }>((resolve) => {
				const verification = spawn(verifyCommand, {
					cwd,
					shell: true,
				});
				let output = "";
				verification.stdout?.on("data", (chunk) => {
					output += String(chunk);
				});
				verification.stderr?.on("data", (chunk) => {
					output += String(chunk);
				});
				activeVerification = verification;
				const settle = (green: boolean) => {
					activeVerification = undefined;
					resolve({ green, output: output.trim().slice(-1200) });
				};
				verification.on("close", (code) => settle(code === 0));
				verification.on("error", (error) => {
					output += `\n${error.message}`;
					settle(false);
				});
			});
		const liveModelId = liveCrewModel();
		// The crew's real progress reaches Bonny's own session: what the verification
		// actually said, and what each seat actually reported doing. Bonny can then
		// speak to the run with the operator instead of guessing. The firewall holds:
		// Bonny receives each seat's own distilled report, never the crew's raw
		// context.
		const narrate = async (line: string) => {
			await runtime.session.sendCustomMessage({
				customType: "crew-narration",
				content: line,
				display: true,
			});
		};
		// The live model rides the seat that is about to work, so every seat turn is a
		// real turn on a real model.
		const seatModelsFor = (seat: Seat): Record<string, string> => {
			const seatModels: Record<string, string> = { ...state.seatModels };
			if (liveModelId) {
				seatModels[seat.role] = liveModelId;
			}
			return seatModels;
		};
		// A working turn on the seat the crew session already holds. The seat the
		// decision seam named is the seat that works.
		/**
		 * @planks("Then the operator's session carries the provider's refusal \"402 This request requires more credits\"")
		 * @planks("Then the crew run ends without reporting the crew's work as done")
		 */
		const runTurnOnCrewSeat = async (prompt: string) => {
			const seatSession = state.crewRuntime?.session;
			if (!seatSession) {
				throw new Error("crew loop ran a seat turn before the seat was taken");
			}
			await seatSession.sendUserMessage(prompt);
			const assistantMessages = seatSession.messages.filter(
				(message) => message.role === "assistant",
			);
			// A provider that refuses the turn leaves an errored assistant message with
			// the refusal and no content. Returned as a quiet report it reads as a crew
			// that worked and changed nothing, so the refusal is raised: it stops the
			// run and surfaces to the operator instead of passing as an ordinary turn.
			const last = assistantMessages[assistantMessages.length - 1] as
				| { stopReason?: string; errorMessage?: string }
				| undefined;
			if (last?.stopReason === "error") {
				throw new Error(
					`${crewSeat.name} (${crewSeat.role})'s provider refused the turn: ${
						last.errorMessage ?? "the provider returned an error"
					}`,
				);
			}
			return (
				assistantMessages
					.map(assistantText)
					.filter((text) => text.trim().length > 0)
					.pop() ?? "(no report)"
			);
		};
		const runSeatTurn = async (seat: Seat, prompt: string) => {
			await seatCrewOn(seat, seatModelsFor(seat));
			return runTurnOnCrewSeat(prompt);
		};
		// A bounded run: a crew that cannot turn the target green stops and says so,
		// rather than spinning through seats forever with no outcome.
		const maxRounds = 5;
		// The authoritative live record of this run. Bonny reads it through the
		// crew_status tool, so "who is working and what are they doing" is answered
		// from fact, never guessed and never dug out of the process table.
		const status: CrewRunStatus = {
			active: true,
			round: 0,
			maxRounds,
			verifyCommand,
			reports: [],
		};
		state.crewStatus = status;
		const record = async (seat: Seat, report: string) => {
			status.reports.push({ seat: `${seat.name} (${seat.role})`, report });
			await narrate(`${seat.name} (${seat.role}): ${report}`);
		};
		const settleStatus = (stoppedBecause?: string) => {
			status.active = false;
			status.seat = undefined;
			status.stoppedBecause = stoppedBecause;
		};
		// Bonny runs the crew rather than watching them: after each round Bonny reads
		// the seats' real reports and speaks to the operator. Bonny stays quiet only
		// when a turn is already in flight, so the operator's own turn is never
		// trampled; the narration still carries the facts in that case.
		const bonnySpeaks = async (prompt: string) => {
			const bonnySession = runtime.session;
			if (!liveModelId || bonnySession.isStreaming) {
				return;
			}
			try {
				await bonnySession.sendUserMessage(prompt);
			} catch {
				// A turn was already in flight; the narration already carries the facts.
			}
		};
		// The Quartermaster's verdict: the project's own verification command decides
		// green, and names the failing target when it is red. The decision seam reads
		// this verdict and nothing else.
		const quartermasterVerdict = async () => {
			const verdict = await runVerification();
			status.verification = verdict;
			currentVerdict = verdict.green
				? { allGreen: true }
				: { failingTarget: verdict.output };
			return verdict;
		};
		let verdict = await quartermasterVerdict();
		while (!crewRunCancelled) {
			// The decision, made once, in the one seam: all green ends the run, a failing
			// target seats the Crew on it.
			const seat = await advanceCrewLoop(seatModelsFor(SEATS.crew));
			if (seat === undefined) {
				break;
			}
			if (status.round >= maxRounds) {
				const why = `the crew ran ${maxRounds} rounds without turning \`${verifyCommand}\` green`;
				settleStatus(why);
				throw new Error(
					`${why}, so the run stopped rather than spinning. The last verification output was:\n${verdict.output}`,
				);
			}
			status.round += 1;
			await narrate(
				`Round ${status.round}: \`${verifyCommand}\` is red.\n${verdict.output}`,
			);
			// The Crew works the seat the decision seam gave them, then the Boatswain
			// takes custody and commits, then the Quartermaster takes the next turn and
			// reports the fresh verdict the seam reads at the top of the loop.
			await record(seat, await runTurnOnCrewSeat(crewDispatch));
			if (crewRunCancelled) {
				break;
			}
			await record(
				SEATS.bellamy,
				await runSeatTurn(SEATS.bellamy, boatswainDispatch),
			);
			if (crewRunCancelled) {
				break;
			}
			await record(
				SEATS.misson,
				await runSeatTurn(SEATS.misson, quartermasterDispatch),
			);
			verdict = await quartermasterVerdict();
			// Bonny runs the crew: read this round's real reports and surface them to
			// the operator, rather than sitting silent while the crew works.
			await bonnySpeaks(
				`Your crew just finished round ${status.round}. The Crew reported: ${status.reports.at(-3)?.report ?? "nothing"}. The Boatswain reported: ${status.reports.at(-2)?.report ?? "nothing"}. The Quartermaster reported: ${status.reports.at(-1)?.report ?? "nothing"}. \`${verifyCommand}\` is now ${verdict.green ? "green" : "red"}. In one or two short lines, tell the operator in your own voice what the crew actually did this round and what happens next.`,
			);
		}
		if (crewRunCancelled) {
			settleStatus("the run was stood down");
		} else {
			settleStatus(
				verdict.green ? undefined : `\`${verifyCommand}\` is still red`,
			);
			await narrate(
				verdict.green
					? `\`${verifyCommand}\` is green. The crew's run is done.`
					: `\`${verifyCommand}\` is still red.\n${verdict.output}`,
			);
		}
		if (crewRunCancelled) {
			return;
		}
		const bonnySession = runtime.session;
		// The crew loop can be driven from inside Bonny's own live tool call.
		// Sending Bonny another user message mid-turn throws, and aborting would
		// kill the very turn that invoked embark, so keep the default summary in
		// that case.
		if (viaBonnyTurn) {
			crewRunReports.push({
				summary: `${SEATS.crew.name}'s run is reported to ${SEATS.bonny.name}`,
			});
			return;
		}
		// Bonny's live opening turn floats past startup, so it can still be
		// streaming when the run ends. The voiced summary must be a real
		// assistant message in Bonny's own session, and sending mid-stream
		// throws instead of voicing, so interrupt the in-flight turn; the
		// crew-run report is Bonny's next act.
		if (bonnySession.isStreaming) {
			await bonnySession.abort();
		}
		await bonnySession.sendUserMessage(crewRunPrompts.crewRunSummary);
		const voiced = bonnySession.messages
			.filter((message) => message.role === "assistant")
			.map(assistantText)
			.filter((text) => text.trim().length > 0);
		crewRunReports.push({ summary: voiced[voiced.length - 1] });
	};

	// The startup rigging refit, once it is under way. It is a live seat turn that
	// runs on the one crew runtime, so a later dispatch waits for it: an overlapping
	// dispatch would clobber the refit's seat and take custody of a deck the refit
	// is still writing.
	let riggingRefit: Promise<unknown> | undefined;
	let riggingRefitEnded = false;

	/**
	 * Dispatch one role to actually DO its job. Opening a crew session seats a role
	 * and drives nothing, so a seated Boatswain never commits and a seated Shipwright
	 * never refits. The dispatch is thin by contract: the role, the base commit, and
	 * the job or scope. The role works from the repository and its own role skill;
	 * the operator's conversation with Bonny never crosses this line.
	 *
	 * @planks("When Bonny dispatches the Boatswain to take custody of the work")
	 * @planks("Then the Boatswain committed the crew's work")
	 * @planks("Then the scratch project's working tree is clean")
	 * @planks("When the operator runs the \"/bellamy\" command in the started session")
	 * @planks("When the operator runs the \"/johnson\" command in the started session")
	 * @planks("Given the operator tells Bonny to embark the crew on the failing scenario")
	 * @planks("When the operator asks Bonny to specify a greeting page for the project")
	 * @planks("Then the scratch project's \"RIGGING.md\" carries a \"focused\" command")
	 */
	const dispatchRole = async (seat: Seat, job?: string, floated = false) => {
		// The refit's own dispatch reads this before it is recorded, so it never
		// waits on itself.
		if (riggingRefit && !riggingRefitEnded) {
			// The rigging fault is already routed and Johnson is refitting it now.
			// Bonny surveys the same fault and dispatches the Shipwright for it too, so
			// a second Shipwright dispatch would hold Bonny's live turn until the refit
			// finished and then refit the same rigging again. The turn that routed the
			// fault could never continue, and the operator could never speak to a
			// session that never goes idle. Report the refit already under way and
			// carry on: the fault is routed, and the work continues in the same turn.
			if (seat.role === SEATS.johnson.role) {
				const line = `${SEATS.johnson.name} (${SEATS.johnson.role}) is already refitting the rigging. The refit runs alongside and blocks nothing: carry on with your turn now rather than waiting for it.`;
				await runtime.session.sendCustomMessage(
					{
						customType: "crew-narration",
						content: line,
						display: true,
					},
					runtime.session.isStreaming ? { deliverAs: "nextTurn" } : undefined,
				);
				return line;
			}
			await riggingRefit;
		}
		const liveModelId = liveCrewModel();
		// Seat the role first, so an unfitted session still shows the crew seated and
		// says plainly why they cannot be set to work, rather than failing the command.
		if (!liveModelId) {
			await state.openCrewSession?.(seat);
			const line = `${seat.name} (${seat.role}) is seated, but no model is fitted, so they cannot be set to work. Fit out a provider and model, then dispatch again.`;
			await runtime.session.sendCustomMessage({
				customType: "crew-narration",
				content: line,
				display: true,
			});
			return line;
		}
		const verifyCommand = projectVerifyCommand(cwd);
		const baseCommit = headCommit(cwd);
		const roleDispatch = crewRunPrompts.roleDispatch;
		const verifyLine = verifyCommand
			? fillPrompt(roleDispatch.verifyLine, { verifyCommand })
			: roleDispatch.noVerifyLine;
		const dispatch =
			seat.role === "boatswain"
				? fillPrompt(roleDispatch.boatswain, {
						job: job ?? roleDispatch.boatswainDefaultJob,
						baseCommit,
						verifyLine,
					})
				: seat.role === "shipwright"
					? fillPrompt(roleDispatch.shipwright, {
							baseCommit,
							scope: job
								? fillPrompt(roleDispatch.shipwrightScope, { job })
								: "",
							verifyLine,
						})
					: fillPrompt(roleDispatch.seat, {
							role: seat.role,
							baseCommit,
							job: job ? fillPrompt(roleDispatch.seatJob, { job }) : "",
							verifyLine,
						});
		const seatModels: Record<string, string> = { ...state.seatModels };
		seatModels[seat.role] = liveModelId;
		crewSeat = seat;
		state.crewRuntime = await buildRuntime({
			providerRequestCount: 0,
			activeSeat: seat,
			skillPaths: {},
			seatModels,
			unavailableModels: [],
			pendingDeliveries: [],
			deliveryFailures: 0,
		});
		const status: CrewRunStatus = {
			active: true,
			seat: `${seat.name} (${seat.role})`,
			round: 1,
			maxRounds: 1,
			verifyCommand,
			reports: [],
		};
		// A floated dispatch is Estelle's own startup routing, not a run the operator
		// embarked. Published as the crew's live status it reads to Bonny as a run in
		// progress, and Bonny holds their turn until it ends. It stays off the crew's
		// status, so the crew's status keeps naming the crew's own run.
		if (!floated) {
			state.crewStatus = status;
		}
		// The dispatch narration is the operator's display line, not work for Bonny's
		// live turn. A plain send into a streaming session steers the line into that
		// turn, where it stays queued: the turn restarts the moment it ends, so the
		// session is busy again and the operator's next message hits a processing
		// agent. The startup refit dispatches while Bonny's opening turn is still
		// streaming, so that is the launch the operator speaks into. Next-turn
		// delivery lands the line at the turn boundary instead and leaves the
		// session idle for the operator.
		const say = async (line: string) => {
			await runtime.session.sendCustomMessage(
				{
					customType: "crew-narration",
					content: line,
					display: true,
				},
				runtime.session.isStreaming ? { deliverAs: "nextTurn" } : undefined,
			);
		};
		await say(
			`${seat.name} (${seat.role}) is dispatched: ${job ?? "per their role"}. Base commit ${baseCommit}.`,
		);
		const seatSession = state.crewRuntime.session;
		await seatSession.sendUserMessage(dispatch);
		const report =
			seatSession.messages
				.filter((message) => message.role === "assistant")
				.map(assistantText)
				.filter((text) => text.trim().length > 0)
				.pop() ?? "(no report)";
		status.reports.push({ seat: `${seat.name} (${seat.role})`, report });
		await say(`${seat.name} (${seat.role}): ${report}`);
		// Custody must actually COMPLETE. A live model that only describes the commit
		// leaves the work on the deck, and the Boatswain is the only seat that may
		// commit, so uncommitted work would be stranded with no other path. The model
		// judges (hygiene, is it green, what the message says); the machine guarantees
		// the mechanical outcome. Trusting a model to remember a deterministic step is
		// how work goes missing.
		let outcome = report;
		if (seat.role === "boatswain") {
			const dirty =
				spawnSync("git", ["status", "--porcelain"], {
					cwd,
					encoding: "utf8",
				}).stdout.trim() !== "";
			if (dirty) {
				const green = verifyCommand
					? spawnSync(verifyCommand, { cwd, shell: true }).status === 0
					: true;
				if (!green) {
					const line = `${seat.name} did not commit: \`${verifyCommand}\` is red, so the deck stays dirty.`;
					await say(line);
					outcome = `${report}\n\n${line}`;
				} else {
					const subject =
						report
							.split("\n")
							.map((line) => line.trim())
							.find(
								(line) =>
									line.length > 0 && line.length <= 72 && !line.startsWith("#"),
							) ?? "Boatswain custody: commit the role-advanced work";
					spawnSync("git", ["add", "-A"], { cwd });
					const committed = spawnSync("git", ["commit", "-m", subject], {
						cwd,
						encoding: "utf8",
					});
					const line =
						committed.status === 0
							? `${seat.name} took custody and committed ${headCommit(cwd)}: ${subject}`
							: `${seat.name} could not commit: ${committed.stderr.trim()}`;
					await say(line);
					status.reports.push({
						seat: `${seat.name} (${seat.role})`,
						report: line,
					});
					outcome = `${report}\n\n${line}`;
				}
			}
		}
		status.active = false;
		status.seat = undefined;
		return outcome;
	};
	state.dispatchRole = dispatchRole;

	/**
	 * @planks("When Bonny embarks the crew as an ordinary act of their own turn")
	 * @planks("Then the crew edits production code in the scratch project during the run")
	 * @planks("Then the started session receives the crew's narration and Bonny's completed-run report")
	 * @planks("Then the crew runs on while Bonny's turn stays live")
	 * @planks("Then the operator's session carries the provider's refusal \"402 This request requires more credits\"")
	 */
	state.embark = async () => {
		// A stream already in flight at embark entry is Bonny's own turn calling
		// the embark tool: the live-voice seams must not abort it.
		const viaBonnyTurn = runtime.session.isStreaming;
		await narrateCrewRun();
		// A resolvable live model drives the real crew loop. A named batch is work
		// the operator asked for, so it drives the crew even on a project whose
		// verification is already green: a loop that only chases red tests would do
		// nothing at all and leave the operator waiting on nothing. An unfitted
		// session just opens the crew session.
		const liveModelId = liveCrewModel();
		if (liveModelId && !currentVerdict.allGreen) {
			// Open the crew session so the operator sees the crew embarked, then
			// drive the loop live without holding Bonny's turn: the conversation
			// stays live while the crew runs. The run is held for a later await and
			// for cancellation at teardown.
			await state.openCrewSession?.();
			crewRun = (async () => {
				try {
					await driveCrewLoopToCompletion(viaBonnyTurn);
					if (crewRunCancelled) {
						return;
					}
					crewRunEnded = true;
					await reportCrewRun(viaBonnyTurn);
				} catch (error) {
					// A cancelled run was stood down at teardown and needs no report.
					// Any other failure is surfaced into the operator's own session, so
					// a crew run that could not complete is visible rather than silent.
					if (!crewRunCancelled) {
						// A message sent into a streaming session is steered into the
						// in-flight turn instead of landing in the session, and Bonny's
						// opening turn floats past startup, so it can still be streaming
						// when the run fails. Interrupt it: the failure report is the
						// session's next message, not a whisper into a live turn.
						if (runtime.session.isStreaming) {
							await runtime.session.abort();
						}
						await runtime.session.sendCustomMessage({
							customType: "crew-run-report",
							content: `${SEATS.bellamy.name}: the crew run stopped before every target was green. ${
								error instanceof Error ? error.message : String(error)
							}`,
							display: true,
						});
					}
				}
			})();
			return;
		}
		await state.openCrewSession?.();
		if (currentVerdict.allGreen) {
			crewRunEnded = true;
			await reportCrewRun(viaBonnyTurn);
			return;
		}
		// A batch is waiting but no model resolves: the crew is seated and cannot be
		// set to work. Say so plainly rather than reporting a run that never ran.
		await runtime.session.sendCustomMessage({
			customType: "crew-run-report",
			content: `${SEATS.bonny.name}: the crew is seated, but no model is fitted, so I cannot set them to work. Fit out a provider and model, then embark again.`,
			display: true,
		});
	};

	// A fitted project whose RIGGING.md is missing a required value carries a
	// rigging fault. The fault is Bonny's to route, never to hold, so Johnson is
	// dispatched to refit the rigging. The refit is a live seat turn, so it floats
	// past startup the way Bonny's opening turn does: the helm opens on the
	// operator's session while Johnson works, and the crew's own dispatches queue
	// behind the refit. Its failure is recorded as a delivery failure, the same
	// observable state every floated turn keeps.
	/**
	 * @planks("Then the scratch project's \"RIGGING.md\" carries a \"focused\" command")
	 */
	if (existsSync(join(cwd, "RIGGING.md"))) {
		const missing = missingRiggingValues(cwd);
		if (missing.length > 0) {
			riggingRefit = state.dispatchRole?.(
				SEATS.johnson,
				`refit RIGGING.md: it carries no ${missing.join(", ")} under its headings, and every one is a required value. Record each missing value as a real, working value on its own \`- <key>: <value>\` line under its heading. A required key left blank, or written as \`none\` or a placeholder, is still the fault you were sent to repair. Derive each value from this project's own stack and tooling; where the tooling for a value is not fitted yet, fit it first, then record the value that runs with it. The \`focused\` command runs one named scenario and carries the \`{scenario}\` placeholder. When you are done, read RIGGING.md back and confirm every one of ${missing.join(", ")} now carries a value.`,
				true,
			);
			// The refit is under way from here, and Bonny's own seams read it: a second
			// Shipwright dispatch is answered with the refit already running, and the
			// crew's live status names the refit as work running alongside rather than
			// a crew run to wait on.
			state.riggingRefitting = true;
			state.pendingDeliveries.push(
				riggingRefit.then(
					() => {
						riggingRefitEnded = true;
						state.riggingRefitting = false;
					},
					() => {
						riggingRefitEnded = true;
						state.riggingRefitting = false;
						state.deliveryFailures += 1;
					},
				),
			);
		}
	}

	reAskBonnyOnOmittedEmbark(runtime.session, state);

	await openWithBonnyVoice(
		state,
		runtime.session,
		runtime.services.modelRegistry,
		cwd,
	);

	// The interactive owner holds the session's lifetime. The default terminal
	// mode disposes when the operator exits; an injected interactive seam keeps
	// the started session live after run() returns, so Bonny's opening turn and
	// later turns run to completion on a connected session.
	/**
	 * @planks("When Bonny takes their next turn")
	 */
	const interactive =
		options?.interactive ??
		(async (handle: InteractiveHandle) => {
			const mode = new InteractiveMode(handle.runtime);
			await mode.run();
			handle.runtime.session.dispose();
		});

	await interactive({
		runtime,
		extensions,
		seat: () => state.activeSeat,
		crewSession: () => {
			const crewRuntime = state.crewRuntime;
			return (
				crewRuntime && {
					runtime: crewRuntime,
					seat: () => crewSeat,
					/**
					 * @planks("Then the crew session reports a heartbeat naming the Quartermaster \"Misson\"")
					 * @planks("Then the crew session's heartbeat shows the crew at rest before it runs")
					 * @planks("Then the crew session's heartbeat reflected live activity during the run")
					 * @planks("Then the crew session's heartbeat shows the crew is no longer at rest during the run")
					 */
					heartbeat: () => ({
						name: SEATS.misson.name,
						atRest: !crewSawActivity,
						sawActivity: crewSawActivity,
					}),
					/**
					 * @planks("When the crew session runs a turn")
					 * @planks("Then the crew session received a live reply from the Quartermaster's model")
					 * @planks("Then the crew session's heartbeat reflected live activity during the run")
					 * @planks("When the alongside Quartermaster's turn ends by refusing for unclean context")
					 * @planks("Then Estelle re-asks the Quartermaster once, stating the alongside session's context is clean")
					 */
					runTurn: async () => {
						const crewSession = crewRuntime.session;
						const seatReplies = () =>
							crewSession.messages
								.filter((message) => message.role === "assistant")
								.map(assistantText)
								.filter((text) => text.trim().length > 0);
						// One real turn on the seat, ended on the seat's own reply.
						const seatTurn = async (prompt: string) => {
							const before = seatReplies().length;
							await new Promise<void>((resolve) => {
								const unsubscribe = crewSession.subscribe(() => {
									crewSawActivity = true;
									if (seatReplies().length > before) {
										unsubscribe();
										resolve();
									}
								});
								void crewSession.sendUserMessage(prompt);
							});
							await crewSession.abort();
						};
						await seatTurn(crewRunPrompts.crewLoopPrompts.crewReady);
						// The alongside session is opened with clean context by
						// construction, so a refusal for unclean context is a turn that
						// omitted the work it was dispatched for. Estelle re-asks the seat
						// once, stating the fact the seat got wrong, and takes whatever the
						// second turn answers: one re-ask, never a retry loop.
						const answered = seatReplies().pop() ?? "";
						if (refusedForUncleanContext(answered)) {
							await seatTurn(UNCLEAN_CONTEXT_REASK);
						}
					},
					/**
					 * @planks("Then the crew session allows a Crew hand to write \"src/handoff.ts\"")
					 * @planks("Then the crew session blocks a Crew hand from writing \"features/new.feature\"")
					 * @planks("Then the crew session allows a Crew hand to write \"packages/pi-open-plugin-shim/src/index.ts\"")
					 * @planks("Then the crew session allows a Crew hand to write \"bin/estelle.js\"")
					 */
					write: (path: string, contents: string) => {
						const relPath = relativeToCwd(cwd, path);
						const decision = shipshapeCustody.checkWriteSync(
							`shipshape:${crewSeat.skill}`,
							relPath,
							process.cwd(),
						);
						if (!decision.allowed) {
							return decision;
						}
						const absolute = resolve(cwd, path);
						mkdirSync(dirname(absolute), { recursive: true });
						writeFileSync(absolute, contents, "utf8");
						return { allowed: true };
					},
					/**
					 * @planks("Then the crew session lets only the Boatswain commit")
					 */
					commit: () => {
						if (crewSeat.role !== "boatswain") {
							return {
								allowed: false,
								reason: "only the Boatswain may commit",
							};
						}
						return { allowed: true };
					},
				}
			);
		},
		/**
		 * @planks("When Estelle hands the crew off from the Quartermaster to the Crew")
		 * @planks("Then the crew session is seated as a Crew hand")
		 * @planks("Then the crew session's message history excludes the Quartermaster's message \"target greeting.md is red\"")
		 * @planks("Then Bonny's narration log records a handoff from the Quartermaster to the Crew")
		 * @planks("Then the started session receives a narration of the handoff from the Quartermaster to the Crew")
		 */
		handOffToCrew: async () => {
			const fromSeat = crewSeat;
			const crewState: EstelleState = {
				providerRequestCount: 0,
				activeSeat: SEATS.crew,
				skillPaths: {},
				seatModels: state.seatModels,
				unavailableModels: [],
				pendingDeliveries: [],
				deliveryFailures: 0,
			};
			crewSawActivity = false;
			crewSeat = SEATS.crew;
			const captainModelId = state.seatModels[SEATS.bonny.role];
			const captainSlash = captainModelId?.indexOf("/") ?? -1;
			const captainModel = captainModelId
				? runtime.services.modelRegistry.find(
						captainModelId.slice(0, captainSlash),
						captainModelId.slice(captainSlash + 1),
					)
				: undefined;
			let line = `${fromSeat.name} hands off to ${SEATS.crew.name}`;
			if (captainModel) {
				const bonnySession = runtime.session;
				// Bonny's live opening turn floats past startup, so it can still be
				// streaming when the handoff runs. The voiced line must be a real
				// assistant message in Bonny's own session, and sending mid-stream
				// throws instead of voicing, so interrupt the in-flight turn; the
				// handoff narration is Bonny's next act.
				if (bonnySession.isStreaming) {
					await bonnySession.abort();
				}
				await bonnySession.sendUserMessage(
					`Voice a single short line in your own voice narrating the handoff from the ${fromSeat.name} to the ${SEATS.crew.name}. Reply with plain text only. Do not read files. Do not call any tools.`,
				);
				const voiced = bonnySession.messages
					.filter((message) => message.role === "assistant")
					.map(assistantText)
					.filter((text) => text.trim().length > 0);
				// Bonny supplies the voice, never the guarantee: a model that voices no
				// line costs the operator colour, and the default line carries the
				// narration to them.
				if (voiced.length > 0) {
					line = voiced[voiced.length - 1];
				}
			}
			state.crewRuntime = await buildRuntime(crewState);
			narrationLog.push({
				from: fromSeat.role,
				to: SEATS.crew.role,
				line,
			});
			// Reaching the operator is Estelle's duty, so the handoff's narration is
			// emitted into the operator's own session, not the log alone.
			await runtime.session.sendCustomMessage({
				customType: "crew-narration",
				content: line,
				display: true,
			});
		},
		narrationLog: () => narrationLog,
		reportCrewRun,
		/**
		 * @planks("When Bonny embarks the batch from their turn")
		 * @planks("Then Estelle runs the crew loop to completion without a further operator step")
		 * @planks("Then the started session receives the crew's narration as the crew runs")
		 * @planks("Then the started session receives Bonny's report when the run ends")
		 * @planks("Then the started session receives the crew's narration and Bonny's completed-run report")
		 */
		captainTools: () => [
			{
				name: "embark",
				run: async () => {
					await state.embark?.();
				},
			},
		],
		crewRunReports: () => crewRunReports,
		/**
		 * @planks("When the Quartermaster reports the failing target \"greeting.md\"")
		 */
		reportFailingTarget: (target: string) => {
			currentVerdict = { failingTarget: target };
		},
		/**
		 * @planks("When the Quartermaster reports all targets green")
		 */
		reportAllGreen: () => {
			currentVerdict = { allGreen: true };
		},
		advanceCrewLoop: async () => {
			await advanceCrewLoop();
		},
		advanceCrewLoopThroughToBoatswain,
		crewDispatches: () => crewDispatches,
		crewRunEnded: () => crewRunEnded,
		/**
		 * The crew's held runs: the embarked loop, and the startup rigging refit that
		 * floats past the helm. Both are Johnson's and the crew's own work running
		 * alongside a live Bonny, so awaiting the run awaits both; a refit still in
		 * flight has not yet landed its repaired rigging on disk.
		 *
		 * @planks("Then the scratch project's own verification command reports the scenario \"adds two numbers\" green")
		 * @planks("Then the scratch project's \"RIGGING.md\" carries a \"focused\" command")
		 * @planks("Then the scratch project carries a specification for the greeting page")
		 */
		awaitCrewRun: async () => {
			await riggingRefit;
			await crewRun;
		},
		/**
		 * @planks("Then the crew runs on while Bonny's turn stays live")
		 */
		cancelCrewRun: async () => {
			crewRunCancelled = true;
			activeVerification?.kill();
			try {
				await state.crewRuntime?.session.abort();
			} catch {}
			try {
				await crewRun;
			} catch {}
		},
		/**
		 * @planks("When Bonny dispatches the Boatswain to take custody of the work")
		 * @planks("Then the Boatswain committed the crew's work")
		 */
		dispatchBoatswain: async (job?: string) =>
			(await state.dispatchRole?.(SEATS.bellamy, job)) ?? "",
		/**
		 * @planks("Then Bonny begins their Captain opening turn before the operator speaks")
		 */
		providerRequestCount: () => state.providerRequestCount,
	});
}
