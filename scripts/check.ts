import type { Check, CiOnly } from "./lib/check-runner.ts";
import { browserSkip, browserTestsFor } from "./lib/browser-selection.ts";
import type { BrowserTests } from "./lib/browser-selection.ts";
import { SUITE_LOCK_FILE } from "./lib/machine-lock.ts";
import { TIMINGS_DIR } from "./lib/slowest-files.ts";
import { changedFiles } from "./lib/changed-files.ts";
import path from "node:path";
import { runChecks } from "./lib/check-runner.ts";

interface Scripted extends Omit<Check, "command"> {
  readonly script: readonly string[];
}

function option(name: string): string {
  const prefix = `--${name}=`;
  const found = process.argv.find((arg) => arg.startsWith(prefix)) ?? "";
  return found.slice(prefix.length);
}

const job = option("job");
const shard = option("shard");
const base = option("base");
const inCi = process.argv.includes("--ci");

const TESTS_REPORT = path.join(TIMINGS_DIR, "tests.json");
const JSON_REPORTER = ["--reporter=json", `--outputFile.json=${TESTS_REPORT}`];
const WITH_DEFAULT_REPORTER = ["--reporter=default", ...JSON_REPORTER];

function testScript(): readonly string[] {
  if (shard !== "") {
    return ["test:shard", `--shard=${shard}`, ...JSON_REPORTER];
  }
  if (process.argv.includes("--merge")) {
    return ["test:merge", ...WITH_DEFAULT_REPORTER];
  }
  return ["test", ...WITH_DEFAULT_REPORTER];
}

function lintScript(): readonly string[] {
  if (base !== "") {
    return ["lint", `--base=${base}`];
  }
  return ["lint"];
}

const NONE = 0;

function selectedBrowserTests(): BrowserTests {
  if (inCi || job !== "") {
    return { all: true, reason: "" };
  }
  const cwd = process.cwd();
  return browserTestsFor({ changed: changedFiles({ base: "origin/v1", cwd }), cwd });
}

const browserTests = selectedBrowserTests();
const browserSkipped = browserSkip(browserTests);

function browserScript(): readonly string[] {
  if (browserTests.all) {
    return ["browser"];
  }
  return ["browser", ...browserTests.run];
}

const scripted: readonly Scripted[] = [
  { budget: 16, job: "lint", name: "lint", script: lintScript() },
  { budget: 18, job: "canaries", name: "canaries", script: ["canaries"] },
  { budget: 10, job: "types", name: "types", script: ["typecheck"] },
  { budget: 16, job: "fixers", name: "fixers", script: ["fixers"] },
  { budget: 8, job: "seams", name: "seams", script: ["seams"] },
  {
    budget: 26,
    job: "tests",
    name: "tests",
    script: testScript(),
    timings: { base: process.cwd(), file: TESTS_REPORT, runner: "vitest" },
  },
  {
    budget: 30,
    job: "browser",
    name: "browser",
    script: browserScript(),
    timings: {
      base: "app/modules/routes/tests/browser",
      file: path.join(TIMINGS_DIR, "browser.json"),
      runner: "playwright",
    },
  },
  { budget: 10, job: "knip", name: "knip", script: ["knip"] },
  { budget: 10, job: "drift", name: "validators", script: ["validators:check"] },
  { budget: 6, job: "drift", name: "hygiene", script: ["hygiene"] },
  { budget: 6, job: "drift", name: "docs", script: ["docs"] },
  { budget: 10, job: "drift", name: "api", script: ["api"] },
  { budget: 6, job: "drift", name: "exports", script: ["exports"] },
  { afterTests: true, budget: 6, job: "format", name: "format", script: ["format:check"] },
];

function commandOf({ script, ...check }: Scripted): Check {
  return Object.assign(check, { command: ["pnpm", "run", "--silent", ...script] });
}

const checks: readonly Check[] = scripted
  .filter((check) => check.job !== "browser" || browserTests.all || browserTests.run.length > NONE)
  .map((check) => commandOf(check));

const ciOnly: readonly CiOnly[] = [
  { ciJob: "e2e-docker", command: "pnpm e2e:docker", name: "the e2e suite (packages/e2e on the Docker image)" },
  ...browserSkipped,
];

if (browserTests.all && browserTests.reason !== "") {
  console.error(`check: running every browser test, since ${browserTests.reason}.`);
}

process.exitCode = await runChecks({ checks, ciOnly, inCi, job, lockFile: SUITE_LOCK_FILE });
