# Rigging

Project tooling values for Shipshape roles. Values only, not procedure.
Procedure lives in the skills. Every role reads this on open.

## Stack

- language: typescript
- runtime: node@20
- packageManager: pnpm

## Directories

- implementation: src
- implementation: bin
- implementation: package.json
- implementation: packages/*/src
- implementation: packages/*/index.ts
- implementation: packages/*/package.json
- specs: features
- specs: packages/*/features
- verification: features/steps
- verification: features/support
- verification: packages/*/features/steps
- verification: packages/*/features/support
- assets: assets
- assets: packages/*/assets
- scantlings: assets/scantlings/internal-api-shape.d.ts

## Commands

- discover: `pnpm exec cucumber-js --dry-run --tags "not @captain and not @eval and not @shipwright"`
- focused: `pnpm exec cucumber-js --tags "not @captain and not @shipwright" --name "{scenario}"`
- broad: `pnpm exec cucumber-js --fail-fast --tags "not @captain and not @eval and not @shipwright"`
- coverage: `pnpm exec c8 --reporter=text --reporter=json-summary --include='src/**' --include='bin/**' --include='packages/*/src/**' pnpm exec cucumber-js --fail-fast --tags "not @captain and not @eval and not @shipwright" --format json:coverage/weather.json`
- coverage-eval: `pnpm exec c8 --reporter=text --reporter=json-summary --include='src/**' --include='bin/**' --include='packages/*/src/**' pnpm exec cucumber-js --fail-fast --tags "@eval and not @captain and not @shipwright" --format json:coverage/weather-eval.json`
- step-usage: `pnpm exec cucumber-js --dry-run --tags "not @captain and not @eval and not @shipwright" --format usage-json`
- eval: `pnpm exec cucumber-js --fail-fast --tags "@eval and not @captain and not @shipwright"`
- conformance: `pnpm exec cucumber-js --tags "not @captain and not @shipwright" --name "The flagship and shim seams discharge against the internal API shape scantling"`
- plank-inventory: `node scripts/plank-inventory.mjs`
- typecheck: `pnpm exec tsc --noEmit`
- lint: `pnpm exec biome check .`
- gherkin-lint: `pnpm exec gplint 'features/**/*.feature' 'packages/*/features/**/*.feature'`

## Perturbation

- message: `PERTURBATION: consider current durable context; remove when fixed`
- perturb: `throw new Error("PERTURBATION: consider current durable context; remove when fixed");`

## Tiers

- default: @logic
- sandbox: @sandbox
- eval: @eval
- policy: @logic needs no credentials; pure local tests, fast, deterministic, safe
- policy: @sandbox needs network access to public npm and the skills CLI, no secret credentials; each scenario runs in a namespaced temporary workspace with idempotent best-effort teardown
- policy: @eval is opt-in live-crew model evaluation over a genuinely-running crew session; requires `HARNESS_OPENROUTER_API_KEY` and `HARNESS_EVAL_MODEL` from `.env` as fitting-out, assumed present; excluded from the default and broad runs; a missing credential is a Captain blocker for incomplete fitting-out, not a skip
- policy: every tier runs serial, the runner's derived worker setting; live seat sessions and package installs share operator-level state, so worker isolation is not yet established
- weather: coverage/weather.json

## Dependencies

- policy: Captain selects dependencies and records them here; Crew installs them from this section; Crew MUST NOT install unspecced dependencies
- dependency: @earendil-works/pi-coding-agent (runtime)
- dependency: pi-open-plugin-shim (runtime, workspace)
- dependency: @cucumber/cucumber (dev)
- dependency: tsx (dev)
- dependency: typescript (dev)
- dependency: @biomejs/biome (dev)
- dependency: gplint (dev)
- dependency: c8 (dev)
- dependency: @types/node (dev)

## Outbound

- outbound: pi-open-plugin-shim, the unscoped public npm runtime engine; publish first, the flagship's dependency resolves it from the registry
- ship: `pnpm --filter pi-open-plugin-shim build && pnpm --filter pi-open-plugin-shim publish --access public`
- verify: install `pi-open-plugin-shim@latest` from the registry and load its compiled entry per the release runbook in `AGENTS.md`
- outbound: @dk/estelle, the scoped public npm flagship; publish after the shim
- ship: `pnpm build && pnpm publish --access public`
- verify: install `@dk/estelle@latest` from the registry and boot-verify the real `estelle` bin per the release runbook in `AGENTS.md`

## Known false-failure modes

- mode: pi enforces a project-trust gate on first launch; an untrusted freshly cloned workspace is the trust gate, not an Estelle defect; trust the project, then rerun
- mode: Estelle installs the upstream Shipshape package on launch when the operator's pi settings do not persist it; a first-run git clone or its network failure is environment state, not an Estelle defect
- mode: cucumber `--format usage` truncates concrete rows per step pattern; use the `step-usage` command (`usage-json`) for plank audits; confirm any stale-plank hit from the pretty table against feature files
- mode: c8 undercounts `packages/pi-open-plugin-shim/src/index.ts` seams that genuinely run under `@logic`, including `checkWriteSync`, `checkReadSync`, `runSessionStart`, `runPostToolUse`, `reportCommands`, `reportAgents`, and the shared private `dispatch`; each has a passing `@logic` scenario driving the real production function; a 0%-line report for these seams is a coverage-attribution gap through cucumber's dynamic `import()`, not a missing spec or dead code
- mode: `pi-command-passthrough.feature` runs `bin/estelle.js` as a real child process via `execFileSync`, so c8's parent-process instrumentation never sees the child's execution of `bin/estelle.js` or the `run()` argv branch in `src/index.ts`; a 0%-line report there is the subprocess-coverage gap, not a missing spec
- mode: the default `coverage` command excludes `@eval`, so `src/index.ts` live-crew internals (`reportCrewRun`, `narrateCrewRun`, `driveCrewLoopToCompletion`, the embark tool registration, `handOffToCrew`'s live-voice branch, `configureRedTarget`, `assistantText`) read uncovered under it even though each is planked and exercised by `@eval` scenarios in `features/live-crew.feature`; that is the intended `@logic`/`@eval` split, not a missing spec
- mode: the same dynamic-`import()` attribution gap undercounts `src/index.ts` seams loaded by `features/steps/*.steps.ts`, observed on `evaluateWrite`, `evaluateRead`, the `tool_call` handler's read and bash branches, `createSkill` past its opening line, and the back half of `installExtension`, resourceLoader reload, session recreation, and command merge; each is planked and its owning scenario passes under `@logic` or `@sandbox`; a 0%-line report confined to these segments is the tooling gap, not dead code
