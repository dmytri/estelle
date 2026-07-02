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

## The four-layer stack, operator direction 2026-07-02

Proven live: this very development session runs the Shipshape open plugin on Claude Code (session hooks raised the RIGGING fail-fast blocker, role subagents held the firewall). The stack:

1. **Skills** (upstream `dmytri/shipshape`): canonical doctrine, 100% portable and complete alone. Skill-only agents run full Shipshape; discipline is theirs. No higher layer adds doctrine.
2. **Open plugin** (upstream `dmytri/shipshape`): mechanical enforcement limited to the **safe intersection of what all supported agents deliver reliably and identically**. No per-runtime maximalism, no graceful degradation; a guarantee that is not uniformly real is not claimed at this layer. Anything Claude-Code-only migrates down to unsupported or up to a flagship layer; that scoping is an upstream voyage.
3. **`pi-vercel-plugin-shim`** (this repo): generic pi extension consuming the open-plugin format (plugin.json, skills/ commands/ agents/ hooks/ to pi resources, registerCommand, events). Zero Shipshape or Estelle opinion; runs any plugin in the format. Conformance target is exactly the layer-2 intersection. No published format spec exists; extract the boundary from Estelle's working seam, do not guess.
4. **`@dk/estelle`** (this repo, flagship): seats and personas, Bonny as sole voice, fitting out, per-seat models, and enforcement beyond the intersection: real context isolation via fresh pi sessions, seat-scoped custody, opinionated config and UX. Stays a good pi citizen; any pi extension works alongside.

