import { browserSkip, browserTestsFor } from "../lib/browser-selection.ts";
import { expect, it, onTestFinished } from "vitest";
import { mkdtempSync, readFileSync, readdirSync, rmSync } from "node:fs";
import { changedFiles } from "../lib/changed-files.ts";
import path from "node:path";
import { tmpdir } from "node:os";

const ROOT = process.cwd();
const BROWSER_TESTS = "app/modules/routes/tests/browser";
const COMPOSER_TEST = `${BROWSER_TESTS}/composer.browser.test.ts`;

function importersOf(helper: string): readonly string[] {
  return readdirSync(BROWSER_TESTS)
    .filter((file) => file.endsWith(".browser.test.ts"))
    .map((file) => `${BROWSER_TESTS}/${file}`)
    .filter((file) => readFileSync(file, "utf8").includes(`"./${helper}"`))
    .toSorted();
}

function emptyDirectory(): string {
  const dir = mkdtempSync(path.join(tmpdir(), "browser-selection-"));
  onTestFinished(() => {
    rmSync(dir, { force: true, recursive: true });
  });
  return dir;
}

it("a branch changing one browser test runs that test alone", { timeout: 30_000 }, () => {
  expect.hasAssertions();

  const selection = browserTestsFor({ changed: { ok: true, value: [COMPOSER_TEST] }, cwd: ROOT });

  expect(selection).toMatchObject({ all: false, run: [COMPOSER_TEST] });
});

it("a branch changing a helper runs only the browser tests that import it", { timeout: 30_000 }, () => {
  expect.hasAssertions();

  const selection = browserTestsFor({ changed: { ok: true, value: [`${BROWSER_TESTS}/relay.ts`] }, cwd: ROOT });

  expect(selection).toMatchObject({ all: false, run: importersOf("relay.ts") });
});

it("a branch changing a view runs every browser test, since each one drives the served cookout", {
  timeout: 30_000,
}, () => {
  expect.hasAssertions();

  const selection = browserTestsFor({
    changed: { ok: true, value: ["app/modules/views/lib/login-form.tsx"] },
    cwd: ROOT,
  });

  expect(selection).toStrictEqual({
    all: true,
    reason: "app/modules/views/lib/login-form.tsx is part of the cookout every browser test drives",
  });
});

it("a branch changing only scripts and docs no browser test reaches runs none", { timeout: 30_000 }, () => {
  expect.hasAssertions();

  const selection = browserTestsFor({
    changed: { ok: true, value: ["scripts/hygiene.ts", "docs/verification.md", ".changeset/quiet-otters-sing.md"] },
    cwd: ROOT,
  });

  expect(selection).toMatchObject({ all: false, run: [] });
});

it("a changed file outside the module graph runs every browser test", { timeout: 30_000 }, () => {
  expect.hasAssertions();

  const selection = browserTestsFor({ changed: { ok: true, value: ["scripts/hygiene.ts", "index.html"] }, cwd: ROOT });

  expect(selection).toStrictEqual({ all: true, reason: "the module graph doesn't hold index.html" });
});

it("runs every browser test when the module graph can't be built", { timeout: 30_000 }, () => {
  expect.hasAssertions();

  const selection = browserTestsFor({ changed: { ok: true, value: [COMPOSER_TEST] }, cwd: emptyDirectory() });

  expect(selection).toMatchObject({ all: true });
});

it("runs every browser test when the branch's changed files can't be listed", { timeout: 30_000 }, () => {
  expect.hasAssertions();

  const selection = browserTestsFor({ changed: changedFiles({ base: "no-such-ref", cwd: ROOT }), cwd: ROOT });

  expect(selection).toMatchObject({ all: true });
});

it("selects from the files the branch changed against its base", { timeout: 30_000 }, () => {
  expect.hasAssertions();

  const selection = browserTestsFor({ changed: changedFiles({ base: "HEAD", cwd: ROOT }), cwd: ROOT });

  expect(selection).toHaveProperty("all");
});

it("names the browser tests it skipped, and that CI runs them all", { timeout: 1000 }, () => {
  expect.hasAssertions();

  const skipped = browserSkip({
    all: false,
    run: [COMPOSER_TEST],
    skipped: [`${BROWSER_TESTS}/approve.browser.test.ts`, `${BROWSER_TESTS}/home.browser.test.ts`],
  });

  expect(skipped).toStrictEqual([
    {
      ciJob: "browser",
      command: "pnpm browser",
      name: "the browser tests this branch doesn't reach (2 of 3 files: approve, home)",
    },
  ]);
});

it("names no browser skip when every browser test runs", { timeout: 1000 }, () => {
  expect.hasAssertions();

  const skips = [
    browserSkip({ all: true, reason: "" }),
    browserSkip({ all: false, run: [COMPOSER_TEST], skipped: [] }),
  ];

  expect(skips).toStrictEqual([[], []]);
});
