# Agent Instructions

This project uses the Shipshape workflow.

Machine-read tooling values such as stack, directories, and commands live in `RIGGING.md`.

Install the Shipshape skills with the open skills CLI:

```bash
npx skills add dmytri/shipshape --skill '*'
```

## No vendoring

Estelle vendors nothing it can pull upstream. pi (pi.dev) and the Shipshape skills are upstream dependencies. They are never copied into this repository. The package launches pi pre-configured with the upstream Shipshape skills and the Estelle enforcement extension.

## pi project-trust gate

pi enforces a project-trust gate on first launch. A freshly cloned workspace must be trusted before its extensions and skills load. An untrusted workspace is the trust gate, not an Estelle defect. Trust the project, then rerun.

## Outbound verification

The release artifact is the scoped public npm package `@dk/estelle`. Before release, verify that the published package launches pi with the Estelle extension loaded. A local green tree alone is not sufficient evidence that the published package boots.

## Building Estelle on pi

Pi-native implementation guidance. Confirm against pi's `dist` type definitions, `docs/`, and `examples/`.

- Seats are pi extension commands, not pi-skills. The extension registers a slash command per seat name and alias with `pi.registerCommand`: `bonny`/`captain`; `misson`/`quartermaster`/`qm`; `bellamy`/`boatswain`; `johnson`/`shipwright`; `crew`. Pi skills surface as `/skill:name`; bare `/role` commands come from the extension.
- A seat's instructions are the upstream Shipshape role skill body plus the character card, injected for the active seat through `pi.on("before_agent_start", ...)` returning `{ systemPrompt }`. Read the upstream role skill in place from its installed file: the resource loader `getSkills()` gives `name` and `filePath`; read it with `readFileSync` and the exported `stripFrontmatter`. Do not copy the upstream skills into this repository.
- Seat models are pi-native `provider/model` ids in `assets/seat-models.json`. Resolve them with `ModelRegistry.find(provider, id)`. Set a seat's model through the `createAgentSession({ model })` path; runtime `setModel` throws without an API key. The default is `opencode-go/deepseek-v4-flash`; operators override through pi settings or flags.
- The launcher `bin` imports pi's exported `main(argv, { extensionFactories: [estelle] })`. It injects `--model opencode-go/deepseek-v4-flash` and any needed flags only when the operator did not pass them, and calls `process.chdir(cwd)` first. There is no `--cwd` flag. This keeps operator overrides working and is the most pi-native path.
- Auth is pi-native: the operator runs `/login` (OpenCode Go) or sets `OPENCODE_API_KEY`. Estelle stores no provider credentials.
- Context-isolated agents for the future live crew are a pi primitive: a separate `pi` process per agent (see `examples/extensions/subagent`) or in-process SDK sessions. The background execution, output routing to Bonny, and one-way firewall are Estelle's to build on pi; no `pi-subagents` dependency.
