import { Announcement } from "../../design-system/index.tsx";
import type { Board } from "../../board/index.ts";
import type { Keymap } from "../../keymap/index.ts";
import type { ReactNode } from "react";
import type { Unread } from "../../unread/index.ts";
import { useSidebarKeys } from "./use-sidebar-keys.ts";

interface SidebarKeysProps {
  readonly board: Board;
  readonly keymap: Keymap;
  readonly me: string;
  readonly unread: Unread;
}

export function SidebarKeys(props: SidebarKeysProps): ReactNode {
  return <Announcement said={useSidebarKeys(props)} />;
}
