import { spawn, spawnSync } from "node:child_process";
import { cpSync, existsSync, readdirSync, readFileSync } from "node:fs";
import { basename, join } from "node:path";

export interface WriteCustodyDecision {
	allowed: boolean;
	reason?: string;
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

export interface ReportedAgent {
	name: string;
	prompt: string;
}

interface HookEntry {
	matcher: string;
	hooks: { command: string }[];
}

interface SessionStartEntry {
	hooks: { command: string }[];
}

/**
 * @planks("Given the shim runs an open-plugin whose write-custody hook denies the role \"crew\" writing under \"features\" and permits it writing under \"src\"")
 * @planks("Given the shim runs an open-plugin whose command-custody hook lets only the role \"boatswain\" commit and denies every role a push")
 * @planks("Given the shim runs an open-plugin whose read-custody hook denies the role \"crew\" reading \"CAPTAIN.md\" and permits the role \"boatswain\"")
 * @planks("Given the shim runs an open-plugin whose matcher \"Edit|Write|MultiEdit|NotebookEdit\" carries a hook that denies the write")
 * @planks("Given the shim runs an open-plugin whose write matcher stacks a hook that permits and a hook that denies")
 * @planks("Given the shim runs an open-plugin whose only matcher is \"Bash\"")
 * @planks("Given the shim runs an open-plugin whose manifest declares no hooks and whose \"hooks/hooks.json\" nests a write hook under a top-level \"hooks\" key, denying the role \"crew\" writing under \"features\"")
 * @planks("Given the shim runs an open-plugin whose manifest declares no components and which ships an agent \"qm\" and a command \"status\"")
 */
export function loadOpenPlugin(pluginDir: string): OpenPluginShim {
	const hooksFile = join(pluginDir, "hooks", "hooks.json");
	const raw = existsSync(hooksFile)
		? JSON.parse(readFileSync(hooksFile, "utf8"))
		: {};
	const hooks = raw.hooks ?? raw;
	return new WriteCustodyShim(
		pluginDir,
		hooks.PreToolUse,
		hooks.PostToolUse,
		hooks.SessionStart,
	);
}

/**
 * @planks("When the plugin is installed into a pi plugin directory")
 * @planks("Given an installed open-plugin whose write hook denies the role \"crew\" writing under \"features\"")
 * @planks("Given an installed open-plugin whose write hook command uses \"${PLUGIN_ROOT}\"")
 */
export function installOpenPlugin(
	sourceDir: string,
	piPluginDir: string,
): void {
	const plugin = JSON.parse(
		readFileSync(join(sourceDir, ".plugin", "plugin.json"), "utf8"),
	);
	cpSync(sourceDir, join(piPluginDir, plugin.name), { recursive: true });
}

/**
 * @planks("Then the installed plugin is registered for discovery")
 * @planks("Given an installed open-plugin whose write hook denies the role \"crew\" writing under \"features\"")
 * @planks("Given an installed open-plugin whose write hook command uses \"${PLUGIN_ROOT}\"")
 */
export function discoverInstalledPlugins(
	piPluginDir: string,
): OpenPluginShim[] {
	const shims: OpenPluginShim[] = [];
	for (const entry of readdirSync(piPluginDir)) {
		const pluginDir = join(piPluginDir, entry);
		if (existsSync(join(pluginDir, ".plugin", "plugin.json"))) {
			shims.push(loadOpenPlugin(pluginDir));
		}
	}
	return shims;
}

class WriteCustodyShim implements OpenPluginShim {
	private readonly pluginDir: string;
	private readonly preToolUse: HookEntry[];
	private readonly postToolUse: HookEntry[];
	private readonly sessionStart: SessionStartEntry[];

	constructor(
		pluginDir: string,
		preToolUse: HookEntry[],
		postToolUse: HookEntry[],
		sessionStart: SessionStartEntry[],
	) {
		this.pluginDir = pluginDir;
		this.preToolUse = preToolUse;
		this.postToolUse = postToolUse;
		this.sessionStart = sessionStart;
	}

