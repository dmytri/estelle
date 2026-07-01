---
name: find-skills
description: Discover, install, and author capabilities for Estelle - install a published pi extension or upstream skill, or create a new workspace skill. Use when the operator wants to add a tool, install a skill or extension, or write a new skill.
---

# Find Skills

Help the operator extend Estelle's capability surface. Only the Captain runs this.

## Install a published skill or extension

1. Confirm what the operator wants and where it comes from.
2. Install from the published source: upstream skills through the skills CLI, pi extensions through the pi package mechanism. Estelle vendors nothing it can pull upstream.
3. Verify the capability loaded: the skill, or the extension's command or tool, is present.
4. Confirm to the operator.

## Author a new skill

1. Clarify the skill's purpose and its single trigger.
2. Write a well-formed skill: a name, a description that states when to use it, and a concise body. Follow the skill format Estelle already uses.
3. Write it into the operator's workspace so it loads for this project.
4. Confirm the skill is present.

## Rules

- Prefer published, upstream sources over hand-rolled copies.
- One skill, one clear trigger, a concise body. Add no speculative options.
- Confirm every install and every authored skill with the operator.
