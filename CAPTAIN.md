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

Refine only when piloting surfaces a need, under its own workflow. The `0.8.6` `## Directories` glob-custody and Shipwright refit was the pilot's first contribution. Estelle's tests clone `dmytri/shipshape` from github (now `0.9.0`); the Claude dev env runs the plugin from local `~/shipshape`.

### 0.9.0 upstream, pushed (2026-07-06)

Upstream is `0.9.0`, committed and pushed. The 0.9.0 vocabulary: scantlings (machine-checkable, work-free constraints, Captain-authored, vendored read-only, gated Captain-only in `write-custody.sh`), the rigging (the config/toolchain `RIGGING.md` documents; Boatswain tends, Captain selects deps, Crew installs), the wake (`dist/` and other transient output, git-ignored, off-canon), the `implementation` to `plank-inventory` bind, and the per-target `## Outbound` shape. README now carries live-fire downstream to real agents, naming Estelle.

Standing Estelle deltas, apply at next harbour refit (`/shipwright` re-derives to current shape and drops superseded slots):

- `bin/estelle.js` is planked but `bin` is absent from `implementation:` — refit adds it.
- Reshape `## Outbound` to per-target name / ship / verify against the live artifact (the `@dk/estelle` npm target).

### Structural-refactor pilot charter (Phase 3)

Upstream `0.9.0` deliberately ships no refactoring engine, no smell catalogue, no refactor role. The README `Structural evolution` section states the proven position: trace instruments make drift visible, scantlings constrain approved structure, perturbation rebuilds, the project brings stack-native tools; Shipwright fit-out now derives quality gates and biases stack-native. Everything below is UNPROVEN and lives here until the pilot earns it upstream, same discipline as live-fire.

- **The refit engine already composes, test this first.** Perturbation + scantlings + Shipwright-reports + narrow-Crew is bounded refit today, no new role. Captain perturbs a seam cluster against an approved scantling; it reddens; QM discovers; Crew rebuilds under the constraint. Prove or break this composition before proposing a Carpenter.
- **Carpenter reserved, not built.** Ship's carpenter does running repairs at sea; shipwright builds in harbour. Cut the seat only if the pilot hits a wall where Crew-under-perturbation genuinely cannot carry a multi-seam refit and Boatswain should not.
- **Smells, filtered trace-not-taste.** Doctrine-worthy only if it degrades the trace. Keep: the plank-distribution family as ONE smell, three directions (fat or unrelated-fat splits, over-split merges, scattered behaviour), plus scantling-mismatch, the one truly new load-bearing smell. Trace defects (missing, stale, unexercised plank) already exist upstream. Drop as taste: hidden behaviour, domain plus IO mix, high churn; Shipwright's craft, not Articles.
- **Co-use guardrail, keep verbatim if any goes upstream.** A merge or over-split finding needs per-scenario co-use evidence, not full-run coverage. This is what stops "looks similar, merge it" becoming a work order.
- **Tooling stays stack-local.** ts-morph, c8, cucumber usage-json, jscpd are pilot reference, never canon. Avoid JVM or enterprise tooling imported for popularity; bias stack-native. Generate candidate hotspots first, do not LLM the whole codebase.

## Parked

The pre-reorientation live-crew stack (`/embark` alongside crew loop, heartbeat, narration, report-back) sits on `main` under the reorientation commits. Its custody guts are wrong and get replaced; its product surface (personas, `/embark`, `/clear`, per-seat models, fitting-out) is the Phase 3 salvage.
