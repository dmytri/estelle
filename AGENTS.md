# Agent Instructions

This project uses the Shipshape workflow.

Machine-read tooling values such as stack, directories, and commands live in `RIGGING.md`.

Estelle installs the upstream Shipshape package through pi's native package manager on launch; it persists to the operator's pi settings and pi auto-loads it on later launches. For manual setup use pi directly:

```bash
pi install https://github.com/dmytri/shipshape
```

## No vendoring

Estelle vendors nothing it can pull upstream. pi (pi.dev) and the Shipshape skills are upstream dependencies. They are never copied into this repository. The package launches pi pre-configured with the upstream Shipshape skills and the Estelle enforcement extension.

## Outbound verification

The release artifact is the scoped public npm package `@dk/estelle`. Before release, verify that the published package launches pi with the Estelle extension loaded. A local green tree alone is not sufficient evidence that the published package boots.

## Release runbook

Two npm targets ship from this repository. The `## Outbound` entries in `RIGGING.md` point here. Publish the shim first; the flagship's dependency resolves the shim from the registry, so a flagship published before the shim is uninstallable.

1. `pi-open-plugin-shim`, the unscoped runtime engine. Build with `pnpm --filter pi-open-plugin-shim build`, which compiles `src/` to `dist/index.cjs`. Publish from `packages/pi-open-plugin-shim` with `pnpm publish --access public`. Use `pnpm publish`, not `npm publish`: `npm publish` leaves `workspace:*` verbatim and skips the `publishConfig` compiled entry, which produces an uninstallable package.
2. `@dk/estelle`, the scoped flagship. Build with `pnpm build`, which compiles `src/` to `dist/` and produces the `estelle` bin. Publish with `pnpm publish --access public` so `workspace:*` dependencies are rewritten to real versions.

Verify each published package from the registry after release.

- Shim: install `pi-open-plugin-shim@latest` in a scratch directory and load its compiled entry.
- Flagship: `npm install @dk/estelle@latest` and boot-verify by running the real `estelle` bin, not only `launch()`, in a directory that has its own unrelated `assets/` folder, the real npx-in-a-project condition where Estelle must use its bundled assets. Confirm it launches pi with the Estelle extension as the Captain Bonny. A clean directory or a `launch()`-only check is not sufficient evidence, since the bin resolves assets differently from a bare workspace.
