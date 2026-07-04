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

Estelle is the vessel: an npm package `@dk/estelle` launched with `npx`. Estelle boots pi (pi.dev) into its interactive TUI as the Captain Bonny, installs the upstream Shipshape package through pi's native package manager, injects each seat's role instructions and character card into the live system prompt, and mechanically enforces custody through the Estelle pi extension. Estelle vendors nothing it can pull upstream. After SV Estelle.

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

## The layered stack

1. **Skills** (upstream `dmytri/shipshape`): canonical doctrine, portable and complete alone.
2. **Open plugin** (upstream `dmytri/shipshape`): vendor-neutral mechanical enforcement in the open-plugin format (vercel-labs/open-plugin-spec). Context isolation and custody hooks; live-fire verified on Claude Code.
3. **pi adapter** (this repo's world): pi-specific glue that runs an open-plugin on pi. pi is not an upstream-supported runtime, so this vendor layer is ours.
4. **`@dk/estelle`** (this repo, flagship): seats and personas, Bonny as sole voice, fitting out, per-seat models, and enforcement beyond open-plugin scope: fresh-pi-session context isolation, seat-scoped and per-repo custody, opinionated config and UX.

**Portability governs layer placement, operator 2026-07-03.** If a mechanism can be expressed in the vendor-neutral open-plugin format and work identically across ALL supported clients, not pi alone, it goes upstream into the Shipshape plugin. Pi-specific mechanisms and anything beyond open-plugin scope stay in Estelle's extension. Estelle's hand-rolled custody (`evaluateWrite`/`evaluateRead`) migrates upstream only where it is portable and open-plugin-shaped; the rest stays flagship. When in doubt, the test is: does it work in every supported client through the open-plugin spec?

## The loop, decided

Bonny is always-on and the only seat the operator speaks with. The operator embarks a batch to set the crew running; the crew (QM, Crew, Boatswain) run in a session beside Bonny that does not carry the operator's conversation with her. The crew work from durable artifacts only.

**Crew UX, decided operator 2026-07-04: alongside sub-session, not mode-switch.** pi carries a first-class non-replacing sub-session primitive, `createAgentSession({ sessionManager: SessionManager.inMemory(), tools, modelRegistry })`, that runs beside the live session and exposes a subscribable event feed through `session.subscribe`. Two shipping pi extensions prove it: `@juicesharp/rpiv-btw` runs a tool-less side call in a bottom overlay, and `pi-btw` runs a real tool-using sub-session with read/bash/edit/write, focus-toggled with `Alt+/`, and summarizes or injects the result back into the main agent. So `/embark` opens the crew as an in-memory sub-session alongside Bonny; her session stays live and unpolluted. The earlier mode-switch-via-`newSession()` decision is dropped, and the prior claim that alongside "fights pi's single-session model" was wrong: pi supports it natively.

**Narration, decided operator 2026-07-04: free heartbeat plus one small call per handoff.** Liveness is free from the event stream: a status line showing the current seat and tool tells the operator nothing hangs, at zero extra tokens. Colour is paid but bounded: one small Bonny model call at each seat handoff (QM to Crew to Boatswain to done), voiced off that seat's summary, roughly four calls a batch. Raw crew work stays peekable behind the panel through the focus toggle. Per-handoff, never per-beat.

**Embark trigger, decided operator 2026-07-04: both.** The real trigger is the deterministic `/embark` command, which a hook fires on reliably. Bonny also resolves natural phrasing ("ship it", "send the crew") to `/embark` as a convenience. Phrase inference is a shortcut, never the sole trigger; fuzzy detection alone is unreliable.

**Slices.** 1: `/embark` opens the seated-Quartermaster crew sub-session alongside Bonny, seeded contextless so none of the operator's messages travel, while Bonny's session stays live. 2: overlay panel plus heartbeat, `Alt+/` focus toggle, raw transcript peekable. 3: seat progression QM to Crew to Boatswain as seated sub-sessions, each custody-scoped. 4: one small Bonny call per handoff. 5: crew result summarized back into Bonny's context.

**Progression driver, decided operator 2026-07-04: Estelle drives it, not the agent.** Estelle's extension orchestrates the seat sequence in code: run the Quartermaster turn, then open a fresh context-isolated sub-session per seat (Crew, then Boatswain), each custody-scoped. A fresh session per seat, not a re-seat, so the QM to Crew firewall holds by fresh context rather than a prompt switch. This keeps the live-crew arc self-contained and out of the pi-adapter arc (the alternative, the crew agent dispatching its own sub-roles, would need a pi role-dispatch primitive and fuse the two arcs). Mirrors how the Captain orchestrates window-isolated subagents in Claude Code.

## Workspace model: the harbour, operator direction 2026-07-02

Estelle's launch directory is a harbour, not a project. Not yet specced:

- Starting Estelle in `$HOME` or any non-project parent MUST fit out Estelle (global), never assume the directory is a project.
- Several repos berth under the workspace at once. Bonny infers from operator intent which repo the conversation is about, whether an existing repo under the harbour or a new one to create, and whether that repo needs project fitting (Shipwright rigging). Project fitting happens during discovery, when intent starts flowing, not at launch.
- Mechanical successors: repo discovery under the workspace (git dirs), per-repo fitting-state derivation (RIGGING.md presence), and per-repo custody scoping (today `evaluateWrite` computes paths relative to one cwd; with berthed repos, custody paths like `src/**` bind per target repo). The inference itself is judgement and lives in Bonny's skill layer, not the extension.
- Per-repo custody scoping is the first mechanical slice, specced alongside the live-crew machinery.

## Next arcs, all wanted by operator 2026-07-03

Three arcs, all in scope; sequencing is Captain's.

1. **Live-crew Layer 2.** Build the always-on Bonny + `/embark` loop into the extension: crew seats in alongside in-memory sub-sessions, one-way firewall, heartbeat plus per-handoff narration routed to Bonny. pi-specific and beyond open-plugin scope, so Estelle-side. Gates the pi-adapter arc (proves pi-run crew isolation).
2. **pi adapter + Shipshape-on-pi.** A pi runtime layer that runs the vendor-neutral open-plugin on pi, so plain-pi users get Shipshape and Estelle can consume upstream custody. Apply the portability rule: portable, open-plugin-shaped custody migrates upstream and must work in all supported clients; pi-specific glue stays in the adapter; beyond-scope custody stays in Estelle.
3. **Perturb as product.** A narrow `perturb` tool through the custody gate so every Captain dagger is an auditable call. Specced by scenario, future iteration.

## Design pointers (pi)

- Custody gates: `tool_call` returns `{ block: true, reason }`; seat commands: `pi.registerCommand`; per-seat model: `before_provider_request` + `model_select`; per-seat toolset: `setActiveTools`.
- Interactive: `createAgentSessionRuntime` + `InteractiveMode.run()` per pi sdk.md; persistent storage comes from `createAgentSessionServices` (`auth.json`, `models.json`, sessions under agentDir).
- Context firewall (live crew): the crew is an alongside sub-session via `createAgentSession({ sessionManager: SessionManager.inMemory(), tools, modelRegistry, resourceLoader })`, seeded contextless so Bonny's history never travels; `session.subscribe(event => ...)` streams `tool_execution_start`/`message_update`/`turn_end` for the heartbeat. Not `newSession()`, which replaces the live session. Reference extensions: `pi-btw`, `@juicesharp/rpiv-btw`.
- Packages: `DefaultPackageManager.installAndPersist`; convention dirs (skills/ with SKILL.md folders) need no pi manifest.
- Extension config idiom: `CONFIG_DIR_NAME` for project-local, `~/.pi/agent/<name>.json` for global.

## Stale-green perturbation dagger, operative rule

Plant the RIGGING `fail-fast` statement as the first statement of a suspected stale-green production seam; run the relevant scenarios. Red proves the seam is reached; green-despite-dagger is stale-green evidence. Reachability, not assertion strength. Custody: the dagger is the sole Captain production-write exception; QM confirms every dagger reddens discovery; Boatswain never commits a live one. Use post-fix on a distrusted green, never pre-fix. Interim rule, operator 2026-07-01: I MAY use the dagger and I tell the operator before planting one.

## Status

- Shipped: `@dk/estelle@0.1.7` on npm, `main` in sync with `origin`. Through 0.1.7: Shipshape install with Articles reaching Bonny's live prompt, model-gated greeting and fitting-out steer both operator-owned assets (`assets/greeting.md`, `assets/steer.md`), `estelle.json` per-seat models bound on both launch seams with pi default winning when unrecorded, and pi command pass-through. Harbour clean at last scan: 76 planks, zero stale, both tiers green.
- Upstream `dmytri/shipshape` is at plugin 0.8.x, vendor-neutral open-plugin; the old qm-entry-guard block on window-isolated subagents is lifted, so the crew run as isolated subagents cleanly this runtime.
- In flight: live-crew slice 1 re-home. Spec `features/live-crew.feature` pins the alongside model with the trigger renamed `/ship` to `/embark`; three scenarios, one that fails under the old `newSession()` replace model (the started session must stay Captain Bonny and keep the operator's message). Production still carries the old `/ship`-via-`newSession()` handler, so the crew has red to close: register `/embark`, open the crew as an in-memory alongside sub-session seated as Misson, expose the crew session for observation apart from the started session, keep the started session live. Old `/ship` scenario `@planks` in `src/index.ts` go stale on rename; crew reconciles.
- QM blocker resolved 2026-07-04: the first spec left the crew session and the started session as one observable seam (the reused firewall step read `runtime.session`, which scenario 2 requires stay Bonny's). Fix is behaviour-only: every scenario now anchors on "a crew session opens alongside the started session" as a distinct object, so "the crew session" and "the started session" are two seams. Topology is stated as behaviour; the mechanism (a distinct alongside session, how it is reached) stays crew craft.
- Slice 1 shipped (unpublished) `1f72058`: `/embark` builds `crewRuntime` (a full alongside runtime seated as Misson), started session untouched, exposed via `crewSession()` on the handle. All 65 `@logic` green.
- `@eval` tier established 2026-07-04, live-agent shape modelled on `~/jolly`. Opt-in, excluded from default/broad so it is not in the default worklist. Knobs in gitignored `.env` (`HARNESS_OPENROUTER_API_KEY` reused from jolly, `HARNESS_EVAL_MODEL=deepseek/deepseek-v4-flash`); template in `.env.example`; `eval` command + tier in `RIGGING.md`. The live-crew heartbeat/narration slices verify here; `@logic` keeps the deterministic plumbing. `.env` gitignored per operator instruction.
- No skip-not-fail, operator directive 2026-07-04. Credentials for every tier are required fitting-out and assumed present. A test that fails on a missing credential is a Captain blocker for incomplete fitting-out, never a silent skip and never a false-failure. Skip-not-fail came from `~/jolly` (AGENTS.md and feature 025), not from canonical Shipshape, and rode in when the `@eval` tier was modelled on jolly; purged from Estelle. Do not reintroduce it.
- Slice 2 shipped (unpublished) `3aedc90`: the crew's heartbeat, fed off the real event stream, `crewSession().heartbeat()` plus `runTurn()`. `@logic` at-rest green, `@eval` live-run green. The literal panel rendering and `Alt+/` focus toggle are terminal keybindings, not cucumber-testable; they ride the published-artifact boot check, not this spec.
- Slice 3 shipped (unpublished) `292745e`: the QM to Crew handoff, Estelle-driven. `@logic` proves handing off opens a fresh Crew-seated session isolated from the Quartermaster's context and carrying Crew custody (`src/**` only). Crew added `handOffToCrew()` (fresh crew runtime seated as `SEATS.crew`) and a crew-session `write()` custody seam.
- @eval integrity fix in flight 2026-07-04. Both `@eval` scenarios were theatre: `runTurn()` (`src/index.ts:893`) subscribed, sent a user message, resolved on the FIRST event (the user-message echo, not a model reply), then aborted before the model replied, so no live call ever happened. Wall-time proved it: 1.5s, no completion. The step also seeded only `auth.json`, not a resolvable openrouter provider block. OpenRouter connectivity, key, and `deepseek/deepseek-v4-flash` are all confirmed live from this box, so the fix is viable. Fix: spec now asserts "the crew session received a live reply from the Quartermaster's model" in both `@eval` scenarios, an observable only a real completion produces, so green means live and an unresolved model or absent credential is hard red (a fitting-out failure, not a vacuous pass). Crew fixes `runTurn` to await the real assistant reply; QM seeds a resolvable openrouter provider (models.json, mirror greeting.steps) and lets absent-cred red surface as the fitting-out blocker. Lesson: never report `@eval` green as "live" without wall-time evidence; a fast pass is a false-green.
- Slice 4 handed off: handoff narration. `@logic` pins that a handoff records a narration entry for the QM to Crew transition (structure, no model); `@eval` pins Bonny voicing a real line at the handoff (a small live captain-model call, non-empty text in her voice). Crew adds a narration log fed on `handOffToCrew`, and on handoff makes one small Bonny model call voiced off the completed seat when a captain model is available. The `@eval` step configures the live model for both the crew seat and Bonny. Verify `@eval` wall-time by hand each slice: a fast pass is a false-green.
- Next after slice 4: slice 5 (crew result summarized back into Bonny's context), then outbound. Arcs 2 and 3 remain.
- Watch items: Misson character detail welcome anytime.
