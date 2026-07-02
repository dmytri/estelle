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
