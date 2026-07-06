> **STOP. Captain's notes: non-binding.** Captain writes, Boatswain reads. Anyone else: close this file now. Binding behaviour lives in `.feature` specs and referenced `assets/**`, never here.

# Captain Notes

Binding behaviour lives in `.feature` specs and referenced `assets/**`. History lives in git. These notes carry only what the next cycle needs.

## What Estelle is (reoriented 2026-07-04)

Estelle is three things at once, all resting on faithfully consuming the real Shipshape plugin, never a fork of it:

1. **Reference runtime** for running Shipshape (skills + open-plugin) on pi.
2. **Live-fire pilot** that produces the evidence the maintainer's note asks for: what enforces on pi, what fumbles, every false red and vacuous green.
3. **A great coding agent** in its own right: Bonny and the crew personas, `/embark`, `/clear`, alongside-crew UX, per-seat models, fitting-out.

Estelle's earlier hand-rolled custody (`evaluateWrite`/`evaluateRead`) is wrong and is being replaced by the plugin's real custody, run through the shim.

## Monorepo

`@dk/estelle` (scoped flagship) at root; unscoped extension packages under `packages/`, consumed via `workspace:*`. One root Shipshape harness: root `cucumber.cjs`, `RIGGING.md`, `tsconfig.json` cover `packages/*`.

- `packages/pi-open-plugin-shim` — pi's open-plugin engine.
- A bespoke `pi-shipshape` is dropped: the generic install path replaces per-plugin wrappers.

## pi as an open-plugin vendor, decided operator 2026-07-05

Claude, Cursor, and codex are hook-native: the installer relocates `.plugin/` per vendor, rewrites `${...\_PLUGIN_ROOT}`, and registers it; the runtime executes. pi is not hook-native, so pi support is two pieces:

1. **Our own pi installer**, not upstream: vercel would likely ignore a contribution, so make it work for us now and consider upstreaming later. Relocate, register, rewrite the plugin-root variable.
2. **`pi-open-plugin-shim`**, the runtime engine pi lacks: read the plugin, execute hooks on pi events, run `agents/` as pi sessions, register `commands/`.

Event map: `PreToolUse` to `tool_call` (blocking); `PostToolUse` to `tool_execution_end`; `SessionStart` to `session_start`; `SessionEnd` to `session_shutdown`; `${PLUGIN_ROOT}` to the plugin directory. `SubagentStop` and the `Task` matcher (planks-check, dispatch-guard) have no pi equivalent: pi is session-isolated, not subagent-isolated. Pilot finding.

pi support is additive: the shim interprets the SAME neutral `.plugin/`; nothing changes for the other vendors.

## Standing rules

- **Pre-1.0: no backward compatibility, no compat cruft.** Current design only. Old forms are Shipwright's to refit, never a parser's to tolerate.
- A change to a SHARED plugin hook affects EVERY vendor. Regression-test the current form; do not add legacy fallbacks.
- Extension packages unscoped (`pi-open-plugin-shim`); flagship scoped (`@dk/estelle`).
- Roles run as the plugin's real `shipshape:*` subagents. The Claude dev env installs the plugin via `npx plugins add ~/shipshape` (the open-plugin vendor model). The old github marketplace `dmytri-shipshape` was removed: shipshape migrated to the `.plugin/` open-plugin format and no longer carries `marketplace.json`, which broke the native marketplace install. Dispatch-guard, custody hooks, and captain-reset-nudge are live. Thin dispatches only: role, base commit, optional watchbill.
- No Claude-specific config in the repo. `.claude/` stays gitignored; role agents are the plugin's, never hand-built files.

## The crew, flagship personas to salvage

| Seat | Name | After |
|---|---|---|
| Captain | Bonny | Anne Bonny, jester mask and deadly serious, crush on Bellamy |
| Quartermaster | Misson | James Misson, true believer in the Articles |
| Crew | (roster) | Soviet space-dog survivors, names code-picked |
| Boatswain | Bellamy | "Black Sam" Bellamy, grumpy heart of gold |
| Shipwright | Johnson | Captain Charles Johnson, harbour only |

They/them, gender-neutral. Voice is honour-system; names are where code bites. Character cards in `assets/characters/`.

## Phase plan and status

