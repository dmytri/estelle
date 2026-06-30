import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { basename, dirname, join, relative, resolve } from "node:path";
import type { AgentSession, ExtensionAPI } from "@earendil-works/pi-coding-agent";

export interface LaunchOptions {
	cwd?: string;
}

export interface EstelleSession {
	session: AgentSession;
	extensions: string[];
	skills: { name: string; filePath: string }[];
	seat(): { role: string; name: string };
	seatCrew(): { role: string; name: string };
	selectSeat(
		role: "captain" | "quartermaster" | "crew" | "bosun" | "shipwright",
		name: string,
	): { role: string; name: string };
	write(path: string, contents: string): { allowed: boolean; reason?: string };
	read(path: string): { allowed: boolean; reason?: string; contents?: string };
	sendToOperator(message: string): { allowed: boolean; reason?: string };
	setSeatModel(
		role: "captain" | "quartermaster" | "crew" | "bosun" | "shipwright",
		id: string,
	): void;
	beginTurn(): Promise<void>;
	providerRequestCount(): number;
	dispose(): void;
}

interface EstelleState {
	providerRequestCount: number;
	activeSeat: { role: string; name: string };
	seatModels: Record<string, string>;
}

function relativeToCwd(cwd: string, path: string): string {
	return relative(cwd, resolve(cwd, path));
}

/**
 * @planks("Then Estelle reports that the Crew may write only \"src/**\"")
 * @planks("Then Estelle reports that the Captain writes specs, assets, \"CAPTAIN.md\", and \"watchbill.json\"")
 * @planks("Then Estelle reports that only the Captain may write \"watchbill.json\"")
 */
function evaluateWrite(role: string, relPath: string): { allowed: boolean; reason?: string } {
	if (relPath === "watchbill.json" && role !== "captain") {
		return { allowed: false, reason: 'only the Captain may write "watchbill.json"' };
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
			reason: 'the Captain writes specifications, assets, "CAPTAIN.md", and "watchbill.json"',
		};
	}
	return { allowed: true };
}

/**
 * @planks("Then Estelle reports that \"CAPTAIN.md\" is private to the Captain")
 */
function evaluateRead(role: string, relPath: string): { allowed: boolean; reason?: string } {
	if (relPath === "CAPTAIN.md" && role !== "captain" && role !== "bosun") {
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
		pi.on("before_provider_request", () => {
			state.providerRequestCount += 1;
		});
		pi.on("tool_call", (event) => {
			if (event.toolName === "write" || event.toolName === "edit") {
				const relPath = relativeToCwd(cwd, (event.input as { path: string }).path);
				const decision = evaluateWrite(state.activeSeat.role, relPath);
				if (!decision.allowed) {
					return { block: true, reason: decision.reason };
				}
			}
			if (event.toolName === "read") {
				const relPath = relativeToCwd(cwd, (event.input as { path: string }).path);
				const decision = evaluateRead(state.activeSeat.role, relPath);
				if (!decision.allowed) {
					return { block: true, reason: decision.reason };
				}
			}
		});
	};
}

/**
 * @planks("Then the active seat is the Captain \"Bonny\"")
 */
function captainSeat(): { role: string; name: string } {
	return { role: "captain", name: "Bonny" };
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
 * @planks("Then the skills \"captain\", \"qm\", \"crew\", \"bosun\", and \"shipwright\" are present")
 * @planks("Then the \"captain\" skill resolves from the upstream Shipshape install")
 */
export async function launch(options?: LaunchOptions): Promise<EstelleSession> {
	const cwd = options?.cwd ?? process.cwd();
	const roster = JSON.parse(
		readFileSync(join(cwd, "assets", "crew-roster.json"), "utf8"),
	) as { survivors: string[] };
	const survivors = roster.survivors;
	const state: EstelleState = {
		providerRequestCount: 0,
		activeSeat: { role: "captain", name: "Bonny" },
		seatModels: {},
	};

	const {
		createAgentSession,
		DefaultResourceLoader,
		getAgentDir,
		SessionManager,
		ModelRegistry,
		AuthStorage,
	} = await import("@earendil-works/pi-coding-agent");

	const resourceLoader = new DefaultResourceLoader({
		cwd,
		agentDir: getAgentDir(),
		noExtensions: true,
		extensionFactories: [createEstelleExtension(state, cwd)],
	});
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

	return {
		get session() {
			return session;
		},
		extensions,
		skills,
		seat: captainSeat,
		seatCrew: () => assignCrewSeat(survivors),
		/**
		 * @planks("Given the active seat is the Crew hand \"Belka\"")
		 * @planks("Given the active seat is the Quartermaster \"Misson\"")
		 * @planks("Given the active seat is the Bosun \"Bellamy\"")
		 */
		selectSeat: (role, name) => {
			state.activeSeat = { role, name };
			return state.activeSeat;
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
			return { allowed: true, contents: readFileSync(resolve(cwd, path), "utf8") };
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
				return { allowed: false, reason: "only the Captain addresses the operator" };
			}
			session.sendUserMessage(message).catch(() => {});
			return { allowed: true };
		},
		/**
		 * @planks("Given Estelle config sets the Captain model to \"glm-5.2\"")
		 * @planks("Given Estelle config sets the Quartermaster model to \"deepseek-v4-flash\"")
		 */
		setSeatModel: (role, id) => {
			state.seatModels[role] = id;
		},
		/**
		 * @planks("When Bonny begins a turn")
		 * @planks("When Misson begins a turn")
		 * @planks("Then the provider request uses the model \"glm-5.2\"")
		 * @planks("Then the provider request uses the model \"deepseek-v4-flash\"")
		 */
		beginTurn: async () => {
			const id = state.seatModels[state.activeSeat.role];
			const model = modelRegistry.getAll().find((m) => m.id === id);
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
		providerRequestCount: () => state.providerRequestCount,
		dispose: () => session.dispose(),
	};
}
