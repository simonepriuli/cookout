import { markRead, stepTo, toggleSubscription } from "./channel-keys.ts";
import { moveFocus, roving, sidebar } from "./sidebar-roving.ts";
import { useCallback, useEffect, useMemo, useState, useSyncExternalStore } from "react";
import type { Board } from "../../board/index.ts";
import type { ChannelKeys } from "./channel-keys.ts";
import type { Keymap } from "../../keymap/index.ts";
import type { Unread } from "../../unread/index.ts";
import { channelOrder } from "./channel-order.ts";
import { useSidebarCounts } from "./use-unread-levels.ts";

const FIRST = 0;
const ONE = 1;

interface SidebarKeys {
  readonly board: Board;
  readonly keymap: Keymap;
  readonly me: string;
  readonly unread: Unread;
}

interface Said {
  readonly count: number;
  readonly text: string;
}

function useChannelKeys(props: SidebarKeys, announce: (text: string) => void): ChannelKeys {
  const { board, unread } = props;
  const { channels } = useSyncExternalStore(board.subscribe, board.snapshot);
  const state = useSyncExternalStore(unread.subscribe, unread.snapshot);
  const counts = useSidebarCounts({ me: props.me, state }).channels;
  return useMemo(
    () => ({
      announce,
      counts,
      order: channelOrder(channels),
      subscriptions: board.subscriptions,
      unread,
    }),
    [announce, board.subscriptions, channels, counts, unread],
  );
}

function useSidebarKeys(props: SidebarKeys): Said {
  const { keymap } = props;
  const [said, setSaid] = useState<Said>({ count: FIRST, text: "" });
  const announce = useCallback((text: string) => {
    setSaid((last) => ({ count: last.count + ONE, text }));
  }, []);
  const keys = useChannelKeys(props, announce);
  useEffect(() => roving(), []);
  useEffect(() => {
    const unbind = [
      keymap.bind({
        actions: {
          nextChannel: stepTo({ keys, step: "next", unreadOnly: false }),
          nextUnreadChannel: stepTo({ keys, step: "next", unreadOnly: true }),
          previousChannel: stepTo({ keys, step: "previous", unreadOnly: false }),
          previousUnreadChannel: stepTo({ keys, step: "previous", unreadOnly: true }),
        },
        scope: "everywhere",
      }),
      keymap.bind({
        actions: {
          nextLink: moveFocus("next"),
          previousLink: moveFocus("previous"),
        },
        scope: "sidebar",
        within: sidebar,
      }),
      keymap.bind({
        actions: { markChannelRead: markRead(keys), toggleSubscription: toggleSubscription(keys) },
        scope: "channel row",
        within: sidebar,
      }),
    ];
    return (): void => {
      for (const each of unbind) {
        each();
      }
    };
  }, [keymap, keys]);
  return said;
}

export { useSidebarKeys };
