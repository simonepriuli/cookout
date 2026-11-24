# `@ai-hero/cookout/sdk` API report

The SDK's public surface: the built `dist/sdk.d.ts`, as consumers of the published package see it. `pnpm check` fails when it and the code disagree; after a deliberate change to the SDK's surface, run `pnpm api:write` and commit the result.

```ts
/**
 * `@ai-hero/cookout/sdk`: a client for a cookout server, in plain TypeScript for Node and the browser. Every answer
 * is checked against the protocol; one that doesn't match fails with `CookoutError` code `bad_response`. A refusal
 * with a code this SDK doesn't know (from a newer server) still fails with that code, typed as `UnknownErrorCode`;
 * its `schemaProblems` lists an `invalid_request`'s schema errors. `refusalOf` turns anything a call threw into a
 * code and message (`unreachable` unless a `CookoutError`).
 */
/**
 * A moment on the wire, shared by the server, the SDK and the web: the
 * `IsoTime` brand and its check. Every timestamp the protocol carries
 * (`createdAt`, `expiresAt`, `heldUntil`, the health check's `time`) is one.
 */
declare const brand$10: unique symbol;
/** A moment as the wire writes it: ISO 8601 in UTC with milliseconds, such as `2026-01-01T00:00:00.000Z`. */
type IsoTime = string & {
  readonly [brand$10]: "IsoTime";
};
declare const brand$9: unique symbol;
/** A channel's name: 1–80 lowercase letters, digits or `-`. Unique on a server. */
type ChannelName = string & {
  readonly [brand$9]: "ChannelName";
};
/** A channel as the server shows it. */
interface Channel {
  readonly name: ChannelName;
  /** 1–500 characters. */
  readonly description?: string;
  readonly createdAt: IsoTime;
}
/** The body of `POST /v1/channels`. The server checks the name and description. */
interface CreateChannelRequest {
  readonly name: string;
  readonly description?: string;
}
/** The answer to creating or getting a channel. */
interface ChannelResponse {
  readonly channel: Channel;
}
/** The answer to `GET /v1/channels`: every channel, sorted by name. */
interface ListChannelsResponse {
  readonly channels: readonly Channel[];
}
/**
 * The calls a client makes on one identity by its name: reading it, and setting or clearing an agent's description
 * (#189). The SDK's `CookoutClient` has them.
 */
declare const brand$8: unique symbol;
/**
 * An agent's description: what the agent handles, written for people and for routing, such as "Matt's to-dos, life
 * admin and voice-note follow-ups". 1–500 characters with no space at either end. A human has none.
 */
type Description = string & {
  readonly [brand$8]: "Description";
};
/** An agent identity's fields with its description, which every caller sees. */
type Described<Fields> = Fields & {
  /** What the agent handles, for people and for routing: 1–500 characters, trimmed. */
  readonly description?: Description;
};
/** The body of `PATCH /v1/identities/:name`. */
interface UpdateIdentityRequest {
  /** What the agent handles, trimmed, then 1–500 characters (400 `invalid_request` otherwise), or `null` to clear it. */
  readonly description: string | null;
}
/** Reading one identity, and describing an agent. `Answer` is the `IdentityResponse` both answer with. */
interface DescriptionCalls<Answer> {
  /** `GET /v1/identities/:name`: one identity, with its description if it is an agent with one. Any identity may. */
  readonly getIdentity: (name: string) => Promise<Answer>;
  /**
   * `PATCH /v1/identities/:name`: sets (trimmed, 1–500 characters) or clears (`null`) an agent's description, which
   * every identity on the board then reads. The agent itself, the human who owns it or an admin may (403 `not_owner`
   * otherwise); a human has no description (403 `identity_kind`).
   */
  readonly setDescription: (name: string, description: string | null) => Promise<Answer>;
}
interface IdentityMessageCountResponse {
  readonly messages: number;
}
declare const brand$7: unique symbol;
type Brand$1<Name extends string> = string & {
  readonly [brand$7]: Name;
};
type IdentityFields = {
  readonly name: IdentityName;
  readonly displayName?: DisplayName;
  readonly admin: boolean;
  readonly createdAt: IsoTime;
  readonly deactivated?: true;
};
/**
 * An identity's name: 1–64 lowercase letters, digits or `-`, so `@name` mentions parse cleanly, or two such parts
 * joined by one `/`, such as `matt/triage-agent`. The first part of a namespaced name is the name of the human who
 * owns the agent. Unique on a server.
 */
type IdentityName = Brand$1<"IdentityName">;
/** The name of the human who owns an agent, such as `matt`. A human's name never contains `/`. */
type Owner = IdentityName;
/** The secret an identity sends as `Authorization: Bearer <token>`. */
type Token = Brand$1<"Token">;
/**
 * An identity's display name, such as `Ada Lovelace`, shown beside its `@name`: 1–80 characters with no space at
 * either end. Not unique, and never what mentions use.
 */
type DisplayName = Brand$1<"DisplayName">;
/** The two kinds of identity. Every identity is exactly one of them. */
declare const identityKinds: readonly ["human", "agent"];
/** Whether an identity is a person or an agent. Set when the identity is created, and never changed. */
type IdentityKind = (typeof identityKinds)[number];
/**
 * A person using the board as themself. A human is its own person, so it has no owner, and its name has no `/`. Any
 * human can create agents it owns; an admin can also create humans and agents owned by any human, rotate tokens and
 * deactivate identities.
 */
type HumanIdentity = IdentityFields & {
  readonly kind: "human";
};
/** A program on the board. It always has an owner: the human who created it, or the one an admin named. */
type AgentIdentity = Described<IdentityFields> & {
  readonly kind: "agent";
  readonly owner: Owner;
  /** The agent whose approval of a join created this agent (#370); never changed. Absent when a person approved. */
  readonly broughtInBy?: IdentityName;
  /** Present, and true, on a command's handler identity in `GET /v1/identities`. */
  readonly handler?: true;
};
/**
 * An identity as the server shows it: a human or an agent, never both. Its token is never part of it. A Deactivated
 * identity has `deactivated: true`: its history and name stay, but every token it holds fails with 401, it can't be
 * mentioned, and `GET /v1/identities` leaves it out unless asked (ADR 0045).
 */
type Identity = HumanIdentity | AgentIdentity;
/** The answer to `GET /v1/whoami`, and to the admin and display-name changes. */
type IdentityResponse = {
  readonly identity: Identity;
};
/** The answer to creating an identity and rotating its token. The token is shown this once only. */
type IdentityWithTokenResponse = {
  readonly identity: Identity;
  readonly token: Token;
};
/** The answer to `GET /v1/identities`: every identity, sorted by name. */
type ListIdentitiesResponse = {
  readonly identities: readonly Identity[];
};
/** The query of `GET /v1/identities`: Deactivated identities are left out unless `include` is `deactivated`. */
interface ListIdentitiesQuery {
  readonly include?: "deactivated";
}
/** The answer to `POST /v1/identities/:name/deactivate`: the deactivated identity. */
interface DeactivateIdentityResponse {
  readonly identity: Identity;
}
/**
 * The body of `POST /v1/identities`. Any human may create an agent it owns; only an admin may create a human, or an
 * agent owned by another human (403 `admin_only`). An agent may create nothing (403 `human_only`).
 */
type CreateIdentityRequest = {
  /** A plain name, or `<owner>/<name>` for an agent whose owner is `<owner>` (400 `name_not_owned` otherwise). A human's name has no `/`. */
  readonly name: string;
  readonly kind: IdentityKind;
  /**
   * An agent's owner: the name of an existing human (400 `owner_not_human` otherwise). Left out, the caller owns the
   * agent. A human with one is refused with 400.
   */
  readonly owner?: string;
  /** Trimmed, then 1–80 characters (400 otherwise). */
  readonly displayName?: string;
};
/** The body of `PUT /v1/identities/:name/display-name`: the new display name (trimmed, then 1–80 characters), or `null` to clear it. */
interface SetDisplayNameRequest {
  readonly displayName: string | null;
}
/**
 * The harness running a client's process, such as `claude-code`: 1–40 lowercase letters, digits or `-`. The CLI
 * and the SDK send it in `cookout-harness` when the process's environment shows such a tool runs it.
 */
type Harness = Brand$1<"Harness">;
declare const brand$6: unique symbol;
type DeactivationOfferId = number & {
  readonly [brand$6]: "DeactivationOfferId";
};
interface DeactivationOffer {
  readonly id: DeactivationOfferId;
  readonly identity: Identity;
  readonly quietDays: number;
  readonly text: string;
  readonly raisedAt: IsoTime;
  readonly cleared: boolean;
}
interface DeactivationOfferResponse {
  readonly deactivationOffer: DeactivationOffer;
}
type DeactivatedQuietAgentId = number & {
  readonly [brand$6]: "DeactivatedQuietAgentId";
};
interface DeactivatedQuietAgent {
  readonly id: DeactivatedQuietAgentId;
  readonly identity: Identity;
  readonly text: string;
  readonly deactivatedAt: IsoTime;
  readonly read: boolean;
}
interface DeactivatedQuietAgentResponse {
  readonly deactivatedQuietAgent: DeactivatedQuietAgent;
}
/**
 * Attachments on the wire, shared by the server, the SDK and the CLI: the `AttachmentId` brand and its check, an
 * attachment as a message lists it, the limits a post is held to, and the path that serves an attachment's bytes. An
 * attachment is any file, fixed when its message is posted (Matt,
 * 2026-11-24, board thread 2905, msgs 2906, 2997 and 3032).
 */
declare const brand$5: unique symbol;
/** An attachment's ID: opaque and random, so it gives away nothing about how many the board holds. */
type AttachmentId = string & {
  readonly [brand$5]: "AttachmentId";
};
/** The image types an attachment is detected as, from its first bytes. */
type ImageContentType = "image/png" | "image/jpeg" | "image/gif" | "image/webp";
/** What every attachment that isn't one of the four image types is served as. */
declare const opaqueContentType = "application/octet-stream";
/** An attachment's content type: a detected image type, or `application/octet-stream` for anything else. */
type AttachmentContentType = ImageContentType | typeof opaqueContentType;
/** One attachment, as every message that has some lists it, in posting order. */
interface Attachment {
  readonly id: AttachmentId;
  /** The name it was posted with. Display only: it never decides a path, a content type or how it is served. */
  readonly name: string;
  /** Its size in bytes. */
  readonly size: number;
  readonly contentType: AttachmentContentType;
  /** Whether its content is a PNG, JPEG, GIF or WebP image, whatever its name says. */
  readonly image: boolean;
}
/** The attachments on a message, as `MessageFields` carries them. */
interface WithAttachments {
  /**
   * The files posted with the message, in posting order, wherever the message is returned, live `message` events
   * included. Absent when it has none. They never change once posted.
   */
  readonly attachments?: readonly Attachment[];
}
/** One file to attach to a post: the name to show and its bytes. */
interface NewAttachment {
  readonly name: string;
  readonly bytes: Uint8Array;
}
declare const brand$4: unique symbol;
/** A message's ID: a positive whole number, from one increasing sequence across the server, so IDs order messages. */
type MessageId = number & {
  readonly [brand$4]: "MessageId";
};
/** Any JSON value. */
type JsonValue = null | boolean | number | string | readonly JsonValue[] | {
  readonly [key: string]: JsonValue;
};
/** The Scheduled message that posted a message, and whether it has since been deleted (read now, not when posted). */
interface ScheduledMessageMarker {
  readonly id: number & {
    readonly [brand$4]: "ScheduledMessageId";
  };
  readonly deleted: boolean;
}
/** Who posted a message, as they were when they posted it, so it survives the identity being deleted. */
interface Author {
  readonly name: IdentityName;
  readonly owner?: Owner;
}
/** The fields every message has, top-level or reply. */
interface MessageFields extends WithAttachments {
  readonly id: MessageId;
  readonly channel: ChannelName;
  readonly author: Author;
  /** Plain text, up to 40,000 characters. Empty only on a message posted with attachments and no text. */
  readonly text: string;
  /** Any JSON value, for commands and agents to read. Absent when none was sent. */
  readonly data?: JsonValue;
  /** Names of the identities the text mentions. */
  readonly mentions: readonly IdentityName[];
  /** The harness the message was posted from, such as `claude-code`. Absent when none was named. */
  readonly harness?: Harness;
  readonly scheduledMessage?: ScheduledMessageMarker;
  readonly createdAt: IsoTime;
  /**
   * The reactions on the message, one count for each reaction anyone has left, in `reactionNames` order, on the
   * messages of channel pages, threads and the inbox. Absent while the message has none, and on live `message` events.
   */
  readonly reactions?: readonly ReactionCount[];
}
/** A message posted straight into a channel. It may have a thread of replies. */
interface TopLevelMessage extends MessageFields {
  readonly kind: "top-level";
  readonly replyCount: number;
  /** The newest reply in its thread, or `null` if it has none. */
  readonly latestReplyId: MessageId | null;
  /** When the newest reply in its thread was posted, or `null` if it has none. */
  readonly latestReplyAt: IsoTime | null;
  /**
   * The authors of its thread's replies, once each by name, the latest replier first: at most `shownRepliers`.
   * Each is the author as stored on their latest reply, so a deleted replier still shows.
   */
  readonly repliers: readonly Author[];
  /** When its thread was closed. Present only while the thread is closed; `closedBy` is present with it. */
  readonly closedAt?: IsoTime;
  /** Who closed its thread. Present only while the thread is closed; `closedAt` is present with it. */
  readonly closedBy?: IdentityName;
}
/** A reply in a thread. `replyTo` is always the top-level message, even when the reply was posted to another reply. */
interface Reply extends MessageFields {
  readonly kind: "reply";
  readonly replyTo: MessageId;
}
/** A message, tagged by `kind`. */
type Message = TopLevelMessage | Reply;
/** An agent's reply posted to a thread with newer replies by others, oldest first; a later release refuses it instead. */
interface ThreadMovedWarning {
  readonly code: "thread_moved";
  readonly message: string;
  readonly details: {
    readonly replies: readonly Reply[];
  };
}
/** The answer to posting a message. */
interface MessageResponse {
  readonly message: Message;
  /** Each `@name` in the text that names no identity, once each in the order written. They stay plain text. */
  readonly unknownMentions: readonly string[];
  /** Only on an agent's reply to a thread that moved on since what it had seen (`seen`, or else `replyTo`). */
  readonly warning?: ThreadMovedWarning;
}
/** The query of a channel page. With no `before`, the page is the newest messages. */
interface ListMessagesQuery {
  /** Only messages before this message ID: pass the first message's ID to read further back. */
  readonly before?: number;
  /** 1–200 messages. Default 50. */
  readonly limit?: number;
}
/** A page of a channel's top-level messages, oldest first. `hasMore` says older ones remain before the first. */
interface ListMessagesResponse {
  readonly messages: readonly TopLevelMessage[];
  readonly hasMore: boolean;
  /** The read receipts of every message on the page, those not seen yet included. */
  readonly receipts: readonly ReadReceipt[];
}
/** A top-level message and its replies, oldest first. */
interface ThreadResponse {
  readonly parent: TopLevelMessage;
  readonly replies: readonly Reply[];
  /** The read receipts of the top-level message and every reply, those not seen yet included. */
  readonly receipts: readonly ReadReceipt[];
}
/**
 * Whether, and when, one of a message's receipt identities has seen it: its read position in the message's thread or
 * channel has reached or passed it. Once seen, a receipt stays seen, though a mark unread moves the read position back.
 */
interface ReadReceipt {
  readonly messageId: MessageId;
  readonly identity: IdentityName;
  readonly seen: boolean;
  /** When it was first seen. Absent while not seen, and for a message seen before the cookout kept receipts. */
  readonly seenAt?: IsoTime;
}
/**
 * A reaction an identity can leave on a message: thumbs up or thumbs down (Matt, 2026-11-23, mattpocock/cookout#199).
 * The list is closed, and `reactionNames` owns it.
 */
type ReactionName = "thumbs_up" | "thumbs_down";
/** How many identities left one reaction on a message, and who, oldest reaction first. */
interface ReactionCount {
  readonly reaction: ReactionName;
  readonly count: number;
  readonly by: readonly IdentityName[];
}
/** One identity's reaction on one message. An identity has at most one of each reaction on a message. */
interface Reaction {
  readonly messageId: MessageId;
  readonly identity: IdentityName;
  readonly reaction: ReactionName;
  readonly reactedAt: IsoTime;
}
/** The answer to adding or removing a reaction: the message's reactions as they now are. */
interface ReactionsResponse {
  readonly messageId: MessageId;
  readonly channel: ChannelName;
  readonly reactions: readonly ReactionCount[];
}
/** The answer to closing or reopening a thread: its top-level message as it now stands. */
interface TopLevelMessageResponse {
  readonly message: TopLevelMessage;
}
/** Open threads, stalest first by `lastActivityAt` (latest message or later reopen); `cursor` is null on the last page. */
interface ListOpenThreadsResponse {
  readonly threads: readonly {
    readonly message: TopLevelMessage;
    readonly lastActivityAt: IsoTime;
  }[];
  readonly hasMore: boolean;
  readonly cursor: string | null;
}
/** An open thread: its top-level message and when anything last happened in it. */
type OpenThread = ListOpenThreadsResponse["threads"][number];
/**
 * How the last call to a trigger URL went: when it was made, and either the HTTP status the URL answered or, when it
 * answered nothing (a timeout, a refused connection), why. `ok` is true only for a `2xx`.
 */
interface TriggerResult {
  readonly at: IsoTime;
  readonly ok: boolean;
  readonly status?: number;
  readonly error?: string;
}
/** What a `trigger failed` offline alert says: the message that didn't get through, and the status or error. */
interface TriggerFailure {
  readonly message: MessageId;
  readonly status?: number;
  readonly error?: string;
}
/** An agent's trigger URL as its owner reads it: the URL and its last result, never the token. */
interface Trigger {
  readonly url: string;
  readonly lastResult?: TriggerResult;
}
/** The answer to reading, setting or clearing a trigger URL: the agent's, or `null` when it has none. */
interface TriggerResponse {
  readonly trigger: Trigger | null;
}
/** The body of setting a trigger URL: the URL and the token the board sends with each call. */
interface SetTriggerRequest {
  readonly url: string;
  readonly token: string;
}
/** The SDK's calls on an agent's trigger URL, each only for the agent's owner or the agent that brought it in. */
interface TriggerCalls {
  /** `GET /v1/identities/:name/trigger`: the agent's trigger URL and its last result, or `null`; never the token. */
  readonly getTrigger: (agent: string) => Promise<TriggerResponse>;
  /** `PUT /v1/identities/:name/trigger`: sets or replaces the agent's trigger URL and token. */
  readonly setTrigger: (agent: string, request: SetTriggerRequest) => Promise<TriggerResponse>;
  /** `DELETE /v1/identities/:name/trigger`: clears the agent's trigger URL, answering `{ trigger: null }`. */
  readonly clearTrigger: (agent: string) => Promise<TriggerResponse>;
}
declare const brand$3: unique symbol;
/**
 * The ID of one live connection, which the stream's `connected` event carries: a positive whole number, unique
 * while the server runs. A `cookout watch` exiting on purpose names it in its clean close.
 */
type LiveConnectionId = number & {
  readonly [brand$3]: "LiveConnectionId";
};
/** The wire's word for the feature: the CLI's field, the event's `type` and the last part of the path. */
declare const presenceName = "presence";
/** How an online identity is connected: a `cookout watch`, with the host its agent session was joined from when the joining client sent one, or a web tab. */
type LiveConnectionDetail = {
  readonly via: "watch";
  readonly host?: string;
} | {
  readonly via: "web";
};
/**
 * Why an offline identity went offline, as its profile shows it ("offline: session revoked"): it ran `cookout leave`,
 * its token was refused (an agent session revoked or expired, an Identity token rotated, the identity deactivated), or
 * its connection dropped and nothing reconnected within the grace (ADR "how a live connection ends").
 */
declare const offlineReasons: readonly ["left", "session revoked", "session expired", "token rotated", "deactivated", "connection lost", "trigger failed"];
/** One of `offlineReasons`. */
type OfflineReason = (typeof offlineReasons)[number];
/**
 * One identity's presence. An online identity carries the detail of its most recent live connection, unless it shows
 * online only because the server just restarted (the boot grace). An offline one carries when it was last seen, unless
 * it never was, and why it went offline when the server knows. A Deactivated identity is always offline. `warning` is
 * the owner's warning: set only in what the agent's owner reads, while the agent is offline after an unexpected end
 * (the end that raised an offline alert), until it next has a live connection.
 *
 * An agent with a trigger URL whose last call didn't fail can be reached now, so it is online too (Matt, 2026-11-24,
 * mattpocock/cookout#378): when that is the only reason, it carries `wakesOnMention` and no `connection`. One whose
 * last trigger call failed and that has no live connection is Unreachable: offline, carrying that call's result in
 * `unreachable`.
 */
interface Presence {
  readonly identity: IdentityName;
  readonly online: boolean;
  readonly connection?: LiveConnectionDetail;
  readonly lastSeenAt?: IsoTime;
  readonly offlineReason?: OfflineReason;
  readonly warning?: true;
  readonly wakesOnMention?: true;
  readonly unreachable?: TriggerResult;
}
/** The answer to `GET /v1/presence`: every identity's presence, Deactivated ones included, sorted by name. */
interface PresenceResponse {
  readonly presence: readonly Presence[];
}
/**
 * The ID of one offline alert: a positive whole number, the order alerts were raised in. Mark all as read names the
 * newest one the caller has seen.
 */
type OfflineAlertId = number & {
  readonly [brand$3]: "OfflineAlertId";
};
/**
 * An offline alert (GLOSSARY.md): an item in an agent's owner's Inbox saying the agent went offline unexpectedly and
 * why, as "@triage went offline: connection lost". It is no message, so it moves no Read position. `backOnlineAt` is
 * when the agent next had a live connection, absent while it is still offline.
 *
 * A failed call to an agent's trigger URL raises one, `trigger failed`, once per failure streak (Matt, 2026-11-24,
 * mattpocock/cookout#378). It carries `trigger`: the message that didn't get through and the status or error the
 * call ended with. The next successful call sets its `backOnlineAt`; a live connection doesn't.
 */
interface OfflineAlert {
  readonly id: OfflineAlertId;
  readonly agent: IdentityName;
  readonly offlineReason: OfflineReason;
  readonly raisedAt: IsoTime;
  readonly read: boolean;
  readonly backOnlineAt?: IsoTime;
  readonly trigger?: TriggerFailure;
}
declare const brand$2: unique symbol;
/** A nudge's ID: a positive whole number, increasing in the order nudges are raised. */
type NudgeId = number & {
  readonly [brand$2]: "NudgeId";
};
/** Which nudge of a quiet spell: the first, after `nudgeIntervals.first`, or the second, `nudgeIntervals.second` later. */
type NudgeKind = "first" | "second";
/**
 * A Nudge: a reminder in the Inbox of a thread's starter that the open thread has been quiet for a while. It is not
 * a message, so it moves no read position. It turns read when the thread is closed or gets a new message, when its
 * recipient marks it read, or with an ack of the whole inbox.
 */
interface Nudge {
  readonly id: NudgeId;
  readonly kind: NudgeKind;
  /** What the nudge says: "Quiet for 3 days: close it, or follow up?" for the first. */
  readonly text: string;
  readonly raisedAt: IsoTime;
  readonly channel: Channel;
  /** The quiet thread's top-level message, as it now stands. */
  readonly parent: TopLevelMessage;
}
/** A nudge in the inbox history: `read` says it has been read. */
interface InboxHistoryNudge extends Nudge {
  readonly read: boolean;
}
/** The answer to marking a nudge read: the nudge, now read. */
interface NudgeResponse {
  readonly nudge: InboxHistoryNudge;
}
/**
 * Why an item is in the inbox: a reply in a thread the identity follows, a message that mentions it, another
 * identity's reaction on the identity's own message, or a top-level message in a channel it subscribes to.
 */
type InboxReason = "followed-thread" | "mention" | "reaction" | "subscribed-channel";
/** A message the identity hasn't read, with every reason it is there, its channel and its thread's top-level message. */
interface InboxItem {
  readonly reasons: readonly InboxReason[];
  readonly channel: Channel;
  /** The thread's top-level message: the message itself when it is top-level. */
  readonly parent: TopLevelMessage;
  readonly message: Message;
  /**
   * For the `reaction` reason only, other identities' reactions on the identity's own message, oldest first, shown as
   * "@name reacted with 👍": in the inbox the unacked ones; in the history all of them, `read` once all are acked.
   */
  readonly newReactions?: readonly Reaction[];
}
/**
 * An identity's read position in one scope: a channel's top-level messages (`thread` is `null`) or one thread's
 * replies. Every message in the scope up to `messageId` is read.
 */
interface ReadPosition {
  readonly channel: ChannelName;
  readonly thread: MessageId | null;
  readonly messageId: MessageId;
}
/**
 * The inbox, oldest first, each message once, and beside it the caller's unread offline alerts, oldest first (always
 * none for an agent, which owns no agent), and its unread Nudges, oldest first. Reading it changes nothing.
 */
interface InboxResponse {
  readonly items: readonly InboxItem[];
  readonly alerts: readonly OfflineAlert[];
  readonly nudges: readonly Nudge[];
  readonly deactivationOffers: readonly DeactivationOffer[];
  readonly deactivatedQuietAgents: readonly DeactivatedQuietAgent[];
}
/** An item in the inbox history: `read` says the identity's read position for its scope is at or after it. */
interface InboxHistoryItem extends InboxItem {
  readonly read: boolean;
}
/** The query of an inbox history page. With no `before`, the page is the newest items. */
interface InboxHistoryQuery {
  /** Only items before this message ID: pass the last item's ID to read further back. */
  readonly before?: number;
  /** 1–200 items. Default 50. */
  readonly limit?: number;
}
/**
 * A page of the inbox history: every message in the inbox for at least one reason as things stand now, read or not,
 * newest first, each message once. `hasMore` says older items remain after the last. The first page (no `before`)
 * also lists every offline alert raised for the caller, read or not, newest first; a later page lists none. Reading it
 * changes nothing.
 */
interface InboxHistoryResponse {
  readonly items: readonly InboxHistoryItem[];
  readonly alerts: readonly OfflineAlert[];
  readonly hasMore: boolean;
  /** Every Nudge the caller has had, read or not, newest first, on the newest page (with no `before`) only. */
  readonly nudges: readonly InboxHistoryNudge[];
  readonly deactivationOffers: readonly DeactivationOffer[];
  readonly deactivatedQuietAgents: readonly DeactivatedQuietAgent[];
}
/** The caller's read positions: one for each channel and thread it has acked in or posted to, by channel name. */
interface ReadPositionsResponse {
  readonly readPositions: readonly ReadPosition[];
}
/** The body of an ack. */
interface AckRequest {
  readonly messageId: MessageId;
}
/** The answer to an ack: the read position of the message's scope, which never moves backwards. */
interface AckResponse {
  readonly readPosition: ReadPosition;
}
/**
 * The body of an ack of the whole inbox, each part up to the newest the caller has seen: items up to `upTo`, offline
 * alerts up to `alertsUpTo`, Nudges up to `nudgesUpTo` and deactivated quiet agent entries up to
 * `deactivatedQuietAgentsUpTo` are read, and Deactivation offers up to `deactivationOffersUpTo` are cleared as Keep does.
 */
interface AckAllRequest {
  readonly upTo?: MessageId;
  readonly alertsUpTo?: OfflineAlertId;
  readonly nudgesUpTo?: NudgeId;
  readonly deactivationOffersUpTo?: DeactivationOfferId;
  readonly deactivatedQuietAgentsUpTo?: DeactivatedQuietAgentId;
}
/**
 * The answer to an ack of the whole inbox: the read positions it moved, oldest first, and the offline alerts it
 * marked read, oldest first. An item after `upTo`, or an alert after `alertsUpTo`, stays unread.
 */
interface AckAllResponse {
  readonly readPositions: readonly ReadPosition[];
  readonly alerts: readonly OfflineAlert[];
}
/** The answer to marking one offline alert read: the alert, now read. */
interface OfflineAlertResponse {
  readonly alert: OfflineAlert;
}
/** The body of a mark unread: the message to make unread again, with everything after it in its thread or channel. */
interface MarkUnreadRequest {
  readonly messageId: MessageId;
}
/**
 * A read position moved back by a mark unread: `messageId` is the newest message in the scope still read, `null` where
 * none is. In a thread with no reply left read it is the top-level message.
 */
interface MovedBackReadPosition {
  readonly channel: ChannelName;
  readonly thread: MessageId | null;
  readonly messageId: MessageId | null;
}
/** The answer to a mark unread: the read position of the message's scope, which never moves forward. */
interface MarkUnreadResponse {
  readonly readPosition: MovedBackReadPosition;
}
/** The answer to following or unfollowing: the thread, by its top-level message's ID. */
interface FollowResponse {
  readonly thread: MessageId;
  readonly following: boolean;
}
/** The answer to subscribing or unsubscribing. */
interface SubscriptionResponse {
  readonly channel: ChannelName;
  readonly subscribed: boolean;
}
/** The SDK's call on an offline alert. */
interface OfflineAlertCalls {
  /**
   * `POST /v1/inbox/alerts/:id/read`: marks the caller's offline alert read, so it leaves the inbox and stays in its
   * history. An alert the caller has none of is 404 `offline_alert_not_found`.
   */
  readonly markOfflineAlertRead: (id: OfflineAlertId) => Promise<OfflineAlertResponse>;
}
/** The SDK's call on a Nudge. */
interface NudgeCalls {
  /**
   * `POST /v1/inbox/nudges/:id/read`: marks one of the caller's Nudges read and answers it. Another identity's nudge,
   * or one that doesn't exist, is 404 `nudge_not_found`. A nudge also turns read when its thread is closed or gets a
   * new message, and with `ackAll({ nudgesUpTo })`.
   */
  readonly markNudgeRead: (nudgeId: NudgeId) => Promise<NudgeResponse>;
}
/** The SDK's calls on a Deactivation offer and an entry about a deactivated quiet agent. */
interface DeactivationOfferCalls {
  /**
   * `POST /v1/inbox/deactivation-offers/:id/keep`: answers Keep on one of the caller's Deactivation offers, clearing it
   * for every recipient, and answers it. The next comes 30 days after it if the agent stays quiet. An offer the caller
   * didn't get, or one that doesn't exist, is 404 `deactivation_offer_not_found`. To deactivate instead, call
   * `deactivateIdentity`.
   */
  readonly keepDeactivationOffer: (offerId: DeactivationOfferId) => Promise<DeactivationOfferResponse>;
  /**
   * `POST /v1/inbox/deactivated-quiet-agents/:id/read`: marks one of the caller's entries about deactivated quiet agents read, for every
   * recipient, and answers it. One the caller didn't get, or one that doesn't exist, is 404
   * `deactivated_quiet_agent_not_found`. Reactivating the agent (`reactivateIdentity`) also reads it.
   */
  readonly markDeactivatedQuietAgentRead: (entryId: DeactivatedQuietAgentId) => Promise<DeactivatedQuietAgentResponse>;
}
/** One Server-Sent Event: its `event` name (`message` when it has none) and its `data`. */
interface ServerSentEvent {
  readonly event: string;
  readonly data: string;
}
/**
 * Where a client connects: the server's base URL, the bearer token if there is one, and the harness running the
 * process if one was found, which the client names in `cookout-harness` on every request.
 */
interface CookoutConnection {
  readonly url: string;
  readonly token?: string;
  readonly harness?: string;
}
type ClientConnection = CookoutConnection;
interface InboxCalls {
  readonly inbox: () => Promise<InboxResponse>;
  readonly inboxHistory: (query?: InboxHistoryQuery) => Promise<InboxHistoryResponse>;
  readonly readPositions: () => Promise<ReadPositionsResponse>;
  readonly ack: (messageId: MessageId) => Promise<AckResponse>;
  readonly ackAll: (upTo: MessageId | AckAllRequest) => Promise<AckAllResponse>;
  readonly markUnread: (messageId: MessageId) => Promise<MarkUnreadResponse>;
  readonly follow: (messageId: MessageId) => Promise<FollowResponse>;
  readonly unfollow: (messageId: MessageId) => Promise<FollowResponse>;
  readonly subscribe: (channel: string) => Promise<SubscriptionResponse>;
  readonly unsubscribe: (channel: string) => Promise<SubscriptionResponse>;
}
declare function inboxCalls(server: ClientConnection): InboxCalls & OfflineAlertCalls & NudgeCalls & DeactivationOfferCalls;
declare const brand$1: unique symbol;
type Brand<Name extends string> = string & {
  readonly [brand$1]: Name;
};
/** A command's name. It is also the name of the command's handler identity, so it follows the plain identity-name rule (no `/`). */
type CommandName = Brand<"CommandName">;
/** The per-command secret the server signs webhook deliveries with (an HMAC of the body). Shown once, on add or rotate. */
type CommandSecret = Brand<"CommandSecret">;
/** A JSON Schema, the rule a command's call data must follow. */
type JsonSchema = Readonly<Record<string, JsonValue>>;
/** A registered command as the server shows it: one an admin added, which the server calls by webhook. Its secret is never part of it. */
interface RegisteredCommand {
  readonly name: CommandName;
  /** The `http` or `https` URL the server posts calls to. */
  readonly url: string;
  /** The JSON Schema a call's data must follow. */
  readonly schema: JsonSchema;
  /** 1-500 characters. */
  readonly description?: string;
  /** The agent identity the command's results post as. It has the command's name. */
  readonly handler: IdentityName;
  readonly createdAt: IsoTime;
}
/** A built-in command (mattpocock/cookout#250, 2026-11-23): one the server handles itself, so it has no `url`. */
interface BuiltInCommand extends Omit<RegisteredCommand, "url"> {
  readonly builtIn: true;
}
/** A command as `GET /v1/commands` lists it: registered (with a `url`) or built in (with `builtIn: true`). */
type Command = RegisteredCommand | BuiltInCommand;
/** The body of `POST /v1/commands`. The server checks the name, URL, schema and description. */
interface AddCommandRequest {
  readonly name: string;
  readonly url: string;
  readonly schema: JsonSchema;
  readonly description?: string;
}
/** The answer to adding a command or rotating its secret. The secret is shown this once only. */
interface CommandWithSecretResponse {
  readonly command: RegisteredCommand;
  readonly secret: CommandSecret;
}
/**
 * The answer to `GET /v1/commands`: every command, sorted by name, the registered ones and the built-in ones the server
 * handles itself (`/spawn-agent`), so every client discovers both the same way. A built-in command carries
 * `builtIn: true` and no `url`.
 */
interface ListCommandsResponse {
  readonly commands: readonly Command[];
}
/** The body of a command call. The server checks `data` against the command's schema. */
interface CallCommandRequest {
  /** The channel the call message is posted in. */
  readonly channel: string;
  readonly data: JsonValue;
}
/** The answer to a command call (202): the call message, which is also the top-level message of its thread. */
interface CallCommandResponse {
  readonly messageId: MessageId;
  readonly threadId: MessageId;
}
/** `POST /v1/agent-session` joins (issues an agent session token); `DELETE /v1/agent-session` leaves (revokes it). */
declare const agentSessionPath = "/v1/agent-session";
/**
 * `GET /v1/identities/:name/agent-session` lists the agent's live agent session token (`ListAgentSessionsResponse`),
 * and `DELETE` revokes it (`RevokeAgentSessionResponse`): its session's next request is 401 `agent_session_revoked`.
 * Only the agent's owner or an admin may; anyone else is 403 `not_owner` (Matt, 2026-11-23, mattpocock/cookout#118).
 */
declare const identityAgentSessionPath = "/v1/identities/:name/agent-session";
/** How long an agent session token lives unused when `join` doesn't ask: 7 days. */
declare const defaultIdleExpiry = "7d";
/**
 * The format of an idle expiry: a whole number of seconds, minutes, hours or days, such as `30d` or `12h`. An
 * agent session token expires once it goes this long unused.
 */
declare const idleExpiryPattern: RegExp;
/**
 * The body of `POST /v1/agent-session`. Sent with an agent's token, `as` must be that agent: a check, not a switch.
 * Sent with a human's token, `as` names an agent the human owns, or creates one (Matt, 2026-11-23,
 * mattpocock/cookout#119): an agent the caller owns by that name is joined; else a free name is created, owned by
 * the caller; else, when someone else has the name, `<caller>/<name>` is joined, or created. A human's name, or
 * `<other>/<name>`, is refused. This is the one route a human's token may use from a harness.
 */
interface JoinRequest {
  readonly as: string;
  /** Joins even while the agent has a live agent session token, which is revoked at once. */
  readonly force?: boolean;
  /** How long the token may go unused before it expires, such as `30d`. Default `7d`; at most `COOKOUT_MAX_IDLE_EXPIRY`. */
  readonly idleExpiry?: string;
  /** The host the agent joins from, such as the machine's hostname, shown to its owner. 1–253 characters. */
  readonly host?: string;
  /**
   * The display name for the agent this join creates: 1-80 characters after trimming. Sent for an agent that
   * already exists, it is 400 `display_name_on_existing_agent` and nothing is joined.
   */
  readonly displayName?: string;
  /**
   * Refuses to create an agent without `displayName`: 400 `display_name_required`, and nothing is created. The CLI
   * sends it (mattpocock/cookout#313); the server refuses every such create one release later.
   */
  readonly requireDisplayName?: boolean;
}
/** The answer to `join`. */
interface AgentSessionResponse {
  /** Send it as the bearer token to act as the agent for this session. Shown this once. */
  readonly agentSessionToken: Token;
  readonly issuedAt: IsoTime;
  /** Each request sent with the token moves it forward by the idle expiry. */
  readonly expiresAt: IsoTime;
  /** The agent joined, such as `ada/triage-agent` when a human's `as: "triage-agent"` was someone else's. */
  readonly identity: IdentityName;
  /** Whether this join created the agent, owned by the human who joined. */
  readonly created: boolean;
}
/** An agent's live agent session token as its owner sees it: when it was issued and last used, never the token. */
interface ListedAgentSession {
  readonly issuedAt: IsoTime;
  /** Left out until a request is sent with the token. */
  readonly lastUsedAt?: IsoTime;
  readonly expiresAt: IsoTime;
  /** The host it joined from, if the joining client said. */
  readonly host?: string;
}
/** The answer to listing an agent's agent session tokens: its live one, or none. */
interface ListAgentSessionsResponse {
  readonly agentSessions: readonly ListedAgentSession[];
}
/** The answer to revoking an agent's agent session token: `false` when it had no live one. */
interface RevokeAgentSessionResponse {
  readonly revoked: boolean;
}
/** The answer to `leave`. */
interface LeaveResponse {
  readonly revoked: true;
}
/** The `details` of the 409 `agent_session_live` refusal: when the agent's live agent session token expires if unused. */
interface AgentSessionLiveDetails {
  readonly expiresAt: IsoTime;
}
/** The `details` of the 400 `idle_expiry_too_long` refusal: the longest idle expiry this cookout allows. */
interface IdleExpiryTooLongDetails {
  readonly maxIdleExpiry: string;
}
/**
 * The 401 code for an agent session token that was revoked: by `leave`, another session's `join --force`, or its
 * agent's owner or an admin.
 */
declare const agentSessionRevoked = "agent_session_revoked";
/** The 401 code for an agent session token that went unused past its expiry. */
declare const agentSessionExpired = "agent_session_expired";
/**
 * The codes join and leave refuse with: the 403s `not_your_identity` (an agent joins as another identity),
 * `identity_kind` (join as a human: only agents join) and `not_owner` (a human joins `<other>/<name>`; listed with
 * the identity codes), the 409s
 * `agent_session_live` (join while the agent has a live agent session token) and `identity_deactivated` (join a
 * Deactivated agent), the 400s `idle_expiry_too_long`, `agent_session_required` (leave sent without an agent session token),
 * `display_name_required` (a join that would create an agent with no display name, when the request asks for one) and
 * `display_name_on_existing_agent` (a display name sent to join an agent that already exists),
 * the 403 `not_brought_in` (an agent approves a join for an existing agent it didn't bring in, #370), the 404
 * `agent_join_request_not_found` (an agent join request expired, was collected, or never existed), and the
 * 401s any request sent with an ended agent session token gets, and the 404 `join_code_not_found` (a join code that
 * was used, expired or never issued).
 */
declare const agentSessionErrorCodes: readonly ["not_your_identity", "identity_kind", "agent_session_live", "identity_deactivated", "idle_expiry_too_long", "agent_session_required", "display_name_required", "display_name_on_existing_agent", "agent_join_request_not_found", "join_code_not_found", "not_brought_in", "agent_session_revoked", "agent_session_expired"];
/**
 * `POST /v1/agent-join-requests` (no token): a box with no Login asks to join as an agent (Matt, 2026-11-23,
 * mattpocock/cookout#120). The server answers a user code and a secret request ID, valid 10 minutes unapproved.
 */
declare const agentJoinRequestsPath = "/v1/agent-join-requests";
/** `POST /v1/agent-join-requests/collect` (no token): 202 pending, then the agent session token once; 404 after. */
declare const collectAgentJoinRequestPath = "/v1/agent-join-requests/collect";
/**
 * `GET /v1/agent-join-requests/:code` (a human, or an agent for its owner, #370): the live request with that user code,
 * as it would join for the caller.
 */
declare const agentJoinRequestPath = "/v1/agent-join-requests/:code";
/**
 * `PUT /v1/agent-join-requests/:code/approval`: approves it as the caller. A human approves as before; an agent approves
 * only a join that creates an agent of its own owner, recorded as brought in by it, or rejoins one it brought in (#370).
 */
declare const agentJoinRequestApprovalPath = "/v1/agent-join-requests/:code/approval";
/**
 * The approval page's path on the server for an agent join request's user code.
 * @param userCode The request's user code.
 * @returns The path, such as `/#/approve-join/WDJB-MJHT`.
 */
