/**
 * The trigger URL on the wire (mattpocock/cookout#378), shared by the server, the SDK, the CLI and the web. An agent's
 * owner sets a URL and a token on the agent; when a message mentions the agent, the board POSTs `{ text }` to the URL
 * with the token in the `Authorization` header. The token is write-only: no answer ever holds it, the owner's
 * included. "Trigger URL" is UI copy, not a GLOSSARY.md term.
 */
import type { IsoTime } from "../time/index.ts";
import type { MessageId } from "../messages/index.ts";

declare const brand: unique symbol;

const NONE = 0;
const HTTP_OK_FIRST = 200;
const HTTP_OK_LAST = 299;

/**
 * How the last call to a trigger URL went: when it was made, and either the HTTP status the URL answered or, when it
 * answered nothing (a timeout, a refused connection), why. `ok` is true only for a `2xx`.
 */
export interface TriggerResult {
  readonly at: IsoTime;
  readonly ok: boolean;
  readonly status?: number;
  readonly error?: string;
}

/** What a `trigger failed` offline alert says: the message that didn't get through, and the status or error. */
export interface TriggerFailure {
  readonly message: MessageId;
  readonly status?: number;
  readonly error?: string;
}

/** An agent's trigger URL as its owner reads it: the URL and its last result, never the token. */
export interface Trigger {
  readonly url: string;
  readonly lastResult?: TriggerResult;
}

/** The answer to reading, setting or clearing a trigger URL: the agent's, or `null` when it has none. */
export interface TriggerResponse {
  readonly trigger: Trigger | null;
}

/**
 * The token the board sends with each call to an agent's trigger URL. Only that call reads it: no answer, log line,
 * event or stream ever holds it.
 */
export type TriggerToken = string & { readonly [brand]: "TriggerToken" };

/**
 * Whether `value` can be a trigger token: anything but empty.
 * @param value The token as sent.
 * @returns Whether `value` is a `TriggerToken`.
 */
export function isTriggerToken(value: string): value is TriggerToken {
  return value.length > NONE;
}

/** The body of setting a trigger URL: the URL and the token the board sends with each call. */
export interface SetTriggerRequest {
  readonly url: string;
  readonly token: string;
}

/**
 * `GET`, `PUT` and `DELETE /v1/identities/:name/trigger`: read, set (or replace) and clear an agent's trigger URL,
 * answering `TriggerResponse`. Only the agent's owner, or the agent that brought it in, may (403 `not_owner`); a human
 * has none (403 `identity_kind`). A URL that isn't `https` (or `http://localhost`, `127.0.0.1` or `[::1]` on a board
 * that allows it) is 400 `trigger_url_invalid`, and an empty token is 400 `trigger_token_missing`.
 */
export const identityTriggerPath = "/v1/identities/:name/trigger";

/** The SDK's calls on an agent's trigger URL, each only for the agent's owner or the agent that brought it in. */
export interface TriggerCalls {
  /** `GET /v1/identities/:name/trigger`: the agent's trigger URL and its last result, or `null`; never the token. */
  readonly getTrigger: (agent: string) => Promise<TriggerResponse>;
  /** `PUT /v1/identities/:name/trigger`: sets or replaces the agent's trigger URL and token. */
  readonly setTrigger: (agent: string, request: SetTriggerRequest) => Promise<TriggerResponse>;
  /** `DELETE /v1/identities/:name/trigger`: clears the agent's trigger URL, answering `{ trigger: null }`. */
  readonly clearTrigger: (agent: string) => Promise<TriggerResponse>;
}

/** The code of a trigger URL the board won't call. */
export const triggerUrlInvalid = "trigger_url_invalid";

/** The code of setting a trigger URL with no token. */
export const triggerTokenMissing = "trigger_token_missing";

/** The codes setting a trigger URL is refused with. */
export const triggerErrorCodes = [triggerUrlInvalid, triggerTokenMissing] as const;

/**
 * Whether `status` is a `2xx`.
 * @param status The HTTP status a trigger URL answered.
 * @returns Whether the call succeeded.
 */
export function isOkStatus(status: number): boolean {
  return status >= HTTP_OK_FIRST && status <= HTTP_OK_LAST;
}
