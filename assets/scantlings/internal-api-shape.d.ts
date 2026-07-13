// Internal API shape scantling. Captain-owned, durable, mechanical only.
//
// Pins the exported surface of the flagship seam ("src/index.ts") and the
// shim seam ("packages/pi-open-plugin-shim/src/index.ts"). Reshape the
// internal API by editing this file directly; the attesting scenario in
// "features/internal-api-shape.feature" reddens when the real seam drifts
// from this contract.

// --- Flagship seam: src/index.ts ---

export interface LaunchOptions {
	cwd?: string;
	agentDir?: string;
}

export interface InteractiveHandle {
	runtime: unknown;
	extensions: string[];
	seat(): { id: string; role: string; name: string };
	crewSession():
		| {
				runtime: unknown;
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
	session: unknown;
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

export declare function launch(
	options?: LaunchOptions,
): Promise<EstelleSession>;
export declare function run(options?: RunOptions): Promise<void>;

// --- Shim seam: packages/pi-open-plugin-shim/src/index.ts ---

export interface WriteCustodyDecision {
	allowed: boolean;
	reason?: string;
}

export interface ReportedAgent {
	name: string;
	prompt: string;
}

export interface OpenPluginShim {
	checkWrite(
		role: string | undefined,
		path: string,
		projectDir?: string,
	): Promise<WriteCustodyDecision>;
	checkWriteSync(
		role: string | undefined,
		path: string,
		projectDir?: string,
	): WriteCustodyDecision;
	checkCommand(
		role: string | undefined,
		command: string,
	): Promise<WriteCustodyDecision>;
	checkRead(
		role: string | undefined,
		path: string,
	): Promise<WriteCustodyDecision>;
	runPostToolUse(
		toolName: string,
		toolInput: Record<string, string>,
		projectDir?: string,
	): Promise<{ output: string }>;
	checkReadSync(
		role: string | undefined,
		path: string,
		projectDir?: string,
	): WriteCustodyDecision;
	reportCommands(): string[];
	reportAgents(): ReportedAgent[];
}

export declare function loadOpenPlugin(pluginDir: string): OpenPluginShim;
export declare function installOpenPlugin(
	sourceDir: string,
	piPluginDir: string,
): void;
export declare function discoverInstalledPlugins(
	piPluginDir: string,
): OpenPluginShim[];
