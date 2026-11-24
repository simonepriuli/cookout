/**
 * Identities on the backend: bearer auth, issuing tokens,
 * the admin identity's token from the setting, `GET /v1/whoami` and the web UI's
 * session cookie. A token is
 * never stored: only its hash, made by `Secrets`, goes into `Storage`.
 */
import {
  AgentSessionSent,
  Caller,
  CommandThread,
  HarnessSent,
  authenticate,
  credentialsOf,
  harnessOf,
  issueToken,
  requireCommandRoute,
} from "./lib/server/auth.ts";
import { Context, Effect, Layer, Option, Schema } from "effect";
import type { Credentials, IdentityChanges, IssuedToken, Principal } from "./lib/server/auth.ts";
import type { Gate, Route } from "../http/server.ts";
import type { IdentityName, Token } from "./index.ts";
import { humanAdmin, identityAdminRoutes, loginRoutes, openLoginRoutes, responseSchemas } from "./lib/server/routes.ts";
import { HttpServerRequest } from "effect/http";
import type { Refusal } from "../http/index.ts";
import { Secrets } from "../secrets/server.ts";
import { Storage } from "../storage/server.ts";
import type { StorageUnavailable } from "../storage/server.ts";
import { callerRoutes } from "./lib/server/session.ts";

export { Caller };
/**
 * The hash of the agent session token the request was sent with, and none for any other token: `leave` revokes it,
 * and an open stream checks it is still live.
 */
export { AgentSessionSent } from "./lib/server/auth.ts";
/**
 * The one thread a request may reply in when it carries a command token, and none for any other token. `Messages`
 * posts such a request only as a reply in this thread.
 */
export { CommandThread } from "./lib/server/auth.ts";
/**
 * The harness the request named in `cookout-harness`, as a field to spread into a message to post: only an
 * agent identity's request carries one (a human's is refused with 403 `agent_as_human`), and none without the header.
 */
export { sentHarness } from "./lib/server/auth.ts";

export type IdentitiesService = {
  /**
   * The identity behind a request's `Authorization` header or, without one, its session cookie, and for a command
   * token the thread of its call. An agent session token's use moves its expiry on. Refuses with 401 `token_missing`,
   * `token_unknown`, `token_revoked`, `token_expired`, `agent_session_revoked` or `agent_session_expired`.
   */
  readonly authenticate: (credentials: Credentials) => Effect.Effect<Principal, Refusal | StorageUnavailable>;
  /** A new token and its hash. Creating an identity and rotating a token both issue one. */
  readonly issueToken: Effect.Effect<IssuedToken>;
};

export class Identities extends Context.Service<Identities, IdentitiesService>()(
  "@ai-hero/cookout/identities/server/Identities",
) {}

/** `Identities` on the running `Storage` and `Secrets`. */
export const identitiesLayer: Layer.Layer<Identities, never, Storage | Secrets> = Layer.effect(
  Identities,
  Effect.gen(function* () {
    const storage = yield* Storage;
    const secrets = yield* Secrets;
    return {
      authenticate: authenticate(storage, secrets),
      issueToken: Effect.provideService(issueToken, Secrets, secrets),
    };
  }),
);

/**
 * The gate every route but `/v1/health` sits behind: authenticates the
 * request's bearer token or, without one, its session cookie, and provides
 * its identity as `Caller`. Refuses
 * with 401 `token_missing`, `token_unknown`, `token_revoked` or `token_expired`. A command token gets 403
 * `outside_command_thread` on every route but `POST /v1/messages`, and its thread as `CommandThread`. A human's
 * token sent with `cookout-harness` gets 403 `agent_as_human` on every route but join (`POST /v1/agent-session`);
 * an agent's provides the tool as `HarnessSent`.
 */
export const requireToken: Gate<
  Caller,
  Identities | HttpServerRequest.HttpServerRequest,
  Refusal | StorageUnavailable
> = (effect) =>
  Effect.gen(function* () {
    const identities = yield* Identities;
    const request = yield* HttpServerRequest.HttpServerRequest;
    const { agentSession, commandThread, identity } = yield* identities.authenticate(credentialsOf(request));
    const harness = yield* harnessOf({ headers: request.headers, identity, target: request });
    if (Option.isSome(commandThread)) {
      yield* requireCommandRoute(request);
    }
    return yield* effect.pipe(
      Effect.provideService(Caller, identity),
      Effect.provideService(CommandThread, commandThread),
      Effect.provideService(HarnessSent, harness),
      Effect.provideService(AgentSessionSent, agentSession),
    );
  });

/** `COOKOUT_ADMIN_NAME` names an agent, and only a human can be an admin, so the server does not start. */
export class AdminNameIsAgent extends Schema.TaggedError<AdminNameIsAgent, { readonly brand: unique symbol }>()(
  "AdminNameIsAgent",
  { adminName: Schema.String },
) {}

/** The admin token and the identity it belongs to, from `COOKOUT_ADMIN_TOKEN` and `COOKOUT_ADMIN_NAME`. */
export interface AdminSettings {
  readonly adminToken: Token;
  readonly adminName: IdentityName;
}

/**
 * Makes `adminToken` the only token of the identity named `adminName`, and makes it an admin: it creates a human
 * admin on a store without one, and gives it back its admin flag if another admin removed it. `cookout serve` runs
 * it at every boot with `COOKOUT_ADMIN_TOKEN` and `COOKOUT_ADMIN_NAME` (Matt, 2026-11-23, mattpocock/cookout#85 and
 * #107), so a token rotated since, lost or leaked stops working once the setting changes and the server restarts.
 * A new name leaves the identity the token belonged to in place, still an admin, with no working token.
 *
 * @param settings The token from `COOKOUT_ADMIN_TOKEN` and the name from `COOKOUT_ADMIN_NAME`.
 * @returns A Layer that sets the token when it is built, and fails with `AdminNameIsAgent` if the name is an agent's.
 */
