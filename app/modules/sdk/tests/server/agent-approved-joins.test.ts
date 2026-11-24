import type {
  AgentJoinCollectedResponse,
  AgentJoinRequestStartedResponse,
  StartAgentJoinRequest,
} from "../../../agent-sessions/index.ts";
import type { AgentSessionResponse, Identity } from "../../index.ts";
import { TestCookout, answer, refusal, testCookout } from "../../../testing/server.ts";
import type { TestCookoutService, TestIdentity } from "../../../testing/server.ts";
import { expect, it } from "@effect/vitest";
import { Effect } from "effect";

const FORBIDDEN = 403;
const CONFLICT = 409;
const asked = { as: "worker", host: "build-box" };

interface Board {
  readonly cookout: TestCookoutService;
  readonly ada: TestIdentity;
  readonly chief: TestIdentity;
}

const board: Effect.Effect<Board, never, TestCookout> = Effect.gen(function* seedBoard() {
  const cookout = yield* TestCookout;
  const ada = yield* cookout.createIdentity("ada", { kind: "human" });
  yield* cookout.createIdentity("bob", { kind: "human" });
  const chief = yield* cookout.createIdentity("chief", { owner: "ada" });
  return { ada, chief, cookout };
});

function started(on: Board, request: StartAgentJoinRequest = asked): Effect.Effect<string> {
  return Effect.map(
    answer(() => on.cookout.clientFor().startAgentJoin(request)),
    ({ userCode }) => userCode,
  );
}

function sessionOf(response: AgentJoinCollectedResponse): AgentSessionResponse {
  if (response.status === "approved") {
    return response.agentSession;
  }
  return expect.unreachable("The agent join request was not approved.");
}

function collected(
  on: Board,
  requestId: AgentJoinRequestStartedResponse["requestId"],
): Effect.Effect<AgentSessionResponse> {
  return Effect.map(
    answer(() => on.cookout.clientFor().collectAgentJoin(requestId)),
    sessionOf,
  );
}

function approvedByChief(on: Board, request: StartAgentJoinRequest = asked): Effect.Effect<AgentSessionResponse> {
  return Effect.gen(function* approveAndCollect() {
    const start = yield* answer(() => on.cookout.clientFor().startAgentJoin(request));
    yield* answer(() => on.chief.client.approveAgentJoin(start.userCode));
    return yield* collected(on, start.requestId);
  });
}

function identityOf(on: Board, name: string): Effect.Effect<Identity> {
  return Effect.map(
    answer(() => on.ada.client.getIdentity(name)),
    ({ identity }) => identity,
  );
}

it.effect("an agent approves a join for its owner, and the new agent records who brought it in", () =>
  Effect.gen(function* approveAsAgent() {
    const on = yield* board;
    const session = yield* approvedByChief(on);
    const actingAs = yield* answer(on.cookout.clientFor(session.agentSessionToken).whoami);
    const shown = yield* identityOf(on, "worker");

    expect(session).toMatchObject({ created: true, identity: "worker" });
    expect(actingAs.identity).toMatchObject({ broughtInBy: "chief", kind: "agent", name: "worker", owner: "ada" });
    expect(shown).toMatchObject({ broughtInBy: "chief", owner: "ada" });
  }).pipe(Effect.provide(testCookout())),
);

it.effect("an agent sees a join request as it would join for its owner", () =>
  Effect.gen(function* previewAsAgent() {
    const on = yield* board;
    const code = yield* started(on);
    const shown = yield* answer(() => on.chief.client.getAgentJoinRequest(code));

    expect(shown.agentJoinRequest).toMatchObject({ approved: false, creates: true, joins: "worker" });
  }).pipe(Effect.provide(testCookout())),
);

it.effect("an agent approves a join in its owner's namespace", () =>
  Effect.gen(function* approveNamespaced() {
    const on = yield* board;
    const session = yield* approvedByChief(on, { ...asked, as: "ada/worker" });

    expect(session).toMatchObject({ created: true, identity: "ada/worker" });
  }).pipe(Effect.provide(testCookout())),
);

it.effect("a join a person approves records no one as bringing it in", () =>
  Effect.gen(function* approveAsPerson() {
    const on = yield* board;
    const code = yield* started(on);
    yield* answer(() => on.ada.client.approveAgentJoin(code));
    const shown = yield* identityOf(on, "worker");

    expect(shown).not.toHaveProperty("broughtInBy");
  }).pipe(Effect.provide(testCookout())),
);

