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

## Upstream field report: qm-entry-guard blocks subagent QM, 2026-07-03

For relay to the upstream Shipshape maintainer. Observed live at plugin **0.7.0** (auto-updated from 0.4.0 mid-voyage). Field report plus open design questions, not a settled proposal. Two of our earlier proposals (dispatch guard, entry guard) are already live upstream and enforcing on the Captain — the dispatch guard refused an over-long Boatswain dispatch this session, and the entry guard produced the block below.

### What happened

- This Claude Code session operates as Captain; it invoked `/captain` twice (transcript lines ~139, ~425).
- I dispatched QM as an Agent-tool **subagent** (`shipshape:qm`), as all voyage.
- `qm-entry-guard.sh` (0.7.0) read THIS session's transcript, detected the `/captain` markers, and refused QM. QM touched nothing, ran no verification, and correctly declined to circumvent by spawning further.
- Earlier QM subagent cycles in this same session (under 0.4.0) **succeeded**. The guard is new or newly strict at 0.7.0.

### Why the block is correct (the leak it closes)

- An Agent-tool subagent gets a **fresh context window** (does not inherit the parent conversation) but **shares the parent session's transcript `.jsonl` on disk**, which is **Bash-readable**. A subagent could `cat`/`grep` the transcript and exfiltrate the entire Captain narrative.
- So **context-window isolation is not session isolation.** Treating "any agent whose session transcript carries `/captain`" as contaminated is the conservative, correct choice for a firewall whose threat model already includes Bash side-channels (the same reason `.rgignore` excludes `CAPTAIN.md`).
- Net invariant: **true QM isolation requires a fresh transcript (a new session), not merely a fresh context window.** A subagent of a Captain session does not qualify.

### Tensions upstream must reconcile

1. **Doctrine vs guard on the same-session `/clear` flow.** The QM skill says "clear context, then `/qm`." But the transcript `.jsonl` **accumulates across `/clear`** — context clears, the file does not. So:
   - If the guard greps `/captain` anywhere in the transcript, it **blocks the documented `/captain` → `/clear` → `/qm` same-session flow** — the guard contradicts the doctrine.
   - If it scopes detection to markers **after the most recent clear boundary**, the same-session flow passes, but a post-clear QM can still Bash-read the pre-clear transcript, so the hole only closes if `/clear` also rotates/segments the transcript file.
   - Upstream must decide and document which invariant holds; the two readings give opposite operational guidance.