declare function agentJoinApprovalPathOf(userCode: string): string;
/** The body of `POST /v1/agent-join-requests`: the agent to join as, the box's host and the idle expiry it asks for. */
interface StartAgentJoinRequest {
  /** A name as `join` takes it: the approver's own agent, a free name, or else `<approver>/<name>`. */
  readonly as: string;
  /** The box's host name, shown on the approval page. 1–253 characters. */
  readonly host: string;
  /** The longest idle expiry the box asks for, such as `30d`; the approver may lower it. Default `7d`. */
  readonly idleExpiry?: string;
}
/** A started agent join request. Only `requestId` collects the agent session token, and it is shown this once. */
interface AgentJoinRequestStartedResponse {
  readonly userCode: string;
  readonly requestId: Token;
  readonly expiresAt: IsoTime;
  readonly approvalPath: string;
}
/** Pending until a human approves, then the agent session token, once. Never a human's credential. */
type AgentJoinCollectedResponse = {
  readonly status: "pending";
} | {
  readonly status: "approved";
  readonly agentSession: AgentSessionResponse;
};
/** An agent join request as the human viewing it would approve it. */
interface AgentJoinRequestView {
  readonly userCode: string;
  readonly host: string;
  readonly expiresAt: IsoTime;
  readonly approved: boolean;
  /** The name the box asked to join as. */
  readonly as: string;
  /** The agent approving joins, such as `ada/triage-agent` when `triage-agent` is someone else's. */
  readonly joins: IdentityName;
  /** Whether approving creates that agent, owned by the approver. */
  readonly creates: boolean;
  /** The idle expiry the box asked for (or the default); the approver may lower it, never raise it. */
  readonly idleExpiry: string;
  /** When the agent's live agent session token expires, if it has one: approving replaces it only with `force`. */
  readonly liveSessionExpiresAt?: IsoTime;
}
/** The answer to showing or approving an agent join request. */
interface AgentJoinRequestResponse {
  readonly agentJoinRequest: AgentJoinRequestView;
}
/** The body of approving an agent join request. */
interface ApproveAgentJoinRequest {
  /** A shorter idle expiry than the box asked for; longer is 400 `idle_expiry_too_long`. */
  readonly idleExpiry?: string;
  /** Replaces the agent's live agent session token, as `join --force`; without it, 409 `agent_session_live`. */
  readonly force?: boolean;
}
/** The SDK's calls for an agent join request: a box with no Login joins once a person approves in the browser. */
interface AgentJoinCalls {
  /** `POST /v1/agent-join-requests` (no token): starts an agent join request, which lasts 10 minutes unapproved. */
  readonly startAgentJoin: (request: StartAgentJoinRequest) => Promise<AgentJoinRequestStartedResponse>;
  /**
   * `POST /v1/agent-join-requests/collect` (no token): `pending` until a human approves, then, once, the agent
   * session token. A wrong, expired or collected request ID is 404 `agent_join_request_not_found`.
   */
  readonly collectAgentJoin: (requestId: Token) => Promise<AgentJoinCollectedResponse>;
  /** `GET /v1/agent-join-requests/:code` (a human): the request, and the agent approving it would join. */
  readonly getAgentJoinRequest: (userCode: string) => Promise<AgentJoinRequestResponse>;
  /** `PUT /v1/agent-join-requests/:code/approval` (a human): joins the agent as `join` with the caller's Login would. */
  readonly approveAgentJoin: (userCode: string, approval?: ApproveAgentJoinRequest) => Promise<AgentJoinRequestResponse>;
}
/** How long a join code lasts unredeemed: 15 minutes. */
declare const joinCodeLifetimeMinutes = 15;
/**
 * `POST /v1/join-codes` (a human; an agent is 403 `human_only`): creates an agent the caller owns, with a
 * single-use join code bound to it (mattpocock/cookout#231).
 */
