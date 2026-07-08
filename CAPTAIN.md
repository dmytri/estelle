> **STOP. Captain's notes: non-binding.** Captain writes, Boatswain reads. Anyone else: close this file now. Binding behaviour lives in `.feature` specs and referenced `assets/**`, never here.

# Captain Notes

Binding behaviour lives in `.feature` specs and referenced `assets/**`. History lives in git. These notes carry only what the next cycle needs.

## Shipped 2026-07-08: Estelle never switches seats, `/captain` registered for real

Operator field report against `0.1.17`: `/bellamy` put them in direct conversation with Bellamy instead of dispatching alongside, and `/captain` started a generic upstream Shipshape captain instead of Bonny. Both confirmed real.

Root cause, same defect *class* as the embark bug, a migration only partially applied. `SEAT_COMMANDS` (`src/index.ts`) registered `/bonny`, `/misson`, `/crew`, `/bellamy`, `/johnson` through one loop whose handler switched the operator's own seat and opened a fresh session as that seat, the pre-Slice-9 design. Only `/qm` had been separately re-registered for the alongside model; `/misson`, `/bellamy`, `/crew`, `/johnson` never were. `/captain` was never registered as a pi command at all, only its seat alias existed, so it fell through to the generic upstream skill. A genuine spec conflict was also found and confirmed as the reason the code never got flagged: `features/interactive-launch.feature` carried a still-live, correctly-passing scenario explicitly requiring the old switch behaviour for `/misson`, directly contradicting the Slice 9 alongside scenarios, which only ever covered `/qm`. A further vacuous-test-path instance, the sixth this project's history has hit, was found in the same investigation: `seat-composition.feature`'s scenario proving `/captain` worked was bound to a test-only `runCommand()` shortcut that flips state directly and never touches pi's real command registry, so it passed regardless of whether `/captain` was ever really registered.

Operator confirmed direction: Estelle should never switch seats. Fixed via the bulkhead-respecting spec-first path: retired the stale switch-behaviour scenario, rewrote the vacuous `/captain` scenario onto the real dispatch path (matching the interactive-launch step vocabulary already proven real), and broadened the `/qm`-only alongside coverage into a `Scenario Outline` covering `/qm`, `/bellamy`, `/johnson`, `/crew`. QM discovered the 5 newly undefined/failing scenarios fresh, with no root-cause narrative from Captain, and dispatched Crew, which registered `/captain` properly and parameterized `state.openCrewSession(seat)` so all four internal-role commands now open an alongside session instead of reseating the operator. Commit `6c98bb9`. A harbour pass then found and fixed two stale `@planks(...)` comments the migration left behind (commit `49e11b9`); full `@logic` tier is 127/127 green.

Not yet released to npm; `0.1.18` still pending as of this note. Same lesson as `0.1.16`: a fix on `main` is not a fix a user has until it is published and boot-verified against the actual behaviour it claims to fix.

Also surfaced, unresolved: the same harbour pass's `@eval` run hit 3 new failures unrelated to this fix (`captain-reset-nudge.feature` reset-nudge assertion, an embark-narration scenario timeout, and a sandbox-clone `spawn ENOENT`/pack-corruption pair that looks environmental). Not yet triaged as flake vs defect.

## Shipped 2026-07-08: @dk/estelle 0.1.17, embark actually reaches the real crew loop

`0.1.16`'s boot-verify only checked the no-model steer path; it never actually exercised embark, so it shipped a still-broken product. Operator field-tested `0.1.16` and reported it directly: Bonny claimed the crew ran but offered no proof, `/embark` and `/qm` appeared to do nothing.

Root cause: two independent "embark" implementations that never converged. `pi.registerTool("embark", ...)` in `createEstelleExtension` (`src/index.ts`), the tool a live Bonny actually calls, only opened an idle crew session (`state.openCrewSession`) and unconditionally returned a canned success string. The real loop-driving logic (`driveCrewLoopToCompletion`, narration, report-back) lived only behind a separate `captainTools()` accessor, exposed for verification and never reachable from pi's real tool-call dispatch. Every `@eval` scenario, including the one commit `01bbc48` cited as proof the vacuous-embark defect was closed, called `captainTools()` directly, bypassing the real seam entirely. Confirmed independently twice: once by Captain reading the code directly, once by a Captain-scoped Shipwright harbour scan (its own "verification seam violation" policy category, which its unscoped harbour pass had missed).

