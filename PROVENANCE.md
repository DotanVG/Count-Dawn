# Provenance (internal engineering record)

## Origin and evidence

Count-Dawn was seeded from DotanVG/BeatEmPie-Phaser on **2026-07-24**, per the
phase-0 research supplied by Dotan. Git independently confirms the initial scaffold:
`6d995a6d7801ab7376e6facc1b16acab06393b1a`, "feat: scaffold playable Count Dawn
prototype", authored 2026-07-24 12:04:20 +03:00. It introduced the Phaser/TypeScript/
Vite scaffold, config, scenes, systems and tests in an independent history.

The scaffold commit does **not** record a BeatEmPie source SHA. The latest
BeatEmPie commit before its timestamp is `b0a88977f6610ff628ad19a0868e00e151c86799`
(2026-07-21); this is a comparison point, **not a verified copy-source revision**.
BeatEmPie's own first scaffold is `4653f639600e61f8c7b13de4eb6125c90367c654`
(2026-06-13). The code has evolved separately; matching paths are not evidence
that gameplay implementations are interchangeable. Exact seed revision remains unknown.

Audit baseline: `staging` at `841180b77663b9ee558e77db1aac1aa1c94b0c7d`.
Reproduce the historical evidence with `git log --reverse` and `git show <sha>`.

## Shared/copied configuration inventory

| Local file | Sibling equivalents | Intentional differences / drift to review |
| --- | --- | --- |
| `vercel.json` | BeatEmPie-Phaser and Orbital-Breach: `vercel.json` | Count-Dawn enforces frame-ancestors and reports the broader CSP; siblings differ in enforcement, allowed origins and cache matchers. Orbital has client-specific deploy commands. |
| `eslint.config.js` | BeatEmPie-Phaser: `eslint.config.js` | Scaffold flat-config structure is related; Count-Dawn ignores tests and enforces unused-variable/any rules. Orbital has no equivalent. |
| `public/analytics.js` | BeatEmPie-Phaser: `public/analytics.js`; Orbital-Breach: `client/public/analytics.js` | Common GA bootstrap structure; production hostname and measurement ID must stay game-specific. |

The GA bootstrap was introduced here by `e7dd6ee0dbddcfab8c338e6f54892a746a7b9a01`
(2026-10-22), in BeatEmPie by `6b5e1df1ac1a8f8e1e449206480e5832261d03c3`,
and in Orbital by `9fd17710b822d11e5155c9ff3db4c6ec03da0353` that day.
These are introduction commits, not proof of copy direction. Vercel analytics/
speed-insights dependency setup and game event instrumentation are related but
outside the file comparison. Exact original copy commits for config variants are unknown.

## Comparison and synchronization rule

```sh
node tools/drift-check.mjs ../BeatEmPie-Phaser
node tools/drift-check.mjs https://github.com/DotanVG/BeatEmPie-Phaser
node tools/drift-check.mjs https://raw.githubusercontent.com/DotanVG/BeatEmPie-Phaser/<commit>/ --strict
```

Pass a sibling checkout or a root HTTP(S) URL. GitHub repo URLs use `staging`;
raw URLs can pin a commit. Other root URLs require `--repo BeatEmPie-Phaser`
(or another listed sibling). Local package names identify renamed checkouts.
The tool reads only the inventory categories, normalizes CRLF to LF and reports
SHA256 values plus bounded positional line previews. It preserves intentional
parameter/whitespace differences; output is not an applyable patch.
Differences, missing files, network and usage errors exit 0 by default; `--strict`
exits 1 for those findings. Orbital's absent ESLint equivalent is a skip.
The tool is not connected to CI, build, deploy or package scripts.

Before changing a variant, compare it with siblings and review every difference.
Never overwrite CSP/origins, analytics parameters, deploy settings or game code
to obtain equality. For an approved synchronization, record source repo/path/full
SHA, date, reason and intentional differences here and in each PR body; target
each repo's current `staging` and run its checks and relevant runtime QA.
Prefer existing shared packages; propose extraction only when two real consumers
need it. Phase 0 creates no package and performs no automatic synchronization.

`tools/drift-check.mjs` is an explicitly authorized bootstrap copy introduced
together in these three repos on 2026-10-30. Initial SHAs are recorded by the
corresponding `shraga/reuse-phase0` PRs (there is no earlier source commit).
Maintain equivalent tool copies through reviewed sibling PRs and hash comparisons.
