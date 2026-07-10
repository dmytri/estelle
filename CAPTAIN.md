> **STOP. Captain's notes: non-binding.** Captain writes, Boatswain reads. Anyone else: close this file now. Binding behaviour lives in `.feature` specs and referenced `assets/**`, never here.

# Captain Notes

Binding behaviour lives in `.feature` specs and referenced `assets/**`. History lives in git. These notes carry only what the next cycle needs.

## Refit to Shipshape 0.11.1 — voyage complete, all tiers green

Last fitted to `0.10.1` doctrine (harbour `82e6b46`); installed workflow now `0.11.1`. Harbour returned a clean bill (all tiers green, fitting already at `0.11.1` shape); operator chose the **Comprehensive** remediation scope. Voyage committed `9c6346c` (relocation + plank hoist) and `fe0b8fa` (spec trim + note).

**All-tier boundary check (QM, base `fe0b8fa`, tier-tag watchbill):** `@logic` 152 green, `@sandbox` 6 green (real npm installs), `@eval` 13/14 — the one miss (`live-crew.feature:235`, Bonny embark-vs-role-command) passed 2/2 on isolated rerun, ruled live-model stochastic variance, not a product or harness defect. This voyage did not touch that logic; embark copy relocated byte-identically. Watchbill struck as spent.

**Outcome (QM voyage committed `9c6346c`, `fe0b8fa`):**
- **0.11.1 plank-form gap closed** — all 65 line-comment planks hoisted to docblocks, inventory 273/273 docblock.
- **Four new `@property` invariants green:** docblock plank-form (M1), registration uniqueness / one-impl-per-name (M2), shim↛flagship boundary (M3), catalogued-copy-not-duplicated (M4).
- **Content-catalog relocation done** — M4 drove Crew to source all six agent-prompt strings (embark description/snippet/guidelines, opening-turn, crew-run summary/narration) from `assets/agent-prompts.json`; the embark presentation is pinned green by `content-catalog.feature` C1 (`@logic`).
- **Content-catalog resolution (this Captain turn):** removed the three opening-turn/voicing equality scenarios. They asserted copy emitted only through a live provider turn, unobservable under file-level `@logic`; their sourcing is already proven by M4 and their live behaviour by the `@eval` live-crew scenarios; and per the Asset policy the exact prompt wording is craft, not a behaviour to pin. Retagging `@eval` (paid runs to pin craft copy) and a testability refactor were both rejected as over-specification. Spec trim committed in `fe0b8fa`.

GritQL, dependency-cruiser, Knip all declined/deferred (see rationale below, retained for the record until next harbour). Economy build-reuse routed to QM as verification debt.

**Open follow-ups queued behind this voyage:**
- Seat-pinning spec item: pin the isolated-dispatch declaration for every internal seat, not only the QM seat, in `seat-composition.feature`'s alongside outline (Boatswain earlier flagged the code as broader than its pinned scenario).
- Release per `## Outbound`: publish the shim first, then `@dk/estelle`, each with the registry boot-verify per `AGENTS.md`; needs fresh operator approval in the main session.
- Economy debt (from this harbour, QM to address when touching support): `runnable-package` build-reuse (~48s), `pi-command-passthrough` subprocess cost, `internal-api-shape` 13s attestation cadence.
- Rigging papercut: `step-usage` filters `not @eval`, so a manual stale-plank audit false-flags the `@eval`-only live-crew step defs; candidate `## Known false-failure modes` note (shipped check unaffected). Route to Shipwright next harbour.
- Rigging finding (Boatswain, this voyage): the `## Commands` `gherkin-lint` glob `features/**/*.feature` matches zero top-level `features/*.feature` files under gplint's globber, so the convenience command lints nothing. The binding `methodology-conformance.feature` gherkin-lint scenario is unaffected (its `featureFiles()` helper walks recursively). Route the glob fix to Shipwright next harbour.

### The findings, and how each routes

- **Plank-form conformance (the real 0.11.1 gap).** 65 `//` line-comment planks on `const` arrow-function seams in `src/index.ts`; `0.11.1` mandates docblock (`/** */`) form and calls line-comment planks malformed. Fix: hoist the 65 to docblocks (Shipwright, in-harbour `@planks` work) and add a ts-morph-backed plank-form `@property` scenario (Captain spec + QM check, Article-6 negative-tested, born green post-hoist). Stays on the compiler API, off-AST for GritQL.
- **GritQL-in-biome (adopt, recommended).** biome 2.5.1 supports `.grit` plugin rules; negative test passed. Fold `FORBIDDEN_DOUBLE` into the `biome check` gate (~7-9 clean AST patterns; the `/\.invalid\b/` substring needs a string-literal predicate or stays regex) and retire the ~150-line `stripComments`+`extractStepRegistrations` parser (live-turn-timeout check). Rigging (.grit rules + biome plugin config) is Shipwright; re-backing the step-def support is QM. MUST keep the `methodology-conformance.feature` scenario — re-back its support, do not drop it.
- **Boundary check (adopt, via GritQL — no new dep).** Shim never imports flagship — a one-directional layer boundary with no enforcing check. It is a single direct rule ("shim source must not import the flagship"), not a transitive multi-layer constraint, so a GritQL/biome rule discharges it on the gate we already run; dependency-cruiser is not warranted and is declined. Captain writes the attestation scenario; the `.grit` boundary rule is laid with the GritQL rigging.
- **One-impl-per-registered-name checker.** Seats/commands/tools register by name (`SEAT_BY_COMMAND`, `registerCommand`, `registerTool`) with no check asserting one implementation per name. Bespoke conformance checker (structural, no off-the-shelf tool) = QM verification support; Captain writes the `@property` attestation scenario.
- **Content-catalog relocation.** Agent-facing prompt copy hardcoded inline while `assets/` catalog exists: embark `description`/`promptSnippet`/`promptGuidelines` (`src/index.ts:396-400`), opening-turn instruction (`:667`), crew-run voicing prompts (`:1262`, `:1297`). Captain moves the copy into assets and writes scenarios asserting each seam sources its agent text from the catalog; Crew wires the seams to read from it.
- **Economy outliers → QM verification debt.** From the weather record: `runnable-package` four scenarios ~12s each (build amortizable to once-per-run), `pi-command-passthrough` subprocess cost (23s/14s), `internal-api-shape` 13s scantling attestation cadence. QM addresses as verification-support quality when it touches support.
- **Declined: Knip.** Viable only with `includeEntryExports:true` on the single-file packages; yielded one low-value finding (`ReportedAgent` — see type-dup below). New dev dep not worth the payoff on this code shape.
- **Report-only papercuts.** `step-usage` filters `not @eval`, so a manual stale-plank audit false-flags 23 `@eval`-only planks (candidate `## Known false-failure modes` note; the shipped check is unaffected). `ReportedAgent` re-declared locally in two step files instead of imported (verification-support hygiene → QM/Boatswain).

