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

## Status, delivered

- Iteration 1 (commit `72cc063`): launch seam, seat write custody, Captain notes privacy, seat tool custody, seat model selection, crew naming.
- Iteration 2 so far (commit `1b074ae`): seat models default from `assets/seat-models.json`, operator config override, character-card injection into each seat's system prompt, operator-delivery-failure recording.
- Also: all five character cards rewritten in Shipshape Controlled English with full depth; the Bosun to Boatswain rename here and upstream; build-config debt cleared (commit `dd9982e`).
- Suite: 20 scenarios green. typecheck and lint green. Repo public at `dmytri/estelle`; old version archived at `dmytri/estelle-old`. Not published to npm.

The three earlier flags are resolved: build-config debt cleared; operator-delivery failure specced and recorded; seat models default from the asset.

## What is not built yet

- **Estelle is not yet runnable as `npx @dk/estelle`.** There is no `bin`, no `main`, no build output. The green suite verifies the `launch()` seam against a real pi session at the @logic tier. It does not verify the CLI an operator runs, real provider turns (needs keys, a @sandbox tier), or the published package. Per the RIGGING outbound policy, the published package must be verified to boot before release.
- **The async-orchestration architecture is unbuilt:** the batch loop, `/ship`, Estelle-driven auto-transitions, the live Captain-to-QM context clear, and the live-show TUI. This is the next design pass.

## Open items for the operator

- Model defaults for Crew, Boatswain, Shipwright in `assets/seat-models.json` are provisional. Confirm or change.
- Pass-two character detail captured. Misson is now protective-pedantic; deeper detail welcome anytime.
