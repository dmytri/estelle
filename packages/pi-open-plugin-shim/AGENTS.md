# Agent Instructions for pi-open-plugin-shim

This package uses the Shipshape spec-driven workflow. Product behaviour lives in
`features/*.feature`. Machine-read tooling values live in `RIGGING.md`; roles
read it on open.

`pi-open-plugin-shim` is a package in the Estelle monorepo. It runs
open-plugin-format plugins (https://open-plugins.com) on the Pi coding agent by
mapping open-plugin parts onto Pi's extension API: `hooks/` custody scripts run
through Pi's `tool_call` hook, `agents/` isolation maps to Pi sessions, and
`commands/` map to `pi.registerCommand`. The shim is generic: it runs any
open-plugin, not Shipshape alone.

Verification runs real open-plugin hook scripts against real fixture plugins. No
mocked hooks, no simulated exit codes.