Fixed via a bulkhead-respecting path, not a narrated dispatch: Captain perturbed the vacuous seam (the one write-scope exception Captain has); QM discovered the perturbation reddened only a methodology check, not any product scenario, confirming the seam was unexercised; Shipwright (Captain-scoped) wrote a bare `@captain` scenario pinning the missing requirement in domain terms; Captain promoted it after stripping a diagnostic comment the operator caught as a contamination risk (see the standing lesson below); QM discovered it fresh and dispatched Crew with zero narrative. Crew's fix: `state.embark` is now the single shared implementation behind both the real registered tool and the test accessor, plus a genuine bug the unification exposed, three `sendUserMessage` call sites needed an `isStreaming` guard since embark can now run from inside Bonny's own already-streaming turn. Verified by a real isolated live-model rerun, 12/12 steps green. Boatswain also caught the new scenario missing the `@eval` tag its sibling carries and a they/them regression in the scenario text before commit.

Released `0.1.17` (`9a1f5e4`), boot-verified with the actual fix confirmed present in the published `dist/index.js` (grepped for `state.embark` and `isStreaming`, both present, matching source), plus the same no-model steer smoke test as `0.1.16`. A full live-interactive boot-verify of embark against the packaged tarball was not attempted, `--print` mode bypasses Estelle's own extension setup entirely and isn't representative; the behavioral proof is the `@eval` rerun against the exact same source that built `dist/`, not a second live drive of the package artifact.

**Standing lesson: boot-verify must exercise the actual behaviour a fix claims to fix, not just "does it boot."** `0.1.16`'s boot-verify checked the no-model steer state, which was already correct, and missed the one thing that was broken. Future outbound boot-verifies for a behavioural fix should drive the specific fixed behaviour where practical, not just confirm the package installs and starts.

## Shipped 2026-07-08: @dk/estelle 0.1.16, embark-drives-real-crew reaches users

Caught a real gap: the embark-drives-real-crew fix (`f8d9429`, `ad3638e`, `01bbc48`) landed on `main` in a prior session but sat unpublished under a `package.json` still reading `0.1.15`. `@dk/estelle@0.1.15` on the npm registry never contained it; anyone on `latest` still had the vacuous embark. Bumped to `0.1.16` (commit `ba5f3b6`), `pnpm build`, `pnpm publish --access public`. Shim unchanged since its own `0.1.1`, no shim republish needed. Boot-verified per the `## Outbound` policy: real `npm install @dk/estelle@latest` in a disposable directory carrying its own unrelated `assets/notes.txt`, real `estelle` bin (not `launch()` alone), isolated `HOME`. Result: `estelle-greeting` extension loaded, Bonny seated, bundled assets correctly used over the unrelated local `assets/` folder, no crash, no paid model call (no credentials in the isolated `HOME`, correctly showed the "not yet fitted out" no-model state). `0.1.16` now actually carries the embark fix plus this session's `c8` coverage rig and the `@eval` timeout-budget fix, none of which are user-visible but ship cleanly alongside it.

Lesson for future releases: a commit landing on `main` is not evidence it shipped. Check the published registry version against `git log -- src/ bin/ assets/ package.json` before declaring a fix delivered, not just against `origin/main`.

## Shipped 2026-07-08: @eval session-persistence race, root cause and fix

Closes a thread this file had deferred three times ("`@eval` flakiness... do NOT enshrine as a known false-failure", "Shipwright flagged the `@eval` tier as environmentally flaky", "parked with a bounded trigger"). The trigger fired again during a harbour pass (different scenarios each time: `:164`, then `:39`/`:70`), which read at first like a session-path concurrency race across alongside internal-role sessions.

