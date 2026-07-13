> **STOP. Captain's notes: non-binding.** Captain writes, Captain trims. No role but Captain reads these notes. Anyone else: close this file now. Binding behaviour lives in `.feature` specs and referenced `assets/**`, never here.

# Captain Notes

Binding behaviour lives in `.feature` specs and referenced `assets/**`. History lives in git. These notes carry only what the next cycle needs.

## Voyage complete — real-crew rebuild + harbour + non-blocking embark, base 27c42fd

Embark now drives a REAL crew: `driveCrewLoopToCompletion` spawns the project's own `cucumber-js` and greens on its exit code (no file-content-as-green, no proxy). Proven by the `@eval` capstone (`live-crew.feature:235`): a genuinely failing scratch Shipshape scenario turns green through live crew work, driven only by Bonny's own embark turn. The `@dk/estelle@0.1.22` vacuous-green sin is fixed.

### Landed this session (local commits on main)
- `00167e6` Harbour custody: condemned the proxy-loop fabrication the real path superseded (`configureRedTarget` / `runCrewLoopToCompletion` / `crewLoopSeatsRanLive` / `crewLoopTargetsAllGreen` seams + `redTargetPath` machinery + 16 dead step defs), re-synced 24 stale `@planks`, aligned the `internal-api-shape` scantling. Greened the methodology plank-trace invariant (`@logic`).
- Non-blocking embark (Boatswain custody this session): `embark` opens the crew session then holds the crew loop as a background run instead of awaiting it inside Bonny's turn, so the conversation stays live while the crew runs (Rule 164/183). `targetGreen` is async (`spawn`). Capstone awaits `awaitCrewRun`; the `After` hook `cancelCrewRun` stands down any live run. New falsifiable pin `live-crew.feature:198` "the crew runs on while Bonny's turn stays live". Fixed the `:198` 600s timeout (old synchronous embark blocked Bonny's turn on the whole build).

### Verified
`@logic` 153/153. `@eval`: `:198` fixed (1m16s), capstone green, all live-crew `@eval` green. Watchbill (`watch1 @logic`, `watch2 @eval`) spent and struck.

### 0.2.2 — embark drives the crew in a REAL session (the operator's actual bug)
Reported by the operator: embark returned "Crew embarked... working alongside" but the crew did nothing (deck unchanged, no build process). Two bugs, only one had been found:
1. **Mechanism (FIXED, proven):** embark gated `liveModelConfigured` on `state.seatModels` (explicit per-seat models), which is empty in a normal session that uses the agent's *default* model. So embark took the "just open the session" branch and never drove the loop. Fix: `liveCrewModel()` resolves `seatModels ?? piDefaultModel(agentDir)` and confirms availability via `modelRegistry`, the same resolution every real turn uses. The capstone now runs through the default-model path ("the live eval model is fitted as the session default", empty seats) — passed 14/14, planted-red proven (old seatModels-only gate reddens it). Also: background-run errors now surface into the operator's session instead of a silent `catch {}`; an unfitted session says so; per-seat narration streams as the crew works.
   - **Why weeks of green missed it:** the capstone hand-configured per-seat `estelle.json` seats — the one path a real session never takes. The green was real but under conditions that don't exist in reality.
2. **Decision (steering TODO, model-dependent):** Bonny reliably embarks on explicit "embark the crew on X" (capstone green) but NOT reliably on loose "build it and ship it" — `:198` reproducibly reddens because the live model instructs a role command instead of calling embark, despite steering that forbids it. Mechanism, not blocked; steering to harden. Operator chose to ship the mechanism fix and defer steering.

### Open follow-ups (not blocking)
- **Bonny embark-decision steering (`:198`):** harden `assets/agent-prompts.json` embark guidelines so "build/ship/proceed" maps hard to calling embark; `:198` is a single-shot live-model decision, so consider best-of-N / demoting it off the hard gate.
- **Harness flake:** `captain-reset-nudge.feature:24` intermittently fails under the loaded full `@eval` run (live-model decision / "Agent is already processing" settle race); passes in isolation. Candidate for `## Known false-failure modes`.
- **Asset tidy:** `crewLoopPrompts.crew` in `assets/agent-prompts.json` is now unused (the proxy crew dispatch is gone); `quartermaster` / `boatswain` / `crewReady` still used.
- **Parked (pre-existing):** 6th handoff-narration inline template; gender-neutral scan scope excludes `assets/`+`src/`; message-history isolation pinning (alongside seats); documented pi-gaps (`Task` -> dispatch-guard, `SubagentStop` -> planks-check).