2. **Runtime-dependent behaviour.** On a runtime with genuine fresh sessions (pi `ctx.newSession()`, which Estelle's Layer-2 live crew uses) each agent gets its own transcript and the guard passes naturally. On Claude Code a subagent shares the transcript and the guard blocks. The doctrine's "if the runtime provides automatic context clearing" must specify **fresh-transcript**, not merely fresh-context-window, or it over-promises isolation where clearing does not rotate the transcript.
3. **Version/workflow break.** Subagent-dispatched QM worked at 0.4.0, blocked at 0.7.0. If intended, this is a **breaking change to the subagent-driven operating model** and deserves a changelog callout plus per-harness migration guidance.

### Recommended resolution (my read, for the maintainer to weigh)

- **Keep the guard strict.** Do NOT relax it to accept fresh-context subagents; the transcript is Bash-readable, so relaxing reopens the hole.
- **State the invariant explicitly** in the QM skill and workflow docs: the isolation unit is the **session/transcript**, not the context window; a subagent of a Captain session is not clean context.
- **Give a per-harness operating recipe.** Claude Code: run `/qm` in a **new session** with the thin dispatch (role, base commit, watchbill pointer); never spawn QM as a subagent of Captain. pi/Estelle: `ctx.newSession()` yields a fresh transcript and passes.
- **Resolve the `/clear` question** by either (a) requiring a fresh SESSION for QM and dropping "clear context, then `/qm`" in favour of "new session" (simpler, closes the hole unconditionally), or (b) making `/clear` rotate the transcript AND scoping the guard to the post-clear segment (preserves the ergonomic same-session flow, needs runtime transcript-segmentation support).
- **Add a firewall conformance test** (proposal #7 applied to itself): assert the guard blocks a QM subagent of a Captain session, and passes QM in a fresh session. Makes the behaviour falsifiable so a future version cannot silently regress it.

### Interaction with the `.rgignore` firewall just landed

- `.rgignore` excludes `CAPTAIN.md` from `rg` — closes the "crew greps the notes file" leak.
- The transcript guard closes a **different** surface: the session `.jsonl` holds the Captain narrative **regardless of `CAPTAIN.md`**, so hiding the notes file does not protect it. Both defenses are needed.
- Open question: should the session transcript path also be added to search-exclusion artifacts by construction? The guard is stronger (prevents crew execution entirely), so likely sufficient, but the transcript remains a distinct, knowable, Bash-readable leak surface worth naming in the threat model.

### Estelle-side consequence (already aligned)

Validates the decided Layer-2 design: the live crew MUST run in genuine fresh pi sessions via `ctx.newSession()`, never subagents sharing a transcript. What blocked the Captain here is exactly the invariant Estelle-on-pi already commits to; the guard is what makes Estelle's isolation claim mechanical rather than honour-system.

### Immediate operational impact here

The greeting-asset cycle (base `fcacef3`, watchbill `watch1`) is pending a **fresh-session QM**. Deck is clean and idle; nothing broken. Until QM runs in a clean session, no cycle can advance in this Captain session.

## Slice 2: fitting out and seat models, in flight

Operator decisions, 2026-07-02:

- **Greeting is model-voiced, gated on an active model.** Bonny greets first, in character, as soon as `/login` and `/model` make a model available; a session with no active model presents fitting-out guidance naming `/login` and `/model`. No banner requirement. `pi-greeter` evaluated and skipped: it is a static startup dashboard (session and model menus), not a voice; it would compete with Bonny's stage.
- **Per-seat models move to `estelle.json` in the operator's agent directory** (pi `CONFIG_DIR_NAME` idiom). Existing `Estelle config sets the <seat> model to` vocabulary retained and now file-backed. New scenarios: recorded model lands in the file, recording one seat preserves the others (merge-not-clobber), a recorded model is used at launch (forces the read path, anti-stale-green). Shipped `assets/seat-models.json` struck; a seat with no recorded model rides the operator's pi default model. Never force a default seat model; operator pi config wins.
- Landed across `95845d0` (greeting, steer, estelle.json seat models, pi-default contract) and `2ffe0de` (the started session binds recorded models: Boatswain caught `run()` never reading `estelle.json`, the same `launch()`/`run()` divergence class as the TUI and built-ins bugs; specced, red, fixed, green). Shipping as 0.1.4 this pass. One stale plank (`beginTurn`, deepseek step text struck in the respec) survived the cycle's audit; Boatswain removes it as a hygiene edit with release prep.
- **Skill-conflict startup noise is plain pi, not Estelle.** Reproduced with bare `pi` from `$HOME`: project scope (`$cwd/.agents/skills`) equals user scope when cwd is home, so every skill collides with itself. Courtesy report upstream to pi: identical resolved paths should not register as collisions. No Estelle machinery.

## Harbour inventory, 2026-07-03

Shipwright full scan at `b8cff6c` came back clean: 75 planks all mapping, zero stale, zero orphans, full coverage, no hidden-behaviour or verification-seam violations. Two refit gaps closed and now Captain-committed: `RIGGING.md` gained the `plank-inventory` command (`rg -n "@planks\(" src bin`, no native docblock tooling), and `.rgignore` created carrying `CAPTAIN.md` so the notes leave crew-visible `rg` search by construction. That is the firewall-by-construction fix from the upstream proposals, landed locally.

One `@captain` finding, resolved with the operator:

- **Greeting copy is operator-owned content.** The ready greeting was a hardcoded string in `src/index.ts`. Operator 2026-07-03: keep the fixed string (not model-voiced; the per-launch turn cost is not worth it), but move the copy to an asset and fix it. Scenario promoted (asset-sourced ready greeting, test-controlled content so a hardcoded string cannot pass). Asset `assets/greeting.md` authored with the corrected line: dropped "What are we building today?" (mixes a construction metaphor into the nautical voice) for "What's on your mind today?". Crew wired production to read the greeting asset. Shipped 0.1.6 (`98193a0` production + step, `a1e5efb` watchbill strike + bump); published-tarball PTY boot check confirmed the installed package boots pi as Bonny with the estelle extension and the ready greeting read from the packaged asset.

## Fitting-out steer is operator-owned content too, 2026-07-03

Harbour scan after 0.1.6 (Shipwright, clean: 76 planks, zero stale, both tiers green) surfaced one `@captain` finding: the unfitted-session steer was still a hardcoded string at `src/index.ts:345` while its sibling ready greeting now reads from an asset. Operator reversed the earlier "steer stays inline" call and promoted it for symmetry. Decision, mine on a 60s no-answer to the reconciliation question: fully operator-owned, mirror the ready greeting exactly. The old `presents fitting-out guidance naming "/login" and "/model"` scenario is struck; naming the commands is now asset craft, not a production guarantee. New binding scenario `Bonny's fitting-out steer is operator-owned content` (asset-sourced, test-controlled). Asset `assets/steer.md` authored with the current shipped copy. Crew wires the unfitted branch of `openWithBonnyVoice` to read `assetsDir(cwd)/steer.md`, parallel to `greeting.md`. Watchbill `watch1` selects the one scenario. Ship as 0.1.7. Confirm with operator whether the fully-operator-owned reading was right, since the reconciliation question went unanswered.

## pi command pass-through, shipping as 0.1.5

Operator direction 2026-07-03: `estelle` passes normal pi commands through to pi; bare `estelle` boots Bonny, arguments delegate to pi (`run({argv})` hands package commands to pi's exported CLI, never reimplementing). Landed `f28ba9f`: both @sandbox scenarios red then green, verification drives the real bin as a child process with a disposable `PI_CODING_AGENT_DIR`. Bin stays the thin Captain-owned wrapper.

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

- Shipped: `@dk/estelle@0.1.6` on npm, `main` in sync with `origin`. Prior: 0.1.3 (Shipshape install + Articles to Bonny's prompt), 0.1.4 (model-gated greeting, fitting-out steer, `estelle.json` per-seat models on both seams, pi default wins when unrecorded), 0.1.5 (pi command pass-through), 0.1.6 (ready greeting reads operator-owned `assets/greeting.md`).
- Shipped 0.1.7: fitting-out steer reads operator-owned `assets/steer.md` (`c66a69f` steps + production, `cdbd51e` watchbill strike + bump). Published-tarball boot check confirmed both paths on the installed package: ready greeting from `greeting.md`, unfitted steer from `steer.md`.
- Next: harbour cleanup of the stale trace left by striking the `presents fitting-out guidance naming "/login" and "/model"` scenario: stale `@planks` at `src/index.ts:335` (Shipwright) and orphaned step def `the started session presents fitting-out guidance naming {string} and {string}` at `features/steps/greeting.steps.ts` (Boatswain hygiene). Source-only, not in the published artifact, so no re-ship needed. Then trim this file's resolved history to git during the lull.
- Watch items: firewall grep leak (a runtime gate should exclude `CAPTAIN.md` by construction; see upstream proposals); Misson character detail welcome anytime.