Real root cause, found by reading the actual step definitions rather than theorizing further: `features/steps/live-crew.steps.ts:305`, `When("the crew session runs a turn", ...)`, calls `crew.runTurn()`, a genuine live OpenRouter round trip, with no explicit Cucumber timeout, defaulting to the 5000ms global default. Every sibling live-turn step in the same file already carries an explicit `{ timeout: 120000 }` or `{ timeout: 600000 }`, one of them with a comment naming this exact class of bug. This one step was the sole gap. On timeout, Cucumber's `After` hook (`features/support/world.ts`) fires `rmSync` on the scenario's `agentDir` while the still-in-flight `runTurn()` promise later tries to persist its session, producing the `ENOENT` symptom. Different scenarios failed across runs because different scenarios happened to hit this one unguarded step depending on real API latency variance that run; not concurrency, not session-path collision, sequential execution throughout (no `--parallel` configured anywhere in this project).

Fixed as a durable, bulkhead-respecting spec rather than a Captain-narrated dispatch: added `Scenario: Every live crew-session step carries a live-step timeout budget` to `features/methodology-conformance.feature` (`@logic @property`, same family as the shipped forbidden-doubles/stale-plank checks), with no rationale attached, just the falsifiable contract. QM, working from a clean dispatch with zero narrative from Captain, wrote the step definitions itself, and the check reddened on exactly the real violation on first run against the live tree, confirming it as a genuine defect rather than a hypothesis. QM fixed the gap directly (verification support is QM's own write scope) with `{ timeout: 120000 }` matching the file's existing convention, reverified focused-red-then-green, broad `@logic` 125/125, and a live `@eval` rerun of the specific affected scenario, which completed in ~11s, real evidence the new budget is headroom for tail latency, not padding over a hang. Commits `d3be75b` (spec), `bfc8297` (QM fix + Boatswain custody), both pushed.

Also confirmed while investigating: this project runs no tier in parallel and keeps no weather record (wall-clock time, pass/fail, pressure signals) in the wake. Upstream's own carry-forward notes already named Estelle as the natural weather-record pilot. Parked, not started: piloting a minimal `@eval` weather log would let a future timeout-budget decision rest on p95 observed latency instead of precedent-matching a sibling step's number.

## Shipped 2026-07-08: voyage (a), embark drives the real crew

Operator field-tested `0.1.15` and found `/embark`, `/qm`, and the embark tool did nothing observable: all three called `state.openCrewSession`, which only built an in-process, invisible, idle Misson runtime. `runCrewLoopToCompletion` was an `@eval` demo, canned lines and a fixture, no real verification: the old "runs the crew loop to green" scenarios were false greens. Fifth instance of the test-path-diverges-from-live-path pattern.

Fixed and verified. Crew rewired embark's `run()` to call the hoisted `driveCrewLoopToCompletion` in scope, with the returned handle exposing `runCrewLoopToCompletion` as the same function, closing the vacuous-embark defect. Proven live: `features/live-crew.feature` "Embarking drives the real crew to turn a failing target green" (pinned at `f8d9429`) passes 1/1, 11/11 steps against a fresh Boatswain recheck; broad `@logic` 124/124 scenarios, 982/982 steps; `tsc` clean; gplint clean; no stale planks; no live perturbation. `watchbill.json` held the one watch, verified green, struck per policy (`01bbc48`).

Deferred, still open: retire the `@eval` demo seams and the `noNonNullAssertion` on `runCrewLoopToCompletion` in harbour. Boot-verify gap: a release check should drive embark on a real target, not just `launch()`.

## Shipped 2026-07-08: methodology-check pilot + perturb + fitting-out (0.1.15)

Harbour `8253ebd`, voyage `d8920cd`, steer refinement `3680388`; released `@dk/estelle 0.1.15` (shim unchanged at 0.1.1), registry boot-verified. Full `@logic` 124/124, all five methodology checks negative-test proven. Boot-verify (isolated pi HOME, `npm install @dk/estelle@latest` in a dir with its own unrelated `assets/`): shim dep resolved to `0.1.1` not `workspace:*`, the `estelle-greeting` extension loaded, Bonny seated, bundled `assets/steer.md` rendered (the local `assets/` correctly ignored), no crash, no paid model call.

- **Methodology-conformance pilot** (Phase 3 charter): five `@logic @property` checks, modelled on the shipped gender-neutral check, each proven by plant->red->remove->green: forbidden-doubles, stale-plank join (real Gherkin compile, outline-expanding), green-tree-carries-no-perturbation, watchbill shape, gplint feature-lint. This is the first executable enforcement of "passing verification is not proof."
- **perturb command**: flagship Captain-gate tool. Inserts only the RIGGING `fail-fast`, no step text or rationale; only the Captain seat perturbs. The seam reads the fail-fast from RIGGING, so no `PERTURBATION` literal sits in production and the no-live-perturbation check stays green by construction.
- **fitting-out**: distinct detection. No model rigged -> `assets/steer.md` (login/model); no `RIGGING.md` -> `assets/unfitted-steer.md` (fit out with Johnson). No-model takes priority since even fitting out needs a model. `/clear` and per-seat models were already shipped; my earlier notes were stale.

Lessons this voyage:
- **Tier-auth-probe was the charter candidate that broke** (operator's catch). Never check ahead: fitting-out assumes envs present, a real run's auth-failure raises a fitting blocker. A standing tier-auth check violates that and would bill paid `@eval` every run. Dropped; the "prove or break" pilot earned its name.
- **gplint** adopted as a dev dependency (`RIGGING.md`), with a verified `gherkin-lint` command (needs feature-file globs, not a bare invocation).
- **`@eval` flakiness** (5000ms live-model timeout; jsonl `ENOENT` races under parallel clones): do NOT enshrine as a known false-failure. Engineer it out (readiness gate, per-worker pi session-path isolation). Defer any entry until we are sure we cannot resolve it.

Deferred to a future harbour: 5 pre-existing Scenario-Outline stale planks (annotation-convention drift, confirmed not deleted steps); 4 `noNonNullAssertion` biome warnings (`src/index.ts`, biome exit 0; the 4th from `riggingFailFast`).

Open follow-ups the pilot surfaced: the gender-neutral `@property` check scans `features/` and step defs only, not `assets/`; a gendered pronoun for a they/them seat in an asset slips it (caught by eye this voyage). Extending the scan to `assets/**` is a candidate, with care for legitimate non-crew copy. Also open (upstream shipshape 0.9.3): whether Estelle's shim should consume the new `rules/` component like native npx plugins, to pilot persistent-rules adherence on pi; Estelle hard-enforces at its own layer, so rules are behaviourally redundant for it but worth hosting to evaluate.

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
2. **Flagship on the real foundation, write+read done.** Estelle enforces the plugin's real **write + read** custody via the shim (`checkWriteSync`/`checkReadSync`); message custody (only Captain addresses the operator) and the Captain write path (`evaluateWrite`) stay flagship. Flagship UX shipped: personas, `/embark`, `/clear` (`clear-session.feature`), per-seat models (`seat-model-selection`/`-defaults`/`-fallback`). `perturb` and fitting-out are specced this voyage (see Current voyage), awaiting QM. `perturb` is flagship-first, upstream later; the additive `captain` case pulls in perturbation-as-tool doctrine, a bigger commitment.
3. **Methodology-check pilot, not started, the note's charter.** `/shipwright` refit to derive executable checks (watchbill shape, perturbation liveness, stale-plank join, forbidden-doubles, feature lint, tier auth probe), negative-test each (plant, confirm red, remove), report evidence. Was gated on a quiescent deck; now unblocked.

**Harbour pass done** (commit `3342dc0`): re-based 5 stale `evaluateWrite`/`evaluateRead`/`selectSeat` `@planks` to live step text, removed the orphaned `packages/pi-shipshape` (line 22 already dropped it) plus its stale lockfile importer. The 3 `noNonNullAssertion` biome warnings are still open, deferred.

**Runtime custody consolidation: done (commit `eb606e5`).** The running `pi.on("tool_call")` hook now gates write/read/bash through the plugin for internal seats and the flagship gate for the Captain, matching the method seams. Verification drives the real hook through `session.extensionRunner.emitToolCall` (`features/support/world.ts` `runningSessionToolCall`), so the three custody features falsify the gate on the seat's own tool call, not a test-facing method. The vacuous green and the `evaluateRead` read regression are both closed. Full `@logic` suite green, `tsc` clean, no perturbation in production.

**Harbour pass: complete (commits `0e3dab2`, `67fdbcb`, `531e46f`).** Outcome:
- `bin` declared as an implementation directory in `RIGGING.md`; `bin/estelle.js` is planked production.
- Stale `@planks` from the custody reword re-based to live step text across `src/index.ts` and the shim; stale-plank join now clean.
- **Dead custody methods retired.** `EstelleSession.read()` and `command()` were a zero-caller duplicate of the `tool_call` hook's custody, so they were condemned (`@shipwright`) and removed with their interface declarations; the tool-call hook is the single custody path. `write()` proved live through the `@eval` crew-session tier and stays. Suite green throughout.
- `RIGGING.md` verification commands (`discover`, `focused`, `broad`, `coverage`, `step-usage`, `eval`) now exclude `@shipwright` as the Articles require; the prior rigging omitted it and reddened once a `@shipwright` feature landed.

Deferred, for a future pass:
- Shipwright flagged the `@eval` tier as environmentally flaky (5000ms live-model step timeout; `ENOENT` races on pi temp session jsonl under parallel clones). Not yet in `## Known false-failure modes`. Document or stabilize.
- Methodology checks are largely unenforced (`Passing verification is not proof`): no executable conformance for watchbill-shape, perturbation-liveness, stale-plank join, forbidden-doubles, gherkin lint (`.gplintrc` present, no `gplint` command in `RIGGING.md`), or a tier-auth probe. New `@property` spec work, aligned with the Phase 3 pilot charter.
- Pre-existing: about 6 stale `@planks` on unrelated seams; 3 deferred `noNonNullAssertion` biome warnings (`src/index.ts` ~1158, 1185).

**npm release: shipped and boot-verified.** `@dk/estelle@0.1.9` is `latest`, installable, and boots pi as Captain Bonny with the `estelle` extension (verified by a clean-directory `npm install @dk/estelle@latest`). The first attempt, `0.1.8`, was uninstallable and is deprecated: the custody-through-shim work made the flagship depend on `pi-open-plugin-shim`, which had never been published and shipped only TS source. Fix: the shim now has a CommonJS build (`dist/index.cjs`, via `tsconfig.build.json`) and is published as `pi-open-plugin-shim@0.1.0`; the flagship stays CommonJS and requires the CJS shim, so node@20 needs no ESM migration. Both must publish via `pnpm publish` (rewrites `workspace:*`, applies the shim `publishConfig`). `RIGGING.md ## Outbound` now names both targets, the publish ordering, and the `pnpm`-not-`npm` requirement. The lesson: a `workspace:*` dependency is a hidden second distribution target; the registry boot-verify is what caught it.

**Crew experience wired into the real run, shipped `0.1.11` (shim `0.1.1`).** Operator report: seats did not know who they were, and Bonny never dispatched. Root causes and fixes, each proven live at `@eval`:
- Seat identity: a `/command` switch only flipped `state.activeSeat`; the seat prompt is composed at session creation (`before_agent_start`), and the TUI never recreated the session, so the model kept the launch seat. Fix: seat switch now `runtime.newSession()`s and composes the active seat via `appendSystemPrompt`. `@eval`: a switched seat's live model named itself "Bellamy". Every seat now also carries the crew roster.
- Dispatch: `/embark` only opened an idle crew session, there was no Captain-seat tool, and the default `InteractiveMode` never drove the loop. Fix: a registered Captain-seat `embark` tool Bonny calls from their own turn; embark drives `runCrewLoopToCompletion` and reports back. `@eval`: a live Bonny embark ran the crew loop to green.
- Reset-nudge: Estelle never wired PostToolUse delivery, so the plugin's `captain-reset-nudge` never reached Bonny. Fix: `pi.on("tool_result")` runs the shim's `runPostToolUse` (now routing project cwd so the nudge gate resolves) and injects the guidance. `@eval`: Bonny offers a fresh context when nudged.
This closes Phase 1 "agents to pi sessions RUNNING" and the Phase 3 live-crew product surface for the default run. Recurring lesson, fourth instance: the first seat-identity cycle passed vacuously by manually firing `emitBeforeAgentStart`; the real proof is the live `@eval` identity turn, not a prompt-composition assertion.

**Crew flow reworked to the alongside model (on `main`, not yet released).** Operator report against `0.1.12`: Bonny started with a check but did not narrate, told the operator to `/clear` + `/qm` instead of embarking, and a manual `/qm` then refused "context not clean". Root cause: the crew loop, narration, and report-back lived only in the test-supplied `interactive` callback; the default `InteractiveMode` never drove them, so the real run showed a bare TUI. Design (operator-clarified): the operator is always the Captain; every internal role runs only in an isolated session alongside, and Bonny narrates.
- Slice 8 (done, live `@eval`): the loop/narration/report-back moved into Estelle's core, triggered by embark, surfacing `crew-narration` and a `crew-run-report` as display messages into the operator's own `runtime.session`. Narration works on the real run.
- Slice 9 (done, live `@eval`): manual internal-role commands (`/qm`, `/bellamy`, etc.) now invoke that role in an isolated alongside session with clean context instead of switching the operator's seat; the alongside Quartermaster proceeds (no bulkhead refusal). `seat-composition.feature` reworked off the operator seat-switch, superseding the slice-5 switch behaviour. `/bonny`/`/captain` keep the operator seated.
- Slice A embark (done, live `@eval`, shipped `0.1.14`): Bonny embarking autonomously on confirmed intent first read as a `deepseek-v4-flash` limit, but the operator's skepticism found the real cause: the `@eval` seeded "make the greeting warmer" into an EMPTY workspace, so Bonny correctly surveyed, found nothing actionable, and returned to discovery instead of embarking on nonsense. Fix was verification, not model: seed a real Shipshape project with a ready spec BEFORE launch and a coherent "build it and ship it" confirmation; the small model then embarks. The card also countermands the upstream captain skill's "tell the operator to run /qm" handoff (the generic captain skill has zero embark knowledge; embark lives only in the flagship card). Lesson: an `@eval` that seeds intent with no basis in the workspace tests incoherence, not the behaviour.
- Shipped: crew-flow A+B+C in `0.1.14` (registry boot-verified). The captain skill and embark tool are both available in the `@eval`; the tool is in `captainTools`.
- Deferred hygiene: ~4 stale seat-switch `@planks` a Boatswain was mid-removing when a session-limit API error killed the cycle; pre-existing stale planks; two orphaned `seat-composition.steps.ts` step defs from the seat-switch removal. Not committed.

**Bonny opens by running their Captain opening, shipped `0.1.12`.** Operator report: Bonny loaded as themselves but did not run any startup, did not notice pending `@captain` scenarios, just asked what the operator wanted. Cause: a seated role is not an invoked one. The Captain opening instructions live in Bonny's prompt, but pi is reactive and startup only injected a canned greeting, never a turn, so the opening never ran (unlike a `/captain` invocation in other runtimes, where invoking the skill is the actuating turn). Fix (`openWithBonnyVoice`): when a model is available, startup fires a real triggered Captain opening turn ("Begin your Captain opening turn now"); with no model it falls back to the canned steer. `@eval` proof: Bonny's live opening turn read the workspace feature files and surfaced a seeded pending `@captain` scenario by name before inviting direction. The canned `assets/greeting.md` is now unreferenced; asset-custody disposition is open.

**They/them sweep (Articles), shipped `0.1.12`.** Operator flagged scenarios using gendered pronouns for the crew, who are they/them. Fixed across all feature files, step definitions (bindings, error strings, comments), and this note. Lesson: the first sweep missed two `@eval`-only step-def bindings because `@logic` discovery excludes `@eval`; an executable gender-neutral conformance check (scan `features/**` and `features/steps/**`, fail on any `\b(she|her|his|him|he)\b`) is recommended and unbuilt, so this cannot drift again.

**`0.1.9` npx crash, fixed in `0.1.10`.** An operator ran `npx @dk/estelle` in a project that had its own `assets/` folder (a website); Estelle crashed with `ENOENT` on `assets/greeting.md`. Cause: `assetsDir` used `cwd/assets` whenever that directory merely existed, hijacking an unrelated operator assets folder. Fix (`assetsDir`): use a workspace `assets/` only when it carries the `crew-roster.json` Estelle marker, else fall back to bundled `__dirname/../assets`. Covered by `features/runnable-package.feature` "uses its bundled assets when the operator directory has its own assets folder". The boot-verify miss: `0.1.9` was verified with `launch()` in a bare directory, never the real `estelle` bin in a directory that has its own `assets/`. `RIGGING.md ## Outbound` policy now requires the boot-verify to run the real bin in a directory with its own `assets/`. Recurring lesson, third instance: exercise the real entry and the real environment, not a controlled harness path.

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
