# A local check runs only the browser tests a branch reaches

2026-11-24 (mattpocock/cookout#439). Matt decided on the board on 2026-11-24 (thread 3416, msg 3626), after [the e2e suite moved to CI only](0088-the-e2e-suite-runs-only-on-ci.md), that a local `pnpm check` runs only the browser tests a branch affects, and CI keeps running them all. #412 had found the local load that times tests out comes from the browser tests and agents' own runs, not the e2e suite, which local `pnpm check` never ran.

## Decision

- A full local `pnpm check` (no `--ci`, no `--job=…`) runs the Playwright browser tests in `app/modules/routes/tests/browser` only for the files the branch changed against `origin/v1`: the changed browser test files, and the browser tests whose module graph reaches a changed file. If it reaches none, the `browser` check doesn't run.
- The changed files are `coverage:changed`'s and `lint:changed`'s: `git diff --merge-base origin/v1` plus untracked files (`scripts/lib/changed-files.ts`). The module graph is dependency-cruiser's, the one `pnpm seams` builds, cruised over `app` and `scripts` as JSON. `scripts/lib/browser-selection.ts` makes the selection.
- It fails safe: it runs every browser test when the changed files can't be listed, when dependency-cruiser can't build the graph, when a changed file is one the graph doesn't hold (`index.html`, `public/`, `package.json`, the lockfile, `playwright.config.ts`, `vite.config.ts`, CSS), and when a changed file is part of the cookout the tests drive: anything `app/dev.ts`, `app/web.tsx` or `scripts/browser-test-server.ts` reaches. Only docs, changesets, `.github/`, `lint/` and `lint-baseline.json` are held inert without being in the graph. When it runs them all for one of these reasons it says why on stderr.
- When it skips any, it prints one line before its verdict, like the e2e suite's: `skipped: the browser tests this branch doesn't reach (35 of 37 files: approve, catch-up, …), which CI runs as its browser job. Run it here on purpose with pnpm browser.`
- CI runs exactly what it ran before: its `browser` job runs `--job=browser --ci`, which always runs every browser test. `pnpm merge-ticket` still waits for every job.

## Why

The browser tests start a dev cookout and Chromium, and many agents ran them all on every check on one machine. A branch that changes only scripts, lint rules, docs or one browser test file has no reason to run the rest.

Playwright's `--only-changed` was the other built-in choice, but it follows only imports, so a branch changing a view would run no browser test at all: the tests reach the cookout through the page it serves, not through imports. Selecting from dependency-cruiser's graph lets the selection see what the served cookout reaches and run everything then, rather than skip silently.

## Consequences

This widens the departure from "CI runs exactly the local check script" that the e2e decision began: a green local `pnpm check` no longer promises every browser test passes. CI still runs every browser test on every ticket and merge push before anything lands on v1, so a break in a skipped test shows in `pnpm ci:wait` after the push.

Because every browser test drives the whole served cookout, a branch changing any source the cookout serves (a view, a route, the server) still runs every browser test locally. Only branches outside the served cookout save the run.
