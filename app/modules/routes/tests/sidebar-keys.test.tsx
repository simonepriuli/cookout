import {
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
} from "./sidebar-keys.ts";
import { expect, it } from "vitest";
import { openAt } from "./render.tsx";

it("only one sidebar link is in the tab order, and the row buttons are out of it", { timeout: 5000 }, async () => {
  expect.hasAssertions();

  const channels = channelsOf("web-sidebar-keys-tabs");
  const close = openAt({ client: await readerOf(channels), hash: `#/channels/${channels.second}` });
  const before = await tabIndexes(channels.second);
  const buttons = rowButtonsInTabOrder();
  await focusInbox();

  expect([before, await tabIndexes(channels.second)]).toStrictEqual([
    [IN_TAB_ORDER, OUT_OF_TAB_ORDER],
    [OUT_OF_TAB_ORDER, IN_TAB_ORDER],
  ]);
  expect(buttons).toBe(NONE);

  close();
});

it("↑ and ↓ move between the sidebar's links, stopping at the ends, and do nothing off a link", {
  timeout: 5000,
}, async () => {
  expect.hasAssertions();

  const close = openAt({ client: await readerOf(channelsOf("web-sidebar-keys-arrows")), hash: "#/inbox" });
  await focusInbox();
  const moved = arrowedToTop();
  focusCollapse();
  pressed({ key: "ArrowDown" });

  expect([...moved, focusedName()]).toStrictEqual(["People & agents", "cookout", "Collapse sidebar"]);

  close();
});

it("alt+↓ and alt+↑ open the next and previous channel", { timeout: 5000 }, async () => {
  expect.hasAssertions();

  const channels = channelsOf("web-sidebar-keys-alt");
  const close = openAt({ client: await readerOf(channels), hash: `#/channels/${channels.first}` });
  await rowOf(channels.third);

  expect([pressed({ altKey: true, key: "ArrowDown" }), pressed({ altKey: true, key: "ArrowUp" })]).toStrictEqual([
    `#/channels/${channels.second}`,
    `#/channels/${channels.first}`,
  ]);

  close();
});

it("alt+shift+↑ opens the previous unread channel, wrapping round, and says so when none is left", {
  timeout: 5000,
}, async () => {
  expect.hasAssertions();

  const { channels, reader } = await postedIn({ at: "third", prefix: "web-sidebar-keys-unread" });
  const close = openAt({ client: reader, hash: `#/channels/${channels.first}` });
  await shownAs({ channel: channels.third, text: `#${channels.third} 1 unread` });
  const wrapped = pressed({ altKey: true, key: "ArrowUp", shiftKey: true });
  const after = pressed({ altKey: true, key: "ArrowDown", shiftKey: true });

  await expect(saying("No unread channels")).resolves.toBe("No unread channels");
  expect([wrapped, after]).toStrictEqual([`#/channels/${channels.third}`, `#/channels/${channels.third}`]);

  close();
});

it("alt+↓ from the Inbox opens a channel", { timeout: 5000 }, async () => {
  expect.hasAssertions();

  const channels = channelsOf("web-sidebar-keys-from-inbox");
  const close = openAt({ client: await readerOf(channels), hash: "#/inbox" });
  await rowOf(channels.first);

  expect(pressed({ altKey: true, key: "ArrowDown" })).toMatch(/^#\/channels\/[^/]+$/u);

  close();
});

it("e on a channel row marks it read, says so, and says when there is nothing to mark", { timeout: 5000 }, async () => {
  expect.hasAssertions();

  const { channels, reader } = await postedIn({ at: "second", prefix: "web-sidebar-keys-read" });
  const close = openAt({ client: reader, hash: `#/channels/${channels.first}` });
  await shownAs({ channel: channels.second, text: `#${channels.second} 1 unread` });

  await expect(markedTwice(channels.second)).resolves.toStrictEqual([
    `#${channels.second} marked read`,
    `Nothing unread in #${channels.second}`,
  ]);

  close();
});

it("e and s off a channel row do nothing", { timeout: 5000 }, async () => {
  expect.hasAssertions();

  const channels = channelsOf("web-sidebar-keys-off-row");
  const close = openAt({ client: await readerOf(channels), hash: "#/inbox" });
  await rowOf(channels.first);
  await focusInbox();
  pressed({ key: "s" });
  focusCollapse();
  pressed({ key: "e" });

  expect(announced()).toBe("");

  close();
});

it("s on a channel row unsubscribes, then subscribes again", { timeout: 5000 }, async () => {
  expect.hasAssertions();

  const channels = channelsOf("web-sidebar-keys-subscribe");
  const close = openAt({ client: await readerOf(channels), hash: `#/channels/${channels.first}` });
  await focusedRow(channels.second);
  const unsubscribed = await pressedUntil({ key: "s", text: `Unsubscribed from #${channels.second}` });

  await expect(pressedUntil({ key: "s", text: `Subscribed to #${channels.second}` })).resolves.toBe(
    `Subscribed to #${channels.second}`,
  );
  expect(unsubscribed).toBe(`Unsubscribed from #${channels.second}`);

  close();
});

it("s does nothing while the subscriptions load", { timeout: 5000 }, async () => {
  expect.hasAssertions();

  const channels = channelsOf("web-sidebar-keys-loading");
  const reader = await readerOf(channels);
  const close = openAt({ client: loadingSubscriptions(reader), hash: `#/channels/${channels.first}` });
  await focusedRow(channels.second);
  pressed({ key: "s" });

  expect(announced()).toBe("");

  close();
});

it("s does nothing while a subscription changes", { timeout: 5000 }, async () => {
  expect.hasAssertions();

  const channels = channelsOf("web-sidebar-keys-changing");
  const hanging = hangingSubscribe(await unsubscribedFrom(channels));
  const close = openAt({ client: hanging.client, hash: `#/channels/${channels.first}` });
  await focusedRow(channels.second);
  await pressedUntil({ key: "s", text: `Subscribed to #${channels.second}` });
  pressed({ key: "s" });

  expect(hanging.asked()).toBe(ONCE);

  close();
});
