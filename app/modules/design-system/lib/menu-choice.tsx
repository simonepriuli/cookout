import type { MenuChoice as Choice, MenuItem } from "./menu-parts.ts";
import { MENU_ITEM } from "./menu-style.ts";
import { MenuAction } from "./menu-action.tsx";
import { MenuKeyedAction } from "./menu-keyed-action.tsx";
import type { ReactNode } from "react";
import { menuIcon } from "./menu-icons.ts";

interface MenuChoiceParts {
  readonly choice: Choice;
  readonly item: MenuItem;
  readonly onChoose: (action: () => void) => void;
}

export function MenuChoice(parts: MenuChoiceParts): ReactNode {
  const { choice, onChoose } = parts;
  const RadixItem = parts.item;
  if (choice.href !== null) {
    return (
      <RadixItem asChild>
        <a className={MENU_ITEM} href={choice.href}>
          {menuIcon(choice.icon)}
          {choice.label}
        </a>
      </RadixItem>
    );
  }
  const keys = choice.keys ?? null;
  if (keys === null) {
    return <MenuAction choice={choice} item={RadixItem} onChoose={onChoose} />;
  }
  return <MenuKeyedAction choice={choice} item={RadixItem} keys={keys} onChoose={onChoose} />;
}