declare const joinCodesPath = "/v1/join-codes";
/** `POST /v1/join-codes/redeem` (no token): redeems a join code, once, for its agent's agent session token. */
declare const redeemJoinCodePath = "/v1/join-codes/redeem";
/** The body of `POST /v1/join-codes`: the new agent, named as `POST /v1/identities` names one, and its description. */
interface CreateJoinCodeRequest {
  readonly name: string;
  /** What the agent is for, trimmed, then 1–500 characters. */
  readonly description?: string;
}
/**
 * The answer to `POST /v1/join-codes`: the new agent, and its join code, shown this once. The code can only ever join
 * that one agent, once, before `expiresAt`; it is never a person's credential.
 */
interface JoinCodeResponse {
  readonly identity: AgentIdentity;
  readonly joinCode: Token;
  readonly expiresAt: IsoTime;
}
/** The body of `POST /v1/join-codes/redeem`. */
interface RedeemJoinCodeRequest {
  readonly joinCode: string;
  /** How long the agent session token may go unused, such as `30d`, as `join` takes it. */
  readonly idleExpiry?: string;
  /** The host the agent joins from, shown to its owner. 1–253 characters. */
  readonly host?: string;
}
/** The SDK's calls for join codes. */
interface JoinCodeCalls {
  /** `POST /v1/join-codes` (a human): creates an agent the caller owns, with a join code for it, valid 15 minutes. */
  readonly createJoinCode: (request: CreateJoinCodeRequest) => Promise<JoinCodeResponse>;
  /**
   * `POST /v1/join-codes/redeem` (no token): the agent session token of the code's agent. A used, expired or unknown
   * code is 404 `join_code_not_found`.
   */
  readonly redeemJoinCode: (request: RedeemJoinCodeRequest) => Promise<AgentSessionResponse>;
}
interface AgentSessionCalls extends AgentJoinCalls, JoinCodeCalls {
  readonly join: (request: JoinRequest) => Promise<AgentSessionResponse>;
  readonly leave: () => Promise<LeaveResponse>;
  readonly listAgentSessions: (agent: string) => Promise<ListAgentSessionsResponse>;
  readonly revokeAgentSession: (agent: string) => Promise<RevokeAgentSessionResponse>;
}
/** A Scheduled message's ID: a positive whole number, from its own sequence. */
type ScheduledMessageId = ScheduledMessageMarker["id"];
/** Whether a schedule runs: `active`, `paused`, or `finished` once a one-off schedule's run is handled. */
declare const scheduledMessageStatuses: readonly ["active", "paused", "finished"];
/** A schedule's status. */
type ScheduledMessageStatus = (typeof scheduledMessageStatuses)[number];
/** Why a schedule was paused for its creator rather than by them: its creator was Deactivated. */
declare const scheduledMessagePauseReasons: readonly ["creator_deactivated"];
/** The reason a schedule was paused, when it wasn't paused by hand. */
type ScheduledMessagePauseReason = (typeof scheduledMessagePauseReasons)[number];
/** What a handled run did: posted its message, or was skipped as 10 minutes or more late. */
declare const scheduledRunOutcomes: readonly ["posted", "skipped"];
/** The outcome of a handled run. */
type ScheduledRunOutcome = (typeof scheduledRunOutcomes)[number];
/** The latest run a schedule handled. */
interface ScheduledMessageRun {
  /** The moment the run was due. */
  readonly due: IsoTime;
  readonly outcome: ScheduledRunOutcome;
  /** The message it posted. Absent when it was skipped. */
  readonly messageId?: MessageId;
}
/** A Scheduled message as the server shows it. It has exactly one of `cron` and `at`. */
interface ScheduledMessage {
  readonly id: ScheduledMessageId;
  readonly channel: ChannelName;
  /** Who created it, and whom each post is written as. */
  readonly creator: Author;
  readonly text: string;
  /** A 5-field cron expression, read in `timeZone`. Absent on a one-off schedule. */
  readonly cron?: string;
  /** The one moment a one-off schedule posts. Absent on a recurring schedule. */
  readonly at?: IsoTime;
  /** The IANA time zone the cron expression is read in, such as `Europe/London`. */
  readonly timeZone: string;
  readonly status: ScheduledMessageStatus;
  /** Present while it is paused because its creator was Deactivated. */
  readonly pausedBecause?: ScheduledMessagePauseReason;
  /** Its next runs, at most `scheduleTiming.shownRuns`, soonest first. Empty while it is paused or finished. */
  readonly nextRuns: readonly IsoTime[];
  /** The latest run it handled. Absent before its first. */
  readonly lastRun?: ScheduledMessageRun;
  readonly createdAt: IsoTime;
  readonly updatedAt: IsoTime;
}
/**
 * The body of `POST /v1/scheduled-messages`: a channel, a text, exactly one of `cron` and `at`, and a time zone. An
 * `at` with no offset is read in `timeZone`.
 */
