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

Bonny is always-on and the only seat the operator speaks with. The operator seals a batch to set the crew running; the crew (QM, Crew, Boatswain) run in a context-isolated session that does not carry the operator's conversation with Bonny. The crew work from durable artifacts only.

**Crew UX, decided operator 2026-07-03: mode-switch, not alongside.** pi's `newSession()` replaces the active session rather than running one beside it. So `/ship` switches the TUI into a fresh, context-isolated crew session; the operator watches the crew work, then switches back to Bonny when done. The earlier "Bonny stays alongside as a live show" vision is dropped: it would need a second runtime streaming crew output into Bonny's session, fighting pi's single-session model. Mode-switch is the model, not a stepping stone.

**Ship trigger, decided operator 2026-07-03: both.** The real seal is the deterministic `/ship` command, which a hook can fire on reliably. Bonny also recognizes natural phrasing ("ship it", "send the crew") as a convenience and resolves it to `/ship`. Phrase inference is a shortcut, never the sole trigger; fuzzy detection alone is unreliable.

**First slice:** `/ship` opens a context-isolated Quartermaster session via `newSession()`. Fresh context carries none of the operator's messages to Bonny; the crew session seats the Quartermaster to begin the run. Later slices: crew progression QM to Crew to Boatswain, switch back to Bonny, batch freeze and queueing.

## Workspace model: the harbour, operator direction 2026-07-02

Estelle's launch directory is a harbour, not a project. Not yet specced:

- Starting Estelle in `$HOME` or any non-project parent MUST fit out Estelle (global), never assume the directory is a project.
- Several repos berth under the workspace at once. Bonny infers from operator intent which repo the conversation is about, whether an existing repo under the harbour or a new one to create, and whether that repo needs project fitting (Shipwright rigging). Project fitting happens during discovery, when intent starts flowing, not at launch.
- Mechanical successors: repo discovery under the workspace (git dirs), per-repo fitting-state derivation (RIGGING.md presence), and per-repo custody scoping (today `evaluateWrite` computes paths relative to one cwd; with berthed repos, custody paths like `src/**` bind per target repo). The inference itself is judgement and lives in Bonny's skill layer, not the extension.
- Per-repo custody scoping is the first mechanical slice, specced alongside the live-crew machinery.

## Next arcs, all wanted by operator 2026-07-03

Three arcs, all in scope; sequencing is Captain's.

1. **Live-crew Layer 2.** Build the always-on Bonny + `/ship` loop into the extension: crew seats in fresh pi sessions, one-way firewall, output routed to Bonny. pi-specific and beyond open-plugin scope, so Estelle-side. Gates the pi-adapter arc (proves pi-run crew isolation).
2. **pi adapter + Shipshape-on-pi.** A pi runtime layer that runs the vendor-neutral open-plugin on pi, so plain-pi users get Shipshape and Estelle can consume upstream custody. Apply the portability rule: portable, open-plugin-shaped custody migrates upstream and must work in all supported clients; pi-specific glue stays in the adapter; beyond-scope custody stays in Estelle.
3. **Perturb as product.** A narrow `perturb` tool through the custody gate so every Captain dagger is an auditable call. Specced by scenario, future iteration.

## Design pointers (pi)

- Custody gates: `tool_call` returns `{ block: true, reason }`; seat commands: `pi.registerCommand`; per-seat model: `before_provider_request` + `model_select`; per-seat toolset: `setActiveTools`.
- Interactive: `createAgentSessionRuntime` + `InteractiveMode.run()` per pi sdk.md; persistent storage comes from `createAgentSessionServices` (`auth.json`, `models.json`, sessions under agentDir).
- Context firewall (live crew): `ctx.newSession()` for a genuine fresh context.
- Packages: `DefaultPackageManager.installAndPersist`; convention dirs (skills/ with SKILL.md folders) need no pi manifest.
- Extension config idiom: `CONFIG_DIR_NAME` for project-local, `~/.pi/agent/<name>.json` for global.

## Stale-green perturbation dagger, operative rule

Plant the RIGGING `fail-fast` statement as the first statement of a suspected stale-green production seam; run the relevant scenarios. Red proves the seam is reached; green-despite-dagger is stale-green evidence. Reachability, not assertion strength. Custody: the dagger is the sole Captain production-write exception; QM confirms every dagger reddens discovery; Boatswain never commits a live one. Use post-fix on a distrusted green, never pre-fix. Interim rule, operator 2026-07-01: I MAY use the dagger and I tell the operator before planting one.

## Status

- Shipped: `@dk/estelle@0.1.7` on npm, `main` in sync with `origin`. Through 0.1.7: Shipshape install with Articles reaching Bonny's live prompt, model-gated greeting and fitting-out steer both operator-owned assets (`assets/greeting.md`, `assets/steer.md`), `estelle.json` per-seat models bound on both launch seams with pi default winning when unrecorded, and pi command pass-through. Harbour clean at last scan: 76 planks, zero stale, both tiers green.
- Upstream `dmytri/shipshape` is at plugin 0.8.x, vendor-neutral open-plugin; the old qm-entry-guard block on window-isolated subagents is lifted, so the crew run as isolated subagents cleanly this runtime.
- Next: the three arcs above. Start point is Captain's call.
- Watch items: Misson character detail welcome anytime.
