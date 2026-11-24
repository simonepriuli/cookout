import { Context, DateTime, Effect, Option, Predicate, String as Str } from "effect";
import type { Harness, Identity, IdentityName, Token, TokenHash } from "../../index.ts";
import type { StorageUnavailable, TokenLookup, UseAgentSessionResult } from "../../../storage/server.ts";
import { agentSessionExpired, agentSessionRevoked } from "../../../agent-sessions/index.ts";
import { sessionCookieName, token } from "../../index.ts";
import type { MessageId } from "../../../messages/index.ts";
import type { Principal } from "./principals.ts";
import type { Refusal } from "../../../http/index.ts";
import { Secrets } from "../../../secrets/server.ts";
import { Storage } from "../../../storage/server.ts";
import { commandTokenPrincipal } from "./principals.ts";
import { isoTimeOf } from "../../../time/server.ts";
import { messagesPath } from "../../../messages/index.ts";

const authorizationHeader = /^Bearer +(\S+)\s*$/iu;

const tokenMissing: Refusal = {
  code: "token_missing",
  message: "Send your token as `Authorization: Bearer <token>` (COOKOUT_TOKEN).",
  status: 401,
};

const tokenRevoked: Refusal = {
  code: "token_revoked",
  message: "This token was revoked. Ask an admin for a new one.",
  status: 401,
};

const identityDeactivated: Refusal = {
  code: "token_revoked",
  message: "This token's identity is deactivated, so none of its tokens work.",
  status: 401,
};

const agentSessionRevokedRefusal: Refusal = {
  code: agentSessionRevoked,
  message:
    "This agent session token was revoked (by leave, another session's join --force, or its owner or an admin). Join again.",
  status: 401,
};

const agentSessionExpiredRefusal: Refusal = {
  code: agentSessionExpired,
  message: "This agent session token expired after going unused for its idle expiry. Join again.",
  status: 401,
};

const outsideCommandThread: Refusal = {
  code: "outside_command_thread",
  message: "A command token can only post replies in its call's thread.",
  status: 403,
};

const CommandThread = Context.Reference<Option.Option<MessageId>>("cookout/identities/CommandThread", {
  defaultValue: Option.none,
});

const AgentSessionSent = Context.Reference<Option.Option<TokenHash>>("cookout/identities/AgentSessionSent", {
  defaultValue: Option.none,
});

const HarnessSent = Context.Reference<Option.Option<Harness>>("cookout/identities/HarnessSent", {
  defaultValue: Option.none,
});

const NO_HARNESS = {};

const sentHarness: Effect.Effect<{ readonly harness?: Harness }> = Effect.gen(function* harnessField() {
  const sent = yield* HarnessSent;
  return Option.match(sent, { onNone: () => NO_HARNESS, onSome: (harness) => ({ harness }) });
});

interface RequestTarget {
  readonly method: string;
  readonly url: string;
}

function requireCommandRoute({ method, url }: RequestTarget): Effect.Effect<void, Refusal> {
  const [path] = Str.split("?")(url);
  if (method === "POST" && path === messagesPath) {
    return Effect.void;
  }
  return Effect.fail(outsideCommandThread);
}

interface Credentials {
  readonly authorization: string | undefined;
  readonly sessionCookie: string | undefined;
}

function tokenInHeader(authorization: string): Effect.Effect<Token, Refusal> {
  const sent = authorizationHeader.exec(authorization)?.[1];
  return sent === undefined ? Effect.fail(tokenMissing) : Effect.succeed(token(sent));
}

function sentToken({ authorization, sessionCookie }: Credentials): Effect.Effect<Token, Refusal> {
  if (authorization !== undefined) {
    return tokenInHeader(authorization);
  }
  if (sessionCookie === undefined || sessionCookie === "") {
    return Effect.fail(tokenMissing);
  }
  return Effect.succeed(token(sessionCookie));
}

interface CarriesCredentials {
  readonly headers: Readonly<Record<string, string | undefined>>;
  readonly cookies: Readonly<Record<string, string | undefined>>;
}

function credentialsOf({ cookies, headers }: CarriesCredentials): Credentials {
  return { authorization: headers["authorization"], sessionCookie: cookies[sessionCookieName] };
}

const endedAgentSession = {
  deactivated: identityDeactivated,
  expired: agentSessionExpiredRefusal,
  revoked: agentSessionRevokedRefusal,
} as const;

function agentSessionPrincipal(storage: Storage["Service"], hash: TokenHash) {
  return (used: UseAgentSessionResult): Effect.Effect<Principal, Refusal | StorageUnavailable> => {
    if (used.status === "active") {
      return Effect.succeed({ agentSession: Option.some(hash), commandThread: Option.none(), identity: used.identity });
    }
    if (used.status === "unknown") {
      return Effect.flatMap(storage.findCommandToken(hash), commandTokenPrincipal({ hash, storage }));
    }
    return Effect.fail(endedAgentSession[used.status]);
  };
}