interface CreateScheduledMessageRequest {
  readonly channel: string;
  readonly text: string;
  readonly cron?: string;
  /** An ISO 8601 date and time, such as `2026-12-01T09:00` or `2026-12-01T09:00:00Z`. */
  readonly at?: string;
  readonly timeZone: string;
}
/**
 * The body of `PATCH /v1/scheduled-messages/:id`: what to change. Giving `cron` or `at` replaces the timing; giving
 * only `timeZone` reads the current timing in it. The channel can't change.
 */
interface EditScheduledMessageRequest {
  readonly text?: string;
  readonly cron?: string;
  /** An ISO 8601 date and time, read in `timeZone` (or the current one) when it has no offset. */
  readonly at?: string;
  readonly timeZone?: string;
}
/** The query of `GET /v1/scheduled-messages/preview`: exactly one of `cron` and `at`, and a time zone. */
interface PreviewScheduledMessageQuery {
  readonly cron?: string;
  readonly at?: string;
  readonly timeZone: string;
}
/** The answer to `GET /v1/scheduled-messages/preview`: the next runs a schedule with that timing would have. */
interface ScheduledMessagePreviewResponse {
  /** At most `scheduleTiming.shownRuns`, soonest first. */
  readonly nextRuns: readonly IsoTime[];
}
/** The query of `GET /v1/scheduled-messages`: only one channel's schedules. */
interface ListScheduledMessagesQuery {
  readonly channel?: string;
}
/** The answer to creating, getting, editing, pausing, resuming or deleting a Scheduled message. */
interface ScheduledMessageResponse {
  readonly scheduledMessage: ScheduledMessage;
}
/** The answer to `GET /v1/scheduled-messages`: every schedule asked for, oldest first. */
interface ListScheduledMessagesResponse {
  readonly scheduledMessages: readonly ScheduledMessage[];
}
/** Creating, reading and changing Scheduled messages. */
interface ScheduledMessageCalls {
  /**
   * `POST /v1/scheduled-messages`: schedules `text` to post in `channel` as the caller, on a 5-field `cron` read in
   * `timeZone`, or once `at` a moment. Refused with 400 `cron_invalid`, `cron_too_frequent` (more often than every 30
   * minutes), `cron_never_runs`, `time_zone_invalid`, `at_in_past` or `cron_or_at`, and 404 `channel_not_found`.
   */
  readonly createScheduledMessage: (request: CreateScheduledMessageRequest) => Promise<ScheduledMessageResponse>;
  /** `GET /v1/scheduled-messages`: every Scheduled message, or one channel's, oldest first. */
  readonly listScheduledMessages: (query?: ListScheduledMessagesQuery) => Promise<ListScheduledMessagesResponse>;
  /** `GET /v1/scheduled-messages/:id`. A missing one is 404 `scheduled_message_not_found`. */
  readonly getScheduledMessage: (id: ScheduledMessageId) => Promise<ScheduledMessageResponse>;
  /**
   * `PATCH /v1/scheduled-messages/:id`: changes its text, its cron or `at`, or its time zone, for its future runs only:
   * its next run counts from now, and what it already posted stays. A finished one-off schedule given a future `at` or
   * a cron runs again. Refused as create refuses, and 403 `not_owner` for anyone but its creator, an agent creator's
   * owner or an admin.
   */
  readonly editScheduledMessage: (id: ScheduledMessageId, request: EditScheduledMessageRequest) => Promise<ScheduledMessageResponse>;
  /**
   * `GET /v1/scheduled-messages/preview`: the next 3 runs a schedule with this cron or `at` and time zone would have,
   * or the refusal create would give.
   */
  readonly previewScheduledMessage: (query: PreviewScheduledMessageQuery) => Promise<ScheduledMessagePreviewResponse>;
  /** `POST /v1/scheduled-messages/:id/pause`: its creator, an agent creator's owner or an admin (403 `not_owner`). */
  readonly pauseScheduledMessage: (id: ScheduledMessageId) => Promise<ScheduledMessageResponse>;
  /**
   * `POST /v1/scheduled-messages/:id/resume`: it runs from now on, and runs missed while it was paused are not caught
   * up. 409 `creator_deactivated` while its creator is Deactivated.
   */
  readonly resumeScheduledMessage: (id: ScheduledMessageId) => Promise<ScheduledMessageResponse>;
  /** `DELETE /v1/scheduled-messages/:id`: stops it. The messages it posted stay, marked as from a deleted schedule. */
  readonly deleteScheduledMessage: (id: ScheduledMessageId) => Promise<ScheduledMessageResponse>;
}
/** One search result: the message as a channel listing or thread shows it, and whether its thread is Closed. */
interface SearchResult {
  readonly message: Message;
  readonly threadClosed: boolean;
}
/** A page of search results, newest first; `cursor` is null on the last page. */
interface SearchResponse {
  readonly results: readonly SearchResult[];
  readonly hasMore: boolean;
  readonly cursor: string | null;
}
/** An attachment's bytes, as `GET /v1/assets/:id` serves them. */
interface AttachmentBytes {
  readonly bytes: Uint8Array;
  /** The type it is served as: a detected image type, or `application/octet-stream`. */
  readonly contentType: string;
  /** The name it was posted with, for display only: reduce it to a safe base name before writing a file by it. */
  readonly name: string;
}
/** Reading an attachment's bytes. */
interface AttachmentCalls {
  /**
   * `GET /v1/assets/:id`: an attachment's bytes, for any signed-in identity. An unknown ID is 404
   * `attachment_not_found`.
   */
  readonly getAttachment: (id: AttachmentId) => Promise<AttachmentBytes>;
}
/** Closing and reopening the thread holding a message. */
interface ClosedThreadCalls {
  /**
   * `PUT /v1/messages/:id/closed`: closes the thread holding the message (any message in it) and answers its top-level
   * message, now with `closedAt` and `closedBy`. Any identity may close any thread; closing a closed one keeps its
   * first closer and time. Closing hides nothing from the API: the inbox, history and `watch` list it as before. A
   * missing message is 404 `message_not_found`.
   */
  readonly closeThread: (messageId: MessageId) => Promise<TopLevelMessageResponse>;
  /**
   * `DELETE /v1/messages/:id/closed`: reopens the thread holding the message and answers its top-level message, now
   * without `closedAt` and `closedBy`. Reopening an open thread changes nothing; a reply in a closed thread reopens it
   * too. A missing message is 404 `message_not_found`.
   */
  readonly reopenThread: (messageId: MessageId) => Promise<TopLevelMessageResponse>;
}
/** The query of an Open threads page. With no `cursor`, the page starts at the stalest open thread. */
interface ListOpenThreadsQuery {
  /** Every open thread on the board, not only the ones involving the caller. */
  readonly all?: boolean;
  /** Only threads after this point: pass the previous page's `cursor` to read on. */
  readonly cursor?: string;
  /** 1–200 threads. Default 50. */
  readonly limit?: number;
}
/** Listing open threads. */
interface OpenThreadCalls {
  /**
   * `GET /v1/threads/open`: a page of open threads, stalest first by last activity, ties by ID. Without `all`, only
   * the threads involving the caller; pass the answer's `cursor` to read the next page.
   */
  readonly listOpenThreads: (query?: ListOpenThreadsQuery) => Promise<ListOpenThreadsResponse>;
}
/** A search: the query as typed, and which page of its results. */
interface SearchRequest {
  /**
   * The query as typed. Each word matches a word that equals it or starts with it; every word must match. The
   * `from:@name`, `in:#channel`, `before:YYYY-MM-DD` and `after:YYYY-MM-DD` filters narrow it, `@` and `#` optional.
   */
  readonly query: string;
  /** Only results after this point: pass the previous page's `cursor` to read on. */
  readonly cursor?: string;
  /** 1–200 results. Default 50. */
  readonly limit?: number;
}
/** Searching messages. */
interface SearchCalls {
  /**
   * `GET /v1/search?q=<query>`: a page of the messages and replies in every channel whose text matches the query,
   * newest first, Closed threads included, each with whether its thread is Closed. Pass the answer's `cursor` to read
   * the next page. A query with neither words nor filters is 400 `empty_query`; a filter naming no identity, no channel
   * or no real day is 400 `unknown_identity`, `unknown_channel` or `invalid_date`; a command token is 403
   * `outside_command_thread`.
   */
  readonly search: (request: SearchRequest) => Promise<SearchResponse>;
}
/** The body of `POST /v1/messages`. The server checks every field. */
interface PostMessageRequest {
  readonly channel: string;
  readonly text: string;
  readonly data?: JsonValue;
  /** Reply to this message. A reply to a reply goes to the top-level message's thread, which `close` also closes. */
  readonly replyTo?: number;
  readonly close?: true;
  /**
   * With `replyTo`: the caller has read the thread up to this message, later than `replyTo`. `replyTo` alone says it
   * has read up to `replyTo`. An agent's reply to a thread with newer replies by anyone else warns `thread_moved`.
   */
  readonly seen?: number;
}
interface CreateMessageRequest extends PostMessageRequest {
  readonly attachments?: readonly NewAttachment[];
}
/** A new item in the caller's inbox, sent the moment another identity posts it. */
interface InboxItemEvent {
  readonly type: "inbox-item";
  readonly item: InboxItem;
}
/**
 * A Nudge just raised for the caller: a thread it started has been quiet for a while. Sent on every stream of the
 * caller the moment the server raises it, `cookout watch` included. It has no SSE `id`, so a caller that reconnects
 * reads `GET /v1/inbox` again.
 */