it.effect("an agent may not approve a join for a human identity", () =>
  Effect.gen(function* refuseHuman() {
    const on = yield* board;
    const code = yield* started(on, { ...asked, as: "bob" });
    const refused = yield* refusal(() => on.chief.client.approveAgentJoin(code));

    expect(refused).toMatchObject({ code: "identity_kind", status: FORBIDDEN });
  }).pipe(Effect.provide(testCookout())),
);

it.effect("an agent may not approve a join in another owner's namespace", () =>
  Effect.gen(function* refuseOtherNamespace() {
    const on = yield* board;
    const code = yield* started(on, { ...asked, as: "bob/x" });
    const refused = yield* refusal(() => on.chief.client.approveAgentJoin(code));

    expect(refused).toMatchObject({ code: "not_owner", status: FORBIDDEN });
  }).pipe(Effect.provide(testCookout())),
);

it.effect("an agent may not approve a join for a plain name another owner's agent has taken", () =>
  Effect.gen(function* refuseTakenName() {
    const on = yield* board;
    yield* on.cookout.createIdentity("worker", { owner: "bob" });
    const code = yield* started(on);
    const refused = yield* refusal(() => on.chief.client.approveAgentJoin(code));
    const namespaced = yield* refusal(() => on.ada.client.getIdentity("ada/worker"));

    expect(refused).toMatchObject({ code: "not_owner", status: FORBIDDEN });
    expect(namespaced).toMatchObject({ code: "identity_not_found" });
  }).pipe(Effect.provide(testCookout())),
);

it.effect("an agent may not approve a rejoin of an agent it didn't bring in", () =>
  Effect.gen(function* refuseRejoin() {
    const on = yield* board;
    yield* on.cookout.createIdentity("worker", { owner: "ada" });
    const code = yield* started(on);
    const refused = yield* refusal(() => on.chief.client.approveAgentJoin(code));

    expect(refused).toMatchObject({ code: "not_brought_in", status: FORBIDDEN });
  }).pipe(Effect.provide(testCookout())),
);

it.effect("an agent may not approve a rejoin of an agent another agent brought in", () =>
  Effect.gen(function* refuseOthersAgent() {
    const on = yield* board;
    const deputy = yield* on.cookout.createIdentity("deputy", { owner: "ada" });
    yield* approvedByChief({ ...on, chief: deputy });
    const code = yield* started(on);
    const refused = yield* refusal(() => on.chief.client.approveAgentJoin(code));

    expect(refused).toMatchObject({ code: "not_brought_in", status: FORBIDDEN });
  }).pipe(Effect.provide(testCookout())),
);

it.effect("an agent may not force a join for an agent it didn't bring in", () =>
  Effect.gen(function* refuseForce() {
    const on = yield* board;
    const worker = yield* on.cookout.createIdentity("worker", { owner: "ada" });
    yield* answer(() => on.cookout.clientFor(worker.token).join({ as: "worker" }));
    const code = yield* started(on);
    const refused = yield* refusal(() => on.chief.client.approveAgentJoin(code, { force: true }));

    expect(refused).toMatchObject({ code: "not_brought_in", status: FORBIDDEN });
  }).pipe(Effect.provide(testCookout())),
);

it.effect(
  "an agent approves a rejoin of an agent it brought in, forcing only when asked, and keeps brought-in-by",
  () =>
    Effect.gen(function* rejoinBroughtIn() {
      const on = yield* board;
      const first = yield* approvedByChief(on);
      const again = yield* answer(() => on.cookout.clientFor().startAgentJoin(asked));
      const live = yield* refusal(() => on.chief.client.approveAgentJoin(again.userCode));
      yield* answer(() => on.chief.client.approveAgentJoin(again.userCode, { force: true }));
      const second = yield* collected(on, again.requestId);
      const ended = yield* refusal(on.cookout.clientFor(first.agentSessionToken).whoami);
      const shown = yield* identityOf(on, "worker");

      expect([live, second, ended, shown]).toMatchObject([
        { code: "agent_session_live", status: CONFLICT },
        { created: false, identity: "worker" },
        { code: "agent_session_revoked" },
        { broughtInBy: "chief" },
      ]);
    }).pipe(Effect.provide(testCookout())),
);

