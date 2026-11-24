import type { ReactNode } from "react";

interface AnnouncementParts {
  readonly said: { readonly text: string; readonly count: number };
}

export function Announcement(parts: AnnouncementParts): ReactNode {
  return (
    <output aria-label="Announcements" aria-live="polite" className="sr-only">
      <span key={parts.said.count}>{parts.said.text}</span>
    </output>
  );
}