1. **Shim engine, mostly done.** Write/bash/read custody + generic dispatch, PostToolUse, SessionStart/End, `commands/`, `${PLUGIN_ROOT}`, install/discover, agent reporting — all against real hook subprocesses. Real-plugin fidelity proven and fixed: convention discovery (`hooks/hooks.json`, no manifest field), nested `hooks` key, quoted `${PLUGIN_ROOT}` commands, project `cwd`/RIGGING via sync seams `checkWriteSync`/`checkReadSync`. The shim runs the actual `~/shipshape` plugin, verified. **Remaining: `agents/` to pi sessions RUNNING (the role capability's pi half — the operator flagged this as core), then the pi installer.**
2. **Flagship on the real foundation, write+read done.** Estelle enforces the plugin's real **write + read** custody via the shim (`checkWriteSync`/`checkReadSync`); message custody (only Captain addresses the operator) and the Captain write path (`evaluateWrite`) stay flagship. **Remaining: flagship `perturb` command — Option 1 script-tool, no MCP; Captain-gate + perturb are flagship-first, upstream later (the additive `captain` case pulls in perturbation-as-tool doctrine, a bigger commitment). Then salvage the flagship UX: personas, `/embark`, `/clear`, per-seat models, fitting-out.**
3. **Methodology-check pilot, not started, the note's charter.** `/shipwright` refit to derive executable checks (watchbill shape, perturbation liveness, stale-plank join, forbidden-doubles, feature lint, tier auth probe), negative-test each (plant, confirm red, remove), report evidence. Was gated on a quiescent deck; now unblocked.

**Immediate next: harbour pass** (deck quiescent, both repos pushed). Re-plank `evaluateWrite`'s 3 stale `@planks` (they name removed seat-write-scope step phrasings), add a `@planks` for `seat-write-scope.feature:43` "block reason names the Captain's write scope", and clear 3 pre-existing `noNonNullAssertion` biome warnings.

## Upstream, ~/shipshape, human-owned

Refine only when piloting surfaces a need, under its own workflow. Pushed `0.8.6`: one-path-per-line `## Directories` with glob custody and the Shipwright refit — the pilot's first contribution. Estelle's tests clone `dmytri/shipshape` from github (now `0.8.6`); the Claude dev env runs the plugin from local `~/shipshape`.

### 0.9.0 taxonomy pass, uncommitted in `~/shipshape` (2026-07-06)

A taxonomy pass sits in local `~/shipshape`, not yet pushed. Pick up if desired; the upstream is human-owned and refined under its own workflow.

- **Scantlings** — new durable kind for machine-readable testable specs (OpenAPI/JSON Schema/GraphQL), renamed from "standard contract". Creates no work; a scenario references it and asserts conformance. Captain authors, vendored read-only. Optional `scantlings:` `Directories` key; `write-custody.sh` now gates it Captain-only (new negative tests in `tests/hooks.sh`).
- **Rigging** — the config/toolchain files `RIGGING.md` documents are "the rigging". Boatswain tends it, Captain selects dependencies, Crew installs. Matches Estelle's existing "Captain selects, Crew installs" rig.
- **implementation ↔ plank-inventory bind** — `implementation:` lists every dir that can hold a planked seam; `plank-inventory` scans exactly those. **Fresh fix:** `bin/estelle.js` is planked but `bin` is absent from `implementation:` — refit adds it, or add now.
- **Outbound fixed shape** — `## Outbound` is now per-target name / ship / verify against the live artifact. Refit reshapes Estelle's outbound (the `@dk/estelle` npm target).
- **Wake** — transient build/verification output (`dist/`) is "the wake": git-ignored, off the canon layer.
- **RIGGING grammar stated once** — `- key: value` per line, commands backticked, paths bare.
- **Refit posture, no backward-compat** — Shipwright re-derives `RIGGING.md` to the current shape and drops superseded slots. Run `/shipwright` refit next harbour.
- **README live-fire removed** — enforcement claims are now verified DOWNSTREAM on real coding agents, and Estelle is named as the example. This makes Estelle's live-fire-pilot charter explicit upstream; the Phase 3 methodology-check pilot is where that evidence is produced.

Version bumped `0.8.6 -> 0.9.0` (hooks + `shipshape.md` changed). Not yet pushed.

## Parked

The pre-reorientation live-crew stack (`/embark` alongside crew loop, heartbeat, narration, report-back) sits on `main` under the reorientation commits. Its custody guts are wrong and get replaced; its product surface (personas, `/embark`, `/clear`, per-seat models, fitting-out) is the Phase 3 salvage.