	/**
	 * @planks("Given the shim runs an open-plugin whose SessionStart entry stacks a hook that emits \"orient\" and a hook that emits \"validate\"")
	 * @planks("Given the shim runs an open-plugin whose SessionStart hook exits non-zero")
	 * @planks("When a pi session starts")
	 * @planks("Then the SessionStart hook output carries \"orient\"")
	 * @planks("Then the SessionStart hook output carries \"validate\"")
	 * @planks("Then the session is not blocked")
	 */
	async runSessionStart(): Promise<{ output: string }> {
		let output = "";
		for (const entry of this.sessionStart) {
			for (const hook of entry.hooks) {
				// biome-ignore lint/suspicious/noTemplateCurlyInString: literal placeholder token the shim replaces with the plugin root at runtime
				const resolved = hook.command.replace("${PLUGIN_ROOT}", this.pluginDir);
				const hookPath =
					resolved === hook.command
						? join(this.pluginDir, hook.command)
						: resolved;
				const { stdout } = await runHook(hookPath, this.pluginDir, "");
				output += stdout;
			}
		}
		return { output };
	}

	/**
	 * @planks("When a Bash tool call \"git push origin main\" completes")
	 * @planks("When a write tool call to \"src/x.ts\" completes")
	 * @planks("Then the plugin's PostToolUse hook output carries \"batch shipped\"")
	 * @planks("Then the tool call is not blocked")
	 * @planks("Then no PostToolUse hook runs")
	 */
	async runPostToolUse(
		toolName: string,
		toolInput: Record<string, string>,
		projectDir?: string,
	): Promise<{ output: string }> {
		const payload = JSON.stringify({
			tool_name: toolName,
			tool_input: toolInput,
			cwd: projectDir,
		});
		const cwd = projectDir ?? this.pluginDir;
		let output = "";
		for (const entry of this.postToolUse) {
			if (!matcherMatchesTool(entry.matcher, toolName)) {
				continue;
			}
			for (const hook of entry.hooks) {
				const resolved = hook.command
					// biome-ignore lint/suspicious/noTemplateCurlyInString: literal placeholder token the shim replaces with the plugin root at runtime
					.replace("${PLUGIN_ROOT}", this.pluginDir)
					// biome-ignore lint/suspicious/noTemplateCurlyInString: the Claude-format plugin root token the installed plugin uses
					.replace("${CLAUDE_PLUGIN_ROOT}", this.pluginDir);
				const unquoted = resolved.replace(/^"(.*)"$/, "$1");
				const hookPath =
					unquoted === hook.command
						? join(this.pluginDir, hook.command)
						: unquoted;
				const { stdout } = await runHook(hookPath, cwd, payload);
				output += stdout;
			}
		}
		return { output };
	}

	/**
	 * @planks("When a write to \"features/login.feature\" is attempted")
	 * @planks("When a write to \"greeting.md\" is attempted")
	 * @planks("When a write to \"src/pay.ts\" in that project is attempted")
	 * @planks("When a write to \"features/pay.feature\" in that project is attempted")
	 */
	async checkWrite(
		role: string | undefined,
		path: string,
		projectDir?: string,
	): Promise<WriteCustodyDecision> {
		return this.dispatch(role, "write", { file_path: path }, projectDir);
	}

