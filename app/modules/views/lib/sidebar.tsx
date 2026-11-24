import { Sidebar, SidebarBody, SidebarFooter } from "../../design-system/index.tsx";
import type { Identity } from "../../sdk/index.ts";
import type { Layout } from "../../layout/index.ts";
import type { ReactNode } from "react";
import { SIDEBAR } from "./sidebar-roving.ts";
import { SidebarLinks } from "./sidebar-links.tsx";
import type { SidebarLinksProps } from "./sidebar-links.tsx";
import { SidebarSettings } from "./sidebar-settings.tsx";
import { hrefOf } from "../../paths/index.ts";
import { sidebarEdge } from "./sidebar-edge.ts";
import { useSyncExternalStore } from "react";

const TEXT = { name: "cookout" } as const;

const HOME = hrefOf({ name: "inbox", selected: null });

interface SidebarProps extends Pick<SidebarLinksProps, "board" | "keymap" | "route" | "unread"> {
  readonly identity: Identity;
  readonly layout: Layout;
}

export function SidebarView(props: SidebarProps): ReactNode {
  const { layout } = props;
  const state = useSyncExternalStore(layout.subscribe, layout.snapshot);
  const handleFollow = layout.closeSidebar;
  const handleToggleCollapsed = layout.toggleCollapsed;
  return (
    <Sidebar
      collapsed={state.collapsed}
      edge={sidebarEdge({ layout, width: state.sidebarWidth })}
      home={HOME}
      label={SIDEBAR}
      onFollowHome={handleFollow}
      onToggleCollapsed={handleToggleCollapsed}
      open={state.sidebar}
      title={TEXT.name}
    >
      <SidebarBody onFollow={handleFollow}>
        <SidebarLinks
          board={props.board}
          keymap={props.keymap}
          me={props.identity.name}
          route={props.route}
          unread={props.unread}
        />
      </SidebarBody>
      <SidebarFooter>
        <SidebarSettings identity={props.identity} route={props.route} />
      </SidebarFooter>
    </Sidebar>
  );
}
