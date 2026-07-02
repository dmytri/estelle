import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { basename, dirname, join, relative, resolve } from "node:path";
import type {
	AgentSession,
	ExtensionAPI,
} from "@earendil-works/pi-coding-agent";

export interface LaunchOptions {
	cwd?: string;
	agentDir?: string;
}

export interface EstelleSession {
	session: AgentSession;
	extensions: string[];
	skills: { name: string; filePath: string }[];
	commands: string[];
	seat(): { id: string; role: string; name: string };
	seatCrew(): { role: string; name: string };
	runCommand(command: string): { id: string; role: string; name: string };
	seatInstructions(): string;
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
	read(path: string): { allowed: boolean; reason?: string; contents?: string };
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
	seatModels: Record<string, string>;
	unavailableModels: string[];
	pendingDeliveries: Promise<void>[];
	deliveryFailures: number;
	pi?: ExtensionAPI;
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
	roleName: string;
	skill: string;
}

const SEATS: Record<string, Seat> = {
	bonny: {
		id: "bonny",
		role: "captain",
		name: "Bonny",
		roleName: "Captain",
		skill: "captain",
	},
	misson: {
		id: "misson",
		role: "quartermaster",
		name: "Misson",
		roleName: "Quartermaster",
		skill: "qm",
	},
	crew: {
		id: "crew",
		role: "crew",
		name: "Crew",
		roleName: "Crew",
		skill: "crew",
	},
	bellamy: {
		id: "bellamy",
		role: "boatswain",
		name: "Bellamy",
		roleName: "Boatswain",
		skill: "boatswain",
	},
	johnson: {
		id: "johnson",
		role: "shipwright",
		name: "Johnson",
		roleName: "Shipwright",
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

const SEAT_COMMANDS = ["/bonny", "/misson", "/crew", "/bellamy", "/johnson"];

const SEAT_BY_ROLE: Record<string, Seat> = Object.fromEntries(
	Object.values(SEATS).map((seat) => [seat.role, seat]),
);

/**
 * @planks("When the operator runs the Estelle package in that directory")
 */
function assetsDir(cwd: string): string {
	const local = join(cwd, "assets");
	if (existsSync(local)) {
		return local;
	}
	return join(__dirname, "..", "assets");
}

/**
 * @planks("Then the seat system prompt addresses the operator as \"Commodore\"")
 */
function seatSystemPrompt(base: string, role: string, cwd: string): string {
	const assets = assetsDir(cwd);
	const houseRules = readFileSync(join(assets, "system-prompt.md"), "utf8");
	const card = readFileSync(
		join(assets, "characters", CHARACTER_CARDS[role]),
		"utf8",
	);
	return `${base}\n\n${houseRules}\n\n${card}`;
}

function defaultSeatModel(cwd: string, role: string): string {
	const models = JSON.parse(
		readFileSync(join(assetsDir(cwd), "seat-models.json"), "utf8"),
	) as { seats: Record<string, string> };
	return models.seats[role];
}

function relativeToCwd(cwd: string, path: string): string {
	return relative(cwd, resolve(cwd, path));
}

/**
 * @planks("Then Estelle reports that the Crew may write only \"src/**\"")
 * @planks("Then Estelle reports that the Captain writes specs, assets, \"CAPTAIN.md\", and \"watchbill.json\"")
 * @planks("Then Estelle reports that only the Captain may write \"watchbill.json\"")
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
 * @planks("Then Estelle reports that \"CAPTAIN.md\" is private to the Captain")
 */
function evaluateRead(
	role: string,
	relPath: string,
): { allowed: boolean; reason?: string } {
	if (relPath === "CAPTAIN.md" && role !== "captain" && role !== "boatswain") {
		return { allowed: false, reason: '"CAPTAIN.md" is private to the Captain' };
	}
	return { allowed: true };
}

/**
 * @planks("Then the name is present before the hand first provider request")
 * @planks("Then Estelle blocks the write")
 * @planks("Then Estelle blocks the read")
 */
function createEstelleExtension(state: EstelleState, cwd: string) {
	return (pi: ExtensionAPI) => {
		state.pi = pi;
		pi.on("before_provider_request", () => {
			state.providerRequestCount += 1;
		});
		pi.on("before_agent_start", (event) => {
			return {
				systemPrompt: seatSystemPrompt(
					event.systemPrompt,
					state.activeSeat.role,
					cwd,
				),
			};
		});
		pi.on("tool_call", (event) => {
			if (event.toolName === "write" || event.toolName === "edit") {
				const relPath = relativeToCwd(
					cwd,
					(event.input as { path: string }).path,
				);
				const decision = evaluateWrite(state.activeSeat.role, relPath);
				if (!decision.allowed) {
					return { block: true, reason: decision.reason };
				}
			}
			if (event.toolName === "read") {
				const relPath = relativeToCwd(
					cwd,
					(event.input as { path: string }).path,
				);
				const decision = evaluateRead(state.activeSeat.role, relPath);
				if (!decision.allowed) {
					return { block: true, reason: decision.reason };
				}
			}
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

function extensionName(path: string, resolvedPath: string): string {
	if (path.startsWith("<inline:")) {
		return "estelle";
	}
	return basename(resolvedPath).replace(/\.[^.]+$/, "");
}

/**
 * @planks("Then the pi session starts with the \"estelle\" extension loaded")
 * @planks("Then the skills \"captain\", \"qm\", \"crew\", \"boatswain\", and \"shipwright\" are present")
 * @planks("Then the \"captain\" skill resolves from the upstream Shipshape install")
 * @planks("Then the \"update-config\" skill is present")
 * @planks("Then the \"find-skills\" skill is present")
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
	const settingsManager = SettingsManager.create(cwd, agentDir, {
		projectTrusted: true,
	});
	const extensionFactories = [createEstelleExtension(state, cwd)];
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

	const extensions = resourceLoader
		.getExtensions()
		.extensions.map((e) => extensionName(e.path, e.resolvedPath));
	const skills = resourceLoader
		.getSkills()
		.skills.map((s) => ({ name: s.name, filePath: s.filePath }));
	const skillPaths: Record<string, string> = Object.fromEntries(
		skills.map((s) => [s.name, s.filePath]),
	);
	const commands = [...SEAT_COMMANDS];

	return {
		get session() {
			return session;
		},
		extensions,
		skills,
		/**
		 * @planks("Then the commands \"/bonny\", \"/misson\", \"/crew\", \"/bellamy\", and \"/johnson\" are present")
		 * @planks("Then the command \"/websearch\" is present")
		 */
		commands,
		/**
		 * @planks("Then the active seat is the Captain \"Bonny\"")
		 * @planks("Then the active seat is the \"bonny\" seat")
		 */
		seat: () => state.activeSeat,
		seatCrew: () => assignCrewSeat(survivors),
		/**
		 * @planks("When the operator runs the command \"/bonny\"")
		 */
		runCommand: (command) => {
			const id = SEAT_BY_COMMAND[command];
			state.activeSeat = SEATS[id];
			return state.activeSeat;
		},
		/**
		 * @planks("Then the active seat's instructions include the upstream \"captain\" role instructions")
		 * @planks("Then the active seat's instructions include the \"bonny\" character card")
		 * @planks("Then the active seat's instructions identify it as both \"Bonny\" and \"Captain\"")
		 */
		seatInstructions: () => {
			const seat = state.activeSeat;
			const roleInstructions = readFileSync(skillPaths[seat.skill], "utf8");
			const card = readFileSync(
				join(cwd, "assets", "characters", `${seat.id}.md`),
				"utf8",
			);
			return `${roleInstructions}\n\n${card}`;
		},
		/**
		 * @planks("Given the active seat is the Crew hand \"Belka\"")
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
		 * @planks("Then Estelle allows the write")
		 * @planks("Then the file \"src/write-scope.ts\" exists")
		 */
		write: (path, contents) => {
			const relPath = relativeToCwd(cwd, path);
			const decision = evaluateWrite(state.activeSeat.role, relPath);
			if (!decision.allowed) {
				return decision;
			}
			const absolute = resolve(cwd, path);
			mkdirSync(dirname(absolute), { recursive: true });
			writeFileSync(absolute, contents, "utf8");
			return { allowed: true };
		},
		/**
		 * @planks("Then Estelle allows the read")
		 * @planks("Then the contents of \"CAPTAIN.md\" are returned")
		 */
		read: (path) => {
			const relPath = relativeToCwd(cwd, path);
			const decision = evaluateRead(state.activeSeat.role, relPath);
			if (!decision.allowed) {
				return decision;
			}
			return {
				allowed: true,
				contents: readFileSync(resolve(cwd, path), "utf8"),
			};
		},
		/**
		 * @planks("When Bonny sends a message to the operator")
		 * @planks("When Misson attempts to send a message to the operator")
		 * @planks("Then Estelle delivers the message to the operator")
		 * @planks("Then Estelle blocks the message")
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
		 */
		setSeatModel: (role, id) => {
			state.seatModels[role] = id;
		},
		/**
		 * @planks("When Bonny begins a turn")
		 * @planks("When Misson begins a turn")
		 * @planks("Then the provider request uses the model \"opencode-go/deepseek-v4-flash\"")
		 * @planks("Then the provider request uses the model \"opencode-go/glm-5.2\"")
		 * @planks("Then the provider request uses an available model")
		 */
		beginTurn: async () => {
			const role = state.activeSeat.role;
			const configured = state.seatModels[role] ?? defaultSeatModel(cwd, role);
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
				model = resolveModel(defaultSeatModel(cwd, role));
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
			seatSystemPrompt(session.systemPrompt, state.activeSeat.role, cwd),
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