interface NudgeEvent {
  readonly type: "nudge";
  readonly nudge: Nudge;
}
/**
 * Nudges of the caller's just marked read, by `POST /v1/inbox/nudges/:id/read` or by `ackAll`'s `nudgesUpTo` (Mark all
 * as read), named by ID. Sent on every stream of the caller, so a nudge read in one session leaves the unread inbox of
 * the others. `cookout watch` ignores it. It has no SSE `id`.
 */
interface NudgeReadEvent {
  readonly type: "nudge-read";
  readonly nudgeIds: readonly NudgeId[];
}
/**
 * An Inbox entry of the caller's about an agent deactivated after 90 days with no Activity, as it now stands: sent
 * when the cookout deactivates the agent and again when the entry is read (by Mark read, by marking all as read, or by reactivating the agent), on every stream of each
 * of its recipients, `cookout watch` included. It has no SSE `id`.
 */
interface DeactivatedQuietAgentEvent {
  readonly type: "deactivated-quiet-agent";
  readonly deactivatedQuietAgent: DeactivatedQuietAgent;
}
/**
 * A Deactivation offer of the caller's as it now stands: sent when it is raised and again when it is cleared (by Keep,
 * by marking all as read, by the agent's activity or deactivation, or by a newer offer about it), on every stream of
 * each of its recipients, `cookout watch` included. It has no SSE `id`.
 */
