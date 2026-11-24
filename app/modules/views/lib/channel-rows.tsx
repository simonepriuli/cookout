import { Alert, NavList, Skeleton } from "../../design-system/index.tsx";
import { channelOrder, openChannel } from "./channel-order.ts";
import type { ChannelActions } from "./use-channel-menu.ts";
import { ChannelMenuRefusal } from "./channel-menu-refusal.tsx";
import type { ChannelName } from "../../sdk/index.ts";
import { ChannelRow } from "./channel-row.tsx";
import type { ChannelsState } from "../../board/index.ts";
import { NO_COUNTS } from "../../unread/index.ts";
import type { ReactNode } from "react";
import type { Route } from "../../paths/index.ts";
import type { UnreadCounts } from "../../unread/index.ts";

const TEXT = { channels: "Channels" } as const;

interface ChannelRowsProps {
  readonly actions: ChannelActions;
  readonly channels: ChannelsState;
  readonly route: Route;
  readonly counts: ReadonlyMap<ChannelName, UnreadCounts>;
}

export function ChannelRows(props: ChannelRowsProps): ReactNode {
  const { channels, counts } = props;
  const open = openChannel(props.route);
  if (channels.status === "loading") {
    return (
      <div className="flex flex-col gap-3 p-4">
        <Skeleton width="short" />
        <Skeleton width="long" />
      </div>
    );
  }
  if (channels.status === "failed") {
    return <Alert>{`Couldn't load the channels (${channels.code}): ${channels.message}`}</Alert>;
  }
  return (
    <>
      <NavList label={TEXT.channels}>
        {channelOrder(channels).map((channel) => (
          <ChannelRow
            actions={props.actions}
            channel={channel}
            counts={counts.get(channel) ?? NO_COUNTS}
            key={channel}
            open={open === channel}
          />
        ))}
      </NavList>
      <ChannelMenuRefusal actions={props.actions} />
    </>
  );
}
