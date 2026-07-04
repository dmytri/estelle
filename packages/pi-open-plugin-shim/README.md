# pi-open-plugin-shim

Run [open-plugin](https://open-plugins.com)-format plugins on the [Pi coding agent](https://github.com/earendil-works/pi-mono).

Pi has no native support for the open-plugin format (`.plugin/plugin.json`, `hooks/`, `agents/`, `commands/`) used by [open-plugins.com](https://open-plugins.com) and the [open-plugin spec](https://github.com/vercel-labs/open-plugin-spec). This shim bridges the gap: it loads an open-plugin and maps its parts onto Pi's extension API.

## What it maps

| Open-plugin part | Pi mechanism |
|---|---|
| `hooks/` custody scripts (keyed off `agent_type`) | Pi's `tool_call` blocking hook invokes the real hook script with the payload it expects |
| `agents/` role agents (context isolation) | Pi sessions (`newSession`/`fork`), since Pi has no subagent primitive |
| `commands/` slash commands | `pi.registerCommand` |

Because Pi provides no `agent_type` to a hook, the role identity is supplied by the host (the seat the shim is running as) rather than the runtime. That is a weaker identity guarantee than a runtime that isolates agents natively, and it is documented as such.

## Status

Early. Built as part of the [Estelle](https://github.com/dmytri/estelle) monorepo, where it is the layer that lets Pi run the Shipshape plugin.

## License

MIT
