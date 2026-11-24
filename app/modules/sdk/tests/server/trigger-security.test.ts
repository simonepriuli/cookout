import { Array as Arr, Effect, Logger, Option, Ref, References, Schema, String as Str } from "effect";
import type { CookoutClient, CookoutEvent } from "../../index.ts";
import { TestCookout, answer, refusal, testCookout } from "../../../testing/server.ts";
import type { TestCookoutService, TestIdentity } from "../../../testing/server.ts";
import { expect, it } from "@effect/vitest";
import type { Scope } from "effect";
import { TestClock } from "effect/testing";

const AGENT = "triage";
const TOKEN = "routine-secret-6c1f";
const HUMAN = { kind: "human" } as const;
const HTTPS_URL = "https://routines.example.com/fire";
const LAST = "last words";
const BAD_REQUEST = 400;
const FORBIDDEN = 403;
const NOT_FOUND = 404;
const SERVER_ERROR = 500;
const ONCE = 1;
const BOTH_CALLS = 2;

interface Board {
  readonly cookout: TestCookoutService;
  readonly matt: TestIdentity;
  readonly ada: TestIdentity;
  readonly agent: TestIdentity;
}

const board: Effect.Effect<Board, never, TestCookout> = Effect.gen(function* mattHisAgentAndAda() {
  const cookout = yield* TestCookout;
  const matt = yield* cookout.createIdentity("matt", HUMAN);
  const ada = yield* cookout.createIdentity("ada", HUMAN);
  const agent = yield* cookout.createIdentity(AGENT, { owner: "matt" });
  yield* answer(() => matt.client.createChannel({ name: "grill" }));
  return { ada, agent, cookout, matt };
});

const NOTHING = 0;
const EVERY_REFUSAL = 9;
const encodeJson = Schema.encodeUnknownOption(Schema.fromJsonString(Schema.Unknown));

function jsonOf(value: unknown): string {
  return Option.getOrElse(encodeJson(value), () => "");
}

type Seen = Ref.Ref<readonly CookoutEvent[]>;

const tick = TestClock.withLive(Effect.sleep("10 millis"));

function eventOf(step: Readonly<IteratorResult<CookoutEvent, unknown>>): Option.Option<CookoutEvent> {
  if (step.done === true) {
    return Option.none();
  }
  return Option.some(step.value);
}

function collecting(client: CookoutClient): Effect.Effect<Seen, never, Scope.Scope> {
  return Effect.gen(function* collectEvents() {
    const events = yield* Effect.acquireRelease(
      answer(() => client.watch()),
      (stream) => answer(() => stream.close()),
    );
    const iterator = events[Symbol.asyncIterator]();
    const seen = yield* Ref.make<readonly CookoutEvent[]>([]);
    const next = answer(() => iterator.next()).pipe(
      Effect.map(eventOf),
      Effect.tap((event) => Ref.update(seen, (before) => [...before, ...Option.toArray(event)])),
      Effect.repeat({ until: Option.isNone }),
    );
    yield* Effect.forkScoped(next);
    return seen;
  });
}

function heard(seen: Effect.Effect<readonly CookoutEvent[]>, text: string): Effect.Effect<readonly CookoutEvent[]> {
  return seen.pipe(
    Effect.tap(() => tick),
    Effect.repeat({ until: (events) => Str.includes(text)(jsonOf(events)) }),
  );
}

interface Captured {
  readonly logger: Logger.Logger<unknown, number>;
  readonly logged: () => string;
}

function capturedLogs(): Captured {
  const lines: string[] = [];
  const logger = Logger.map(Logger.formatJson, (line) => lines.push(line));
  return { logged: () => Arr.join(lines, "\n"), logger };
}

function mentionedTwice({ ada, cookout }: Board): Effect.Effect<readonly (string | undefined)[]> {
  return Effect.gen(function* failThenSucceed() {
    yield* cookout.webhook.failNext(ONCE, SERVER_ERROR);
    yield* answer(() => ada.client.createMessage({ channel: "grill", text: `@${AGENT} first` }));
    yield* cookout.webhook.waitForCalls(ONCE);
    yield* answer(() => ada.client.createMessage({ channel: "grill", text: `@${AGENT} ${LAST}` }));
    const calls = yield* cookout.webhook.waitForCalls(BOTH_CALLS);
    return Arr.map(calls, ({ headers }) => headers["authorization"]);
  });
}

function everyAnswer({ agent, cookout, matt }: Board): Effect.Effect<readonly unknown[]> {
  return Effect.all(
    [
      answer(() => matt.client.getTrigger(AGENT)),
      answer(() => matt.client.presence()),
      answer(() => matt.client.inbox()),
      answer(() => matt.client.listIdentities()),
      answer(() => cookout.client.listIdentities()),
      answer(() => cookout.client.presence()),
      answer(() => agent.client.whoami()),
      answer(() => matt.client.clearTrigger(AGENT)),
    ],
    { concurrency: 1 },
  );
}

const drivenBoard = Effect.gen(function* driveTheBoard() {
  const on = yield* board;
  const owner = yield* collecting(on.matt.client);
  const admin = yield* collecting(on.cookout.client);
  const agent = yield* collecting(on.agent.client);
  const set = yield* answer(() => on.matt.client.setTrigger(AGENT, { token: TOKEN, url: on.cookout.webhook.url }));
  const calls = yield* mentionedTwice(on);
  yield* Effect.all([heard(Ref.get(owner), LAST), heard(Ref.get(owner), "trigger failed")], { concurrency: 1 });
  const answers = yield* everyAnswer(on);
  const sent = yield* Effect.forEach([owner, admin, agent], Ref.get, { concurrency: 1 });
  return { answers: [set, ...answers], calls, sent };
});

