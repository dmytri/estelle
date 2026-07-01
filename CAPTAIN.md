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
- Iteration 2 (commit `1b074ae`): seat models default from `assets/seat-models.json`, operator config override, character-card injection into each seat's system prompt, operator-delivery-failure recording.
- Iteration 3 (commit `d50085a`): per-name seat commands and aliases (`/bonny` and `/captain`; `/misson`, `/quartermaster`, `/qm`; `/bellamy` and `/boatswain`; `/johnson` and `/shipwright`; `/crew`), plus composed seat instructions (upstream role skill body and character card, identifying both character and role), verified without vendoring.
- Housekeeping this pass: biome `rules.recommended` deprecation cleared (`93b651c`); AGENTS.md shadow-spec sections trimmed, behaviour now lives in specs and code (`8d12031`).
- Also earlier: five character cards in Shipshape Controlled English; Bosun to Boatswain rename here and upstream; build-config debt cleared (`dd9982e`).
- Iteration 4 (commit `f5ef8da`): seat-model fallback and unavailable-report; built-in skills `update-config` and `find-skills` shipped; operator-requested skill authoring (`createSkill`); house-rules append addressing the operator as "Commodore" on every seat; `@sandbox` skill install (`dmytri/shipshape`) and extension install (`npm:pi-web-access`, `/websearch`). Fresh-workspace install scenarios launch with a disposable empty agent dir, so an installed skill is proven absent before install. `watchbill.json` removed after the batch landed.
- Suite: 43 scenarios green across `@logic` and `@sandbox`. typecheck and lint green. Repo public at `dmytri/estelle`; old version archived at `dmytri/estelle-old`. Not published to npm.

## In flight

- **Runnable package, iteration 5, landed.** The three seam scenarios (`bd7344c`) plus the packed-artifact scenario (`063f813`) are green. The `estelle` bin and `build` script boot Bonny from an assetless directory on `opencode-go/deepseek-v4-flash` with the extension loaded, and the packed tarball ships its runtime while withholding Captain notes.
- **Packaging gap closed.** The earlier `npm pack --dry-run` leak (tarball excluded `dist/`, shipped `CAPTAIN.md` and dev files) is fixed. `The published package ships its runtime and withholds Captain notes` in `features/runnable-package.feature` asserts the packed tarball includes `dist/index.js`, `bin/estelle.js`, and a shipped asset, and withholds `CAPTAIN.md` and `src/index.ts`. Crew landed the fix as a `files: ["dist","bin","assets"]` allowlist in `package.json`; the allowlist is the clean seam that auto-excludes everything else.
- **Publish blocked: the compiled artifact does not boot.** The manual outbound boot check (build, pack, install the tarball into a fresh operator dir, run it) failed with `ERR_PACKAGE_PATH_NOT_EXPORTED` on `@earendil-works/pi-coding-agent`. pi is ESM-only: its `exports` map defines `".": { "import": "./dist/index.js" }` with no `require` condition. Estelle builds to CommonJS (`tsc --module commonjs`), so tsc downlevels `await import("@earendil-works/pi-coding-agent")` into `require(...)`, which pi's exports map rejects. The `@logic` suite missed it because the launch scenarios boot `src` via tsx as real ESM, and the packed-artifact scenario checked only the file list, not that the compiled `dist` boots.
- **Decision: spec the compiled-artifact boot, then fix the build, then publish.** New `@logic` scenario `The built package boots pi as the Captain Bonny` in `features/runnable-package.feature` boots the compiled `dist` from an assetless directory and asserts the active seat is Bonny with the `estelle` extension loaded. This turns the manual boot check into an executable gate, closing the src-only blind spot the same way the file-list scenario closed the pack blind spot. `watchbill.json` watch1 focuses it for the next `/qm` cycle. The fix is Crew production build config: emit ESM so the compiled `import()` matches pi's `import` export, rather than a downlevelled `require()`. Mechanism is Crew's craft; the scenario asserts only the observable boot. Publish stays held until this scenario is green and the manual boot check passes; then bump `version` to `0.1.0`, build, publish `--access public`. npm auth present as `dk`.
- **Cycle 1 outcome, emit-ESM confirmed.** The `/qm` cycle made the scenario executable and green, and Crew booted the artifact. Crew's first mechanism, `--module node16`, kept CJS output and needed `with { "resolution-mode": "import" }` on the type-only pi import. That booted (typecheck and all 48 scenarios green) but tripped biome `noTypeOnlyImportAttributes`, so Boatswain held the commit on red lint. Operator ruled: keep lint strict, emit ESM instead of relaxing the rule. The `node16` attempt is superseded. Next cycle: `package.json` gains `"type": "module"` and builds with `--module nodenext`, and the resolution-mode attribute is dropped. The `bin/estelle.js` `require`-to-`import` fix is Captain outbound work, not Crew, per the packaging split below. The constraint set forces this mechanism: the boot scenario stays green, `biome.json` stays out of Crew's write scope, and no correctness rule is suppressed, so the only clean production path is ESM output. Deck reset to the last commit so the next `/qm` re-drives from a clean base; watch1 retained.
- Decisions this batch:
  - **Asset home is the package, not the operator directory.** For a published `npx` run the operator's working directory carries no Estelle assets, so Estelle MUST resolve its shipped assets (`assets/characters`, `assets/skills`, `assets/seat-models.json`, `assets/system-prompt.md`) from the installed package. Shape: `launch` gains an `assetsDir` option that defaults to the package's shipped assets home; `cwd` stays the operator's working directory for their files, custody scope, and installed packages. The three new scenarios boot from a directory that carries no Estelle assets and still come up as Bonny on the default model with the extension loaded.
  - **Verification is packaging-seams-only, `@logic`.** The bin entry, the built output, package-relative asset resolution, and boot-as-Bonny are verified locally. The live published boot is the manual outbound check per the RIGGING Outbound policy. The interactive pi TUI handoff is the DIY wrapper; it is exercised by the outbound boot, not a scenario.
  - **Publish all the way.** `npm publish --access public` for the scoped `@dk/estelle`. Needs npm auth for the `@dk` scope in the environment; if absent, outbound blocks for the operator to authenticate. Bump `version` off `0.0.0` at outbound. Recorded the build and publish commands in RIGGING Outbound.
  - **Packaging config split by coverage.** The `main`, `files`, and `build` script in `package.json`, and the `dist` emit config (module type), are Crew production, spec-covered by `The built package boots pi as the Captain Bonny`, so RIGGING `implementation` now lists `package.json`. The `bin` entry launch is not `@logic`-spec-covered (only presence and shebang are); its real launch is the manual outbound boot check, so `bin/estelle.js` stays Captain-owned and I fix its `require`-to-`import` at outbound prep. Operator rule, 2026-07-01: widen Crew scope only for work a falsifiable spec covers; outbound-only-covered work stays Captain-owned.