	/**
	 * @planks("When a write to \"features/login.feature\" is synchronously attempted")
	 * @planks("When a write to \"src/login.ts\" is synchronously attempted")
	 * @planks("Then the shim blocks the write")
	 * @planks("Then the shim allows the write")
	 * @planks("Then the block reason carries the hook's denial message")
	 * @planks("Then the block reason carries the Shipshape plugin's denial \"Captain writes specs\"")
	 * @planks("Then the block reason carries the Shipshape plugin's denial \"Production code belongs to Crew\"")
	 * @planks("Then the block reason carries the Shipshape plugin's denial \"Captain-custodied or configuration artifact\"")
	 */
	checkWriteSync(
		role: string | undefined,
		path: string,
		projectDir?: string,
	): WriteCustodyDecision {
		if (role === undefined) {
			return { allowed: true };
		}
		const payload = JSON.stringify({
			agent_type: role,
			tool_name: "write",
			tool_input: { file_path: path },
		});
		const cwd = projectDir ?? this.pluginDir;
		for (const entry of this.preToolUse) {
			if (!matcherMatchesTool(entry.matcher, "write")) {
				continue;
			}
			for (const hook of entry.hooks) {
				const resolved = hook.command
					// biome-ignore lint/suspicious/noTemplateCurlyInString: literal placeholder token the shim replaces with the plugin root at runtime
					.replace("${PLUGIN_ROOT}", this.pluginDir)
					// biome-ignore lint/suspicious/noTemplateCurlyInString: the Claude-format plugin root token the installed plugin uses
					.replace("${CLAUDE_PLUGIN_ROOT}", this.pluginDir);
				const unquoted = resolved.replace(/^"(.*)"$/, "$1");
				const hookPath =
					unquoted === hook.command
						? join(this.pluginDir, hook.command)
						: unquoted;
				const result = spawnSync(hookPath, {
					cwd,
					input: payload,
					encoding: "utf8",
				});
				if ((result.status ?? 0) !== 0) {
					return { allowed: false, reason: result.stderr };
				}
			}
		}
		return { allowed: true };
	}

	/**
	 * @planks("When a Bash tool call runs \"git commit -m x\"")
	 * @planks("When a Bash tool call runs \"git push origin main\"")
	 */
	async checkCommand(
		role: string | undefined,
		command: string,
	): Promise<WriteCustodyDecision> {
		return this.dispatch(role, "bash", { command });
	}

	/**
	 * @planks("When a read tool call opens \"CAPTAIN.md\"")
	 */
	async checkRead(
		role: string | undefined,
		path: string,
	): Promise<WriteCustodyDecision> {
		return this.dispatch(role, "read", { file_path: path });
	}

	/**
	 * @planks("When a read tool call synchronously opens \"CAPTAIN.md\"")
	 * @planks("Then the shim blocks the read")
	 * @planks("Then the shim allows the read")
	 * @planks("Then the block reason carries the hook's denial message")
	 * @planks("Then the block reason carries the Shipshape plugin's denial \"MUST NOT read CAPTAIN.md\"")
	 */
	checkReadSync(
		role: string | undefined,
		path: string,
		projectDir?: string,
	): WriteCustodyDecision {
		if (role === undefined) {
			return { allowed: true };
		}
		const payload = JSON.stringify({
			agent_type: role,
			tool_name: "read",
			tool_input: { file_path: path },
		});
		const cwd = projectDir ?? this.pluginDir;
		for (const entry of this.preToolUse) {
			if (!matcherMatchesTool(entry.matcher, "read")) {
				continue;
			}
			for (const hook of entry.hooks) {
				const resolved = hook.command
					// biome-ignore lint/suspicious/noTemplateCurlyInString: literal placeholder token the shim replaces with the plugin root at runtime
					.replace("${PLUGIN_ROOT}", this.pluginDir)
					// biome-ignore lint/suspicious/noTemplateCurlyInString: the Claude-format plugin root token the installed plugin uses
					.replace("${CLAUDE_PLUGIN_ROOT}", this.pluginDir);
				const unquoted = resolved.replace(/^"(.*)"$/, "$1");
				const hookPath =
					unquoted === hook.command
						? join(this.pluginDir, hook.command)
						: unquoted;
				const result = spawnSync(hookPath, {
					cwd,
					input: payload,
					encoding: "utf8",
				});
				if ((result.status ?? 0) !== 0) {
					return { allowed: false, reason: result.stderr };
				}
			}
		}
		return { allowed: true };
	}

	/**
	 * @planks("When the shim reports the plugin's commands")
	 */
	reportCommands(): string[] {
		const commandsDir = join(this.pluginDir, "commands");
		if (!existsSync(commandsDir)) {
			return [];
		}
		return readdirSync(commandsDir)
			.filter((entry) => entry.endsWith(".md"))
			.map((entry) => basename(entry, ".md"));
	}

