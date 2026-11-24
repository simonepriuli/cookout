import { chose, pressed } from "./menus.ts";
import { expect, it, vi } from "vitest";
import { fireEvent, screen, waitFor, within } from "@testing-library/react";
import { inPane, inSidebar } from "./regions.ts";
import type { CookoutClient } from "../../sdk/index.ts";
import type { Unread } from "../../unread/index.ts";
import { createUnread } from "../../unread/index.ts";
import { openAt } from "./render.tsx";
import { subscribedReader } from "./inbox-reader.ts";
import { watched } from "./watched.ts";

const ICON_FIRST = ':scope > svg[aria-hidden="true"]:first-child';

type Shown = readonly (readonly [string, boolean, boolean])[];

async function channelLink(channel: string): Promise<HTMLElement> {
  const link = await inSidebar().findByRole("link", { name: new RegExp(`^#${channel}(?!-)`, "u") });
  return link;
}

async function menuItems(name: string): Promise<Shown> {
  const shown = await screen.findByRole("menu", { name });
  const items: (readonly [string, boolean, boolean])[] = [];
  for (const item of within(shown).getAllByRole("menuitem")) {
    let label = "";
    for (const node of item.childNodes) {
      if (node.nodeType === Node.TEXT_NODE) {
        label += node.textContent ?? "";
      }
    }
    items.push([label, item.querySelector(ICON_FIRST) !== null, "disabled" in item.dataset]);
  }
  return items;
}

async function moreActionsOf(channel: string): Promise<HTMLElement> {
  const link = await channelLink(channel);
  return within(link.closest("li") ?? link).getByRole("button", { name: "More actions" });
}

async function subscribedNames(client: CookoutClient): Promise<readonly string[]> {
  const { channels } = await client.listSubscribedChannels();
  return channels.map((channel) => channel.name);
}

async function inboxTexts(client: CookoutClient): Promise<readonly string[]> {
  const { items } = await client.inbox();
  return items.map((item) => `${item.channel.name} ${item.message.text}`);
}

async function unreadChannel(channel: string): Promise<CookoutClient> {
  const other = `${channel}-other`;
  const { poster, reader } = await subscribedReader(channel, other);
  const { message: parent } = await reader.createMessage({ channel, text: "Deploy?" });
  await poster.createMessage({ channel, replyTo: parent.id, text: "Noon" });
  await poster.createMessage({ channel, text: "One" });
  await poster.createMessage({ channel, text: "Two" });
  await poster.createMessage({ channel: other, text: "Elsewhere" });
  return reader;
}

async function titleSaying(title: string): Promise<string> {
  await waitFor(() => {
    expect(globalThis.document.title).toBe(title);
  });
  return globalThis.document.title;
}

it("right-clicking a sidebar channel opens its actions menu, every item with an icon", { timeout: 5000 }, async () => {
  expect.hasAssertions();

  const { reader } = await subscribedReader("web-channel-menu-right");
  const close = openAt({ client: reader, hash: "#/inbox" });
  fireEvent.contextMenu(await channelLink("web-channel-menu-right"));

  await expect(menuItems("#web-channel-menu-right actions")).resolves.toStrictEqual([
    ["Mark all as read", true, true],
    ["Unsubscribe", true, false],
  ]);

  close();
});

it("a sidebar channel's More actions button opens the same menu", { timeout: 5000 }, async () => {
  expect.hasAssertions();

  const { reader } = await subscribedReader("web-channel-menu-more");
  const close = openAt({ client: reader, hash: "#/inbox" });
  const button = await moreActionsOf("web-channel-menu-more");
  pressed(() => button);

  await expect(menuItems("More actions")).resolves.toStrictEqual([
    ["Mark all as read", true, true],
    ["Unsubscribe", true, false],
  ]);

  close();
});

const KEYS = [
  ["the context-menu key", "ContextMenu", false],
  ["Shift+F10", "F10", true],
] as const;

const BOTH_ITEMS = 2;

async function chooseFor(channel: string, name: string): Promise<void> {
  fireEvent.contextMenu(await channelLink(channel));
  await chose(name);
}

async function linkText(channel: string): Promise<string> {
  const link = await channelLink(channel);
  return link.textContent;
}