## Architecture decided

- **Orchestration on pi directly, no `pi-subagents`.** Context-isolated agents are a pi primitive (a separate `pi` process per agent, or in-process SDK sessions). `pi-subagents` only adds generic orchestration polish with its own opinions. Estelle's model is specific (Bonny the sole voice, Shipshape seats with custody, the "ship it" batch loop, the live crew), so we build the orchestration on pi for full control.
- **One architecture, incremental layers, no throwaway.** Layer 1 (foundation): the single-session extension and launcher: seat commands, composed role-plus-card instructions, custody, models, booting the pi TUI as Bonny. Layer 2 (live crew): background context-isolated seats whose output surfaces to the operator and into Bonny's context, a one-way firewall, the ship-it batch loop. Layer 2 is additive on Layer 1.

## AGENTS.md boundary, decided

AGENTS.md holds working agreements, setup, and release process only: the Shipshape pointer, the `npx skills` install, No vendoring (a project agreement), Outbound verification. Product behaviour belongs in verified `.feature` specs. Implementation mechanism (pi API calls such as `ModelRegistry.find`, `before_agent_start`, `registerCommand`) belongs in code, never in prose and never named in a step; steps assert observables, not a pi method name. The pi project-trust gate is not an AGENTS.md section: the harness caveat lives in RIGGING known-false-failure-modes, and the published-artifact check lives in the Outbound policy.

## What is not built yet

- **The runnable package: specced now, see In flight.** Layer 1 needs the `bin`/`main`/build and the `npm publish`. Specced this pass in `features/runnable-package.feature` and in the next `/qm` cycle. First milestone target: published `npx @dk/estelle` booting pi as Bonny with the seats, on `opencode-go/deepseek-v4-flash`, for manual testing. The published-package boot is verified by running it (RIGGING outbound policy); the @logic suite verifies the seams.
- **The live crew (Layer 2):** background seats, output routing to Bonny, the batch loop. Built on pi directly, after Layer 1 is in the operator's hands.

## Self-managing Estelle, future arc, captured this session

