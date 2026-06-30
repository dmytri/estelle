# Rigging

Project tooling values for Shipshape roles. Values only, not procedure.
Procedure lives in the skills. Every role reads this on open.

## Stack

- language: typescript
- runtime: node@20
- packageManager: pnpm

## Directories

- implementation: src/
- specs: features/
- verification: features/steps/, features/support/
- assets: assets/

## Commands

- discover: `pnpm exec cucumber-js --dry-run --tags "not @captain"`
- focused: `pnpm exec cucumber-js --tags "not @captain" --name "{scenario}"`
- broad: `pnpm exec cucumber-js --tags "not @captain"`
- coverage: `pnpm exec cucumber-js --tags "not @captain" --format usage`
- step-usage: `pnpm exec cucumber-js --dry-run --tags "not @captain" --format usage`
- typecheck: `pnpm exec tsc --noEmit`
- lint: `pnpm exec biome check .`

## Tiers

- default: @logic; pure local tests, no external accounts; fast, deterministic, safe; needs no credentials
- sandbox: not provisioned yet; no @sandbox tier in iteration one

## Dependencies

- policy: Captain selects dependencies and records them here; Crew installs them from this section; Crew MUST NOT install unspecced dependencies
- runtime: `@earendil-works/pi-coding-agent`
- dev: `@cucumber/cucumber`, `tsx`, `typescript`, `@biomejs/biome`

## Outbound

- artifact: scoped public npm package `@dk/estelle`
- policy: before release, verify the published package launches pi with the Estelle extension loaded; a local green tree alone is not sufficient evidence the published package boots

## Known false-failure modes

- pi enforces a project-trust gate on first launch; a freshly cloned workspace must be trusted before its extensions and skills load; an untrusted workspace is the trust gate, not an Estelle defect; trust the project, then rerun
