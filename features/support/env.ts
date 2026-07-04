import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

// Load the project's .env into process.env so the @eval tier can read the live
// crew credentials the hermetic tier never needs. Only fills keys that are not
// already set in the environment, so a real shell export always wins. The @eval
// tier requires those credentials as fitting-out; an absent credential fails the
// eval run as a Captain blocker, never a silent skip, per RIGGING.md.
const envPath = join(process.cwd(), ".env");
if (existsSync(envPath)) {
	for (const line of readFileSync(envPath, "utf8").split("\n")) {
		const trimmed = line.trim();
		if (!trimmed || trimmed.startsWith("#")) {
			continue;
		}
		const eq = trimmed.indexOf("=");
		if (eq === -1) {
			continue;
		}
		const key = trimmed.slice(0, eq).trim();
		const value = trimmed.slice(eq + 1).trim();
		if (key && process.env[key] === undefined) {
			process.env[key] = value;
		}
	}
}
