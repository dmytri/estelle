<!-- ============================================================= -->
<!-- STOP. CAPTAIN ROLE ONLY.                                      -->
<!-- If you are NOT running as the Captain, i.e. you are the      -->
<!-- Quartermaster, Crew Mate, Boatswain, or any other role, do NOT   -->
<!-- read past this line. Close this file now. Its contents are    -->
<!-- Captain-only working context and must never enter another     -->
<!-- role's context. You were not given this file by your role.    -->
<!-- ============================================================= -->

> **STOP, CAPTAIN ROLE ONLY.** If you are not the Captain, close this file now. Binding behaviour lives in `.feature` specs and referenced `assets/**`, never here.

# Captain Notes, Captain only, non-binding

Captain-only working memory. Binding behaviour lives in `.feature` specs and referenced `assets/**`; history lives in git. These notes carry only what the next cycle needs.

## Access rule

Only Captain MAY edit this file. Boatswain MAY read it to evaluate spec quality and watchbill completeness. Quartermaster, Crew Mate, and Shipwright MUST NOT read it.

## What Estelle is

Estelle is the vessel: an npm package `@dk/estelle` launched with `npx`. Estelle boots pi (pi.dev) pre-configured to taste, with the upstream Shipshape skills installed via `npx skills`, and an Estelle pi extension that mechanically enforces the workflow. Estelle vendors nothing it can pull upstream. After SV Estelle.

## The crew

| Seat | Name | After | Note |
|---|---|---|---|
| Captain | Bonny | Anne Bonny | Jester mask, deadly serious; respects Misson; crush on Bellamy |
| Quartermaster | Misson | James Misson | True believer in the Articles; protects the crew |
| Crew | (roster) | Soviet space-dog survivors | Ragged, work-shy; names code-picked, not dogs |
| Boatswain | Bellamy | "Black Sam" Bellamy | Grumpy heart of gold; best hand; hygiene stickler |
| Shipwright | Johnson | Captain Charles Johnson | Tireless inspector; honorary crew; harbour only |

All seats are they/them, gender-neutral abstractions of their inspirations. Character cards live in `assets/characters/`. Personality is voice, honour-system. Names are where code bites.

## Enforcement posture, decided

Estelle enforces custody and context, not craft. Hard-gate the deterministic boundaries: who may write or read which files, which tools a seat holds, which model a seat runs, the Captain-to-Quartermaster context firewall. Leave judgement to the agent: simplicity, premature abstraction, whether code matches its steps, real-vs-mock. The skill prompts carry the fuzzy half.

## The loop, decided

Bonny is always-on and the only seat the operator speaks with. The operator gives the word ("ship it") to seal a batch. Estelle then freezes the batch, clears context, and runs the crew (QM, Crew, Boatswain). The crew work is a live show the operator watches in the session flow, each seat in its own voice, while Bonny stays alongside. The operator keeps talking to Bonny; new intent queues as the next batch.

The experience we want: concurrent, not blocking. The operator never waits on a black box; they watch a real crew work and talk to the captain at the same time. Visibility is asymmetric. Crew output is visible to the operator, read-only. The operator's words reach only Bonny; the crew never see them and work from the durable artifacts. Bonny holds the operator's intent, can reference it, and is the signal layer over the live feed: adds meaning, catches what matters, fields reactions. The crew speak through their visible output, not to the operator. The TUI and UX implementation of this show is refined in later revisions; this captures the target experience.

## Iteration map

Iteration 1, this batch: launch, seat write custody, Captain notes privacy, seat tool custody, seat model selection, crew naming. Deterministic gates only.

Deferred to iteration 2+: the async batch loop and `/ship`; Estelle-driven auto-transitions and the live Captain-to-QM context clear; `@captain` exclusion injection, watchbill schema validation, RIGGING required-value gate, harbour git/grep guards, outbound gate, `@planks` lint; injecting the character cards as per-seat prompt addenda; themes, keybindings, the rest of the tastes.

## Design pointers (pi hooks)

- Write/read/tool gates: the `tool_call` event returns `{ block: true, reason }` (examples `protected-paths.ts`, `permission-gate.ts`).
- Per-seat model: the `before_provider_request` event, plus `model_select`.
- Per-seat toolset: `setActiveTools` / `getActiveTools`.
- Skills from upstream: `resources_discover` and the `packages` array in `.pi/settings.json`; installed via `npx skills`, never vendored.
- Context firewall (iteration 2): `ctx.newSession()` for a genuine fresh context at the boundary.
- Launch: pi has no documented `npx` wrapper pattern; the DIY wrapper is the chosen path. Mind the pi project-trust gate on first launch.

## Iteration 1 status, delivered

Commit `72cc063`. All 15 scenarios green across the six iteration-1 features. `src/index.ts` carries the launch seam and the enforcement extension; verification lives under `features/`. `watchbill.json` spent and removed.

## Flags raised by the cycle, for decision

- **Config debt, build-config scope (not Captain-writable).** `tsc --noEmit` is red on `tsconfig.json` `moduleResolution: node10` deprecation (TS5107). `biome check .` is red with no `biome.json`; it was red at the keel, not a regression. Both block the RIGGING `typecheck` and `lint` boundary commands. Resolution is a Shipwright/fitting-out or explicit-edit decision.
- **Operator-delivery failure unspecified.** `src/index.ts` swallows every rejection from `sendUserMessage` to survive the hermetic tier. No scenario covers a real delivery failure. Iteration-2 candidate: spec the failure behaviour, then narrow the catch.
- **`seat-models.json` not read by code.** Model-selection scenarios pass model ids as literals through the `setSeatModel` seam; nothing reads `assets/seat-models.json`. Iteration-2 candidate: a scenario that Estelle defaults each seat model from the asset.

## Open items for the operator

- Model defaults for Crew, Boatswain, Shipwright in `assets/seat-models.json` are provisional. Confirm or change.
- Pass-two character detail captured. Misson is now protective-pedantic; deeper detail welcome anytime.
