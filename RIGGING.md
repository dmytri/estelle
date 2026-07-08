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

## Commands

- discover: `pnpm exec cucumber-js --dry-run --tags "not @captain and not @eval and not @shipwright"`
- focused: `pnpm exec cucumber-js --tags "not @captain and not @shipwright" --name "{scenario}"`
- broad: `pnpm exec cucumber-js --tags "not @captain and not @eval and not @shipwright"`
- coverage: `pnpm exec c8 --reporter=text --reporter=json-summary --include='src/**' --include='bin/**' --include='packages/*/src/**' pnpm exec cucumber-js --tags "not @captain and not @eval and not @shipwright"`
- step-usage: `pnpm exec cucumber-js --dry-run --tags "not @captain and not @eval and not @shipwright" --format usage-json`
- eval: `pnpm exec cucumber-js --tags "@eval and not @captain and not @shipwright"`
- plank-inventory: `rg -nI "@planks\(" -g 'src/**' -g 'bin/**' -g 'package.json' -g 'packages/*/src/**' -g 'packages/*/index.ts' -g 'packages/*/package.json' .`
- typecheck: `pnpm exec tsc --noEmit`
- lint: `pnpm exec biome check .`
- gherkin-lint: `pnpm exec gplint 'features/**/*.feature' 'packages/*/features/**/*.feature'`

## Perturbation

- message: `PERTURBATION: consider current durable context; remove when fixed`
- fail-fast: `throw new Error("PERTURBATION: consider current durable context; remove when fixed");`

## Tiers

- default: @logic; pure local tests, no external accounts; fast, deterministic, safe; needs no credentials
- sandbox: @sandbox; tests that install real pi extensions or upstream skills from public npm and the skills CLI; each scenario runs in a namespaced temporary workspace with idempotent best-effort teardown; needs network access, no secret credentials
- eval: @eval; opt-in live-crew model evaluation; drives a real model over a genuinely-running crew session to verify live behaviour the hermetic tier cannot; requires `HARNESS_OPENROUTER_API_KEY` and `HARNESS_EVAL_MODEL` from `.env` as fitting-out, assumed present; excluded from the default and broad runs so it is not in the default worklist; a missing credential is not a skip but a Captain blocker for incomplete fitting-out

## Dependencies

- policy: Captain selects dependencies and records them here; Crew installs them from this section; Crew MUST NOT install unspecced dependencies
- runtime: `@earendil-works/pi-coding-agent`, `pi-open-plugin-shim` (workspace)
- dev: `@cucumber/cucumber`, `tsx`, `typescript`, `@biomejs/biome`, `gplint`, `c8`

## Outbound

- target: scoped public npm package `@dk/estelle` (the flagship); build `pnpm build` compiles `src/` to `dist/` and produces the `estelle` bin; publish with `pnpm publish --access public` so `workspace:*` deps are rewritten to real versions
- target: unscoped public npm package `pi-open-plugin-shim` (the runtime engine `@dk/estelle` depends on); it MUST be published before or with the flagship, or the flagship is uninstallable; build `pnpm build` in `packages/pi-open-plugin-shim` compiles `src/` to `dist/index.cjs`; publish with `pnpm publish --access public`
- ordering: publish the shim first, then the flagship; the flagship's dependency resolves the shim from the registry
- publisher: use `pnpm publish`, not `npm publish`; `npm publish` leaves `workspace:*` verbatim and does not apply the shim's `publishConfig` (compiled entry), which produces an uninstallable package
- policy: before release, run the build, then verify each published package from the registry; for the flagship, `npm install @dk/estelle@latest` and boot-verify by running the real `estelle` bin, not only `launch()`, in a directory that has its own unrelated `assets/` folder (the real npx-in-a-project condition, where Estelle must use its bundled assets); confirm it launches pi with the Estelle extension as the Captain Bonny; a clean directory or a `launch()`-only check is not sufficient evidence, since the bin resolves assets differently from a bare workspace

## Known false-failure modes

- pi enforces a project-trust gate on first launch; a freshly cloned workspace must be trusted before its extensions and skills load; an untrusted workspace is the trust gate, not an Estelle defect; trust the project, then rerun
- Estelle installs the upstream Shipshape package on launch when the operator's pi settings do not persist it; on a host without it, the first `@logic` run performs one real git clone; later runs skip; a first-run clone or its network failure is environment state, not an Estelle defect
- cucumber `--format usage` truncates concrete rows per step pattern; use the `step-usage` command (`usage-json`) for plank audits; a stale-plank hit from the pretty table must be confirmed against feature files
- c8 undercounts several `packages/pi-open-plugin-shim/src/index.ts` seams that genuinely run under `@logic`, including `checkWriteSync`, `checkReadSync`, `runSessionStart`, `runPostToolUse`, `reportCommands`, and `reportAgents`; each has a passing `@logic` scenario driving the real production function against real fixtures or the real installed plugin, confirmed for the custody seams by the real plugin's denial text surfacing in assertions; a 0%-line report for these seams is a coverage-tooling gap under investigation, not a missing spec or dead code; QM should isolate the root cause, likely in how c8 attributes coverage through cucumber's dynamic `import()` of `packages/*/src` modules
- `pi-command-passthrough.feature` runs `bin/estelle.js` as a real child process via `execFileSync`, so c8's parent-process instrumentation never sees the child's execution of `bin/estelle.js` or the `run()` argv branch in `src/index.ts`; a 0%-line report there is the same subprocess-coverage gap, not a missing spec
