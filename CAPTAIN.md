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

### 0.2.4 — the crew does real work; /embark works; Bonny knows what the crew is doing
The operator ran it and the crew "spun from role to role with no outcomes", and Bonny could not say what the crew was doing. Four more defects, all now fixed and pinned:
1. **`targetGreen` hardcoded `pnpm exec cucumber-js`** -> a project verified by anything else never turned green, so the loop spun forever. Now reads the project's own verify command from ITS `RIGGING.md` (`broad`, else `focused`). `methodology-conformance` now FORBIDS a hardcoded runner in the crew-loop driver (planted-red proven).
2. **The Quartermaster and Boatswain prompts said "Do not read files. Do not call any tools."** -> they could only narrate; verification never ran and nothing was ever committed. All three seats now get real tool-enabled dispatches naming the project's actual verify command. The theater prompts are DELETED from `assets/agent-prompts.json`.
3. **`/embark` never drove the crew.** The embark TOOL called `state.embark` (drives the loop) but the `/embark` COMMAND called `openCrewSession` -> seated an idle Misson. The operator's own deterministic path WAS the original bug. Now `/embark` drives the real loop.
4. **Bonny had no idea what the crew was doing** and had to do `ps`/`git` forensics. New `crew_status` tool gives Bonny authoritative live state: active, WHICH SEAT is working now, round, the real verification output, each seat's report, why it stopped. Narration now carries real outcomes, not empty transition announcements.

**The non-gameable capstones** (this is the lesson): a NON-cucumber scratch project (`verify = node verify.js`) in a real git repo, asserting the project's own verification greens AND **the Boatswain makes a real git commit** — a seat forbidden from calling tools cannot commit. Two scenarios: driven by Bonny's turn, and driven by the operator's `/embark`. Neither can pass on a technicality.

**Why weeks of green missed all of this:** every fixture was built so the test would pass — per-seat models a real session never sets, a cucumber scratch project the hardcoded runner happened to match, a trivial fix the Crew seat alone could make (so the QM/Boatswain theater never mattered). Green was real and meaningless. The fix is to verify against a project shaped like the operator's, and to assert a durable outcome (a commit) that theater cannot fake.

### 0.2.5 — the crew does what the operator ASKED, even on a green project
Operator: "refit never happened tho I asked for it", "bonny just sat there waiting for nothing", "fire and forget". Their transcript showed the crew narrating `... is green. The crew's run is done.` having done nothing. Three defects:
1. **The crew never learned the operator's intent.** The embark tool took NO parameters (`properties: {}`); `state.embark: () => Promise<void>`. There was no channel at any layer. The crew could only chase the verification green, so it committed the wrong work and the refit was never assigned to anyone. `embark(batch)` now carries the operator's confirmed request and EVERY seat's dispatch names it. The tool description tells Bonny the crew cannot see the conversation, so the batch is the only intent they get.
2. **On an already-green project the loop ran ZERO rounds** (`while (!verification.green)`), so Misson/Crew/Bellamy were never seated — which is why the Boatswain never committed. This looked to the operator like "Boatswain custody won't commit"; in fact Bellamy was never seated. A named batch now drives the crew even when green, and the Quartermaster owns the worklist and declares `BATCH COMPLETE`.
3. **Bonny was fire-and-forget**: after embark the turn ended and the narration was display-only, so Bonny never read a report or spoke. Bonny now speaks each round off the crew's real reports; `crew_status` names the batch.

**Pin:** an ALREADY-GREEN project + batch "Add a LICENSE file" -> the crew creates LICENSE and **Bellamy commits it** (13/13 live). Under the old gate that scenario runs zero rounds and does nothing. This is the operator's exact case.

**Note:** there is deliberately NO Captain-side commit path. Only the Boatswain may commit; the custody hook is correct. The bug was that embark never reached Bellamy.

### 0.2.6 — Bonny can dispatch Bellamy and Johnson; custody actually completes
The operator was right twice; I was wrong twice.

