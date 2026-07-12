import { spawnSync } from "node:child_process";
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
	configureRedTarget(): void;
	runCrewLoopToCompletion(): Promise<void>;
	crewLoopSeatsRanLive(): {
		quartermaster: boolean;
		crew: boolean;
		boatswain: boolean;
	};
	crewLoopTargetsAllGreen(): boolean;
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
	onProviderRequest?: () => void;
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
	return `${base}\n\n${houseRules}\n\n${roleInstructions}\n\n${pluginRules}\n\n${card}${dispatch}${embarkSteer}`;
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
 * The perturbation statement is durable configuration under "## Perturbation"
 * in RIGGING.md, read from the project root so the stamped seam tracks the
 * project value.
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
 * @planks("Then the crew session allows a Crew hand to write \"src/handoff.ts\"")
 * @planks("Then the crew session blocks a Crew hand from writing \"features/new.feature\"")
 */
function evaluateWrite(
	role: string,
	relPath: string,
): { allowed: boolean; reason?: string } {
	if (relPath === "watchbill.json" && role !== "captain") {
		return {
			allowed: false,
			reason: 'only the Captain may write "watchbill.json"',
		};
	}
	if (role === "crew") {
		if (relPath.startsWith("src/")) {
			return { allowed: true };
		}
		return { allowed: false, reason: 'the Crew may write only "src/**"' };
	}
	if (role === "captain") {
		if (
			relPath === "CAPTAIN.md" ||
			relPath === "watchbill.json" ||
			relPath.startsWith("features/") ||
			relPath.startsWith("assets/")
		) {
			return { allowed: true };
		}
		return {
			allowed: false,
			reason:
				'the Captain writes specifications, assets, "CAPTAIN.md", and "watchbill.json"',
		};
	}
	return { allowed: true };
}

/**
 * @planks("Then the running session allows the read")
 */
