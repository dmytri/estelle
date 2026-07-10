> **STOP. Captain's notes: non-binding.** Captain writes, Boatswain reads. Anyone else: close this file now. Binding behaviour lives in `.feature` specs and referenced `assets/**`, never here.

# Captain Notes

Binding behaviour lives in `.feature` specs and referenced `assets/**`. History lives in git. These notes carry only what the next cycle needs.

## Refit to Shipshape 0.11.1 — resumed, harbour entered

Active voyage. The project was last fitted to Shipshape `0.10.1` doctrine (harbour commit `82e6b46`, `CAPTAIN.md`/`RIGGING.md`/`AGENTS.md`); the installed workflow is now `0.11.1`, confirmed from the plugin manifest this session. Estelle pilots Shipshape, so a workflow-version bump is doubly material: its custody assertions and hook consumption were last proven against `0.10.1` (see "Standing Estelle deltas" below).

State at resume: committed tree synced with `origin/main` at `82e6b46` (the pending harbour commit was pushed last session — `f4b56fb..82e6b46`, now `0/0`). The only working-tree change was this `CAPTAIN.md` note flush itself — work in flight ordering the refit voyage — handed to Boatswain to commit so the tree is clean for harbour entry. Zero `@captain`, zero `@shipwright`.

The earlier pause was because the session had loaded `0.11.0` skills, not `0.11.1`. That is resolved: both Captain and Shipwright now run on `0.11.1`, the doctrine we refit toward.

Harbour plan, in flight: Shipwright dispatched (isolated) for the full inventory and fitting-refresh against `0.11.1` — re-derive `RIGGING.md`/`AGENTS.md`, re-run plank inventory and the verification-economy audit, write `@captain` skeletons for any behaviour/policy drift, and run the full-tier boundary check. Then review each skeleton with the operator.

### Harbour discovery tooling — trial candidates, stack-local examples

Tooling stays stack-local, so these name two tool-classes to fit out this harbour (or stack-appropriate equivalents), never canon:

- **Unused / dead-code detection** (import-graph absence), e.g. Knip. Fills a gap plank-inventory and c8 both miss: a seam can be planked and covered yet export something nothing imports. Needs entry points declared or it false-positives here — `bin/estelle.js`, `features/steps` + `support`, the `.plugin/` hooks, workspace `exports`; the dynamic-`import()` attribution gap in `## Known false-failure modes` bites it too. A doctrine bump is when code serving old hook shapes goes dead, so this harbour is its moment. New dependency.
- **Structural code-pattern conformance** (AST match), e.g. GritQL — native to biome (`biome search` + `.grit` plugin rules), zero new dependency, rides the `biome check` gate already run. Retires two fragile hand-rolled parsers in verification support: the `FORBIDDEN_DOUBLE` line-regex scan and the ~150-line `stripComments`+`extractStepRegistrations` parser. Robustness, not speed. Confirm the installed biome version supports the plugin-rule form before the gate-folded path.

Boundaries: findings route as ordinary harbour findings — dead code removed or deferred; unused dependency to Boatswain hygiene or a Captain dependency call. Plank/placement checks stay on the tsc/ts-morph compiler API: `@planks` is comment trivia, off-AST for GritQL. Any methodology check keeps its Article-6 negative test wherever it lands, and folding `FORBIDDEN_DOUBLE` into the biome gate MUST NOT silently drop its `methodology-conformance.feature` scenario — keep the scenario with GritQL-backed support, or retire it deliberately.

Custody: Shipwright does not read `CAPTAIN.md`, so this is Captain's steering note — raise it with Shipwright in-harbour. A tool that earns its keep gets fitted into `AGENTS.md`/`RIGGING.md` by Shipwright, not recorded here.

## Harbour 2026-07-09 complete, committed and shipped (`82e6b46`)

Resumed the interrupted refit at base `f4b56fb` and completed the inventory. All-tier boundary check green: `@logic`+`@sandbox` 139/139, `@eval` 14/14, first weather record at `coverage/weather.json`. `RIGGING.md`/`AGENTS.md` refit to current shape, `README.md` Shipshape block added. Plank inventory sound: 273 planks, 217 unique step texts, zero stale against `@eval`-inclusive live steps. Zero `@captain` and zero `@shipwright` scenarios; nothing to promote or condemn.

Harbour-scoped edits this session, uncommitted for Boatswain: `RIGGING.md` `plank-inventory` now `node scripts/plank-inventory.mjs` (TS compiler API, reads docblock and line-comment planks, escaped-quote-safe, seam-bound; retires the fragile `rg` lister); two below-seam fragment planks hoisted to their function docblocks (`createEstelleExtension`, `openWithBonnyVoice`); `scripts/plank-inventory.mjs` added.