function usedAgentSession(
  storage: Storage["Service"],
  hash: TokenHash,
): Effect.Effect<Principal, Refusal | StorageUnavailable> {
  return Effect.gen(function* useSentAgentSession() {
    const now = yield* DateTime.now;
    const used = yield* storage.useAgentSession({ hash, now: isoTimeOf(now) });
    return yield* agentSessionPrincipal(storage, hash)(used);
  });
}

function principalOf(storage: Storage["Service"], hash: TokenHash) {
  return (found: TokenLookup): Effect.Effect<Principal, Refusal | StorageUnavailable> => {
    switch (found.status) {
      case "active": {
        return Effect.succeed({ agentSession: Option.none(), commandThread: Option.none(), identity: found.identity });
      }
      case "revoked": {
        return Effect.fail(tokenRevoked);
      }
      case "unknown": {
        return usedAgentSession(storage, hash);
      }
    }
  };
}

class Caller extends Context.Service<Caller, Identity>()("@ai-hero/cookout/identities/lib/server/auth/Caller") {}

function notOwner(name: IdentityName): Refusal {
  return {
    code: "not_owner",
    message: `Only the human who owns ${name}, or an admin, can do this.`,
    status: 403,
  };
}

interface Ownership {
  readonly caller: Identity;
  readonly target: Identity | undefined;
}

function ownsAgent({ caller, target }: Ownership): boolean {
  if (Predicate.isUndefined(target) || caller.kind !== "human" || target.kind !== "agent") {
    return false;
  }
  return target.owner === caller.name;
}

function requireOwnerOrAdmin(name: IdentityName): Effect.Effect<void, Refusal | StorageUnavailable, Caller | Storage> {
  return Effect.gen(function* checkOwnerOrAdmin() {
    const caller = yield* Caller;
    if (!caller.admin) {
      const storage = yield* Storage;
      const target = yield* storage.findIdentityByName(name);
      yield* Effect.when(Effect.fail(notOwner(name)), Effect.succeed(!ownsAgent({ caller, target })));
    }
  });
}

function broughtInBy({ caller, target }: Ownership): boolean {
  if (Predicate.isUndefined(target) || caller.kind !== "agent" || target.kind !== "agent") {
    return false;
  }
  return target.broughtInBy === caller.name && target.owner === caller.owner;
}

function requireOwnerBringerOrAdmin(
  name: IdentityName,
): Effect.Effect<void, Refusal | StorageUnavailable, Caller | Storage> {
  return Effect.gen(function* checkOwnerBringerOrAdmin() {
    const caller = yield* Caller;
    if (!caller.admin) {
      const storage = yield* Storage;
      const target = yield* storage.findIdentityByName(name);
      const allowed = ownsAgent({ caller, target }) || broughtInBy({ caller, target });
      yield* Effect.when(Effect.fail(notOwner(name)), Effect.succeed(!allowed));
    }
  });
}

export const authenticate =
  (storage: Storage["Service"], secrets: Secrets["Service"]) =>
  (credentials: Credentials): Effect.Effect<Principal, Refusal | StorageUnavailable> =>
    sentToken(credentials).pipe(
      Effect.flatMap(secrets.hashToken),
      Effect.flatMap((hash) => Effect.flatMap(storage.findIdentityByTokenHash(hash), principalOf(storage, hash))),
      Effect.filterOrFail(
        (principal) => principal.identity.deactivated !== true,
        () => identityDeactivated,
      ),
    );

const adminOnly: Refusal = { code: "admin_only", message: "Only an admin identity can do this.", status: 403 };

export const requireAdmin: Effect.Effect<void, Refusal, Caller> = Effect.gen(function* () {
  const caller = yield* Caller;
  if (!caller.admin) {
    return yield* Effect.fail(adminOnly);
  }
});

export type IssuedToken = { readonly token: Token; readonly hash: TokenHash };

export const issueToken: Effect.Effect<IssuedToken, never, Secrets> = Effect.gen(function* () {
  const secrets = yield* Secrets;
  const token = yield* secrets.newToken;
  return { hash: yield* secrets.hashToken(token), token };
});

export {
  AgentSessionSent,
  Caller,
  HarnessSent,
  broughtInBy,
  CommandThread,
  type Credentials,
  credentialsOf,
  ownsAgent,
  requireCommandRoute,
  requireOwnerBringerOrAdmin,
  requireOwnerOrAdmin,
  sentHarness,
  sentToken,
};
export type { Principal } from "./principals.ts";
export { harnessOf } from "./harness-guard.ts";
export { IdentityChanges, announced, announcedDeleted, reactivated, tokensEnded } from "./changes.ts";
