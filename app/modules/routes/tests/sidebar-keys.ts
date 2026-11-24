import { fireEvent, screen, waitFor } from "@testing-library/react";
import type { CookoutClient } from "../../sdk/index.ts";
import { expect } from "vitest";
import { inSidebar } from "./regions.ts";
import { subscribedReader } from "./inbox-reader.ts";

const IN_TAB_ORDER = 0;
const OUT_OF_TAB_ORDER = -1;
const ONCE = 1;
const NONE = 0;
const INBOX = "^Inbox";
const ANNOUNCEMENTS = { name: "Announcements" } as const;

interface Press {
  readonly key: string;
  readonly altKey?: boolean;
  readonly shiftKey?: boolean;
}

interface Channels {
  readonly first: string;
  readonly second: string;
  readonly third: string;
}

interface Posted {
  readonly channels: Channels;
  readonly reader: CookoutClient;
}

function channelsOf(prefix: string): Channels {
  return { first: `${prefix}-a`, second: `${prefix}-b`, third: `${prefix}-c` };
}

async function readerOf({ first, second, third }: Channels): Promise<CookoutClient> {
  const { reader } = await subscribedReader(first, second, third);
  return reader;
}

async function postedIn({ at, prefix }: { readonly prefix: string; readonly at: keyof Channels }): Promise<Posted> {
  const channels = channelsOf(prefix);
  const { poster, reader } = await subscribedReader(channels.first, channels.second, channels.third);
  await poster.createMessage({ channel: channels[at], text: "Unread here" });
  return { channels, reader };
}

async function linkOf(pattern: string): Promise<HTMLElement> {
  const link = await inSidebar().findByRole("link", { name: new RegExp(pattern, "u") });
  return link;
}

async function rowOf(channel: string): Promise<HTMLElement> {
  const row = await linkOf(`^#${channel}(?![a-z-])`);
  return row;
}

function pressed(press: Press): string {
  fireEvent.keyDown(globalThis.document.activeElement ?? globalThis.document.body, press);
  return globalThis.location.hash;
}

function focusedName(): string {
  const focused = globalThis.document.activeElement;
  if (focused === null) {
    return "";
  }
  return focused.getAttribute("aria-label") ?? focused.textContent;
}

function announced(): string {
  return screen.getByRole("status", ANNOUNCEMENTS).textContent;
}

async function saying(text: string): Promise<string> {
  await waitFor(() => {
    expect(announced()).toBe(text);
  });
  return announced();
}

async function pressedUntil({ key, text }: { readonly key: string; readonly text: string }): Promise<string> {
  await waitFor(() => {
    pressed({ key });

    expect(announced()).toBe(text);
  });
  return announced();
}

async function shownAs({ channel, text }: { readonly channel: string; readonly text: string }): Promise<void> {
  const row = await rowOf(channel);
  await waitFor(() => {
    expect(row.textContent).toBe(text);
  });
}

async function focusedRow(channel: string): Promise<void> {
  const row = await rowOf(channel);
  row.focus();
}

async function forever<Value>(): Promise<Value> {
  const { promise } = Promise.withResolvers<Value>();
  const value = await promise;
  return value;
}

function loadingSubscriptions(reader: Readonly<CookoutClient>): CookoutClient {
  return { ...reader, listSubscribedChannels: forever };
}

interface Hanging {
  readonly client: CookoutClient;
  readonly asked: () => number;
}

function hangingSubscribe(reader: Readonly<CookoutClient>): Hanging {
  let asked = 0;
  return {
    asked: () => asked,
    client: {
      ...reader,
      subscribe: async () => {
        asked += ONCE;
        const never = await forever<Awaited<ReturnType<CookoutClient["subscribe"]>>>();
        return never;
      },
    },
  };
}

function focusCollapse(): void {
  inSidebar().getByRole("button", { name: "Collapse sidebar" }).focus();
}

function arrowedToTop(): readonly string[] {
  pressed({ key: "ArrowDown" });
  const people = focusedName();
  pressed({ key: "ArrowUp" });
  pressed({ key: "ArrowUp" });
  pressed({ key: "ArrowUp" });
  return [people, focusedName()];
}

function rowButtonsInTabOrder(): number {
  let count = NONE;
  for (const button of inSidebar().getAllByRole("button", { name: "More actions" })) {
    if (button.tabIndex === IN_TAB_ORDER) {
      count += ONCE;
    }
  }
  return count;
}

async function focusInbox(): Promise<void> {
  const inbox = await linkOf(INBOX);
  inbox.focus();
}

async function markedTwice(channel: string): Promise<readonly string[]> {
  await focusedRow(channel);
  pressed({ key: "e" });
  const marked = await saying(`#${channel} marked read`);
  await shownAs({ channel, text: `#${channel}` });
  pressed({ key: "e" });
  return [marked, await saying(`Nothing unread in #${channel}`)];
}

async function unsubscribedFrom(channels: Channels): Promise<CookoutClient> {
  const reader = await readerOf(channels);
  await reader.unsubscribe(channels.second);
  return reader;
}

async function tabIndexes(channel: string): Promise<readonly number[]> {
  const row = await rowOf(channel);
  const inbox = await linkOf(INBOX);
  return [row.tabIndex, inbox.tabIndex];
}

export {
  IN_TAB_ORDER,
  NONE,
  ONCE,
  OUT_OF_TAB_ORDER,
  announced,
  arrowedToTop,
  channelsOf,
  focusCollapse,
  focusInbox,
  focusedName,
  focusedRow,
  hangingSubscribe,
  loadingSubscriptions,
  markedTwice,
  postedIn,
  pressed,
  pressedUntil,
  readerOf,
  rowButtonsInTabOrder,
  rowOf,
  saying,
  shownAs,
  tabIndexes,
  unsubscribedFrom,
};