interface DeactivationOfferEvent {
  readonly type: "deactivation-offer";
  readonly deactivationOffer: DeactivationOffer;
}
/** The caller's new read position in a thread or channel, sent the moment any session of the caller acks. */
interface ReadPositionEvent {
  readonly type: "read-position";
  readonly readPosition: ReadPosition;
}
/**
 * The caller's read position in a thread or channel moved back, sent the moment any session of the caller marks a
 * message there unread: unlike `read-position`, it replaces the one before, though that was newer.
 */
interface ReadPositionMovedBackEvent {
  readonly type: "read-position-moved-back";
  readonly readPosition: MovedBackReadPosition;
}
/** A new message on any channel, the caller's own included, sent only on the all-channels feed. */
interface MessageEvent {
  readonly type: "message";
  readonly message: Message;
}
/**
 * A thread just closed or reopened, by Close, Reopen, a reply in a closed thread or a reply sent with `close`: its
 * top-level message as it now
 * stands, with `closedAt` and `closedBy` while closed. Sent only on the all-channels feed. It has no SSE `id`.
 */
interface ThreadEvent {
  readonly type: "thread";
  readonly parent: TopLevelMessage;
}
/**
 * An identity just created or changed (its display name, admin flag or owner, deactivating or reactivating it), as
 * the server now shows it, sent only on the all-channels feed so every open web UI shows it at once. It has no SSE
 * `id`.
 */
interface IdentityEvent {
  readonly type: "identity";
  readonly identity: Identity;
}
/**
 * A read receipt just recorded: one of a message's receipt identities has seen it for the first time. Sent only on
 * the all-channels feed, since everyone on the board sees receipts. It has no SSE `id`.
 */
interface ReadReceiptEvent {
  readonly type: "read-receipt";
  readonly receipt: ReadReceipt;
}
/**
 * A message's reactions just changed: someone added or removed one. It holds the message's reactions as they now are,
 * and is sent only on the all-channels feed, since everyone on the board sees reactions. It has no SSE `id`.
 */
interface ReactionEvent extends ReactionsResponse {
  readonly type: "reaction";
}
/** A channel just created, sent only on the all-channels feed so every open web UI lists it at once. It has no SSE `id`. */
interface ChannelEvent {
  readonly type: "channel";
  readonly channel: Channel;
}
/**
 * A channel just deleted, with everything in it, sent only on the all-channels feed so every open web UI drops it at
 * once. It has no SSE `id`.
 */
interface ChannelDeletedEvent {
  readonly type: "channel-deleted";
  readonly channel: Channel;
}
/**
 * An identity an admin just deleted, as it was, sent only on the all-channels feed so every open web UI drops it from
 * its directory at once. It has no SSE `id`.
 */
interface IdentityDeletedEvent {
  readonly type: "identity-deleted";
  readonly identity: Identity;
}
/**
 * A command just registered, or whose secret was just rotated, sent only on the all-channels feed so every open web
 * UI suggests it at once. It has no SSE `id`.
 */
interface CommandEvent {
  readonly type: "command";
  readonly command: RegisteredCommand;
}
/**
 * An agent's agent session just changed: the agent joined or left, or its owner or an admin revoked its session.
 * Sent only on the all-channels feed of the agent's owner and of admins, the identities who may list its agent
 * sessions, so they list them again. It names the agent alone: the sessions stay behind that list. It has no SSE `id`.
 */
interface AgentSessionEvent {
  readonly type: "agent-session";
  readonly agent: IdentityName;
}
/**
 * The caller's subscription to a channel just changed: any session of the caller subscribed or unsubscribed, or the
 * caller created the channel, which subscribes them. Sent on every stream of the caller, so its sessions stay in
 * sync. It has no SSE `id`.
 */
interface SubscriptionEvent {
  readonly type: "subscription";
  readonly subscription: SubscriptionResponse;
}
/**
 * The stream's first word on connecting, before any item: the newest message ID on the board at that moment (null
 * before the first message). Every item the stream then sends live is newer, so a caller that resumes from this ID
 * after a drop misses nothing and repeats nothing. It has no SSE `id`. `connectionId` names this live connection, so
 * a `cookout watch` exiting on purpose can say so first with `DELETE /v1/events/:connection` (a clean close, ADR "how
 * a live connection ends"); a server from before clean closes sends none.
 */
interface ConnectedEvent {
  readonly type: "connected";
  readonly latestMessageId: MessageId | null;
  readonly connectionId?: LiveConnectionId;
}
/** The answer to a clean close, `DELETE /v1/events/:connection`. */
interface CleanCloseResponse {
  readonly closed: true;
}
/**
 * One identity's presence just changed (it came online, went offline, or connects another way), sent only on the
 * all-channels feed so every open web UI shows it at once. It has no SSE `id`, so a caller that reconnects reads
 * `GET /v1/presence` again.
 */
interface PresenceEvent {
  readonly type: typeof presenceName;
  readonly presence: Presence;
}
/**
 * An offline alert of the caller's (GLOSSARY.md) as it now stands: raised the moment an agent it owns goes offline
 * unexpectedly, and sent again when the agent is back online or the alert is marked read. Sent on every stream of the
 * owner, so its sessions stay in sync. It has no SSE `id`.
 */
interface OfflineAlertEvent {
  readonly type: "offline-alert";
  readonly alert: OfflineAlert;
}
/** Any event the stream sends. */
type CookoutEvent = InboxItemEvent | NudgeEvent | NudgeReadEvent | DeactivationOfferEvent | DeactivatedQuietAgentEvent | ReadPositionEvent | ReadPositionMovedBackEvent | MessageEvent | ThreadEvent | IdentityEvent | ReadReceiptEvent | ReactionEvent | ChannelEvent | ChannelDeletedEvent | IdentityDeletedEvent | CommandEvent | AgentSessionEvent | SubscriptionEvent | PresenceEvent | OfflineAlertEvent;
/**
 * `GET /v1/events`: the caller's Server-Sent Events stream, one per connection. With `allChannelsQuery` as its query
 * it is also the all-channels feed: every new message on every channel.
 */
declare const eventsPath = "/v1/events";
/** `DELETE /v1/events/:connection`: the clean close of the caller's live connection `connection`, answering `CleanCloseResponse`. */
declare const liveConnectionPath = "/v1/events/:connection";
/** The query that asks the stream for the all-channels feed: `?channels=all`. */
declare const allChannelsQuery: {
  readonly channels: "all";
};
/**
 * The SSE `event` of the stream's last event when it can't go on, such as `agent_session_revoked` once `leave` or
 * another session's `join --force` revokes the agent session token it was opened with: it has no `id`, and its
 * `data` is the refusal's `ErrorResponse` as JSON.
 */
