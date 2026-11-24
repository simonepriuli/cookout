import { NavHeading, NavLink, NavList } from "../../design-system/index.tsx";
import { useMemo, useSyncExternalStore } from "react";
import type { Board } from "../../board/index.ts";
import { ChannelRows } from "./channel-rows.tsx";
import { InboxLink } from "./inbox-link.tsx";
import type { Keymap } from "../../keymap/index.ts";
import type { Looking } from "./use-unread-levels.ts";
import { NewChannel } from "./new-channel.tsx";
import { NewChannelButton } from "./new-channel-button.tsx";
import type { ReactNode } from "react";
import type { Route } from "../../paths/index.ts";
import { hrefOf } from "../../paths/index.ts";
import { useSidebarCounts } from "./use-unread-levels.ts";

const TEXT = {
  channels: "Channels",
  people: "People & agents",
  views: "Views",
} as const;

interface SidebarLinksProps {
  readonly board: Board;
  readonly keymap: Keymap;
  readonly route: Route;
  readonly unread: Looking["unread"];
  readonly me: string;
}

export type { SidebarLinksProps };

export function SidebarLinks(props: SidebarLinksProps): ReactNode {
  const { route } = props;
  const { channels } = useSyncExternalStore(props.board.subscribe, props.board.snapshot);
  const unread = useSyncExternalStore(props.unread.subscribe, props.unread.snapshot);
  const counts = useSidebarCounts({ me: props.me, state: unread });
  const actions = useMemo(
    () => ({ keymap: props.keymap, subscriptions: props.board.subscriptions, unread: props.unread }),
    [props.board.subscriptions, props.keymap, props.unread],
  );
  return (
    <>
      <NavList label={TEXT.views}>
        <InboxLink active={route.name === "inbox"} counts={counts.inbox} />
        <NavLink
          active={route.name === "people" || route.name === "profile"}
          href={hrefOf({ name: "people" })}
          icon="people"
          label={TEXT.people}
          marked={false}
        />
      </NavList>
      <NavHeading label={TEXT.channels}>
        <NewChannelButton creation={props.board.creation} />
      </NavHeading>
      <ChannelRows actions={actions} channels={channels} route={route} counts={counts.channels} />
      <NewChannel creation={props.board.creation} />
    </>
  );
}
