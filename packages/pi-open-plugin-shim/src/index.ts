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
}

/**
 * @planks("Given the shim runs an open-plugin whose write-custody hook denies the role \"crew\" writing under \"features\" and permits it writing under \"src\"")
 */
export function loadOpenPlugin(pluginDir: string): OpenPluginShim {
	const plugin = JSON.parse(
		readFileSync(join(pluginDir, ".plugin", "plugin.json"), "utf8"),
	);
	const hooks = JSON.parse(readFileSync(join(pluginDir, plugin.hooks), "utf8"));
	const command: string = hooks.PreToolUse[0].hooks[0].command;
	return new WriteCustodyShim(pluginDir, command);
}

class WriteCustodyShim implements OpenPluginShim {
	constructor(
		private readonly pluginDir: string,
		private readonly command: string,
	) {}

	/**
	 * @planks("When a write to \"features/login.feature\" is attempted")
	 * @planks("Then the shim blocks the write")
	 * @planks("Then the block reason carries the hook's denial message")
	 * @planks("Then the shim allows the write")
	 * @planks("Given the host acts with no plugin role")
	 */
	async checkWrite(
		role: string | undefined,
		path: string,
	): Promise<WriteCustodyDecision> {
		if (role === undefined) {
			return { allowed: true };
		}
		const payload = JSON.stringify({
			agent_type: role,
			tool_name: "write",
			tool_input: { file_path: path },
		});
		const { code, stderr } = await runHook(
			join(this.pluginDir, this.command),
			this.pluginDir,
			payload,
		);
		if (code === 0) {
			return { allowed: true };
		}
		return { allowed: false, reason: stderr };
	}
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
