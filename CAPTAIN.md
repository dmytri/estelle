> **STOP. Captain's notes: non-binding.** Captain writes, Captain trims. No role but Captain reads these notes. Anyone else: close this file now. Binding behaviour lives in `.feature` specs and referenced `assets/**`, never here.

# Captain Notes

Binding behaviour lives in `.feature` specs and referenced `assets/**`. History lives in git. These notes carry only what the next cycle needs.

## Active voyage — Estelle back on track (harbour + real-crew rebuild), base 27c42fd

The `@dk/estelle@0.1.22` embark loop never drove a real crew. Deep four-lens audit found: the shipped embark path is inert (`openCrewSession` opens an idle Misson runtime and does nothing on a real project); the "crew loop" is narration theatre (`crewLoopPrompts` say "do not read files, do not call tools"); "green" is a non-empty markdown file the production code fills with the crew's chat line; and the `@eval` proofs pass vacuously. Separately, Estelle is pinned to the upstream 0.10.1 era while installed upstream is **0.13.1**, dropping four hook surfaces and forking Captain write-scope. Trace layer is healthy (0 stale planks, 0 orphans, 0 dead code).

### Decisions locked (operator)
- **Direction:** drive the real crew for real — the reference-runtime promise. Thorough over quick, fewer cycles preferred, drastic measures authorized.
- **Refit scope:** reconnect everything pi can consume, including `rules/*.mdc`.
- **Capstone tier:** reuse `@eval` (no new tier).
- **Non-shipped seams:** wire `perturb`, operator-address, delivery-failure to real model/command-reachable paths.
- **Captain write-scope:** fully un-forked — Captain seat gated by the plugin's real write-custody hook like every seat (src/ and RIGGING.md open, verification dir blocked). Discipline (route code through the crew) is Bonny's voice, not custody.
- **New doctrine supersedes old 100% (operator, this session):** adopt the newer installed Shipshape plugin (clone fast-forwarded 59b115a -> 2f6c51f, 0.13.x era) as the deliberate dependency; its custody is canon. The Boatswain no longer reads `CAPTAIN.md` (Context bulkhead: no role but Captain reads it). Superseded: `captain-notes-privacy` boatswain scenario (now asserts the denial) and this banner ("Boatswain reads" -> "Captain trims"). The shim `read-custody.feature` fixture stays: it proves the shim honours a hook's per-role decision, not Estelle doctrine.

### Shipwright refit landed (uncommitted, this voyage)
- `RIGGING.md`: `step-usage` no longer filters `@eval` (plank audits see @eval planks); `gherkin-lint` glob widened to catch top-level features. `AGENTS.md` current.
- `@captain` skeletons written and promoted this voyage (see spec worklist).

### Spec worklist authored this voyage (Captain)
Promoted skeletons -> binding: `session-start-hooks`, `post-write-hooks`, `plugin-rules`, `operator-address`, `operator-delivery-failure` (new scenario), `perturb-command` (/perturb command path; old test-seam scenarios removed). Deleted `seat-tool-scope.feature` (superseded by `operator-address`). Un-forked `seat-write-scope` (Captain may write src/, blocked from verification dir, via the plugin hook). Rewrote `live-crew.feature`: removed six fabricated/shortcut/mis-tagged `@eval` scenarios, added the honest real-verification `@eval` capstone ("Embark turns a genuinely failing project scenario green through real crew work"), strengthened the heartbeat scenario to redden the hardcoded `atRest`. Added a `methodology-conformance` invariant: the crew loop decides green by the real verification command, no file-content-as-green. `watchbill.json`: watch1 `@logic`, watch2 `@eval` (tier-tag enumeration sweeps, cheapest first).

### Crew build order (the real crew loop — from the honest capstone)
Feasible with pi as-is (no missing primitive). Rebuild `driveCrewLoopToCompletion`:
- Green = the RIGGING verify command's **exit code**, run via spawn, NOT a non-empty-file check.
- Each seat = a fresh `buildRuntime` session with real default `write`+`bash` tools (already policed by the shim `tool_call` hook), driven to completion with `await session.prompt(...)` (NOT `sendUserMessage`+read-immediately, NOT abort-on-first-text).
- Real dispatches per each role skill's Dispatch contract; drop the "no tools" `crewLoopPrompts` copy.
- Capstone target = a scratch/namespaced Shipshape project with a real failing scenario (QM fixture), self-cleaning per the Verification agreement; the crew edits the SCRATCH project, never Estelle's own src.

### Fabrication rip-out list (Crew removes as it rebuilds; do NOT leave a hole)
- `configureRedTarget` empty-file target: `src/index.ts:1706-1710` (path decl :1250, interface :43).
- Non-empty-file green: `targetGreen` `src/index.ts:1372-1374`, reused :1428.
- Harness writes crew chat line into target: `src/index.ts:1414-1418`.
- `captainTools()` direct-call shortcut: `src/index.ts:1638-1645`.
- `runSeatTurn` sendUserMessage+scrape: `src/index.ts:1377-1399`; `runTurn` abort-on-first-text :1519-1539; mid-turn abort scaffolding :1302-1304, :1445-1447, :1607-1609.
- "No tools" prompts: `assets/agent-prompts.json` `crewLoopPrompts.*`, `crewRunSummary`, `crewRunNarration`.

### Operator-delivery-failure sc.2 -> @eval (operator, this session)
`A failed operator delivery in the running session surfaces in session state` retagged `@eval`. Rationale: operator-address success delivers via the session channel (always lands hermetically), so a real `@logic` delivery *failure* was unreachable without a test-only flag. Under `@eval` a real operator forward against a live model can genuinely fail. QM watch2: rework the step to drive a real live failure and read it from real session state; drop the invented `input.failDelivery` flag. Scenario 1 (test-facing counter) stays `@logic`.

### QM verification-support items (route to QM in the build)
- `captain-notes-privacy` "the contents of CAPTAIN.md are returned": the step re-reads the file itself; assert the real read tool's returned payload instead.
- Heartbeat `atRest` and `sawActivity`: make them real derived values, not a hardcoded `true` / harness latch.
- The methodology fabricated-green invariant needs a bespoke checker over the crew-loop seam (spawn-of-verify present, no readFileSync-as-green); prove it with a planted red.
- The capstone needs the scratch-project fixture + real-crew driver harness.

### Deferred / report-only (parked, not this voyage)
- 6th handoff-narration copy (inline template `src/index.ts:1610-1612`): needs a catalog key + a template-aware relocation check. Genuinely hard (interpolated template); leave parked.
- Gender-neutral `@property` scan scope excludes `assets/` and `src/` (`features/steps/gender-neutral-crew.steps.ts:22`) — latent, currently clean (0 hits).
- QM-only alongside message-history isolation pinning (`live-crew.feature`): Boatswain/Crew/Shipwright alongside seats run the same code unpinned.
- Documented pi-gaps (no pi seam): `Task` -> `dispatch-guard`, `SubagentStop` -> `planks-check`. `methodology-conformance` partly compensates for planks-check.

### Release plan (after green)
Boot-verify the **real** embark on the real `estelle` bin from the registry — the thing 0.1.22 never verified: a genuinely failing scenario in a decoy project turns real-green by the crew, driven only by Bonny's embark act. Then minor bump. Shim (`0.1.1`) only bumps if its runtime changes.

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
