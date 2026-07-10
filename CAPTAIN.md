> **STOP. Captain's notes: non-binding.** Captain writes, Boatswain reads. Anyone else: close this file now. Binding behaviour lives in `.feature` specs and referenced `assets/**`, never here.

# Captain Notes

Binding behaviour lives in `.feature` specs and referenced `assets/**`. History lives in git. These notes carry only what the next cycle needs.

## Harbour (this session) — clean bill; content-catalog completion voyage in flight

Maintenance harbour opened from a quiescent deck (base `192b93e`). Shipwright returned a clean bill: mature, thoroughly-fitted project, no `RIGGING.md`/`AGENTS.md` refit needed; 273 planks all docblock form, 0 stale (with `@eval` steps included); 0 unplanked or dead code; every uncovered line maps to a documented `## Known false-failure modes` entry. No `@shipwright` condemnations.

**All-tier boundary check:** `@logic` + `@sandbox` 144 green; `@eval` 13/14. The one red, `live-crew.feature:282` ("operator's own embark act ... turns the failing target green"), adjudicated as live-model stochastic variance: isolated rerun 2/3 green (pass 2m36s, fail 47s, pass 43s). Behaviour sound, not a regression, not a Crew target. Same class as the `:235` variance already on record; the deepest live-model e2e depends on the live crew actually driving the loop to green on the run.

**Content-catalog completion voyage (complete, committed `17ebbd7`):** Shipwright found more agent-facing copy still embedded in `src/index.ts`, against `content-catalog.feature`'s own Rule. Operator chose promote-via-catalog. Catalogued the five plain-string sites into `assets/agent-prompts.json`: `crewLoopPrompts.{quartermaster,crew,boatswain,crewReady}` (drive-loop seat turns `:1379/:1386/:1398` plus crew-ready `:1511`) and `embarkComplete` (`:420`). The existing "Catalogued agent-prompt copy is not duplicated" `@property` check (methodology-conformance.feature, substring scan over the flattened catalog) now reds against the inline literals; that is the M4 driver. QM discovered the red; Crew relocated the five seams to read from the catalog; Boatswain committed `17ebbd7` (deck 144/144 `@logic`+`@sandbox` green, fresh). Removed the two `@captain` skeletons: their intent is served by the catalog plus the existing check (same as `openingTurn`/`crewRunSummary`/`crewRunNarration`, which carry no per-site scenario), so per-site equality scenarios would re-add the over-specification removed in 0.11.1. Shipped in the `@dk/estelle@0.1.21` release (below).

**Deferred — handoff-narration template site (`:1587`):** the sixth flagged site is an interpolated template literal (`...from the ${fromSeat.name} to the ${SEATS.crew.name}...`). A substring not-duplicated check cannot cleanly drive a template's relocation; forcing it needs either fragment-cataloguing (ugly) or a template-aware driver (QM verification-support design). Scoped out of this voyage; queued below.

## Open follow-ups

- **Handoff-narration template relocation** (see deferred, above): pair a catalog entry with a template-aware relocation check.
- **Seat-pinning spec:** pin the isolated-dispatch declaration for every internal seat, not only QM, in `seat-composition.feature`'s alongside outline (code broader than the pinned scenario).
- **Release:** `@dk/estelle@0.1.21` shipped and boot-verified (`605b788`, tag `v0.1.21`). Registry install rewrote `workspace:*`→`pi-open-plugin-shim@0.1.1`; strace confirmed the real bin reads its BUNDLED `agent-prompts.json` (carrying the new `crewLoopPrompts`+`embarkComplete`) in a decoy-`assets/` project, with `assetsDir`'s `crew-roster.json` sentinel routing an unrelated project to bundled assets. Shim held at `0.1.1` (untouched this voyage; the next release touching shim runtime must bump it).
- **Economy debt → QM when touching support** (round this session, uninstrumented `@logic`+`@sandbox`: wall 129.5s / 144 scenarios; top-7 scenarios = 60% of 126.3s summed): `runnable-package` 32.0s across 4 scenarios and `pi-command-passthrough` 34.2s across 2 both rebuild `pnpm build` per scenario, no build-once guard (biggest amortizable lever); `pi-command-passthrough` real npm install/remove is 12.0s+22.3s (spec-form: does argv-forwarding need a real install or a cheaper pi subcommand); `internal-api-shape` 9.1s scantling attestation every inner loop (candidate tier-retag, Captain call).
- **Rigging papercuts → next harbour** (report-only, binding checks unaffected): `step-usage` filters `not @eval`, so a manual stale-plank audit false-flags `@eval`-only live-crew planks (Shipwright's independent join confirmed 0 real stale); `gherkin-lint` glob `features/**/*.feature` matches zero top-level feature files under gplint's globber.
- **Discovery-shaped `@eval` variant** without `--fail-fast`, alongside the confirmatory `eval` command, so enumerating an unknown live-failure set does not re-run unchanged scenarios on paid turns once per revealed red.
- **0.10.1 hook behaviour Estelle consumes live** must be re-proven against the shim's custody assertions: planks-check scoped to crew/shipwright, dispatch-guard binding a spawned Captain and measuring the prompt, feature-quality exempting `# language:` and doc-string hashes.
- **Shim consuming `rules/`** is now safer to pilot; 0.10.1 rewrote the rules as faithful cited checklists under test.

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