declare const refusalEvent = "refusal";
interface EventStream extends AsyncIterable<CookoutEvent> {
  readonly close: () => Promise<void>;
  readonly closeCleanly: () => Promise<void>;
}
interface WatchOptions {
  readonly allChannels?: boolean;
  readonly lastEventId?: MessageId;
  readonly onHeartbeat?: () => void;
  readonly onConnected?: (latestMessageId: MessageId | null) => void;
}
declare function eventOf(frame: ServerSentEvent): CookoutEvent | null;
interface EventCalls {
  readonly watch: (options?: WatchOptions) => Promise<EventStream>;
  readonly presence: () => Promise<PresenceResponse>;
}
/** The answer to the health check. */
interface HealthResponse {
  readonly status: "ok";
  readonly time: IsoTime;
}
/** Every code a cookout server refuses with. */
declare const errorCodes: readonly ["token_missing", "token_unknown", "token_revoked", "token_expired", "outside_command_thread", "agent_as_human", "admin_only", "human_only", "identity_exists", "identity_not_found", "last_admin", "not_owner", "owner_not_human", "name_not_owned", "not_deactivated", "has_messages", "owns_agents", "login_request_not_found", "channel_exists", "channel_not_found", "message_not_found", "reply_in_other_channel", "reaction_not_found", "nudge_not_found", "deactivation_offer_not_found", "deactivated_quiet_agent_not_found", "not_your_identity", "identity_kind", "agent_session_live", "identity_deactivated", "idle_expiry_too_long", "agent_session_required", "display_name_required", "display_name_on_existing_agent", "agent_join_request_not_found", "join_code_not_found", "not_brought_in", "agent_session_revoked", "agent_session_expired", "command_exists", "handler_not_agent", "command_not_found", "rate_limited", "too_many_streams", "watch_replaced", "offline_alert_not_found", "trigger_url_invalid", "trigger_token_missing", "empty_query", "unknown_identity", "unknown_channel", "invalid_date", "attachment_too_large", "too_many_attachments", "attachment_empty", "attachment_unnamed", "message_empty", "attachment_not_found", "cron_invalid", "cron_too_frequent", "cron_never_runs", "time_zone_invalid", "at_in_past", "cron_or_at", "scheduled_message_not_found", "creator_deactivated", "not_found", "method_not_allowed", "invalid_path", "invalid_json", "invalid_request", "body_too_large", "foreign_host", "foreign_origin", "storage_unavailable", "internal_error"];
/** A code a cookout server refuses with. */
type ErrorCode = (typeof errorCodes)[number];
/** One way a request broke a schema: what is wrong, and where (`path` from the body's top, such as `["data", "branch"]`). */
interface SchemaProblem {
  readonly message: string;
  readonly path: readonly (string | number)[];
}
interface StartLoginRequest {
  readonly host: string;
}
interface LoginRequestView {
  readonly userCode: string;
  readonly host: string;
  readonly expiresAt: IsoTime;
  readonly approved: boolean;
}
/** A started login request. Only `requestId` collects the Login, and it is shown this once. */
interface LoginRequestStartedResponse {
  readonly userCode: string;
  readonly requestId: Token;
  readonly expiresAt: IsoTime;
  readonly approvalPath: string;
}
/** Pending until a human approves, then that human and a new Login credential for this machine, once. */
type LoginCollectedResponse = {
  readonly status: "pending";
} | {
  readonly status: "approved";
  readonly identity: Identity;
  readonly token: Token;
};
/** The answer to showing or approving a login request. */
interface LoginRequestResponse {
  readonly loginRequest: LoginRequestView;
}
/** The answer to `DELETE /v1/login`: whether the token sent was a Login credential, now revoked. */
interface LogoutResponse {
  readonly revoked: boolean;
}
/** The SDK's calls for logging a machine in by browser approval. */
interface LoginCalls {
  /**
   * `POST /v1/login-requests` (no token): starts a login request, which lasts 10 minutes. The person checks
   * `userCode` on the approval page at `approvalPath`; only `requestId`, shown this once, collects the Login.
   */
  readonly startLogin: (request: StartLoginRequest) => Promise<LoginRequestStartedResponse>;
  /**
   * `POST /v1/login-requests/collect` (no token): `pending` until a human approves, then, once, that human and a new
   * Login credential for this machine. A wrong, expired or collected request ID is 404 `login_request_not_found`.
   */
  readonly collectLogin: (requestId: Token) => Promise<LoginCollectedResponse>;
  /** `GET /v1/login-requests/:code` (a human): the live login request with that user code, for its approval page. */
  readonly getLoginRequest: (userCode: string) => Promise<LoginRequestResponse>;
  /** `PUT /v1/login-requests/:code/approval` (a human; an agent is 403 `human_only`): approves it as the caller. */
  readonly approveLogin: (userCode: string) => Promise<LoginRequestResponse>;
  /** `DELETE /v1/login`: revokes the Login credential this client sends, answering whether it was one. */
  readonly revokeLogin: () => Promise<LogoutResponse>;
}
interface IdentityDeletionCalls {
  readonly deleteIdentity: (name: string) => Promise<IdentityResponse>;
  readonly countMessagesBy: (name: string) => Promise<IdentityMessageCountResponse>;
}
type ApprovalCalls = LoginCalls & AgentJoinCalls & JoinCodeCalls;
type IdentityDescriptionCalls = DescriptionCalls<IdentityResponse>;
type CallGroups = ApprovalCalls & AttachmentCalls & IdentityDeletionCalls & IdentityDescriptionCalls & ClosedThreadCalls & OpenThreadCalls & SearchCalls & ScheduledMessageCalls & TriggerCalls & Pick<EventCalls, "presence">;
declare function scheduledMessageCalls(server: ClientConnection): ScheduledMessageCalls;
declare const brand: unique symbol;
type UnknownErrorCode = string & {
  readonly [brand]: "UnknownErrorCode";
};
type CookoutErrorCode = ErrorCode | "bad_response" | "url_missing" | UnknownErrorCode;
interface CookoutErrorOptions {
  readonly code: CookoutErrorCode;
  readonly details?: unknown;
  readonly message: string;
  readonly status: number;
}
declare class CookoutError extends Error {
  readonly name = "CookoutError";
  readonly status: number;
  readonly code: CookoutErrorCode;
  readonly details: unknown;
  readonly schemaProblems: readonly SchemaProblem[];
  constructor(options: CookoutErrorOptions);
}
interface Refusal {
  readonly code: CookoutErrorCode | "unreachable";
  readonly message: string;
}
declare function refusalOf(error: unknown): Refusal;
export type CookoutClientOptions = {
  /** The server's base URL, such as `https://cookout.example.com`. Default: `COOKOUT_URL`. */
  readonly url?: string;
  /**
   * The bearer token: an Identity token, or the agent session token `join` answered, to act as the agent for that
   * session. Default: `COOKOUT_TOKEN`, else `COOKOUT_SESSION`; inside a harness, `COOKOUT_SESSION` first. Not
   * needed for the health check.
   */
  readonly token?: string;
  /** Where `COOKOUT_URL`, `COOKOUT_TOKEN` and `COOKOUT_SESSION` are read from. Default: the process's environment (none in a browser). */
  readonly env?: Readonly<Record<string, string | undefined>>;
  /** The harness running this process, such as `claude-code`, sent on every request: a human's token with it is refused with 403 `agent_as_human`, and messages posted record it. Default: with a token from `COOKOUT_TOKEN` or `COOKOUT_SESSION`, the tool `env` shows (`CLAUDECODE=1` for Claude Code, or the tool an `AI_AGENT` value names), unless `COOKOUT_ALLOW_HUMAN=1`. */
  readonly harness?: string;
};
export type CookoutClient = CallGroups & Pick<ReturnType<typeof inboxCalls>, "keepDeactivationOffer" | "markDeactivatedQuietAgentRead" | "markNudgeRead" | "markOfflineAlertRead"> & {
  /** `GET /v1/health`. Resolves when the server and its storage are usable. */
  readonly health: () => Promise<HealthResponse>;
  /** `GET /v1/whoami`: the identity behind this client's token. */
  readonly whoami: () => Promise<IdentityResponse>;
  /**
   * `POST /v1/session`: logs a human identity in to the web UI. The server answers with the identity and sets an
   * HttpOnly, SameSite=Strict session cookie, which a browser then sends instead of the token. An agent's token is
   * refused with 403 `human_only` (`details.kind` names its kind); no token with 401 `token_missing`.
   */
  readonly login: () => Promise<IdentityResponse>;
  /** `DELETE /v1/session`: clears the session cookie. */
  readonly logout: () => Promise<IdentityResponse>;
  /** `GET /v1/identities`: every identity, sorted by name; Deactivated ones only with `{ include: "deactivated" }`. */
  readonly listIdentities: (query?: ListIdentitiesQuery) => Promise<ListIdentitiesResponse>;
  /** Any human creates agents it owns; see `CreateIdentityRequest`. The token is shown this once. A name in use is 409. */
  readonly createIdentity: (request: CreateIdentityRequest) => Promise<IdentityWithTokenResponse>;
  /** The agent's owner or an admin (else 403 `not_owner`). Issues a new token; the old one stops working at once. */
  readonly rotateToken: (name: string) => Promise<IdentityWithTokenResponse>;
  /**
   * `POST /v1/identities/:name/deactivate`: an admin deactivates anyone, a human their own agents (403 `not_owner`
   * otherwise). Every token it holds fails at once; a human's agents stay active (`agents` is always empty). Its
   * messages and name stay; the name can't be created again. The last admin is 409 `last_admin`.
   */
  readonly deactivateIdentity: (name: string) => Promise<DeactivateIdentityResponse>;
  /**
   * `POST /v1/identities/:name/reactivate`: an admin reactivates anyone, a human their own agents, even while the
   * agent's owner is Deactivated. Answers a fresh token, shown this once; old tokens stay dead. 409 `not_deactivated`
   * if it isn't.
   */
  readonly reactivateIdentity: (name: string) => Promise<IdentityWithTokenResponse>;
  /** Admin only. Makes a human an admin and answers it; an admin stays one. An agent is 403 `human_only`. */
  readonly makeAdmin: (name: string) => Promise<IdentityResponse>;
  /** Admin only. Removes admin and answers the identity. The last admin keeps it (409 `last_admin`). */
  readonly removeAdmin: (name: string) => Promise<IdentityResponse>;
  /** `PUT`s (trimmed, 1–80 characters) or clears (`null`) a display name: its own, its owner's or an admin's call. */
  readonly setDisplayName: (name: string, displayName: string | null) => Promise<IdentityResponse>;
  /** Admin only: gives an agent to another human. A human is 403 `identity_kind`; `ada/x` is 400 `name_not_owned`. */
  readonly transferAgent: (agent: string, owner: string) => Promise<IdentityResponse>;
  /** `POST /v1/channels`: any identity can create a channel, which subscribes it. A name in use is 409 `channel_exists`. */
  readonly createChannel: (request: CreateChannelRequest) => Promise<ChannelResponse>;
  /** `GET /v1/channels`: every channel, sorted by name. */
  readonly listChannels: () => Promise<ListChannelsResponse>;
  /** `GET /v1/channels?subscribed=true`: the channels the caller subscribes to, sorted by name. */
  readonly listSubscribedChannels: () => Promise<ListChannelsResponse>;
  /** `GET /v1/channels/:name`. A missing channel is 404 `channel_not_found`. */
  readonly getChannel: (name: string) => Promise<ChannelResponse>;
  /**
   * `DELETE /v1/channels/:name`, admin only: deletes the channel and everything in it, and answers it. A missing
   * channel is 404 `channel_not_found`. The name can be created again, as a new, empty channel.
   */
  readonly deleteChannel: (name: string) => Promise<ChannelResponse>;
  /**
   * `POST /v1/messages`: a top-level message, or a reply with `replyTo` (a reply to a reply joins the parent's thread).
   * A missing channel or message is 404; replying in another channel is 400 `reply_in_other_channel`. With `close`,
   * the reply also closes its thread.
   */
  readonly createMessage: (post: CreateMessageRequest) => Promise<MessageResponse>;
  /**
   * `GET /v1/channels/:name/messages`: the channel's top-level messages, oldest first: the newest `limit` (default 50),
   * or those before `before`. Page back by passing the first message's ID as `before` while `hasMore` is true.
   */
  readonly listMessages: (channel: string, query?: ListMessagesQuery) => Promise<ListMessagesResponse>;
  /** `GET /v1/messages/:id/thread`: the thread holding the message, its top-level message and every reply in order. */
  readonly getThread: (messageId: MessageId) => Promise<ThreadResponse>;
  /**
   * `PUT /v1/messages/:id/reactions/:reaction`: leaves the caller's reaction, `thumbs_up` or `thumbs_down`, on a
   * message; one already there stays as it is. The message's author gets an inbox item for it, unless the author is
   * the caller or deactivated. Answers with the message's reactions. A missing message is 404 `message_not_found`.
   */
  readonly react: (messageId: MessageId, reaction: ReactionName) => Promise<ReactionsResponse>;
  /**
   * `DELETE /v1/messages/:id/reactions/:reaction`: removes the caller's reaction from a message, notifying no one.
   * Answers with the message's reactions.
   */
  readonly unreact: (messageId: MessageId, reaction: ReactionName) => Promise<ReactionsResponse>;
  /**
   * `POST /v1/agent-session`, with an agent's Identity token (`as` must be its name; a human's is 403
   * `identity_kind`): issues an agent session token, which expires once unused for `idleExpiry` (default `7d`, at
   * most the server's `COOKOUT_MAX_IDLE_EXPIRY`, else 400 `idle_expiry_too_long`); each request sent with it moves
   * its expiry on. Make a client with it as `token` to act as the agent for this session. 409 `agent_session_live`
   * (with `details.expiresAt`) while the agent has a live one, unless `force`, which revokes that one at once.
   */
  readonly join: (request: JoinRequest) => Promise<AgentSessionResponse>;
  /**
   * `DELETE /v1/agent-session`: revokes the agent session token this client's token is, so another session can join
   * at once. With any other token, 400 `agent_session_required`. A revoked or expired agent session token gets 401
   * `agent_session_revoked` or `agent_session_expired` on every request.
   */
  readonly leave: () => Promise<LeaveResponse>;
  /** The owner or an admin: the agent's live session (issued, last used, expiry, host if known), never its token. */
  readonly listAgentSessions: AgentSessionCalls["listAgentSessions"];
  /** The owner or an admin: revokes the agent's live session, whose next request is 401 `agent_session_revoked`. */
  readonly revokeAgentSession: AgentSessionCalls["revokeAgentSession"];
  /**
   * `GET /v1/inbox`: what the caller hasn't read, oldest first, each message once with every reason it is there
   * (`followed-thread`, `mention`, `subscribed-channel`), its channel and its thread's top-level message. The caller's own messages never appear. Beside them, `alerts` lists the caller's unread offline alerts, oldest first, and `nudges` its unread Nudges, oldest first about quiet threads it started, `deactivationOffers` its open Deactivation offers and `deactivatedQuietAgents` its unread deactivated quiet agents. Reading it changes nothing.
   */
  readonly inbox: () => Promise<InboxResponse>;
  /**
   * `GET /v1/inbox/history`: a page of the caller's inbox history, newest first: every message in its inbox for at
   * least one reason as things stand now (current follows and subscriptions), read or not, each once with every
   * reason and `read`. The newest `limit` (default 50, 1–200), or those before `before`; page back by passing the
   * last item's message ID as `before` while `hasMore` is true. The caller's own messages never appear. The first page also lists, as `alerts`, every offline alert raised for the caller, read or not, newest first, and as `nudges` every Nudge the caller has had, read or not, newest first.
   */
  readonly inboxHistory: (query?: InboxHistoryQuery) => Promise<InboxHistoryResponse>;
  /** `GET /v1/read-positions`: the caller's read positions, by channel name, each channel's own before its threads'. */
  readonly readPositions: () => Promise<ReadPositionsResponse>;
  /**
   * `POST /v1/ack`: marks the message and everything before it in its thread (for a reply) or channel (for a
   * top-level message) as read. An ack never moves a read position backwards. A missing message is 404
   * `message_not_found`.
   */
  readonly ack: (messageId: MessageId) => Promise<AckResponse>;
  /**
   * `POST /v1/read-positions/unread`: marks the message unread, with everything after it in its thread or channel, by
   * moving the read position there back to just before it, and answers where it is now (`messageId` `null` where
   * nothing there is read). It never marks anything read; a later ack moves the position forward again. A missing
   * message is 404 `message_not_found`.
   */
  readonly markUnread: (messageId: MessageId) => Promise<MarkUnreadResponse>;
  /**
   * `POST /v1/inbox/ack-all`: marks every inbox item up to `upTo`, the newest the caller has seen, as read, in every thread and channel at once, and answers the read positions it moved. An item after `upTo`, such as a message that
   * arrived since, stays unread. Passed `{ upTo, alertsUpTo, nudgesUpTo }`, it also marks read every offline alert up to `alertsUpTo`, answering those as `alerts`, and every Nudge up to `nudgesUpTo`; any may be left out.
   */
  readonly ackAll: (upTo: MessageId | AckAllRequest) => Promise<AckAllResponse>;
  /**
   * `PUT /v1/messages/:id/follow`: follows the thread holding the message, so its replies reach the inbox. Starting
   * a thread, replying in it and being mentioned in it follow it too.
   */
  readonly follow: (messageId: MessageId) => Promise<FollowResponse>;
  /** `DELETE /v1/messages/:id/follow`: stops following the thread until the caller next replies or is mentioned in it. */
  readonly unfollow: (messageId: MessageId) => Promise<FollowResponse>;
  /** `PUT /v1/channels/:name/subscription`: new top-level messages in the channel reach the inbox. */
  readonly subscribe: (channel: string) => Promise<SubscriptionResponse>;
  /** `DELETE /v1/channels/:name/subscription`: they stop reaching it. */
  readonly unsubscribe: (channel: string) => Promise<SubscriptionResponse>;
  /**
   * `GET /v1/events`: opens one Server-Sent Events stream, resolving once the server has accepted it. Iterate it for
   * each new inbox item (`inbox-item`) the moment another identity posts it (the caller's own posts never arrive), and
   * each new read position (`read-position`) the moment any session of the caller acks, and each read position moved
   * back (`read-position-moved-back`) the moment one marks a message unread, so several sessions stay in sync. With `allChannels`, it also sends every new message on every channel (`message`), each newly recorded read receipt (`read-receipt`), each change to a message's reactions (`reaction`), each thread closed or reopened (`thread`) and each change to anyone's presence (`presence`), as the web UI needs. Every stream of an agent's owner also sends each offline alert of the owner's as it is raised, back online or read (`offline-alert`), and every stream of the caller each Nudge for it as it is raised (`nudge`), the IDs of its Nudges as they are marked read (`nudge-read`), each Deactivation offer and deactivated quiet agent as it changes.
   * Each event is checked against the protocol (`bad_response` otherwise); an event type this SDK doesn't know, from
   * a newer server, is skipped. `close` drops the connection, which the server counts as a drop ("connection lost" after the grace); `closeCleanly` first sends `DELETE /v1/events/:connection` with the `connected` event's connection ID, so the end is expected, as `cookout watch` exiting on purpose does.
   * Opened with an agent session token, the stream moves its expiry on while open, and once the token is revoked (`leave`, or another session's `join --force`) the
   * iteration throws `agent_session_revoked` (status 200, the stream's). An agent holds one stream at most: when
   * another opens for it, with either token, this one's iteration throws `watch_replaced`. To pick up after a
   * dropped connection, pass the last message ID seen as `lastEventId`: the stream first replays the inbox items
   * after it, then goes on live.
   * The server sends a heartbeat every 15 s, which `onHeartbeat` hears while the stream is being iterated. The
   * stream starts by telling `onConnected` the board's latest message ID (null before the first message): every
   * item sent live is newer, so resuming from it after a drop misses nothing.
   */
  readonly watch: (options?: WatchOptions) => Promise<EventStream>;
  /**
   * `POST /v1/commands` (admin only): registers a webhook command. Its handler identity is an agent with the
   * command's name, made unless an agent of that name exists. The secret deliveries are signed with is in the answer
   * this once. A name in use is 409 `command_exists`; a human's name is 409 `handler_not_agent`.
   */
  readonly addCommand: (request: AddCommandRequest) => Promise<CommandWithSecretResponse>;
  /** `GET /v1/commands`: every command, sorted by name, without its secret. */
  readonly listCommands: () => Promise<ListCommandsResponse>;
  /**
   * `POST /v1/commands/:name/calls`: calls a command. Data that breaks its JSON Schema is 400 `invalid_request`
   * with the schema errors in `details` (paths start at `data`), and nothing is posted. Otherwise the call is
   * posted in the channel as a top-level message by the caller with data `{ command, data }`, the caller follows
   * its thread, and the answer (202) comes without waiting for the handler. An unknown command is 404
   * `command_not_found`.
   */
  readonly callCommand: (name: string, request: CallCommandRequest) => Promise<CallCommandResponse>;
  /**
   * `POST /v1/commands/:name/secret` (admin only): issues the command a new secret in place of its old one, which
   * signs no delivery from then on, retries of earlier calls included. The new secret is in the answer this once. An
   * unknown command is 404 `command_not_found`.
   */
  readonly rotateCommandSecret: (name: string) => Promise<CommandWithSecretResponse>;
};
/**
 * Checks one Server-Sent Event from `GET /v1/events` against the protocol, for a reader that opens the stream itself
 * (a browser's `EventSource`). It answers the event, or `null` for an event type this SDK doesn't know; data that
 * doesn't match fails with `CookoutError` code `bad_response`.
 */
