import type { Locator, Page } from "@playwright/test";
import { adminClient, newIdentity } from "./people.ts";
import { expect, test } from "@playwright/test";
import type { Person } from "./people.ts";
import { inSidebar } from "./regions.ts";
import { logInWithStream } from "./login.ts";

const MESSAGE_BOX = { exact: true, name: "Message" } as const;
const NONE = 0;

interface Reading {
  readonly first: string;
  readonly second: string;
  readonly third: string;
  readonly poster: Person;
  readonly reader: Person;
}

interface Opening {
  readonly page: Page;
  readonly channel: string;
  readonly reader: Person;
}

async function readerOf(prefix: string): Promise<Reading> {
  const [first, second, third] = [`${prefix}-a`, `${prefix}-b`, `${prefix}-c`] as const;
  const admin = adminClient();
  await Promise.all(
    [first, second, third].map(async (name) => {
      await admin.createChannel({ name });
    }),
  );
  const poster = await newIdentity({ kind: "agent", name: `${prefix}-poster` });
  const reader = await newIdentity({ kind: "human", name: `${prefix}-reader` });
  await Promise.all(
    [first, second, third].map(async (channel) => {
      await reader.client.subscribe(channel);
    }),
  );
  return { first, poster, reader, second, third };
}

function rowOf(page: Page, channel: string): Locator {
  return inSidebar(page).getByRole("link", { name: new RegExp(`^#${channel}(?![a-z-])`, "u") });
}

function opened(channel: string): RegExp {
  return new RegExp(`#/channels/${channel}$`, "u");
}

async function openedOn({ channel, page, reader }: Opening): Promise<void> {
  await logInWithStream({ page, token: reader.token });
  await page.goto(`/#/channels/${channel}`);

  await expect(rowOf(page, channel)).toHaveAttribute("aria-current", "page");
}

function said(page: Page, text: string): Locator {
  return page.getByRole("status").filter({ hasText: text });
}

function subscriptionOf(person: Person, channel: string): () => Promise<boolean> {
  return async () => {
    const { channels } = await person.client.listSubscribedChannels();
    return channels.some((each) => each.name === channel);
  };
}

async function tabbedIntoSidebar(page: Page): Promise<void> {
  await inSidebar(page).getByRole("button", { name: "Collapse sidebar" }).focus();
  await page.keyboard.press("Tab");

  await expect(inSidebar(page).getByRole("link", { name: /^Inbox/u })).toBeFocused();

  await page.keyboard.press("ArrowDown");

  await expect(inSidebar(page).getByRole("link", { name: "People & agents" })).toBeFocused();
}

async function openedByArrows(page: Page): Promise<string> {
  await page.keyboard.press("ArrowDown");
  await page.keyboard.press("ArrowDown");
  await page.keyboard.press("ArrowUp");
  await page.keyboard.press("Enter");

  await expect(page).toHaveURL(/#\/channels\/[^/]+$/u);

  return new URL(page.url()).hash.replace("#/channels/", "");
}

async function subscribedByS({ channel, page, reader }: Opening): Promise<void> {
  await rowOf(page, channel).focus();
  await page.keyboard.press("s");

  await expect(said(page, `Subscribed to #${channel}`)).toBeAttached();
  await expect.poll(subscriptionOf(reader, channel)).toBe(true);
}

async function unsubscribedByS({ channel, page, reader }: Opening): Promise<void> {
  await page.keyboard.press("s");

  await expect(said(page, `Unsubscribed from #${channel}`)).toBeAttached();
  await expect.poll(subscriptionOf(reader, channel)).toBe(false);
}

async function caughtUp(page: Page, channel: string): Promise<void> {
  await page.keyboard.press("Alt+Shift+ArrowDown");

  await expect(said(page, "No unread channels")).toBeAttached();
  await expect(page).toHaveURL(opened(channel));
}

test("the sidebar's links are one Tab stop: arrows move between them, Enter opens one, and Tab leaves", async ({
  page,
}) => {
  const { reader } = await readerOf("browser-sidebar-keys-tab");
  await logInWithStream({ page, token: reader.token });
  await tabbedIntoSidebar(page);
  const channel = await openedByArrows(page);

  await expect(rowOf(page, channel)).toBeFocused();

  await page.keyboard.press("Tab");

  await expect(inSidebar(page).locator(":focus")).toHaveCount(NONE);

  await page.keyboard.press("Shift+Tab");

  await expect(rowOf(page, channel)).toBeFocused();
});

test("alt+↓ and alt+↑ open the next and previous channel, from the message box too", async ({ page }) => {
  const { first, reader, second } = await readerOf("browser-sidebar-keys-alt");
  await openedOn({ channel: first, page, reader });
  await page.getByRole("textbox", MESSAGE_BOX).click();
  await page.keyboard.press("Alt+ArrowDown");

  await expect(page).toHaveURL(opened(second));

  await page.getByRole("textbox", MESSAGE_BOX).click();
  await page.keyboard.press("Alt+ArrowUp");

  await expect(page).toHaveURL(opened(first));
});

test("alt+shift+↓ opens the next unread channel, and says so when none is left", async ({ page }) => {
  const { first, poster, reader, second, third } = await readerOf("browser-sidebar-keys-unread");
  await openedOn({ channel: first, page, reader });
  await poster.client.createMessage({ channel: third, text: "Unread over here" });

  await expect(rowOf(page, third)).toHaveAccessibleName(`#${third} 1 unread`);
  await expect(rowOf(page, second)).toHaveAccessibleName(`#${second}`);

  await page.keyboard.press("Alt+Shift+ArrowDown");

  await expect(page).toHaveURL(opened(third));
  await expect(rowOf(page, third)).toHaveAccessibleName(`#${third}`);

  await caughtUp(page, third);
});

test("e on a focused channel row marks it all read", async ({ page }) => {
  const { first, poster, reader, second } = await readerOf("browser-sidebar-keys-read");
  await openedOn({ channel: first, page, reader });
  await poster.client.createMessage({ channel: second, text: "Read me from the sidebar" });

  await expect(rowOf(page, second)).toHaveAccessibleName(`#${second} 1 unread`);

  await rowOf(page, second).focus();
  await page.keyboard.press("e");

  await expect(rowOf(page, second)).toHaveAccessibleName(`#${second}`);
  await expect(said(page, `#${second} marked read`)).toBeAttached();
  await expect(page).toHaveURL(opened(first));
});

test("s on a focused channel row subscribes, then unsubscribes", async ({ page }) => {
  const { first, reader, second } = await readerOf("browser-sidebar-keys-subscribe");
  await reader.client.unsubscribe(second);
  await openedOn({ channel: first, page, reader });
  await subscribedByS({ channel: second, page, reader });
  await unsubscribedByS({ channel: second, page, reader });
});

test("the channel menu shows the keys for Mark all as read and Unsubscribe", async ({ page }) => {
  const { first, reader, second } = await readerOf("browser-sidebar-keys-menu");
  await openedOn({ channel: first, page, reader });
  await rowOf(page, second).focus();
  await page.keyboard.press("Shift+F10");
  const menu = page.getByRole("menu", { name: `#${second} actions` });
  const markRead = menu.getByRole("menuitem", { name: "Mark all as read" });

  await expect(markRead).toHaveAttribute("aria-keyshortcuts", "e");
  await expect(markRead.locator("kbd")).toHaveText("e");
  await expect(menu.getByRole("menuitem", { name: "Unsubscribe" })).toHaveAttribute("aria-keyshortcuts", "s");
  await expect(menu.getByRole("menuitem", { name: "Unsubscribe" }).locator("kbd")).toHaveText("s");
});
