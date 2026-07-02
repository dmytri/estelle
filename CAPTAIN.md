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

## Slice 1: Bonny is actually the Captain, in flight

Operator report: live Estelle loaded only the character card; no Shipshape skills, no Articles. Both root causes proven (perturbation dagger showed `seatInstructions` orphaned from the live prompt; role skills present only via host-leak, never installed) and fixed in commit `61d30e4`:

- `seatSystemPrompt` composes base + house rules + upstream role skill body (resource-loader `skillPaths`) + character card on both `launch()` and `run()` paths; dead `seatInstructions` seam removed.
- `ensureShipshapePackage` installs `https://github.com/dmytri/shipshape` via pi's `DefaultPackageManager.installAndPersist` (user-scope) before resource loading when not already persisted; pi auto-loads it on later launches. The external `skills` CLI is off-design; `AGENTS.md` corrected. The npm `pi-shipshape` is stale (0.1.15, "bosun"); git source is current.
- Suite 54/54 green after the cycle.

**Open before 0.1.3 ships:** Boatswain flagged the idempotence match as substring `"shipshape"`, so an operator holding the stale `npm:pi-shipshape` never receives `dmytri/shipshape` and seat prompts build from wrong or missing role skills. Specced this pass: exact-source persistence assertion plus the unrelated-package scenario in `features/skill-installation.feature`; `watchbill.json` focuses them. Second flag accepted as environment state, recorded in RIGGING known-false-failure-modes: on a host without a persisted shipshape package the first `@logic` run performs one real git clone.

Ship as `0.1.3` when green: bump, build, PTY boot check that the Articles reach Bonny's live prompt, publish `--access public`, push. Standing operator approval to commit and push.

## Next arcs, captured not specced

- **Slice 2, Estelle fitting out.** Global first-run onboarding, distinct from per-project fitting (Shipwright rigging). Friendly Bonny greeting when unfitted; providers and models via pi-native onboarding (`/login`, `/model`); per-seat models recorded in `~/.pi/agent/estelle.json` (pi `CONFIG_DIR_NAME` idiom), file presence is the fitted signal. Shipped `assets/seat-models.json` defaults go away; unfitted Estelle rides pi's `defaultModel`; the operator's pi config always wins (decided: never force a default seat model in the interactive path). Mechanical seams in the extension; judgement in the `update-config` skill Bonny reads.
- **The shim and `pi-shipshape` packages**, per the stack section above.
- **Operator-config persistence, merge-not-clobber.** Spec the persisted operator-config-write seam first (Slice 2 `estelle.json`), then the custody scenario that a seat-model write preserves other seats' settings. Vocabulary: keep `Estelle config sets the <seat> model to` phrasing.
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

- Shipped: `@dk/estelle@0.1.2` on npm (interactive TUI as Bonny, live seat commands, persistent auth/model/session storage, built-ins served from the package, createSkill with operator body, custody gates, crew naming, Commodore address). Suite green across `@logic` and `@sandbox`; repo `dmytri/estelle`.
- In flight: Slice 1 idempotence fix, then `0.1.3`.
- Watch items: firewall grep leak (QM excluded `CAPTAIN.md` by discipline; a runtime gate should exclude it by construction); Misson character detail welcome anytime.
