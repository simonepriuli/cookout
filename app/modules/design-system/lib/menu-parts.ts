import type { MenuIcon } from "./menu-icons.ts";
import type { ReactNode } from "react";
import type { Shortcut } from "./shortcut.ts";

interface ReactionChoice {
  readonly symbol: string;
  readonly key: string;
  readonly inHoverBar: boolean;
  readonly onReact: () => void;
}

interface ThreadChoice {
  readonly label: string;
  readonly icon: MenuIcon;
  readonly name: string;
  readonly onSelect: () => void;
}

interface MessageMenuParts {
  readonly onMarkUnread: () => void;
  readonly reactions: readonly ReactionChoice[];
  readonly thread: ThreadChoice | null;
}

interface MessageActionParts {
  readonly actionHref: string | null;
  readonly actionLabel: string;
  readonly onAction: (() => void) | null;
}

interface MenuChoiceLabel {
  readonly label: string;
  readonly icon: MenuIcon;
}

type MenuChoice =
  | (MenuChoiceLabel & { readonly href: string; readonly onSelect: null })
  | (MenuChoiceLabel & {
      readonly href: null;
      readonly onSelect: () => void;
      readonly shortcut?: string;
      readonly keys?: Shortcut;
      readonly disabled?: boolean;
    });

type ActionChoice = Extract<MenuChoice, { readonly href: null }>;

interface MenuItemShape {
  readonly asChild: true;
  readonly onSelect?: () => void;
  readonly disabled?: boolean;
  readonly children: ReactNode;
}

type MenuItem = (props: MenuItemShape) => ReactNode;

interface ActionMenuParts {
  readonly choices: readonly MenuChoice[];
  readonly label: string;
  readonly buttonLabel?: string;
}

interface HoverActionsParts extends MessageActionParts {
  readonly choices: readonly MenuChoice[];
  readonly replyOnHover: boolean;
  readonly reactions: readonly ReactionChoice[];
  readonly thread: ThreadChoice | null;
}

export type {
  ActionChoice,
  ActionMenuParts,
  HoverActionsParts,
  MenuChoice,
  MenuItem,
  MessageActionParts,
  MessageMenuParts,
  ReactionChoice,
  ThreadChoice,
};
