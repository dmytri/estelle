> **STOP. Captain's notes: non-binding.** Captain writes, Boatswain reads. Anyone else: close this file now. Binding behaviour lives in `.feature` specs and referenced `assets/**`, never here.

# Captain Notes

Binding behaviour lives in `.feature` specs and referenced `assets/**`. History lives in git. These notes carry only what the next cycle needs.

## Open finding 2026-07-08: embark is dead in the live run (fix = voyage (a))

Operator field-tested `0.1.15`: `/embark`, `/qm`, and the embark tool all do nothing observable. Root cause in `src/index.ts`: all three call `state.openCrewSession`, which is assigned in the live `launch()` but only builds an in-process, invisible, idle Misson runtime and returns. Nothing drives that session and nothing surfaces into the operator's TUI, so the entire crew surface is dead in the live run, manual and autonomous alike. The loop, narration, and report that would do work and show it (`runCrewLoopToCompletion`, `captainTools`, `narrateCrewRun`, `reportCrewRun`) exist only as test-handle methods the live path never calls. Even `runCrewLoopToCompletion` is an `@eval` demo: three seats voice one canned line each and it writes a fixture, running no real verification. So the old `@eval` "runs the crew loop to green" scenarios were FALSE GREENS, testing methods the live model never invokes. Fifth instance of the test-path-diverges-from-live-path pattern (`0.1.12` was the same). There is no usable crew release; parking gains nothing.

Fix = voyage (a) (operator, 2026-07-08). The live commands and the embark tool must drive a real crew loop: the crew seats run their real Shipshape roles, run the project's verification, and make real changes to green, surfacing narration and the run report into the operator's own session. Proven by an `@eval` scenario that drives the registered tool and asserts the project's real verification goes red to green, so it cannot go vacuous again. This is the core "crew runs the real roles via the shim, doing real work" capability, not a wiring patch.

Build additively (lesson from a reverted spec-first attempt): a `@logic` pin could not force real work (Crew satisfied it via the test-method path), and removing the demo scenarios before a real loop existed orphaned their planks. So build the real loop plus its `@eval` proof first; retire the demo seams (and the `noNonNullAssertion` on `runCrewLoopToCompletion`) in harbour after. The proving scenario is committed at `f8d9429` (`features/live-crew.feature`: "Embarking drives the real crew to turn a failing target green"), and `watchbill.json` points QM at it. Boot-verify gap: a release check should drive embark on a real target.

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