async function headerPressed(name: string): Promise<string | null> {
  const button = await inPane().findEnabledButton(name);
  return button.getAttribute("aria-pressed");
}

it.each(KEYS)(
  "%s on a sidebar channel's link opens its actions menu",
  { timeout: 5000 },
  async (_name, key, shiftKey) => {
    expect.hasAssertions();

    const channel = `web-channel-menu-key-${key.toLowerCase()}`;
    const { reader } = await subscribedReader(channel);
    const close = openAt({ client: reader, hash: "#/inbox" });
    fireEvent.keyDown(await channelLink(channel), { key, shiftKey });

    await expect(menuItems(`#${channel} actions`)).resolves.toHaveLength(BOTH_ITEMS);

    close();
  },
);

it("mark all as read clears a channel's unread count, its Inbox items and the title's count of what is for you", {
  timeout: 10_000,
}, async () => {
  expect.hasAssertions();

  const channel = "web-channel-mark-read";
  const reader = await unreadChannel(channel);
  const close = openAt({ client: reader, hash: "#/inbox" });
  const before = await titleSaying("(1) Inbox · cookout");
  await chooseFor(channel, "Mark all as read");
  const after = await titleSaying("Inbox · cookout");

  expect([before, after, await linkText(channel), await inboxTexts(reader)]).toStrictEqual([
    "(1) Inbox · cookout",
    "Inbox · cookout",
    `#${channel}`,
    [`${channel}-other Elsewhere`],
  ]);

  close();
});

interface OtherTab {
  readonly reader: CookoutClient;
  readonly texts: () => Promise<readonly string[]>;
  readonly close: () => Promise<void>;
}

function loadedTexts(unread: Unread): readonly string[] {
  const state = unread.snapshot();
  if (state.status !== "loaded") {
    throw new Error("still loading");
  }
  return state.items.map((item) => item.message.text);
}

async function otherTabOf(reader: CookoutClient): Promise<OtherTab> {
  const { live, stream } = watched(reader);
  const unread = createUnread({ client: reader, live });
  const stop = unread.subscribe(vi.fn<() => void>());
  await waitFor(() => loadedTexts(unread));
  const events = await stream;
  return {
    close: async () => {
      stop();
      await events.close();
    },
    reader,
    texts: async () => {
      const texts = await waitFor(() => loadedTexts(unread));
      return texts;
    },
  };
}

it("a channel marked read in one tab drops its items in another tab live", { timeout: 10_000 }, async () => {
  expect.hasAssertions();

  const channel = "web-channel-mark-read-live";
  const other = await otherTabOf(await unreadChannel(channel));
  const before = await other.texts();
  const close = openAt({ client: other.reader, hash: "#/inbox" });
  await chooseFor(channel, "Mark all as read");

  await waitFor(async () => {
    expect([before, await other.texts()]).toStrictEqual([["Noon", "One", "Two", "Elsewhere"], ["Elsewhere"]]);
  });

  close();
  await other.close();
});

it("subscribe and Unsubscribe in a channel's menu flip the subscription, as the header's button does", {
  timeout: 10_000,
}, async () => {
  expect.hasAssertions();

  const channel = "web-channel-menu-subscribe";
  const { reader } = await subscribedReader(channel);
  const close = openAt({ client: reader, hash: `#/channels/${channel}` });
  await chooseFor(channel, "Unsubscribe");
  const unsubscribed = [await headerPressed("Subscribe"), await subscribedNames(reader)];
  await chooseFor(channel, "Subscribe");

  expect([...unsubscribed, await headerPressed("Subscribed"), await subscribedNames(reader)]).toStrictEqual([
    "false",
    [],
    "true",
    [channel],
  ]);

  close();
});

it("shift+F10 on a message opens its actions menu, as on a channel", { timeout: 5000 }, async () => {
  expect.hasAssertions();

  const channel = "web-message-menu-key";
  const { poster, reader } = await subscribedReader(channel);
  await poster.createMessage({ channel, text: "Deploy?" });
  const close = openAt({ client: reader, hash: `#/channels/${channel}` });
  fireEvent.keyDown(await inPane().findByRole("article"), { key: "F10", shiftKey: true });

  await expect(screen.findByRole("menu", { name: "Message actions" })).resolves.toHaveProperty("tagName", "DIV");

  close();
});
