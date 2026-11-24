import { Caller, broughtInBy, identityNotFound, nameParam } from "../../../identities/server.ts";
import { Effect, Option, Predicate } from "effect";
import type { Identity, IdentityName } from "../../../identities/index.ts";
import type { Refusal } from "../../../http/index.ts";
import { Storage } from "../../../storage/server.ts";
import type { StorageUnavailable } from "../../../storage/server.ts";
import { triggerTokenMissing } from "../../index.ts";

const BAD_REQUEST = 400;
const FORBIDDEN = 403;

const tokenMissing: Refusal = {
  code: triggerTokenMissing,
  message: "A trigger URL needs a token, which the board sends with each call.",
  status: BAD_REQUEST,
};

function notOwner(name: IdentityName): Refusal {
  return {
    code: "not_owner",
    message: `Only the human who owns ${name}, or the agent that brought it in, can set its trigger URL.`,
    status: FORBIDDEN,
  };
}

function humanHasNone(name: IdentityName): Refusal {
  return {
    code: "identity_kind",
    message: `${name} is a human identity; only an agent has a trigger URL.`,
    status: FORBIDDEN,
  };
}

function refusalFor(caller: Identity, name: IdentityName, target: Identity | undefined): Option.Option<Refusal> {
  if (Predicate.isUndefined(target)) {
    return Option.some(identityNotFound(name));
  }
  if (target.kind === "human") {
    return Option.some(humanHasNone(name));
  }
  if (caller.name !== target.owner && !broughtInBy({ caller, target })) {
    return Option.some(notOwner(name));
  }
  return Option.none();
}

function ownedAgent(
  params: Readonly<Record<string, string>>,
): Effect.Effect<Identity, Refusal | StorageUnavailable, Caller | Storage> {
  return Effect.gen(function* findOwnedAgent() {
    const caller = yield* Caller;
    const name = yield* nameParam(params);
    const storage = yield* Storage;
    const target = yield* storage.findIdentityByName(name);
    const refused = refusalFor(caller, name, target);
    if (Option.isSome(refused)) {
      return yield* Effect.fail(refused.value);
    }
    return yield* Effect.orDie(Effect.fromNullishOr(target));
  });
}

export { ownedAgent, tokenMissing };
