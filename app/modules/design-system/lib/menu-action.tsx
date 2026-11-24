import type { ActionChoice, MenuItem } from "./menu-parts.ts";
import { MENU_ITEM } from "./menu-style.ts";
import type { ReactNode } from "react";
import { ShortcutTooltip } from "./shortcut-tooltip.tsx";
import { menuIcon } from "./menu-icons.ts";
import { useCallback } from "react";

interface MenuActionParts {
  readonly choice: ActionChoice;
  readonly item: MenuItem;
  readonly onChoose: (action: () => void) => void;
}

export function MenuAction(parts: MenuActionParts): ReactNode {
  const { choice, onChoose } = parts;
  const RadixItem = parts.item;
  const handleSelect = useCallback(() => {
    onChoose(choice.onSelect);
  }, [choice, onChoose]);
  const item = (
    <RadixItem asChild disabled={choice.disabled ?? false} onSelect={handleSelect}>
      <div className={MENU_ITEM}>
        {menuIcon(choice.icon)}
        {choice.label}
      </div>
    </RadixItem>
  );
  const shortcut = choice.shortcut ?? null;
  if (shortcut === null) {
    return item;
  }
  return (
    <ShortcutTooltip label={choice.label} shortcut={shortcut}>
      {item}
    </ShortcutTooltip>
  );
}
