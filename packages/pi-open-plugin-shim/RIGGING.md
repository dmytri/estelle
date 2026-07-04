# Rigging

Project tooling values for Shipshape roles. Values only, not procedure.
Procedure lives in the skills. Every role reads this on open.

## Stack

- language: typescript
- runtime: node@20
- packageManager: pnpm

## Directories

- implementation: index.ts, src/
- specs: features/
- verification: features/steps/, features/support/
- assets: assets/

## Commands

- discover: `pnpm exec cucumber-js --dry-run --tags "not @captain"`
- focused: `pnpm exec cucumber-js --tags "not @captain" --name "{scenario}"`
- broad: `pnpm exec cucumber-js --tags "not @captain"`
- coverage: `pnpm exec cucumber-js --tags "not @captain" --format usage`
- step-usage: `pnpm exec cucumber-js --dry-run --tags "not @captain" --format usage-json`
- plank-inventory: `rg -n "@planks\(" index.ts src`
- typecheck: `pnpm exec tsc --noEmit`
- lint: `pnpm exec biome check .`

## Perturbation

- message: `PERTURBATION: consider current durable context; remove when fixed`
- fail-fast: `throw new Error("PERTURBATION: consider current durable context; remove when fixed");`

## Tiers

- default: @logic; pure local tests, no external accounts; fast, deterministic, safe; needs no credentials; runs real open-plugin hook scripts against real fixture plugins

## Dependencies

- policy: Captain selects dependencies and records them here; Crew installs them from this section; Crew MUST NOT install unspecced dependencies
- runtime: `@earendil-works/pi-coding-agent` (peer)

## Outbound

- artifact: unscoped public npm package `pi-open-plugin-shim`
- publish: `npm publish --access public`
- policy: the shim ships as raw TypeScript loaded by pi; before release, verify the published package loads as a pi extension and enforces a fixture open-plugin's write custody
