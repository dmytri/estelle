import { spawn } from "node:child_process";
import { readFileSync } from "node:fs";
import { join } from "node:path";

export interface WriteCustodyDecision {
	allowed: boolean;
	reason?: string;
}

export interface OpenPluginShim {
	checkWrite(
		role: string | undefined,
		path: string,
	): Promise<WriteCustodyDecision>;
	checkCommand(
		role: string | undefined,
		command: string,
	): Promise<WriteCustodyDecision>;
	checkRead(
		role: string | undefined,
		path: string,
	): Promise<WriteCustodyDecision>;
}

interface HookEntry {
	matcher: string;
	hooks: { command: string }[];
}

/**
 * @planks("Given the shim runs an open-plugin whose write-custody hook denies the role \"crew\" writing under \"features\" and permits it writing under \"src\"")
 * @planks("Given the shim runs an open-plugin whose command-custody hook lets only the role \"boatswain\" commit and denies every role a push")
 * @planks("Given the shim runs an open-plugin whose read-custody hook denies the role \"crew\" reading \"CAPTAIN.md\" and permits the role \"boatswain\"")
 * @planks("Given the shim runs an open-plugin whose matcher \"Edit|Write|MultiEdit|NotebookEdit\" carries a hook that denies the write")
 * @planks("Given the shim runs an open-plugin whose write matcher stacks a hook that permits and a hook that denies")
 * @planks("Given the shim runs an open-plugin whose only matcher is \"Bash\"")
 */
export function loadOpenPlugin(pluginDir: string): OpenPluginShim {
	const plugin = JSON.parse(
		readFileSync(join(pluginDir, ".plugin", "plugin.json"), "utf8"),
	);
	const hooks = JSON.parse(readFileSync(join(pluginDir, plugin.hooks), "utf8"));
	return new WriteCustodyShim(pluginDir, hooks.PreToolUse);
}

class WriteCustodyShim implements OpenPluginShim {
	constructor(
		private readonly pluginDir: string,
		private readonly preToolUse: HookEntry[],
	) {}

	/**
	 * @planks("When a write to \"features/login.feature\" is attempted")
	 * @planks("When a write to \"greeting.md\" is attempted")
	 */
	async checkWrite(
		role: string | undefined,
		path: string,
	): Promise<WriteCustodyDecision> {
		return this.dispatch(role, "write", { file_path: path });
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
	 * @planks("Given the host acts with no plugin role")
	 * @planks("Then the shim blocks the write")
	 * @planks("Then the shim allows the write")
	 * @planks("Then the shim blocks the command")
	 * @planks("Then the shim allows the command")
	 * @planks("Then the shim blocks the read")
	 * @planks("Then the shim allows the read")
	 * @planks("Then the block reason carries the hook's denial message")
	 * @planks("Then the block reason carries the denying hook's message")
	 */
	private async dispatch(
		role: string | undefined,
		toolName: string,
		toolInput: Record<string, string>,
	): Promise<WriteCustodyDecision> {
		if (role === undefined) {
			return { allowed: true };
		}
		const payload = JSON.stringify({
			agent_type: role,
			tool_name: toolName,
			tool_input: toolInput,
		});
		for (const entry of this.preToolUse) {
			if (!matcherMatchesTool(entry.matcher, toolName)) {
				continue;
			}
			for (const hook of entry.hooks) {
				const { code, stderr } = await runHook(
					join(this.pluginDir, hook.command),
					this.pluginDir,
					payload,
				);
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
): Promise<{ code: number; stderr: string }> {
	return new Promise((resolve) => {
		const child = spawn(hookPath, { cwd });
		let stderr = "";
		child.stderr.setEncoding("utf8");
		child.stderr.on("data", (chunk) => {
			stderr += chunk;
		});
		child.on("close", (code) => {
			resolve({ code: code ?? 0, stderr });
		});
		child.stdin.end(payload);
	});
}