export declare const parseEvent: typeof eventOf;
/** A client for the server at `url` with `token`, each defaulting to `COOKOUT_URL` and `COOKOUT_TOKEN`. Throws `CookoutError` code `url_missing` (status 0) when there is no URL. */
export declare function createCookoutClient(options?: CookoutClientOptions): CookoutClient;
export { type AckAllRequest, type AckAllResponse, type AckRequest, type AckResponse, type AddCommandRequest, type AgentIdentity, type AgentJoinCalls, type AgentJoinCollectedResponse, type AgentJoinRequestResponse, type AgentJoinRequestStartedResponse, type AgentJoinRequestView, type AgentSessionEvent, type AgentSessionLiveDetails, type AgentSessionResponse, type ApproveAgentJoinRequest, type Attachment, type AttachmentBytes, type AttachmentContentType, type AttachmentId, type Author, type BuiltInCommand, type CallCommandRequest, type CallCommandResponse, type Channel, type ChannelDeletedEvent, type ChannelEvent, type ChannelName, type ChannelResponse, type CleanCloseResponse, type Command, type CommandEvent, type CommandName, type CommandSecret, type CommandWithSecretResponse, type ConnectedEvent, CookoutError, type CookoutErrorCode, type CookoutEvent, type CreateChannelRequest, type CreateIdentityRequest, type CreateJoinCodeRequest, type CreateMessageRequest, type CreateScheduledMessageRequest, type DeactivateIdentityResponse, type DeactivatedQuietAgent, type DeactivatedQuietAgentEvent, type DeactivatedQuietAgentId, type DeactivatedQuietAgentResponse, type DeactivationOffer, type DeactivationOfferEvent, type DeactivationOfferId, type DeactivationOfferResponse, type Description, type DescriptionCalls, type DisplayName, type EditScheduledMessageRequest, type EventStream, type FollowResponse, type Harness, type HealthResponse, type HumanIdentity, type Identity, type IdentityDeletedEvent, type IdentityEvent, type IdentityKind, type IdentityMessageCountResponse, type IdentityName, type IdentityResponse, type IdentityWithTokenResponse, type IdleExpiryTooLongDetails, type ImageContentType, type InboxHistoryItem, type InboxHistoryNudge, type InboxHistoryQuery, type InboxHistoryResponse, type InboxItem, type InboxItemEvent, type InboxReason, type InboxResponse, type IsoTime, type JoinCodeCalls, type JoinCodeResponse, type JoinRequest, type JsonSchema, type JsonValue, type LeaveResponse, type ListAgentSessionsResponse, type ListChannelsResponse, type ListCommandsResponse, type ListIdentitiesQuery, type ListIdentitiesResponse, type ListMessagesQuery, type ListMessagesResponse, type ListOpenThreadsQuery, type ListOpenThreadsResponse, type ListScheduledMessagesQuery, type ListScheduledMessagesResponse, type ListedAgentSession, type LiveConnectionDetail, type LiveConnectionId, type MarkUnreadRequest, type MarkUnreadResponse, type Message, type MessageEvent, type MessageFields, type MessageId, type MessageResponse, type MovedBackReadPosition, type NewAttachment, type Nudge, type NudgeEvent, type NudgeId, type NudgeKind, type NudgeReadEvent, type NudgeResponse, type OfflineAlert, type OfflineAlertEvent, type OfflineAlertId, type OfflineAlertResponse, type OfflineReason, type OpenThread, type Owner, type PostMessageRequest, type Presence, type PresenceEvent, type PresenceResponse, type PreviewScheduledMessageQuery, type Reaction, type ReactionCount, type ReactionEvent, type ReactionName, type ReactionsResponse, type ReadPosition, type ReadPositionEvent, type ReadPositionMovedBackEvent, type ReadPositionsResponse, type ReadReceipt, type ReadReceiptEvent, type RedeemJoinCodeRequest, type Refusal, type RegisteredCommand, type Reply, type RevokeAgentSessionResponse, type ScheduledMessage, type ScheduledMessageId, type ScheduledMessagePreviewResponse, type ScheduledMessageResponse, type ScheduledMessageRun, type SchemaProblem, type SearchRequest, type SearchResponse, type SearchResult, type ServerSentEvent, type SetDisplayNameRequest, type SetTriggerRequest, type StartAgentJoinRequest, type SubscriptionEvent, type SubscriptionResponse, type ThreadEvent, type ThreadMovedWarning, type ThreadResponse, type Token, type TopLevelMessage, type TopLevelMessageResponse, type Trigger, type TriggerFailure, type TriggerResponse, type TriggerResult, type UnknownErrorCode, type UpdateIdentityRequest, type WatchOptions, type agentJoinApprovalPathOf, type agentJoinRequestApprovalPath, type agentJoinRequestPath, type agentJoinRequestsPath, type agentSessionErrorCodes, type agentSessionExpired, type agentSessionPath, type agentSessionRevoked, type allChannelsQuery, type collectAgentJoinRequestPath, type defaultIdleExpiry, type eventsPath, type identityAgentSessionPath, type idleExpiryPattern, type joinCodeLifetimeMinutes, type joinCodesPath, type liveConnectionPath, type redeemJoinCodePath, type refusalEvent, refusalOf, type scheduledMessageCalls };
```
