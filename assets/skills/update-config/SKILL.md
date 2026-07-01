---
name: update-config
description: Configure Estelle for the operator - set per-seat models, provider auth, and pi settings, and mend an unavailable model or missing setup. Use when the operator asks to change configuration, when a seat model is reported unavailable, or when provider setup is incomplete.
---

# Update Config

Help the operator configure Estelle. Only the Captain runs this. The crew work from durable artifacts and never configure.

## Workflow

1. Read the current configuration before changing anything. Never write blind.
2. Clarify scope when the request is ambiguous: which seat, which model, operator config or provider setup.
3. Merge, do not replace. Preserve every setting the operator did not ask to change.
4. Make the smallest change that satisfies the request.
5. Confirm what changed, in the operator's own terms.

## Config surface

- Per-seat models: Estelle ships a default model per seat. The operator overrides a seat's model in operator config. Model ids are pi-native `provider/model`, for example `opencode-go/deepseek-v4-flash`.
- Unavailable model: when a configured id is not one pi can resolve, the seat falls back to an available model and Estelle reports the id as unavailable. Offer to correct it: fix a typo, choose a known id, or set up the provider.
- Provider setup: a model resolves only when its provider is configured. When a provider is missing, walk the operator through adding it.
- Extensions and skills: to add published capabilities or author a new skill, use the find-skills skill.

## Rules

- Read before write. Merge, never clobber. Confirm every change.
- Only the Captain addresses the operator, so surface every warning and offer through the Captain.