export function adminTokenSet(
  settings: AdminSettings,
): Layer.Layer<never, StorageUnavailable | AdminNameIsAgent, Storage | Secrets> {
  const { adminName, adminToken } = settings;
  return Layer.effectDiscard(
    Effect.gen(function* setAdminToken() {
      const secrets = yield* Secrets;
      const storage = yield* Storage;
      const existing = yield* storage.findIdentityByName(adminName);
      if (Option.exists(Option.fromNullishOr(existing), ({ kind }) => kind === "agent")) {
        return yield* AdminNameIsAgent.make({ adminName });
      }
      const hash = yield* secrets.hashToken(adminToken);
      const admin = yield* humanAdmin(adminName);
      yield* storage.setOnlyToken(admin, hash);
      return yield* storage.setAdmin(admin.name, true);
    }),
  );
}

/**
 * The identity routes, for the server's route list: whoami, logging the web
 * UI in and out, create, list and rotate, and making and removing admins. They need `Caller`, which
 * `requireToken` provides.
 */
export const identityRoutes: readonly Route<Caller | Storage | Secrets | IdentityChanges>[] = [
  ...callerRoutes,
  ...identityAdminRoutes,
  ...loginRoutes,
];

/**
 * The routes that need no token: starting a login request and collecting it (ADR 0047). The server puts its
 * per-address request limit in front of them.
 */
export const openIdentityRoutes: typeof openLoginRoutes = openLoginRoutes;

/**
 * The request limit of the address a request to one of `openIdentityRoutes` comes from: `Limits` provides it.
 */
export { AddressLimit } from "./lib/server/routes.ts";

/** `PUT /v1/identities/:name/owner`, an admin transferring an agent to another human. It needs `Caller`. */
export { transferRoutes } from "./lib/server/transfer.ts";

/**
 * `POST /v1/identities/:name/deactivate` and `/reactivate`: an admin, or the human who owns an agent, switches an
 * identity off or back on (ADR 0045). Only an identity no message names can be deleted, by an admin.
 */
export { deactivationRoutes } from "./lib/server/deactivation.ts";

/**
 * `DELETE /v1/identities/:name` (admin) and `GET /v1/identities/:name/message-count`: deleting an identity no message
 * names, with everything that refers to it. It needs `Caller`. A deletion is published on the `IdentityChanges` hub.
 */
export { deletionRoutes } from "./lib/server/deletion.ts";

/** The response Schemas of the identity routes, for the SDK's generated validators. */
export const identityResponseSchemas = { ...responseSchemas };

/** The response Schemas of the login routes, for the SDK's generated validators. */
export { loginResponseSchemas } from "./lib/server/routes.ts";

/** Refuses with 403 `admin_only` unless `Caller` is an admin. */
export { requireAdmin } from "./lib/server/auth.ts";

/**
 * Refuses with 403 `not_owner` unless `Caller` is an admin or the human who owns the named agent (Matt, 2026-11-23,
 * mattpocock/cookout#118). A non-admin naming a missing identity gets 403 too, so a name's existence doesn't leak.
 */
export { requireOwnerBringerOrAdmin, requireOwnerOrAdmin } from "./lib/server/auth.ts";

/**
 * Whether `caller` is the agent that brought in the agent `target`, for the same owner (mattpocock/cookout#370): it
 * may deactivate that agent, end its agent session and set or clear its trigger URL, and nothing more.
 */
export { broughtInBy } from "./lib/server/auth.ts";

/** Reads the `:name` path parameter, refusing a name no identity could have with 404 `identity_not_found`. */
export { identityNotFound, nameParam } from "./lib/server/routes.ts";

/**
 * `PUT /v1/identities/:name/display-name` and the layer of the service behind it. The route needs `Caller`, which
 * `requireToken` provides.
 */
export { displayNameRoutes, displayNamesLayer } from "./lib/server/display-names.ts";

/**
 * `GET /v1/identities/:name` (any identity) and `PATCH /v1/identities/:name`, which sets or clears an agent's
 * description (#189): the agent itself, its owner or an admin may (403 `not_owner` otherwise; a human, who has none,
 * is 403 `identity_kind`). The `PATCH` needs `Caller`, which `requireToken` provides.
 */
export { descriptionRoutes } from "./lib/server/descriptions.ts";

/**
 * The `IdentityChanges` hub: every route that creates an identity or changes one (its display name, admin flag,
 * owner, deactivating and reactivating) publishes the identity as it now is, and the live stream sends each on as an
 * `identity` event. Deleting an identity publishes it on its own hub, which the live stream sends on as an
 * `identity-deleted` event.
 */
export { IdentityChanges, THE_COOKOUT, identityChangesLayer } from "./lib/server/changes.ts";

/**
 * Tokens a request just ended (`leave`, a revoke, a rotation, a deactivation), told through `IdentityChanges` so the
 * presence registry ends the live connections sent with them at once (ADR "how a live connection ends").
 */
export type { EndedTokens, TokensEnded } from "./lib/server/changes.ts";

/**
 * The Schemas of the identity as the server shows it and of its name, for the live stream's `identity`,
 * `agent-session` and `presence` events.
 */
export { IdentityNameSchema, IdentitySchema } from "./lib/server/wire.ts";

/** The Schemas of an agent identity and of a description as sent, for a route that creates an agent. */
export { AgentIdentitySchema, SentDescriptionSchema, SentDisplayNameSchema } from "./lib/server/wire.ts";