function evaluateRead(
	_role: string,
	_relPath: string,
): { allowed: boolean; reason?: string } {
	return { allowed: true };
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
 * @planks("When Bonny embarks the crew as an ordinary act of their own turn, with no further step standing in for their decision")
 * @planks("Then the crew's real work, driven only by that one embark act, turns the failing target green")
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
				description: `Dispatch the ${SEATS[id].role} ${SEATS[id].name} in a crew session alongside, keeping you seated with Bonny`,
				handler: async () => {
					await state.openCrewSession?.(SEATS[id]);
				},
			});
		}
		pi.registerCommand("embark", {
			description:
				"Embark the batch: open a crew session alongside seated as the Quartermaster Misson",
			handler: async () => {
				await state.openCrewSession?.();
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
				parameters: {
					type: "object",
					properties: {},
					additionalProperties: false,
				} as unknown as Parameters<typeof pi.registerTool>[0]["parameters"],
				execute: async () => {
					await (state.embark ?? state.openCrewSession)?.();
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
			// The session's active tool set defaults to the built-in tools, so a
			// registered tool stays hidden from the model until activated. Activate
			// embark on session_start, after the default set is applied, so Bonny's
			// live model can call it from their own turn.
			pi.on("session_start", () => {
				pi.setActiveTools([...pi.getActiveTools(), "embark"]);
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
				const decision =
					state.activeSeat.role === "captain"
						? evaluateRead(state.activeSeat.role, relPath)
						: custody.checkReadSync(seat, relPath, process.cwd());
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
		 * @planks("Then Bonny offers the operator a fresh context for the next batch")
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
 * @planks("Then Bonny begins their Captain opening turn before the operator speaks")
 * @planks("Then Bonny opens the session with the guidance \"Commodore, no model is rigged yet. Use /login, then /model.\"")
 * @planks("Then Bonny steers the operator to fit out with the Shipwright \"Johnson\"")
 * @planks("When Bonny takes their next turn")
 */
async function openWithBonnyVoice(
	state: EstelleState,
	session: AgentSession,
	modelRegistry: { getAvailable(): unknown[] },
	cwd: string,
): Promise<void> {
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
		 */
		write: (path, contents) => {
			const relPath = relativeToCwd(cwd, path);
			const decision =
				state.activeSeat.role === "captain"
					? evaluateWrite(state.activeSeat.role, relPath)
					: shipshapeCustody.checkWriteSync(
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
		crewRunSummary: string;
		crewRunNarration: string;
		crewLoopPrompts: {
			quartermaster: string;
			crew: string;
			boatswain: string;
			crewReady: string;
		};
	};
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
	 * @planks("Then Bonny offers the operator a fresh context for the next batch")
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
	const crewLoopSeats = { quartermaster: false, crew: false, boatswain: false };
	let crewLoopAllGreen = false;
	let redTargetPath: string | undefined;
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

	/**
	 * @planks("When Estelle reports the crew's run back to Bonny")
	 * @planks("Then the started session records a crew-run report")
	 * @planks("Then the started session's history excludes the crew's raw message \"greeting.md warmer; three planks green\"")
	 * @planks("Then Bonny's crew-run report carries a live summary of the crew's work")
	 * @planks("Then the crew run is reported back into Bonny's session")
	 * @planks("Then the started session receives Bonny's report when the run ends")
	 * @planks("Then the started session shows Bonny's report of the completed run")
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
			summary = voiced[voiced.length - 1];
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
	 * @planks("Then the started session shows live narration of the crew's run")
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

	/**
	 * @planks("When Estelle runs the crew loop to completion")
	 * @planks("Then the crew loop ran the Quartermaster, the Crew, and the Boatswain live")
	 * @planks("Then the crew loop ended with every target green")
	 * @planks("Then Bonny's crew-run report carries a live summary of the run")
	 * @planks("When Bonny embarks the crew from their own turn")
	 * @planks("Then Estelle drives the Quartermaster, the Crew, and the Boatswain against the failing target")
	 * @planks("Then the failing target passes the project's verification after the run")
	 * @planks("Then the crew edits production code in the scratch project during the run")
	 * @planks("Then the scratch project's own verification command reports the scenario \"adds two numbers\" green")
	 */
	const driveCrewLoopToCompletion = async (viaBonnyTurn = false) => {
		// A configured proxy target arms the harness loop, faked from the Crew's
		// voiced line. A real project has no proxy: the Crew's own live turn reads
		// the durable specs and edits real production, and the project's own
		// verification command decides green.
		const targetPath = redTargetPath;
		const realCrewDispatch =
			"You are a Crew hand dispatched to a single failing verification target. The project's own verification command `pnpm exec cucumber-js` reports a failing scenario. Read the failing feature spec under features/ and the production code it exercises under src/, reproduce the failure, then make the smallest production edit that turns the failing scenario green. Use your edit or write tool to change the real production file. Do not edit the specs or the tests.";
		const targetGreen = () => {
			const verification = spawnSync(
				"pnpm",
				["exec", "cucumber-js", "--tags", "not @captain and not @shipwright"],
				{ cwd, encoding: "utf8" },
			);
			return verification.status === 0;
		};
		const liveModelId =
			state.seatModels[SEATS.misson.role] ?? state.seatModels[SEATS.bonny.role];
		const runSeatTurn = async (seat: Seat, prompt: string) => {
			const seatModels: Record<string, string> = { ...state.seatModels };
			if (liveModelId) {
				seatModels[seat.role] = liveModelId;
			}
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
			const seatSession = state.crewRuntime.session;
			await seatSession.sendUserMessage(prompt);
			return seatSession.messages
				.filter((message) => message.role === "assistant")
				.map(assistantText)
				.filter((text) => text.trim().length > 0)
				.pop();
		};
		while (!targetGreen()) {
			const qmReply = await runSeatTurn(
				SEATS.misson,
				crewRunPrompts.crewLoopPrompts.quartermaster,
			);
			if (qmReply) {
				crewLoopSeats.quartermaster = true;
			}
			const crewReply = await runSeatTurn(
				SEATS.crew,
				targetPath === undefined
					? realCrewDispatch
					: crewRunPrompts.crewLoopPrompts.crew,
			);
			if (crewReply) {
				crewLoopSeats.crew = true;
				if (targetPath !== undefined) {
					const relPath = relativeToCwd(cwd, targetPath);
					const decision = evaluateWrite(SEATS.crew.role, relPath);
					if (decision.allowed) {
						writeFileSync(targetPath, `${crewReply}\n`, "utf8");
					}
				}
			}
			const boatswainReply = await runSeatTurn(
				SEATS.bellamy,
				crewRunPrompts.crewLoopPrompts.boatswain,
			);
			if (boatswainReply) {
				crewLoopSeats.boatswain = true;
			}
		}
		crewLoopAllGreen = targetGreen();
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

	/**
	 * @planks("When Bonny embarks the crew from their own turn")
	 * @planks("Then the crew's real work, driven only by that one embark act, turns the failing target green")
	 * @planks("When Bonny embarks the crew as an ordinary act of their own turn")
	 * @planks("Then the crew edits production code in the scratch project during the run")
	 * @planks("Then the started session receives the crew's narration and Bonny's completed-run report")
	 */
	state.embark = async () => {
		// A stream already in flight at embark entry is Bonny's own turn calling
		// the embark tool: the live-voice seams must not abort it.
		const viaBonnyTurn = runtime.session.isStreaming;
		await narrateCrewRun();
		// A proxy target arms the harness loop. Otherwise, a live model with a
		// genuinely failing project drives the real crew loop against the project's
		// own verification; an all-green verdict just opens the crew session.
		const liveModelConfigured = Boolean(
			state.seatModels[SEATS.misson.role] ?? state.seatModels[SEATS.bonny.role],
		);
		if (redTargetPath || (!currentVerdict.allGreen && liveModelConfigured)) {
			await driveCrewLoopToCompletion(viaBonnyTurn);
		} else {
			await state.openCrewSession?.();
		}
		if (currentVerdict.allGreen || crewLoopAllGreen) {
			crewRunEnded = true;
		}
		await reportCrewRun(viaBonnyTurn);
	};

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
	 * @planks("Then Bonny offers the operator a fresh context for the next batch")
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
					 */
					runTurn: async () => {
						const crewSession = crewRuntime.session;
						await new Promise<void>((resolve) => {
							const unsubscribe = crewSession.subscribe(() => {
								crewSawActivity = true;
								const gotReply = crewSession.messages.some(
									(message) =>
										message.role === "assistant" &&
										assistantText(message).trim().length > 0,
								);
								if (gotReply) {
									unsubscribe();
									resolve();
								}
							});
							void crewSession.sendUserMessage(
								crewRunPrompts.crewLoopPrompts.crewReady,
							);
						});
						await crewSession.abort();
					},
					/**
					 * @planks("Then the crew session allows a Crew hand to write \"src/handoff.ts\"")
					 * @planks("Then the crew session blocks a Crew hand from writing \"features/new.feature\"")
					 */
					write: (path: string, contents: string) => {
						const relPath = relativeToCwd(cwd, path);
						const decision = evaluateWrite(crewSeat.role, relPath);
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
					 * @planks("Then the crew session blocks a Crew hand from committing")
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
		 * @planks("Then Bonny's narration for the handoff carries a live line in their voice")
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
				line = voiced[voiced.length - 1];
			}
			state.crewRuntime = await buildRuntime(crewState);
			narrationLog.push({
				from: fromSeat.role,
				to: SEATS.crew.role,
				line,
			});
		},
		narrationLog: () => narrationLog,
		reportCrewRun,
		/**
		 * @planks("When Bonny embarks the batch from their turn")
		 * @planks("Then Estelle runs the crew loop to completion without a further operator step")
		 * @planks("Then the started session receives the crew's narration as the crew runs")
		 * @planks("Then the started session receives Bonny's report when the run ends")
		 * @planks("When Bonny embarks the crew from their own turn")
		 * @planks("Then Estelle drives the Quartermaster, the Crew, and the Boatswain against the failing target")
		 * @planks("Then the failing target passes the project's verification after the run")
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
		/**
		 * @planks("When Estelle advances the crew loop")
		 * @planks("Then Estelle sends the Crew to the target \"greeting.md\"")
		 * @planks("Then the crew run ends without sending the Crew")
		 * @planks("Then Estelle sent the Crew exactly once")
		 * @planks("Then the crew run ends")
		 */
		advanceCrewLoop: async () => {
			if (currentVerdict.allGreen) {
				crewRunEnded = true;
				return;
			}
			const { failingTarget } = currentVerdict;
			if (failingTarget === undefined) {
				throw new Error("crew loop advanced without a reported failing target");
			}
			crewDispatches.push({ target: failingTarget });
		},
		/**
		 * @planks("When Estelle advances the crew loop through the Crew to the Boatswain")
		 * @planks("Then the crew session is seated as the Boatswain \"Bellamy\"")
		 * @planks("Then the crew session's message history excludes the Crew's context")
		 */
		advanceCrewLoopThroughToBoatswain: async () => {
			const { failingTarget } = currentVerdict;
			if (failingTarget === undefined) {
				throw new Error("crew loop advanced without a reported failing target");
			}
			crewDispatches.push({ target: failingTarget });
			const boatswainState: EstelleState = {
				providerRequestCount: 0,
				activeSeat: SEATS.bellamy,
				skillPaths: {},
				seatModels: state.seatModels,
				unavailableModels: [],
				pendingDeliveries: [],
				deliveryFailures: 0,
			};
			crewSawActivity = false;
			crewSeat = SEATS.bellamy;
			state.crewRuntime = await buildRuntime(boatswainState);
		},
		crewDispatches: () => crewDispatches,
		crewRunEnded: () => crewRunEnded,
		/**
		 * @planks("Given a target that is red until the Crew fixes it")
		 */
		configureRedTarget: () => {
			redTargetPath = resolve(cwd, join("src", "estelle-live-target.md"));
			mkdirSync(dirname(redTargetPath), { recursive: true });
			writeFileSync(redTargetPath, "", "utf8");
		},
		/**
		 * @planks("When Estelle runs the crew loop to completion")
		 * @planks("Then the crew loop ran the Quartermaster, the Crew, and the Boatswain live")
		 * @planks("Then the crew loop ended with every target green")
		 * @planks("Then Bonny's crew-run report carries a live summary of the run")
		 */
		runCrewLoopToCompletion: driveCrewLoopToCompletion,
		/**
		 * @planks("Then the crew loop ran the Quartermaster, the Crew, and the Boatswain live")
		 */
		crewLoopSeatsRanLive: () => crewLoopSeats,
		/**
		 * @planks("Then the crew loop ended with every target green")
		 */
		crewLoopTargetsAllGreen: () => crewLoopAllGreen,
		/**
		 * @planks("Then Bonny begins their Captain opening turn before the operator speaks")
		 */
		providerRequestCount: () => state.providerRequestCount,
	});
}
