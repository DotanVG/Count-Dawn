---
name: graphify
description: Query and maintain Count Dawn's optional local Graphify knowledge graph for unfamiliar, architectural, debugging, cross-cutting, or likely multi-file development tasks.
---

# Count Dawn Graphify workflow

This is the canonical repository skill. The Codex-discovered adapter at
`.agents/skills/graphify/SKILL.md` deliberately points here instead of
duplicating these instructions.

Use Graphify only when `graphify-out/graph.json` exists and the task would
otherwise require broad exploration. Skip it for a clearly isolated edit.
Graph output is a navigation aid: always open the cited `src/`, `tests/`,
`docs/`, `tools/`, or configuration files and verify the current source before
editing.

## Commands

All commands are cross-platform Node wrappers and keep output under
`graphify-out/`.

```bash
npm run graph:status
npm run graph:query -- "How does blood overflow become healing or Wrath?"
npm run graph:query -- --dfs "What is the path from Ultimate input to enemy deaths and HUD updates?"
npm run graph:path -- "InputController" "CombatSystem"
npm run graph:explain -- "AudioDirector"
npm run graph:update
npm run graph:build
```

- `graph:query` uses a 1,600-token default budget for bounded context.
- `graph:update` is Graphify 0.9.30's local AST incremental update.
- `graph:build` performs `extract . --force`, then `cluster-only .` so JSON,
  report, and HTML outputs stay together. It uses the local `claude` CLI for
  useful documentation when available and otherwise safely falls back to
  deterministic `--code-only` extraction.
- `graph:cluster`, `graph:watch`, and `graph:check` expose the verified
  `cluster-only`, `watch`, and `check-update` commands.

Useful Count Dawn questions include:

- How does blood overflow become healing or Wrath?
- What is the path from Ultimate input to enemy deaths and HUD updates?
- How do Countdown, GameFlow and the coffin determine night success?
- Which systems participate in spawning and controlling bosses?
- How does AudioDirector respond to pause, gameplay and night transitions?
- Which files must change when adding a hunter or boss?

The source-focused scan includes code, tests, docs, offline tools, and relevant
root/agent configuration. `.graphifyignore` excludes all shipped and raw
artwork, sprite sheets, audio, video, dependencies, generated output, caches,
worktrees, and likely secret files.

If Graphify, semantic extraction, or subagent extraction is unavailable, do not
invent relationships and do not block the task: use `--code-only` or inspect the
source normally. Preserve Graphify's relationship confidence fields and audit
classifications; never rewrite an `INFERRED` or `AMBIGUOUS` edge as fact.
