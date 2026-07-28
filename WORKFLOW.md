---
tracker:
  kind: linear
  project_slug: count-dawn-55ab04d3a2c4
  active_states:
    - Todo
    - "In Progress"
  terminal_states:
    - Done
    - Cancelled
polling:
  interval_ms: 30000
workspace:
  root: ~/code/count-dawn-workspaces
hooks:
  after_create: |
    git clone --depth 1 --branch staging https://github.com/DotanVG/Count-Dawn.git .
    npm install
  before_run: |
    git fetch origin
    git merge --ff-only origin/staging
agent:
  max_concurrent_agents: 3
  max_turns: 20
codex:
  command: codex app-server
  approval_policy: never
  thread_sandbox: danger-full-access
---

# Count Dawn - Orchestration Workflow

## Execution contract

- You are working on Linear ticket `{{ issue.identifier }}` for the Count Dawn project.
- This is an **unattended orchestration session**.
- **Never ask a human to perform follow-up actions.**
- Stop early **only** for true blockers:
  - missing auth
  - missing permissions
  - missing required secrets
  - destructive ambiguity
  - unavailable required repository
- Work only inside the provided repository copy.
- Always **sync with `origin/staging`** before active work.
- Always create or update a persistent **`## Codex Workpad`** comment on the ticket.
- Move **Todo -> In Progress** before active work.
- Move **In Progress -> In Review** after a PR is opened and validation passes.
- **Done** and **Cancelled** are terminal states - do nothing.
- If rework is needed:
  - re-read the full issue,
  - re-read PR comments,
  - create a fresh branch from `origin/staging`,
  - execute end-to-end again.

## Project context

**Count Dawn** is a browser-based reverse horde survival game created for GMTK Game Jam 2026.

Stack:
- Phaser 4
- TypeScript
- Vite
- ESLint
- `node:test`
- Static deployment to Vercel and itch.io

Repository layout:
- `src/game/` - bootstrap, Phaser config, constants, events, cursor, fullscreen
- `src/scenes/` - Boot, Preload, Game, Pause, GameOver, Victory
- `src/entities/` - player, hunters, bosses, projectiles, pickups, coffin
- `src/systems/` - input, combat, spawning, countdown, game flow, audio, cold open
- `src/ui/` - HUD, boss health, touch controls, menus, debrief, audio editor
- `src/data/` - balance and audio configuration
- `public/assets/` - shipped art and audio
- `tools/` - offline Python sprite-sheet builders
- `tests/` - pure game-rule tests
- `docs/` - game loop, asset integration, audio, deployment

## Status map

| State | Meaning / action |
|-------|------------------|
| **Todo** | Move to **In Progress** immediately before active work. |
| **In Progress** | Implementation actively underway. |
| **In Review** | PR attached and validated; waiting on human approval. |
| **Done** | Terminal - do nothing. |
| **Cancelled** | Terminal - do nothing. |

## Kickoff

1. Fetch the issue by ticket ID.
2. Read the current state.
3. Route based on state and skip terminal states.
4. Find or create a persistent workpad comment named **`## Codex Workpad`**.
5. Reconcile the workpad against current reality.
6. Sync with `origin/staging` using `git fetch origin && git merge --ff-only origin/staging`.
7. Reproduce or inspect current behavior **before** changing code.
8. Write a hierarchical plan with acceptance criteria and validation steps into the workpad.

## Execution

1. Implement against the workpad TODOs.
2. Run the required validation.
3. Fix all build, type, lint, and test errors.
4. Push the branch.
5. Open a PR **into `staging`**.
6. The PR body must include:
   - summary
   - implementation details
   - validation commands run
   - screenshots or visual notes if relevant
   - linked Linear issue
   - `Closes #<N>` when there is a matching GitHub issue number
7. Attach the PR URL to the Linear issue.
8. Move the issue to **In Review**.

## Validation commands

```bash
npm install
npm run dev
npm run build
npm run typecheck
npm run lint
npm test
```

For visual or gameplay changes, also perform an interactive sanity check on desktop and, where relevant, mobile landscape controls.

## Branching rules

- Branch from `staging`.
- PRs target `staging`.
- Never commit directly to or open feature PRs into `main`.
- Promote `staging -> main` only after validation.
- See [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md) for deployment details.

## Workpad template

```md
## Codex Workpad

<hostname>:<abs-path>@<short-sha>

### Plan

- [ ] 1. Parent task
  - [ ] 1.1 Child task

### Acceptance Criteria

- [ ] Criterion 1

### Validation

- [ ] build: `npm run build`
- [ ] lint: `npm run lint`
- [ ] tests: `npm test`

### Notes

- <short progress note with timestamp>
```