Removed the orphaned `packages/pi-shipshape/` residue: fitted out in `bd571bb`, tracked files struck in `3342dc0`, only ignored `node_modules` lingered. Layer-1 (packaging upstream Shipshape skills for plain pi) is realized at runtime per no-vendoring, not as a built package; the operator confirmed the residue is deletable, not a stub for a planned distributable.

Boatswain custody landed and shipped as `82e6b46`. Remaining follow-ups, now queued behind the 0.11.1 refit above: the seat-pinning spec item below, then release per `## Outbound` with the registry boot-verify; outbound needs fresh operator approval in that session.

## Upstream planking evidence, drafted for delivery

Two planking-doctrine findings for `dmytri/shipshape`, drafted self-contained for the maintainer to read cold. Deliver as a GitHub issue on the upstream repo; `CAPTAIN.md` is private and search-excluded, so it is our record, never the channel. The draft (session scratchpad, `upstream-planking-findings.md`) may need re-generating if the scratchpad is gone; the two findings are:

1. **Inventory guidance is self-defeating for line-comment planks.** Discovery-tools says prefer jsdoc/ts-morph, but `@planks` is plain-text-by-design and 65 of 273 planks here are `//` line comments. `getJSDocTags` reads only `/** */` and undercounts by a quarter. Fix: mandate docblock-on-declaration form, or drop the AST recommendation and read all comment ranges.
2. **The hoisting rule ships with no executable placement check.** Two planks sat below their seam and passed QM and Boatswain to harbour, because the only plank check joins step *text* to live steps, never *placement* (Article 6). Fix: ship a reference "every plank annotates a declaration" check, or state that placement is harbour-only by design.

Both share one root: `@planks` is specified free-placed plain text, yet the tooling guidance and hoisting rule assume declaration-anchored annotations.

## Verification-economy findings, harbour audit

From the weather record and step-def read. Routing noted per finding.

- **Build-reuse debt (QM, speed).** `Given("the built Estelle package")` and `Given("the packaged Estelle artifact")` each run `pnpm build` (~4.8s) per scenario; four scenarios rebuild the same ambient `dist/` no scenario mutates, ~14s redundant, near 10% of the `@logic` run. Build once per run behind a marker or lock and reuse, per the Verification agreement's reuse rule. Verification debt for QM.
- **Over-provisioned fixture (QM).** `"The package exposes the estelle launch command"` runs the build but asserts only `package.json` `bin` and the committed `bin/estelle.js` shebang, needing no build. Drop or split the build `Given` for it.
- **GritQL-in-biome (rigging, robustness not speed).** The forbidden-double scan (`methodology-conformance.steps.ts` `FORBIDDEN_DOUBLE` line regexes) is real code AST: a biome GritQL plugin rule folds it into the `biome check` gate we already run. The hand-rolled `stripComments` + `extractStepRegistrations` balanced-paren parser (~150 lines) for the live-turn-timeout check is a stronger AST candidate: structural matching retires the fragile text-parsing. Neither speeds a fast check; both cut fragility. GritQL does not fit plank or placement checks: comment trivia stays on the compiler API.
- **Plank-placement check (QM).** The `@property` "every plank annotates a declaration" check from the upstream note above is ours to add regardless; `scripts/plank-inventory.mjs` `bindSeam` already distinguishes the in-body case.
- **Scantling form is sound.** `internal-api-shape` is already correct scantling-attestation form (tsc proof); its ~13s is inherent to a real type-proof, optionally narrowed by scoping its conformance tsconfig to the seams. `"ships runtime and withholds Captain notes"` genuinely needs real `npm pack` ignore-rule semantics, so it stays a behaviour scenario, not a scantling; only its build should be reused. No scenario is a false scantling.

## Voyage closed 2026-07-09: audit remediation

All audit items landed: lint gate green under a binding lint-clean scenario; 7 promoted skeletons executable and green; six live-path production defects found and fixed through the `@eval` tier (thinking-level clamp, premature dispose, leaked floating-turn rejection, mid-stream hand-off guard, abort-and-voice for the crew-run summary, isolated-dispatch seat declaration); default tier 139/139. Watchbill struck. Boundary check deferred to harbour per Captain spend directive; the confirmatory `@eval` pass runs there.

Immediate post-harbour spec work: pin the isolated-dispatch declaration for every internal seat, not only the QM seat, in `seat-composition.feature`'s alongside outline; Boatswain flagged the code as broader than its pinned scenario. Written after harbour so the boundary check meets no undefined steps.

## Standing Estelle deltas, open follow-ups

The 0.10.1 Rigging reshape landed this harbour (Outbound, Dependencies, Tiers policy/weather, mode lines, scantlings). Still open:

- Derive a discovery-shaped eval variant without `--fail-fast`, alongside the confirmatory `eval` command: enumerating an unknown live-failure set through a fail-fast command re-runs unchanged-behaviour scenarios on paid model turns once per newly revealed red, observed live this voyage.
- 0.10.1 changed hook behaviour Estelle consumes live: planks-check scopes to crew/shipwright, dispatch-guard binds a spawned Captain and measures the prompt, feature-quality exempts `# language:` and doc-string hashes. The shim's custody assertions must be re-proven against these.
- The shim consuming the `rules/` component is now safer to pilot; 0.10.1 rewrote the rules as faithful cited checklists under test.

## What Estelle is (reoriented 2026-07-04)

Estelle is three things at once, all resting on faithfully consuming the real Shipshape plugin, never a fork of it:

1. **Reference runtime** for running Shipshape (skills + open-plugin) on pi.
2. **Live-fire pilot** that produces the evidence the maintainer's note asks for: what enforces on pi, what fumbles, every false red and vacuous green.
3. **A great coding agent** in its own right: Bonny and the crew personas, `/embark`, `/clear`, alongside-crew UX, per-seat models, fitting-out.

## Monorepo

`@dk/estelle` (scoped flagship) at root; unscoped extension packages under `packages/`, consumed via `workspace:*`. One root Shipshape harness: root `cucumber.cjs`, `RIGGING.md`, `tsconfig.json` cover `packages/*`. `packages/pi-open-plugin-shim` is pi's open-plugin engine; pi is not hook-native, so the shim executes the neutral `.plugin/` hooks on pi events. `SubagentStop` and the `Task` matcher have no pi equivalent: pi is session-isolated, not subagent-isolated. Pilot finding.

## Standing rules

- **Pre-1.0: no backward compatibility, no compat cruft.** Current design only. Old forms are Shipwright's to refit, never a parser's to tolerate.
- A change to a SHARED plugin hook affects EVERY vendor. Regression-test the current form; do not add legacy fallbacks.
- Extension packages unscoped (`pi-open-plugin-shim`); flagship scoped (`@dk/estelle`).
- Roles run as the plugin's real `shipshape:*` subagents. The Claude dev env installs the plugin via `npx plugins add ~/shipshape`. Thin dispatches only: role, base commit, optional watchbill.
- No Claude-specific config in the repo. `.claude/` stays gitignored; role agents are the plugin's, never hand-built files.
- **Boot-verify must exercise the actual behaviour a fix claims to fix**, on the real `estelle` bin, in a directory with its own unrelated `assets/`, from the real registry. A commit landing on `main` is not evidence it shipped; check the registry version against `git log -- src/ bin/ assets/ package.json`.
- An `@eval` that seeds intent with no basis in the workspace tests incoherence, not the behaviour: seed a real project with a ready spec before driving embark.

## The crew, flagship personas

| Seat | Name | After |
|---|---|---|
| Captain | Bonny | Anne Bonny, jester mask and deadly serious, crush on Bellamy |
| Quartermaster | Misson | James Misson, true believer in the Articles |
| Crew | (roster) | Soviet space-dog survivors, names code-picked |
| Boatswain | Bellamy | "Black Sam" Bellamy, grumpy heart of gold |
| Shipwright | Johnson | Captain Charles Johnson, harbour only |

They/them, gender-neutral. Voice is honour-system; names are where code bites. Character cards in `assets/characters/`. The gender-neutral `@property` check scans `features/**` and step defs, not `assets/**`; extending it is an open candidate.

## Structural-refactor pilot charter (Phase 3)

Upstream deliberately ships no refactoring engine, no smell catalogue, no refactor role. Everything below is UNPROVEN and lives here until the pilot earns it upstream:

- **The refit engine already composes, test this first.** Perturbation + scantlings + Shipwright-reports + narrow-Crew is bounded refit today, no new role. Prove or break this composition before proposing a Carpenter.
- **Carpenter reserved, not built.** Cut the seat only if the pilot hits a wall where Crew-under-perturbation genuinely cannot carry a multi-seam refit.
- **Smells, filtered trace-not-taste.** Doctrine-worthy only if it degrades the trace: the plank-distribution family as ONE smell, plus scantling-mismatch. Drop as taste: hidden behaviour, domain plus IO mix, high churn.
- **Co-use guardrail, keep verbatim if any goes upstream.** A merge or over-split finding needs per-scenario co-use evidence, not full-run coverage.
- **Tooling stays stack-local.** ts-morph, c8, cucumber usage-json, jscpd are pilot reference, never canon.

## Parked

- Weather-record pilot: no tier records weather yet; the 0.10.1 `weather:` rigging slot standardizes where it lands. A future timeout-budget decision should rest on observed p95, not precedent-matching a sibling's number.
- Canned `assets/greeting.md` is unreferenced since `openWithBonnyVoice`; asset-custody disposition open.