1. **BULKHEAD VIOLATION, REVERTED.** 0.2.5 passed the operator's request into the crew dispatches as a prose `batch` parameter. That is discovery context crossing the **Captain-to-Quartermaster bulkhead**, and a conforming Quartermaster MUST refuse a dispatch beyond its contract. Removed from every layer: the embark tool, `state.embark`, the seat dispatches, `crew_status`, `captainTools`, the scantling, and the test written to justify it. The Quartermaster's dispatch now names **`watchbill.json` as its one work channel**: intent reaches the crew only through durable artifacts the Captain writes. **Never route intent through a dispatch parameter again.**
2. **THE REAL GAP: Bonny could only invoke Misson.** Estelle had exactly one crew tool (`embark` -> Quartermaster -> QM loop). `/bellamy` and `/johnson` merely called `openCrewSession`, which **seats a role and drives NOTHING** — a seated Boatswain never commits, a seated Shipwright never refits. So on a green deck with uncommitted work: no failing target -> the loop seats nobody -> and since **only the Boatswain may commit**, the work was **structurally uncommittable**. `dispatchRole` now seats a role AND drives it, thin by contract (role, base commit, job/scope). New Captain tools `dispatch_boatswain` and `dispatch_shipwright`; the alongside commands drive the role instead of seating it idle.
3. **CUSTODY NOW ACTUALLY COMPLETES.** Even properly dispatched, Bellamy committed only ~2 of 3 runs: the model **described** custody instead of doing it. The operator reported exactly this ("Boatswain custody is not completing the commit") and I waved it away. The model still judges (hygiene, green, the message); the **commit is now guaranteed by code** — if verification is green and the deck is dirty, Estelle completes custody under the Boatswain's own seat. A red verification still refuses the commit; there is still **no Captain-side commit path**, by design.

**Pinned on the operator's exact deck:** already-green project + a real uncommitted change -> Bonny dispatches Bellamy -> a commit lands and the tree is clean. **3/3 live** (a 2/3 pass is not a commit path).

**Standing rule learned the hard way:** *model judges, machine guarantees.* Every failure this session came from trusting a model — or a fixture built to pass — to produce an outcome that should have been enforced in code.

### Unreleased — Bonny resolves blockers instead of holding them (commits 90dd8c4, 1660174)
The operator's report: Bonny hit a refused `.feature` write, declared a "runtime custody blocker", and **sat** — reporting it back across two turns until scolded, then fixed it herself.

**Two defects, one upstream and one ours.**

1. **Upstream Shipshape (fixed, pushed, 0.13.15 `d31b22f`).** `hooks/scripts/write-custody.sh` decided Captain and Shipwright custody by *directory only*, while the QM and Crew branches already decided `.feature` by *artifact kind*. The operator's project carried `verification: features` (the Cucumber-conventional layout, step defs under `features/`), so the specs directory sat inside the verification directory and **the Captain was denied her own spec**. Fix: artifact kind outranks directory in both branches; Shipwright's derivation now forbids a `verification` value that is a parent of `specs`; hook tests gained the Cucumber layout and — never previously tested in 14 releases — that the Captain may write a spec at all. Planted-red proven.
2. **Estelle (this voyage).** Bonny's card had extensive embark steering and **nothing about blockers**. Now pinned by `features/captain-blocker-resolution.feature` (`@eval`, 2 scenarios, both green on a live crew): she repairs a rigging fault rather than ending the turn on it, and carries the confirmed intent into a durable spec in the same turn. Both assert a *file on disk*, so a narrated blocker report cannot pass. Four Crew dispatches to green: the fault reached Bonny but was held; the refit wrote the key with an empty value; the intent never reached a `.feature`; the first steer still left a discovery loop as a legal move. Steering alone was insufficient — `src/index.ts` changed too.

**THE FINDING OF THIS SESSION — roles end turns holding work in flight.** Three instances: Bonny held a blocker; Misson ended their turn "standing by" for a live run **twice**. Upstream doctrine already forbids this in plain words (0.13.14: "a role's turn ends only in its final report: never end a turn waiting"). **The words are not holding.** This is the standing rule again — *model judges, machine guarantees*. A turn ending with a live run or an unresolved blocker should be caught by the harness, not entrusted to model discipline. Estelle's crew loop already knows when a run is live. **This is the next voyage.**

### Open follow-ups (not blocking)
- **Plugin cache staleness:** the operator's running Estelle loads the **0.13.6** plugin cache. The 0.13.15 custody fix does not reach Bonny until that install updates. A commit on upstream `main` is not evidence the fix reaches the seat.
- **Upstream hook crash (environment):** after a run reports, node dies on unhandled `spawn .../hooks/scripts/captain-reset-nudge.sh ENOENT` from a *cloned* upstream Shipshape. Lands after the verdict, changed no result, but crashes any run whose agent dir clones a Shipshape lacking that script.
- **Orphaned step def (harbour):** `"a scratch project whose verification is already green, in a git repo"` at `features/steps/live-crew.steps.ts:1327`, zero `step-usage` matches, pre-existing.
- **Bonny embark-decision steering (`:198`) — MOSTLY BROKEN, not flaky.** Record across this session: 1 pass / 3 fails. Bonny's live model usually instructs a role command instead of calling embark from loose phrasing ("build it and ship it"), despite `assets/agent-prompts.json` embark guidelines forbidding exactly that. `/embark` is the reliable path and works. Fix: harden the embark steering so "build/ship/proceed" maps hard to calling the tool; consider best-of-N or demoting `:198` off the hard gate, since a single-shot live-model decision is probabilistic by nature.
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
