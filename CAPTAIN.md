> **STOP. Captain's notes: non-binding.** Captain writes, Boatswain reads. Anyone else: close this file now. Binding behaviour lives in `.feature` specs and referenced `assets/**`, never here.

# Captain Notes

Binding behaviour lives in `.feature` specs and referenced `assets/**`. History lives in git. These notes carry only what the next cycle needs.

## Boundary check 2026-07-11 — all tiers green at `2e9f108`

Full-tier boundary check on operator order: tier-tag watchbill, fresh QM cycle, base `c2f5633`. Static discovery clean: 144 scenarios, 1281 steps, zero undefined or unimplemented; plank audit zero stale, zero malformed. Sweeps all fresh: `@logic` 138 green in 1m36s; `@sandbox` 6 green in 26s; `@eval` 12/14 in 6m02s.

The two `@eval` reds, both `live-crew.feature`:

- `:235` (Bonny embarks instead of instructing a role command) adjudicated a real production fault, not variance. Crew anchored the catalogued `embark.promptGuidelines` copy at the end of the Captain seat prompt, read from the catalog at runtime; the same guidance sat mid-prompt in the base Guidelines and a long seat prompt buried it. Focused rerun green in 1m07s. This refines the earlier ":235 variance" record: live-crew sweep reds now have both causes on the books, so adjudicate each red per-run, never by precedent.
- `:282` (operator's own embark act turns the target green) went green on focused rerun after the fix, 60s. Consistent with the fix landing and with its prior variance history. No second Crew dispatch.

Boatswain committed `2e9f108` (embark steer, plank, spent watchbill rode along); tsc, biome, gplint green. Watchbill struck after custody per the Watchbill policy; the strike rides with this note. Prior harbour clean bill and the content-catalog voyage record live in git history (`c2f5633`, `17ebbd7`).

## Open follow-ups

- **Handoff-narration template relocation**: the sixth copy site is an interpolated template literal in `src/index.ts` (`...from the ${fromSeat.name} to the ${SEATS.crew.name}...`). A substring not-duplicated check cannot cleanly drive a template's relocation; pair a catalog entry with a template-aware relocation check (QM verification-support design).
- **Seat-pinning spec:** pin the isolated-dispatch declaration for every internal seat, not only QM, in `seat-composition.feature`'s alongside outline (code broader than the pinned scenario).
- **Release:** registry `@dk/estelle@0.1.21` (shim `0.1.1`) predates the embark-steer fix (`2e9f108`, flagship-only, `src/index.ts` + the catalog read). Pending outbound: push `main`; flagship `0.1.22` when the operator approves. Shim untouched this round, stays `0.1.1`; the next release touching shim runtime must bump it. Boot-verify per the runbook: real `estelle` bin, registry install, decoy-`assets/` project, and exercise the actual fixed behaviour (Captain seat prompt ends on the catalogued embark steer).
- **Economy debt → QM when touching support** (round 2026-07-11 boundary check, uninstrumented: `@logic` 1m36s/138 + `@sandbox` 26s/6, wall 122s/144; prior round's top-7 profile still current, 60% of summed time): `runnable-package` 32.0s across 4 scenarios and `pi-command-passthrough` 34.2s across 2 both rebuild `pnpm build` per scenario, no build-once guard (biggest amortizable lever); `pi-command-passthrough` real npm install/remove is 12.0s+22.3s (spec-form: does argv-forwarding need a real install or a cheaper pi subcommand); `internal-api-shape` 9.1s scantling attestation every inner loop (candidate tier-retag, Captain call).
- **Rigging papercuts → next harbour** (report-only, binding checks unaffected): `step-usage` filters `not @eval`, so a manual stale-plank audit false-flags `@eval`-only live-crew planks (Shipwright's independent join confirmed 0 real stale); `gherkin-lint` glob `features/**/*.feature` matches zero top-level feature files under gplint's globber.
- **Discovery-shaped `@eval` variant** without `--fail-fast`, alongside the confirmatory `eval` command, so enumerating an unknown live-failure set does not re-run unchanged scenarios on paid turns once per revealed red. QM derived the no-fail-fast sweep ad hoc this round; standardize it as a rigging command for Shipwright next harbour.
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