### Execution — one voyage, no harbour re-entry

Harbour is closed (clean bill delivered). The remediation runs as a normal Captain→QM→Crew→Boatswain voyage over a work-in-flight tree; no clean-tree guard, no Shipwright rigging pass, no new dependency, no biome.json rigging edit. The `.grit` rules are Captain-owned scantlings (a policy ruleset discharged by biome, the static analyzer), invoked from step-def support via `biome search`/`.grit`, so nothing folds into the lint gate and no rigging changes.

Ownership map:
- **Captain `@property` scenarios (bespoke checker, QM support), all in `methodology-conformance.feature`:** plank-form (ts-morph, compiler API, off-AST for GritQL — `@planks` is comment trivia); one-impl-per-registered-name (keys on `SEAT_BY_COMMAND`/`registerCommand`/`registerTool`); shim↛flagship boundary (scan shim source imports for the flagship package).
- **Captain assets + scenarios:** `assets/agent-prompts.json` catalog holds the four prompts (embark description/snippet/guidelines, opening-turn, crew-run summary, crew-run narration). `content-catalog.feature` pins each seam to its catalogued copy. The driver is a `@property` "catalogued copy is not duplicated inline" check in `methodology-conformance.feature` — it reddens while the strings sit in `src`, forcing Crew to wire the catalog read. **No perturbation** (superseded — the perturbation approach the operator first picked verified two seams through paid `@eval`; the not-duplicated-inline driver + `@logic` equality scenarios relocate all four seams and verify entirely in `@logic`, strictly cheaper, same result).
- **QM support:** build the plank-form ts-morph check (Article-6 negative-tested, born green post-hoist), the one-impl checker, the boundary import scan, and the not-duplicated-inline scan; wire the four content-catalog equality scenarios (assert the seam's catalog-sourced prompt without a live model); apply `runnable-package` build-reuse (economy).
- **Crew production:** hoist the 65 line-comment planks to docblocks (driven by the failing plank-form check); wire the content-catalog seams to read prompts from `assets/agent-prompts.json`, extracting each into a `@logic`-assertable seam.
- **Boatswain:** commit the whole voyage.

**GritQL is out of Captain scope entirely — no Captain-authored `.grit` scantlings.** Two grounds, both verified this session: (1) the shim↛flagship boundary is not cleanly GritQL-expressible — `biome search '`import $c from "@dk/estelle"`'` matched *any* import (even a nonexistent package name), so a correct rule needs `where`-predicate string matching, which is verifier R&D belonging to QM; the constraint is thus a bespoke checker (QM), not a policy-engine scantling. (2) The two existing green checks resist clean GritQL too: live-turn-timeout asserts `timeout >= budget` (a numeric threshold GritQL cannot express) and forbidden-double's `/\.invalid\b/` is a fragile substring. Adopting GritQL for the *parsing* inside those checks is QM verification-support latitude, decided on QM's judgment; it is not a durable Captain artifact and does not change the behavioural scenarios. Knip stays declined; dependency-cruiser declined (no new dep).

Custody: Shipwright does not read `CAPTAIN.md`; steering to it happens in-harbour via direct message. Tooling stays stack-local, fitted into `RIGGING.md` by Shipwright, never recorded as canon here.

## Upstream planking findings — resolved in 0.11.1, converted to local conformance

Both standing findings for `dmytri/shipshape` are fixed in the `0.11.1` doctrine loaded this harbour, so neither ships upstream. They convert to the local plank-form conformance work in the refit section above.

1. **Inventory guidance self-defeating for line-comment planks** — RESOLVED. The Traceability policy now mandates docblock form and calls a line-comment/in-body plank malformed and correctable.
2. **Hoisting rule shipped no executable placement check** — RESOLVED. The Shipwright derivation notes now prescribe a plank-form check where every `@planks` token resolves to a docblock tag on a declaration so a line-comment or in-body plank reddens.

Local consequence: this project's 65 line-comment planks and absent plank-form check now diverge from `0.11.1`. Remediation is the plank-form item in the refit section. The scratchpad draft `upstream-planking-findings.md` is obsolete.

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
