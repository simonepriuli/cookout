import type { ActionChoice, MenuItem } from "./menu-parts.ts";
import { MENU_ITEM } from "./menu-style.ts";
import { MenuKeys } from "./menu-keys-hint.tsx";
import type { ReactNode } from "react";
import type { Shortcut } from "./shortcut.ts";
import { menuIcon } from "./menu-icons.ts";
import { useCallback } from "react";

interface MenuKeyedActionParts {
  readonly choice: ActionChoice;
  readonly item: MenuItem;
  readonly keys: Shortcut;
  readonly onChoose: (action: () => void) => void;
}

export function MenuKeyedAction(parts: MenuKeyedActionParts): ReactNode {
  const { choice, keys, onChoose } = parts;
  const RadixItem = parts.item;
  const handleSelect = useCallback(() => {
    onChoose(choice.onSelect);
  }, [choice, onChoose]);
  return (
    <RadixItem asChild disabled={choice.disabled === true} onSelect={handleSelect}>
      <div aria-keyshortcuts={keys.keys} className={MENU_ITEM}>
        {menuIcon(choice.icon)}
        {choice.label}
        <MenuKeys shortcut={keys} />
      </div>
    </RadixItem>
  );
}
