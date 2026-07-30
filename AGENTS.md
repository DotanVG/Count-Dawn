# Count Dawn Codex instructions

Count Dawn is a Phaser 4 and TypeScript browser game. Treat `src/`, `tests/`,
`docs/`, `tools/`, and the root configuration as authoritative. Do not inspect
the large binary asset corpus for ordinary code tasks.

Codex discovers the Graphify adapter at
`.agents/skills/graphify/SKILL.md`. That adapter points to the canonical,
repository-local instructions in `.claude/skills/graphify/SKILL.md`; Codex does
not discover the Claude skill directory by itself. Graphify is optional
development tooling and must not be added to the game runtime.

## Knowledge graph policy

When `graphify-out/graph.json` exists:

1. For unfamiliar, architectural, debugging, cross-cutting or likely multi-file tasks, query Graphify before performing broad repository exploration.
2. Use the graph to identify likely files, symbols, dependencies and execution paths.
3. Open and verify the authoritative source files before editing.
4. Never trust stale graph data over current source.
5. For a clearly isolated edit, skip Graphify.
6. After material structural changes, perform an incremental graph update when practical.
7. After a major refactor, perform a full rebuild.
8. Never commit `graphify-out/`.
9. Do not block ordinary work only because the optional local graph is absent.

Run `npm run graph:status` before relying on an existing graph. The trusted
project `SessionStart` hook only reports availability and possible staleness; it
never builds or updates the graph.