it.effect("the token is never answered, sent on a stream, or logged, only sent to the trigger URL", () =>
  Effect.gen(function* tokenStaysSecret() {
    const { logged: loggedNow, logger } = capturedLogs();
    const logs = Logger.layer([logger], { mergeWithExisting: true });
    const { answers, calls, sent } = yield* drivenBoard.pipe(
      Effect.provide(testCookout()),
      Effect.scoped,
      Effect.provide(logs),
    );
    const logged = loggedNow();

    expect(calls).toStrictEqual([`Bearer ${TOKEN}`, `Bearer ${TOKEN}`]);
    expect({
      logged: Str.includes(`trigger URL of ${AGENT}`)(logged),
      sent: Arr.flatten(sent).length > NOTHING,
    }).toStrictEqual({
      logged: true,
      sent: true,
    });
    expect(Arr.filter([jsonOf(answers), jsonOf(sent), logged], Str.includes(TOKEN))).toStrictEqual([]);
  }).pipe(Effect.provideService(References.MinimumLogLevel, "All")),
);

it.effect("another human, an admin or the agent itself may not read, set or clear an agent's trigger URL", () =>
  Effect.gen(function* onlyTheOwner() {
    const { ada, agent, cookout } = yield* board;
    const set = { token: TOKEN, url: HTTPS_URL };
    const refused = yield* Effect.forEach(
      [ada.client, cookout.client, agent.client],
      (client) =>
        Effect.all(
          [
            refusal(() => client.getTrigger(AGENT)),
            refusal(() => client.setTrigger(AGENT, set)),
            refusal(() => client.clearTrigger(AGENT)),
          ],
          { concurrency: 1 },
        ),
      { concurrency: 1 },
    );
    const notOwner = { code: "not_owner", status: FORBIDDEN };

    expect(Arr.flatten(refused)).toMatchObject(Arr.makeBy(EVERY_REFUSAL, () => notOwner));
  }).pipe(Effect.provide(testCookout())),
);

it.effect("a human has no trigger URL, and an unknown name is not found", () =>
  Effect.gen(function* noTriggerForHumans() {
    const { matt } = yield* board;
    const human = yield* refusal(() => matt.client.setTrigger("matt", { token: TOKEN, url: HTTPS_URL }));
    const unknown = yield* refusal(() => matt.client.getTrigger("nobody"));

    expect([human, unknown]).toMatchObject([
      { code: "identity_kind", status: FORBIDDEN },
      { code: "identity_not_found", status: NOT_FOUND },
    ]);
  }).pipe(Effect.provide(testCookout())),
);

const NOT_CALLABLE = [
  "http://routines.example.com/fire",
  "ftp://routines.example.com/fire",
  "http://localhost.example.com/fire",
  "not a url",
  "",
];

it.effect.each(NOT_CALLABLE)("%j is refused as a trigger URL, even on a board that allows localhost", (url) =>
  Effect.gen(function* refuseUrl() {
    const { matt } = yield* board;
    const refused = yield* refusal(() => matt.client.setTrigger(AGENT, { token: TOKEN, url }));
    const kept = yield* answer(() => matt.client.getTrigger(AGENT));

    expect([refused, kept]).toMatchObject([{ code: "trigger_url_invalid", status: BAD_REQUEST }, { trigger: null }]);
  }).pipe(Effect.provide(testCookout())),
);

const LOCAL = ["http://localhost:4000/fire", "http://127.0.0.1:4000/fire", "http://[::1]:4000/fire"];

it.effect.each(LOCAL)("%s is refused on a board that doesn't allow local trigger URLs", (url) =>
  Effect.gen(function* refuseLocal() {
    const { matt } = yield* board;
    const refused = yield* refusal(() => matt.client.setTrigger(AGENT, { token: TOKEN, url }));
    const https = yield* answer(() => matt.client.setTrigger(AGENT, { token: TOKEN, url: HTTPS_URL }));

    expect([refused, https]).toMatchObject([
      { code: "trigger_url_invalid", status: BAD_REQUEST },
      { trigger: { url: HTTPS_URL } },
    ]);
  }).pipe(Effect.provide(testCookout({ allowLocalTriggers: false }))),
);

it.effect.each(LOCAL)("%s is allowed on a board that allows local trigger URLs, as in tests", (url) =>
  Effect.gen(function* allowLocal() {
    const { matt } = yield* board;
    const set = yield* answer(() => matt.client.setTrigger(AGENT, { token: TOKEN, url }));

    expect(set).toStrictEqual({ trigger: { url } });
  }).pipe(Effect.provide(testCookout())),
);

it.effect("a trigger URL with an empty token is refused", () =>
  Effect.gen(function* refuseEmptyToken() {
    const { matt } = yield* board;
    const refused = yield* refusal(() => matt.client.setTrigger(AGENT, { token: "", url: HTTPS_URL }));

    expect(refused).toMatchObject({ code: "trigger_token_missing", status: BAD_REQUEST });
  }).pipe(Effect.provide(testCookout())),
);
