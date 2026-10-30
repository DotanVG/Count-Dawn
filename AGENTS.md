# AGENTS.md — Count-Dawn

Personal project owned by DotanVG. Branch from current `origin/staging` and open
PRs to `staging`; never push directly to `staging` or `main` or promote without approval.
Run `npm ci`, `npm run lint`, `npm run typecheck`, `npm run build` and `npm test`
before handoff. Follow the repository's existing game, asset and deployment docs.

## Reuse first

Before implementing a feature or config, search installed dependencies and their
READMEs, this repo's `PROVENANCE.md`, and the relevant personal DotanVG siblings
(BeatEmPie-Phaser, Count-Dawn, Orbital-Breach). Check `DotanVG/game-kit`'s
`packages/INDEX.md` if that project exists; do not assume packages are published.
For an unfamiliar feature, compare existing open-source approaches, license,
maintenance and security first. Record findings and the reuse decision in the PR body.

Prefer an existing shared package or native API. Do not copy source files,
directories, workflows, configs or security logic between repositories, including
from old branches or node_modules. A small game-specific idea can be implemented
locally; shared security policy deserves a shared config/package proposal.
An explicitly approved exception must record source repo/path/full commit SHA,
date, reason, intentional differences and intended shared-package destination in
`PROVENANCE.md` and the PR body. Phase 0's documented drift-tool bootstrap is one
such authorized exception. Asset reuse also requires license/inventory attribution.

Propose a shared component only for two concrete consumers. Put the proposal in
`docs/reuse-proposals/<name>.md` in a PR: existing locations and SHAs, consumers,
API/parameters, engine boundary, risks and checks. Keep Phaser-specific, Three.js-
specific and engine-agnostic code separate. Obtain approval before creating or
publishing a package; use a human-merged version/Changesets PR if adopted. Do not
vendor modified dependencies or commit local `file:` dependencies as a substitute.

Run `node tools/drift-check.mjs <sibling-checkout-or-url>` before changing listed
shared configs. Review intentional differences rather than forcing equality.
Never put secrets, game hostnames, analytics IDs or origins into shared defaults;
take game-specific values as parameters. The drift check remains advisory and
must not be added to deploy/build gates. Use PR bodies for evidence, not comments.