Operator wants Estelle to manage its own capability surface, not only boot preconfigured. Scope discovered this session:

- Self-configure: ensure provider auth, models, and pi settings are ready so a seat's model resolves, whatever the host preconfigured. exe.dev is the live example.
- Unavailable model: fall back to an available model, warn naming the bad id, offer to fix. Fall-back and warn are specced in `features/seat-model-fallback.feature`. Offer-to-fix is the self-config skill below.
- Install other pi extensions.
- Install upstream skills, the `npx skills` path already in use.
- Create skills, author new skills in the workspace.

Shape follows the decided posture. Mechanical seams live in the Estelle extension: detect an unavailable model, fall back, surface the warning, perform an install or a write. Judgement lives in a built-in skill Bonny reads: how to configure and extend Estelle, walking the operator through the fix. Bonny is the only operator-facing voice, so warnings and offers surface through Bonny.

Decided this session:

- Config knowledge home: both. Mechanical fixes (fall back, warn, write) live in the extension; a shipped `update-config` skill composed into Bonny's instructions carries the judgement to walk the operator through a fix. Named by function with no redundant `estelle-` prefix, the same way Claude Code's built-in is `update-config` not `claude-config`, and the same way the seat skills are `captain` and `qm`. Specced in `features/built-in-skills.feature`. The skill body models on Claude Code's `update-config` skill: read current config before writing, merge rather than replace, clarify ambiguous scope with the operator, carry a reference for Estelle's config surface (seat models, operator config, provider setup, extension and skill install, skill authoring), and confirm each change. Body authored this session at `assets/skills/update-config/SKILL.md`. Decided: Estelle's own skills are Captain-owned assets under `assets/`, the same class as `assets/characters/`. The body carries craft and judgement only. Any behaviour that must be guaranteed is promoted to a `.feature` scenario, so the asset never becomes a shadow spec. This is distinct from operator-requested skills, which the create-skill seam writes into the operator's workspace at runtime, not into Estelle's shipped assets. Naming holds for every Estelle built-in: no redundant `estelle-` prefix. Skills are function-named (`update-config`; a skill-management skill mirrors Claude Code's `find-skills`), and feature files are behaviour-named (`built-in-skills`, `skill-authoring`, `skill-installation`, `extension-install`), matching the existing `seat-*` and `crew-naming` files.
- Install tier: provision `@sandbox` now. Tier defined in `RIGGING.md`. Install scenarios run in a namespaced temporary workspace with idempotent teardown, network allowed, no secret credentials.
- Create-skill: operator-requested workspace skill. Specced in `features/skill-authoring.feature` with the concrete example skill `harbour-report`. The authoring capability models on Claude Code's skill format and conventions: a `SKILL.md` with frontmatter (name, description as the trigger, when-to-use) and a concise progressively-disclosed body; the created skill loads through the same resource path as the upstream skills. Skill install (watch5) draws on the discover-and-install pattern of Claude Code's `find-skills`.

Specced this session and ordered in `watchbill.json`:

- `features/built-in-skills.feature`, @logic, watch3: ships the `update-config` and `find-skills` built-in skills so each appears in the pi skills listing. Presence only, not composition, because pi lists skills for on-demand reading. Bodies authored at `assets/skills/update-config/SKILL.md` and `assets/skills/find-skills/SKILL.md`.
- `features/skill-authoring.feature`, @logic, watch4: operator asks Estelle to create the `harbour-report` skill, it loads.
- `features/skill-installation.feature`, @sandbox, watch5: Estelle installs `dmytri/shipshape`, its `captain` skill loads. Needs the sandbox harness stood up.

Extension install anchored and specced:

- `features/extension-install.feature`, @sandbox, watch6: Estelle installs `npm:pi-web-access`; its `/websearch` command becomes present. Real package at pi.dev/packages/pi-web-access, installs via `pi install npm:pi-web-access`, the same packages mechanism as `npm:pi-shipshape` in pi settings.

## System prompt layer and operator address, decided

pi builds the system prompt from a base template plus a first-class persistent append (`appendSystemPrompt` SDK option, or a shipped `.pi/APPEND_SYSTEM.md`), plus project context files (`AGENTS.md`/`CLAUDE.md`), plus a skills listing. The persistent append holds every turn, unlike the per-turn `before_agent_start` hook the character cards use. Cards stay on the hook because they are per-seat and the active seat changes at runtime. House rules are session-wide and static, so they belong on the append.