it.effect("an agent ends the agent session of, and deactivates, an agent it brought in", () =>
  Effect.gen(function* manageBroughtIn() {
    const on = yield* board;
    const session = yield* approvedByChief(on);
    yield* answer(() => on.chief.client.revokeAgentSession("worker"));
    const ended = yield* refusal(on.cookout.clientFor(session.agentSessionToken).whoami);
    const deactivated = yield* answer(() => on.chief.client.deactivateIdentity("worker"));

    expect(ended).toMatchObject({ code: "agent_session_revoked" });
    expect(deactivated.identity).toMatchObject({ deactivated: true, name: "worker" });
  }).pipe(Effect.provide(testCookout())),
);

it.effect("an agent may not end the agent session of, or deactivate, an agent it didn't bring in", () =>
  Effect.gen(function* refuseManage() {
    const on = yield* board;
    yield* on.cookout.createIdentity("worker", { owner: "ada" });
    const revoke = yield* refusal(() => on.chief.client.revokeAgentSession("worker"));
    const deactivate = yield* refusal(() => on.chief.client.deactivateIdentity("worker"));

    expect([revoke, deactivate]).toMatchObject([
      { code: "not_owner", status: FORBIDDEN },
      { code: "not_owner", status: FORBIDDEN },
    ]);
  }).pipe(Effect.provide(testCookout())),
);

const trigger = { token: "routine-secret-6c1f", url: "https://routines.example.com/fire" };

it.effect("an agent reads, sets and clears the trigger URL of an agent it brought in", () =>
  Effect.gen(function* bringerSetsTrigger() {
    const on = yield* board;
    yield* approvedByChief(on);
    const set = yield* answer(() => on.chief.client.setTrigger("worker", trigger));
    const read = yield* answer(() => on.chief.client.getTrigger("worker"));
    const cleared = yield* answer(() => on.chief.client.clearTrigger("worker"));

    expect([set, read, cleared]).toStrictEqual([
      { trigger: { url: trigger.url } },
      { trigger: { url: trigger.url } },
      { trigger: null },
    ]);
  }).pipe(Effect.provide(testCookout())),
);

it.effect(
  "another agent of the same owner may not read, set or clear the trigger URL of an agent it didn't bring in",
  () =>
    Effect.gen(function* otherAgentRefused() {
      const on = yield* board;
      const deputy = yield* on.cookout.createIdentity("deputy", { owner: "ada" });
      yield* approvedByChief(on);
      const refused = yield* Effect.all(
        [
          refusal(() => deputy.client.getTrigger("worker")),
          refusal(() => deputy.client.setTrigger("worker", trigger)),
          refusal(() => deputy.client.clearTrigger("worker")),
        ],
        { concurrency: 1 },
      );

      expect(refused).toMatchObject([
        { code: "not_owner", status: FORBIDDEN },
        { code: "not_owner", status: FORBIDDEN },
        { code: "not_owner", status: FORBIDDEN },
      ]);
    }).pipe(Effect.provide(testCookout())),
);

it.effect("the owner still sets and clears the trigger URL of an agent its agent brought in", () =>
  Effect.gen(function* ownerSetsTrigger() {
    const on = yield* board;
    yield* approvedByChief(on);
    const set = yield* answer(() => on.ada.client.setTrigger("worker", trigger));
    const cleared = yield* answer(() => on.ada.client.clearTrigger("worker"));

    expect([set, cleared]).toStrictEqual([{ trigger: { url: trigger.url } }, { trigger: null }]);
  }).pipe(Effect.provide(testCookout())),
);

it.effect("an agent gets no other new powers over an agent it brought in", () =>
  Effect.gen(function* noOtherPowers() {
    const on = yield* board;
    yield* approvedByChief(on);
    const rotate = yield* refusal(() => on.chief.client.rotateToken("worker"));
    yield* answer(() => on.ada.client.deactivateIdentity("worker"));
    const reactivate = yield* refusal(() => on.chief.client.reactivateIdentity("worker"));

    expect([rotate, reactivate]).toMatchObject([
      { code: "not_owner", status: FORBIDDEN },
      { code: "not_owner", status: FORBIDDEN },
    ]);
  }).pipe(Effect.provide(testCookout())),
);
