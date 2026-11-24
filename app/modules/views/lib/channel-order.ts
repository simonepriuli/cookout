import type { ChannelName } from "../../sdk/index.ts";
import type { ChannelsState } from "../../board/index.ts";
import type { Route } from "../../paths/index.ts";

const NEXT = 1;
const START = 0;
const NOT_FOUND = -1;

type Step = "next" | "previous";

interface Stepping {
  readonly order: readonly ChannelName[];
  readonly open: ChannelName | null;
  readonly step: Step;
  readonly wanted: (channel: ChannelName) => boolean;
}

function channelOrder(channels: ChannelsState): readonly ChannelName[] {
  if (channels.status !== "loaded") {
    return [];
  }
  return channels.channels.map((channel) => channel.name).toSorted((first, second) => first.localeCompare(second));
}

function openChannel(route: Route): ChannelName | null {
  if (route.name === "channel" || route.name === "thread") {
    return route.channel;
  }
  return null;
}

function indexOfOpen(order: readonly ChannelName[], open: ChannelName | null): number {
  if (open === null) {
    return NOT_FOUND;
  }
  return order.indexOf(open);
}

function after(order: readonly ChannelName[], open: ChannelName | null): readonly ChannelName[] {
  const at = indexOfOpen(order, open);
  return [...order.slice(at + NEXT), ...order.slice(START, Math.max(at, START))];
}

function inStepOrder(step: Step, around: readonly ChannelName[]): readonly ChannelName[] {
  if (step === "next") {
    return around;
  }
  return around.toReversed();
}

function steppedTo({ open, order, step, wanted }: Stepping): ChannelName | null {
  return inStepOrder(step, after(order, open)).find((channel) => wanted(channel)) ?? null;
}

export { channelOrder, openChannel, type Step, steppedTo };