	/**
	 * @planks("When the shim reports the plugin's agents")
	 */
	reportAgents(): ReportedAgent[] {
		const agentsDir = join(this.pluginDir, "agents");
		if (!existsSync(agentsDir)) {
			return [];
		}
		return readdirSync(agentsDir)
			.filter((entry) => entry.endsWith(".md"))
			.map((entry) => {
				const source = readFileSync(join(agentsDir, entry), "utf8");
				const match = source.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/);
				const frontmatter = match ? match[1] : "";
				const body = match ? match[2] : source;
				const nameLine = frontmatter
					.split("\n")
					.find((line) => line.startsWith("name:"));
				const name = nameLine
					? nameLine.slice("name:".length).trim()
					: basename(entry, ".md");
				return { name, prompt: body.trim() };
			});
	}

	/**
	 * @planks("Given the host acts with no plugin role")
	 * @planks("Given the shim runs an open-plugin whose write hook command is \"${PLUGIN_ROOT}/hooks/scripts/write-custody\" and denies the role \"crew\" writing under \"features\"")
	 * @planks("Given the shim runs an open-plugin whose write hook is the real Shipshape write-custody script, its hooks.json command quoted and rooted at \"${PLUGIN_ROOT}\"")
	 * @planks("Then the shim blocks the write")
	 * @planks("Then the shim allows the write")
	 * @planks("Then the shim blocks the command")
	 * @planks("Then the shim allows the command")
	 * @planks("Then the shim blocks the read")
	 * @planks("Then the shim allows the read")
	 * @planks("Then the block reason carries the hook's denial message")
	 * @planks("Then the block reason carries the denying hook's message")
	 * @planks("Then the block reason carries \"Production code belongs to Crew\"")
	 */
	private async dispatch(
		role: string | undefined,
		toolName: string,
		toolInput: Record<string, string>,
		projectDir?: string,
	): Promise<WriteCustodyDecision> {
		if (role === undefined) {
			return { allowed: true };
		}
		const payload = JSON.stringify({
			agent_type: role,
			tool_name: toolName,
			tool_input: toolInput,
		});
		const cwd = projectDir ?? this.pluginDir;
		for (const entry of this.preToolUse) {
			if (!matcherMatchesTool(entry.matcher, toolName)) {
				continue;
			}
			for (const hook of entry.hooks) {
				const resolved = hook.command
					// biome-ignore lint/suspicious/noTemplateCurlyInString: literal placeholder token the shim replaces with the plugin root at runtime
					.replace("${PLUGIN_ROOT}", this.pluginDir)
					// biome-ignore lint/suspicious/noTemplateCurlyInString: the Claude-format plugin root token the installed plugin uses
					.replace("${CLAUDE_PLUGIN_ROOT}", this.pluginDir);
				const unquoted = resolved.replace(/^"(.*)"$/, "$1");
				const hookPath =
					unquoted === hook.command
						? join(this.pluginDir, hook.command)
						: unquoted;
				const { code, stderr } = await runHook(hookPath, cwd, payload);
				if (code !== 0) {
					return { allowed: false, reason: stderr };
				}
			}
		}
		return { allowed: true };
	}
}

function matcherMatchesTool(matcher: string, toolName: string): boolean {
	const target = toolName.toLowerCase();
	return matcher
		.split("|")
		.some((name) => name.trim().toLowerCase() === target);
}

function runHook(
	hookPath: string,
	cwd: string,
	payload: string,
): Promise<{ code: number; stdout: string; stderr: string }> {
	return new Promise((resolve) => {
		const child = spawn(hookPath, { cwd });
		let stdout = "";
		let stderr = "";
		child.stdout.setEncoding("utf8");
		child.stdout.on("data", (chunk) => {
			stdout += chunk;
		});
		child.stderr.setEncoding("utf8");
		child.stderr.on("data", (chunk) => {
			stderr += chunk;
		});
		child.on("close", (code) => {
			resolve({ code: code ?? 0, stdout, stderr });
		});
		child.stdin.end(payload);
	});
}
