import { field, list, parseJson, text } from "./json.ts";
import type { CiOnly } from "./check-runner.ts";
import type { Outcome } from "./tools.ts";
import path from "node:path";
import { readdirSync } from "node:fs";
import { spawnSync } from "node:child_process";

type BrowserTests =
  | { readonly all: true; readonly reason: string }
  | { readonly all: false; readonly run: readonly string[]; readonly skipped: readonly string[] };

interface Changed {
  readonly changed: Outcome<readonly string[]>;
  readonly cwd: string;
}

interface Inputs {
  readonly graph: Graph;
  readonly tests: readonly string[];
}

type Graph = ReadonlyMap<string, readonly string[]>;

const BROWSER_TESTS = "app/modules/routes/tests/browser";
const TEST_SUFFIX = ".browser.test.ts";
const SERVED_ROOTS = ["app/dev.ts", "app/web.tsx", "scripts/browser-test-server.ts"];
const INERT_DIRECTORIES = [".changeset/", "docs/", ".github/", "lint/"];
const INERT_FILES = new Set(["lint-baseline.json"]);
const EXIT_SUCCESS = 0;
const NONE = 0;
const MAX_BUFFER = 268_435_456;

function graphOf(json: unknown): Graph {
  const modules = list(field(json, "modules")) ?? [];
  return new Map(
    modules.map((module) => [
      text(field(module, "source")) ?? "",
      (list(field(module, "dependencies")) ?? []).map((dependency) => text(field(dependency, "resolved")) ?? ""),
    ]),
  );
}

function moduleGraph(cwd: string): Outcome<Graph> {
  const ran = spawnSync(
    path.join(cwd, "node_modules/.bin/depcruise"),
    ["app", "scripts", "--output-type", "json", "--cache", "node_modules/.cache/depcruise-browser"],
    { cwd, encoding: "utf8", maxBuffer: MAX_BUFFER },
  );
  if (ran.status !== EXIT_SUCCESS) {
    return { ok: false, reason: `dependency-cruiser couldn't build the module graph: ${ran.stderr.trim()}` };
  }
  const graph = graphOf(parseJson(ran.stdout));
  if (graph.size === NONE) {
    return { ok: false, reason: "dependency-cruiser listed no modules" };
  }
  return { ok: true, value: graph };
}

function browserTestFiles(cwd: string): Outcome<readonly string[]> {
  try {
    const files = readdirSync(path.join(cwd, BROWSER_TESTS)).filter((file) => file.endsWith(TEST_SUFFIX));
    return { ok: true, value: files.map((file) => `${BROWSER_TESTS}/${file}`).toSorted() };
  } catch (error) {
    return { ok: false, reason: `the browser tests couldn't be listed: ${String(error)}` };
  }
}

function inputsIn(cwd: string): Outcome<Inputs> {
  const tests = browserTestFiles(cwd);
  if (!tests.ok) {
    return tests;
  }
  const graph = moduleGraph(cwd);
  if (!graph.ok) {
    return graph;
  }
  return { ok: true, value: { graph: graph.value, tests: tests.value } };
}

function reachedFrom(graph: Graph, roots: readonly string[]): ReadonlySet<string> {
  const reached = new Set<string>();
  const pending = [...roots];
  while (pending.length > NONE) {
    const file = pending.pop() ?? "";
    if (!reached.has(file)) {
      reached.add(file);
      pending.push(...(graph.get(file) ?? []));
    }
  }
  return reached;
}

function inert(file: string): boolean {
  return (
    file.endsWith(".md") || INERT_FILES.has(file) || INERT_DIRECTORIES.some((directory) => file.startsWith(directory))
  );
}

function unknownChange(changed: readonly string[], graph: Graph): string {
  const served = reachedFrom(graph, SERVED_ROOTS);
  for (const file of changed) {
    if (served.has(file)) {
      return `${file} is part of the cookout every browser test drives`;
    }
    if (!graph.has(file) && !inert(file)) {
      return `the module graph doesn't hold ${file}`;
    }
  }
  return "";
}

function selected(changed: readonly string[], { graph, tests }: Inputs): BrowserTests {
  const reason = unknownChange(changed, graph);
  if (reason !== "") {
    return { all: true, reason };
  }
  const run = tests.filter((test) => {
    const reached = reachedFrom(graph, [test]);
    return changed.some((file) => reached.has(file));
  });
  return { all: false, run, skipped: tests.filter((test) => !run.includes(test)) };
}

function browserTestsFor({ changed, cwd }: Changed): BrowserTests {
  if (!changed.ok) {
    return { all: true, reason: changed.reason };
  }
  const inputs = inputsIn(cwd);
  if (!inputs.ok) {
    return { all: true, reason: inputs.reason };
  }
  return selected(changed.value, inputs.value);
}

function browserSkip(tests: BrowserTests): readonly CiOnly[] {
  if (tests.all || tests.skipped.length === NONE) {
    return [];
  }
  const names = tests.skipped.map((test) => path.basename(test, TEST_SUFFIX)).join(", ");
  const total = tests.run.length + tests.skipped.length;
  return [
    {
      ciJob: "browser",
      command: "pnpm browser",
      name: `the browser tests this branch doesn't reach (${String(tests.skipped.length)} of ${String(total)} files: ${names})`,
    },
  ];
}

export type { BrowserTests };
export { browserSkip, browserTestsFor };