### Released — @dk/estelle 0.2.1 (shim 0.1.2)
Shipped and registry-boot-verified: a fresh `npm install @dk/estelle@latest` bin launches pi with the Estelle extension as Captain Bonny, greeting rendered, no crash.

Boot-verify caught a real pre-existing bug: `0.2.0` (and `0.1.22`) crashed at boot on the Shipshape SessionStart hook `session-orient.sh` (a new quoted-`${PLUGIN_ROOT}` plugin hook). Root cause: **published `pi-open-plugin-shim@0.1.1` never unquoted in `runSessionStart`** — the source fix landed in `0d3fb67` but the shim was never republished, and no scenario exercised a *quoted* SessionStart command. Fix: quoted the `sessionstart-stack` fixture command (pins it, planted-red proven), republished shim `0.1.2` (unquote reaches the registry), bumped `@dk/estelle 0.2.1` (resolves shim `0.1.2`). The "shim bumps only if runtime changed" assumption was wrong — its runtime had changed since `0.1.1` and it was overdue for republish.

### Release follow-ups
- **Deprecate the boot-broken versions:** `npm deprecate @dk/estelle@0.2.0` (and `@0.1.22`) pointing at `0.2.1` — both crash at boot against the current plugin.
- **Push pending:** local `main` is ahead of `origin/main`; push not yet done.

## What Estelle is

Estelle rests on faithfully consuming the real upstream Shipshape plugin, never a fork:
1. **Reference runtime** for Shipshape (skills + open-plugin) on pi.
2. **Live-fire pilot** producing the maintainer's evidence: what enforces on pi, what fumbles, every false red and vacuous green.
3. **A coding agent** in its own right: Bonny and the crew personas, `/embark`, `/clear`, alongside-crew UX, per-seat models, fitting-out.

## Monorepo

`@dk/estelle` (scoped flagship) at root; unscoped extension packages under `packages/`, consumed via `workspace:*`. One root Shipshape harness covers `packages/*`. `packages/pi-open-plugin-shim` is pi's open-plugin engine; pi is not hook-native, so the shim executes the neutral `.plugin/` hooks on pi events. pi is session-isolated, not subagent-isolated — a pilot finding.

## Standing rules

- **Pre-1.0: no backward compatibility, no compat cruft.** Current design only. Old forms are Shipwright's to refit, never a parser's to tolerate.
- A change to a SHARED plugin hook affects EVERY vendor. Regression-test the current form; add no legacy fallbacks.
- Extension packages unscoped (`pi-open-plugin-shim`); flagship scoped (`@dk/estelle`).
- Roles run as the plugin's real `shipshape:*` subagents. Thin dispatches only: role, base commit, optional watchbill/scope. The 0.13.1 `dispatch-guard` enforces the thin-dispatch cap (a prose-heavy dispatch is rejected).
- No Claude-specific config in the repo. `.claude/` stays gitignored.
- **Boot-verify must exercise the actual behaviour a fix claims to fix**, on the real `estelle` bin, in a directory with its own unrelated `assets/`, from the real registry. A commit on `main` is not evidence it shipped; check the registry version against `git log -- src/ bin/ assets/ package.json`. Argv-bearing invocations are pure passthrough (no Bonny, no seat prompt); the bare-launch TUI writes no session file until its first turn.
- An `@eval` that seeds intent with no basis in the workspace tests incoherence: seed a real project with a ready spec before driving embark.

## The crew, flagship personas

| Seat | Name | After |
|---|---|---|
| Captain | Bonny | Anne Bonny, jester mask and deadly serious, crush on Bellamy |
| Quartermaster | Misson | James Misson, true believer in the Articles |
| Crew | (roster) | Soviet space-dog survivors, names code-picked |
| Boatswain | Bellamy | "Black Sam" Bellamy, grumpy heart of gold |
| Shipwright | Johnson | Captain Charles Johnson, harbour only |

They/them, gender-neutral. Voice is honour-system; names are where code bites. Character cards in `assets/characters/`.

## Structural-refactor pilot charter (Phase 3, unproven, parked)

Upstream ships no refactoring engine. The refit engine already composes (perturbation + scantlings + Shipwright-reports + narrow-Crew is bounded refit today, no new role) — prove or break that composition before proposing a Carpenter. Smells filtered trace-not-taste (plank-distribution family as ONE smell, plus scantling-mismatch). Co-use guardrail: a merge/over-split finding needs per-scenario co-use evidence, not full-run coverage. Tooling stays stack-local (ts-morph, c8, cucumber usage-json, jscpd are pilot reference, never canon).