Decided: Estelle ships a house-rules preamble as the Captain-owned asset `assets/system-prompt.md`, wired into every seat through pi's persistent append. First rule: every hand, Bonny included, addresses the operator as "Commodore" and refers to them as "Commodore", honouring a different form only when the Commodore asks. The utterance is honour-system voice; the enforceable slice is delivery, specced by example in `features/system-prompt.feature` (watch7): a seat's system prompt addresses the operator as "Commodore". No bespoke word-level feature.

pi surfaces skills as a listing the model reads on demand, not as injected bodies. So a built-in skill spec asserts presence in the listing, not composition into a seat. Estelle's own composition of the role skill body plus character card into a seat, `seatInstructions`, is separate and stays for seat identity.

## Stale-green perturbation dagger, captured 2026-07-01

Idea, operator-proposed. A manual mutation probe against stale-green, the weakness Article 10 names but arms nobody against. Plant the exact dagger as the first statement of a suspected-stale-green production seam:

```js
throw new Error("PERTURBATION: stale-green challenge; consider current Gherkin step and Rule context; remove when fixed");
```

Rebuild if the seam compiles, run the relevant scenarios. A genuine scenario goes red. A scenario that stays green never reached the seam, so it is stale-green. The message is self-explanatory, so it crosses the firewall as its own briefing; QM, Crew, and Boatswain need no separate note.

- **Custody.** Planting the dagger is the sole exception to Captain production-code custody. Nothing else in production is Captain-writable.
- **Two guards for upstream.** QM confirms every `PERTURBATION` dagger yields a scenario failure; a green-despite-dagger is a stale-green blocker back to Captain to strengthen the scenario. Boatswain treats a live dagger as a foul deck and never commits it.
- **Caveat.** It proves the seam is reached, not that the scenario asserts anything about the seam's output. Reachability, not assertion strength.
- **Placement discipline.** Use it post-fix on a green I distrust. A pre-fix dagger masks the real red and tangles the probe with the actual fix, as it would have this ESM cycle.
- **Estelle enforcement home.** Natural future Estelle feature: a narrow `perturb` tool exposed through the custody gate (`evaluateWrite`), so the Captain still cannot otherwise write production code and every plant is an auditable call. Pure custody, Estelle's charter. Future iteration, specced by a scenario, not this publish cycle.
- **Interim rule, operator 2026-07-01.** Until this is upstreamed into Shipshape, I MAY use the dagger, and I tell the operator first before planting one.

## Open items for the operator

- **Operator-config persistence, and merge-not-clobber, deferred.** The self-config "offer to fix" writes a corrected model into operator config. That write must preserve other seats' settings. Speccing this now presupposes a persisted operator-config-write seam that Estelle has not defined; today "operator config" is the in-memory `setSeatModel` dict, so a custody scenario would be trivial or get ahead of undefined machinery. Spec operator-config persistence first, then the merge-not-clobber custody scenario against it. Vocabulary note: align on the existing `Estelle config sets the <seat> model to` phrasing, do not introduce `operator config sets ...`.
- **Install-skill sandbox anchor, resolved.** `features/skill-installation.feature` installs `dmytri/shipshape` and asserts the `captain` skill loads. The fresh-workspace launch takes a disposable empty agent dir (`LaunchOptions.agentDir`), so `captain` is genuinely absent until the install brings it. The non-core anchor is unnecessary; isolation proves absence.
- **Firewall grep leak, watch.** This cycle the Quartermaster reported a broad `grep` surfaced `CAPTAIN.md` during discovery. They excluded it and worked from the specs and their own probes. The firewall held by role discipline, not tooling. If a runtime gate is built later, exclude `CAPTAIN.md` from crew-visible search by construction.
- **Unknown seat-model id: decided, fall back and warn and offer to fix.** A configured id pi's registry does not know falls back to an available model, warns naming the unavailable id, and offers to fix. Fall-back and warn are delivered in `features/seat-model-fallback.feature`. Offer-to-fix belongs to the self-managing arc below.
- Model defaults are the cheapest model per seat (`opencode-go/deepseek-v4-flash`). Operator wants cheap-and-easy; the pinned id stays because it is deterministic and testable, unlike "whatever the provider defaults to". Per-seat model taste is a later pass.
- Git identity set to `Dmytri Kleiner <dev@dmytri.to>`; the seven local commits ahead of origin were amended to it. Clean for push.
- Pass-two character detail captured. Misson is now protective-pedantic; deeper detail welcome anytime.