**Monorepo, operator 2026-07-02.** The shim and `pi-shipshape` (Shipshape's plugin delivered to plain pi users through the shim) live in this repo, published independently to the pi directory with links back to Estelle. Estelle-first scope: built to what Estelle needs, others welcome, no speculative generality. Consequences when the shim materializes: `packages/` layout, per-package RIGGING and outbound values. Estelle's hand-rolled custody (`evaluateWrite`/`evaluateRead`) migrates down to plugin-through-shim over time; Estelle keeps only what is beyond the plugin's reach.

Build order: Slice 1 (below, in flight), Slice 2 fitting out, then the shim against the proven seam, then Estelle refactors onto it.

## The loop, decided

Bonny is always-on and the only seat the operator speaks with. The operator gives the word ("ship it") to seal a batch. Estelle freezes the batch, clears context, and runs the crew (QM, Crew, Boatswain) as a live show the operator watches while Bonny stays alongside; new intent queues as the next batch. Visibility is asymmetric: crew output is operator-visible read-only; the operator's words reach only Bonny; the crew work from durable artifacts. Layer 2 of the architecture (live crew) builds this on pi directly, no `pi-subagents`: context-isolated pi sessions, one-way firewall, output routed to Bonny. Additive on the shipped single-session foundation, after fitting out.

## Slice 1: Bonny is actually the Captain, shipping as 0.1.3

Live Estelle loaded only the character card; no Shipshape skills, no Articles. Both root causes proven (perturbation dagger showed `seatInstructions` orphaned from the live prompt; role skills present only via host-leak, never installed) and fixed:

- `seatSystemPrompt` composes base + house rules + upstream role skill body (resource-loader `skillPaths`) + character card on both `launch()` and `run()` paths; dead `seatInstructions` seam removed (`61d30e4`).
- `ensureShipshapePackage` installs `https://github.com/dmytri/shipshape` via pi's `DefaultPackageManager.installAndPersist` (user-scope) before resource loading when the exact source is not persisted; pi auto-loads it on later launches (`61d30e4`, exact-source idempotence `5bbc6c1` after Boatswain flagged the substring match would let the stale `npm:pi-shipshape` suppress the install). The external `skills` CLI is off-design; `AGENTS.md` corrected.
- Suite 55/55 green across both tiers; verification honesty fix landed with it (persistence assert is exact-entry, not substring).

Outbound this pass: bump 0.1.3, build, PTY boot check that the Articles reach Bonny's live prompt, publish `--access public`, push. Standing operator approval.

## Upstream proposals: firewall hardening, to review with the operator

Live leak inventory from this voyage: the dispatch prompt (Captain-authored channel through the firewall; I carried craft notes), the disk side channel (one QM `grep` surfaced `CAPTAIN.md`; held by discipline), and honour-system self-reports. Proposals for `dmytri/shipshape`, layered:

1. **Dispatch contract (skills).** Define what a role dispatch MAY contain: role + base commit + nothing else; the durable artifacts are the hand-off. Craft notes, seams, and expected failure modes are contamination even when labelled tooling facts.
2. **Contamination protocol (skills).** Abort-on-sight, not exclude-and-continue: Captain content entering an internal role's context mid-run means stop, report contamination, fresh re-dispatch.
3. **Frozen sentinel (plugin).** Freeze the exact `CAPTAIN.md` STOP-banner string in the template so hooks can grep for it.
4. **Dispatch guard at spawn (plugin).** Pre-tool hook on subagent dispatch: sentinel in the outgoing prompt blocks; a length cap for internal-role dispatches mechanizes the thin-dispatch rule.
5. **Output sentinel scan (plugin).** Post-tool hook greps tool output for the sentinel and returns a contamination directive; closes the broad-Bash side channel the per-file guard misses.
6. **Exclude by construction (fitting out).** Shipwright scaffolds `.rgignore`/`.ignore` carrying `CAPTAIN.md`; ripgrep-based search skips it by default. Cheapest, highest-value single change.
7. **Firewall conformance tests (plugin repo).** Article 10 applied to itself: tests spawn a role agent, attempt each leak path (Read, Bash cat, broad grep, fat dispatch), assert each is blocked. Today the firewall is a claim; nothing reddens when a hook regresses.

Intersection rule applies: each mechanism ships at layer 2 only if every supported runtime delivers it identically; the rest is flagship-layer (Estelle on pi: fresh sessions and `CAPTAIN.md` outside crew-visible filesystem by construction). Held structural option: move `CAPTAIN.md` out of the worktree; trades repo durability, `.rgignore` buys most of it.

**Adopted immediately here: thin dispatches.** From the next cycle, my role dispatches carry role + base commit + watchbill pointer only; QM pays the honest rediscovery cost.

## Slice 2: fitting out and seat models, in flight

Operator decisions, 2026-07-02:

- **Greeting is model-voiced, gated on an active model.** Bonny greets first, in character, as soon as `/login` and `/model` make a model available; a session with no active model presents fitting-out guidance naming `/login` and `/model`. No banner requirement. `pi-greeter` evaluated and skipped: it is a static startup dashboard (session and model menus), not a voice; it would compete with Bonny's stage.
- **Per-seat models move to `estelle.json` in the operator's agent directory** (pi `CONFIG_DIR_NAME` idiom). Existing `Estelle config sets the <seat> model to` vocabulary retained and now file-backed. New scenarios: recorded model lands in the file, recording one seat preserves the others (merge-not-clobber), a recorded model is used at launch (forces the read path, anti-stale-green). Shipped `assets/seat-models.json` struck; a seat with no recorded model rides the operator's pi default model. Never force a default seat model; operator pi config wins.
- Specced in `features/greeting.feature`, `features/seat-model-defaults.feature`, `features/seat-model-selection.feature`; `features/seat-model-fallback.feature` survives unchanged (fallback target is now an available model, steps already say so). `runnable-package` scenario "booted Captain runs on the shipped default model" struck with the shipped default. Watchbill orders greeting first, then the seat-model batch. Expect the hand-off deck red on seat-model scenarios: the asset is gone and the contract changed; that red is the discovered work.
- **Skill-conflict startup noise is plain pi, not Estelle.** Reproduced with bare `pi` from `$HOME`: project scope (`$cwd/.agents/skills`) equals user scope when cwd is home, so every skill collides with itself. Courtesy report upstream to pi: identical resolved paths should not register as collisions. No Estelle machinery.

## Workspace model: the harbour, operator direction 2026-07-02

Estelle's launch directory is a harbour, not a project. Captured for the next arc, not yet specced:

- Starting Estelle in `$HOME` or any non-project parent MUST fit out Estelle (global), never assume the directory is a project.
- Several repos berth under the workspace at once. Bonny infers from operator intent which repo the conversation is about, whether an existing repo under the harbour or a new one to create, and whether that repo needs project fitting (Shipwright rigging). Project fitting happens during discovery, when intent starts flowing, not at launch.
- Mechanical successors this implies: repo discovery under the workspace (git dirs), per-repo fitting-state derivation (RIGGING.md presence), and per-repo custody scoping (today `evaluateWrite` computes paths relative to one cwd; with berthed repos, custody paths like `src/**` bind per target repo). The inference itself is judgement and lives in Bonny's skill layer, not the extension.
- Spec alongside the live-crew Layer 2 machinery; the custody rescoping is the first mechanical slice.

## Next arcs, captured not specced

- **The shim and `pi-shipshape` packages**, per the stack section above.
- **Perturb as product.** A narrow `perturb` tool through the custody gate so every Captain dagger is an auditable call. Future iteration, specced by scenario.

## Design pointers (pi)

- Custody gates: `tool_call` returns `{ block: true, reason }`; seat commands: `pi.registerCommand`; per-seat model: `before_provider_request` + `model_select`; per-seat toolset: `setActiveTools`.
- Interactive: `createAgentSessionRuntime` + `InteractiveMode.run()` per pi sdk.md; persistent storage comes from `createAgentSessionServices` (`auth.json`, `models.json`, sessions under agentDir).
- Context firewall (live crew): `ctx.newSession()` for a genuine fresh context.
- Packages: `DefaultPackageManager.installAndPersist`; convention dirs (skills/ with SKILL.md folders) need no pi manifest.
- Extension config idiom: `CONFIG_DIR_NAME` for project-local, `~/.pi/agent/<name>.json` for global.

## Stale-green perturbation dagger, operative rule

Plant the RIGGING `fail-fast` statement as the first statement of a suspected stale-green production seam; run the relevant scenarios. Red proves the seam is reached; green-despite-dagger is stale-green evidence. Reachability, not assertion strength. Custody: the dagger is the sole Captain production-write exception; QM confirms every dagger reddens discovery; Boatswain never commits a live one. Use post-fix on a distrusted green, never pre-fix. Interim rule, operator 2026-07-01: I MAY use the dagger and I tell the operator before planting one. Proven in service 2026-07-02: exposed the orphaned `seatInstructions` seam.

## Status

- Shipped: `@dk/estelle@0.1.3` on npm, registry-verified: fresh-operator boot installs `dmytri/shipshape` itself (exact-source idempotence), the captain Articles reach Bonny's live prompt with card and house rules, interactive TUI, live seat commands, persistent auth/model/session storage. Operator confirmed live: Bonny loads with Shipshape skills.
- In flight: Slice 2 (greeting, fitting-out steer, `estelle.json` seat models).
- Watch items: firewall grep leak (a runtime gate should exclude `CAPTAIN.md` by construction; see upstream proposals); Misson character detail welcome anytime.
