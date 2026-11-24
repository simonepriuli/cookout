import type { ReactNode } from "react";
import type { Shortcut } from "./shortcut.ts";

interface MenuKeysParts {
  readonly shortcut: Shortcut;
}

export function MenuKeys(parts: MenuKeysParts): ReactNode {
  return (
    <kbd aria-hidden="true" className="ml-auto pl-4 font-sans text-[11px] text-muted-foreground">
      {parts.shortcut.label}
    </kbd>
  );
}
