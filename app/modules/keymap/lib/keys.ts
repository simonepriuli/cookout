const SCOPES = ["search box", "text box", "profile panel", "channel row", "sidebar", "inbox", "everywhere"] as const;

type Scope = (typeof SCOPES)[number];

const TEXT_SCOPES: ReadonlySet<Scope> = new Set(["search box", "text box"]);

const GROUPS: Readonly<Record<Scope, string>> = {
  "channel row": "Channel in the sidebar",
  everywhere: "Everywhere",
  inbox: "Inbox row",
  "profile panel": "Profile panel",
  "search box": "Search box",
  sidebar: "Sidebar",
  "text box": "Message box",
};

const KEYS = [
  { action: "openSearch", chord: "Mod+K", does: "Open the search box", scope: "everywhere" },
  { action: "openShortcutList", chord: "?", does: "Show the keyboard shortcuts", scope: "everywhere" },
  { action: "openShortcutList", chord: "Mod+/", does: "Show the keyboard shortcuts", scope: "everywhere" },
  { action: "nextChannel", chord: "Alt+ArrowDown", does: "Open the next channel", scope: "everywhere" },
  { action: "previousChannel", chord: "Alt+ArrowUp", does: "Open the previous channel", scope: "everywhere" },
  {
    action: "nextUnreadChannel",
    chord: "Alt+Shift+ArrowDown",
    does: "Open the next channel with unread messages",
    scope: "everywhere",
  },
  {
    action: "previousUnreadChannel",
    chord: "Alt+Shift+ArrowUp",
    does: "Open the previous channel with unread messages",
    scope: "everywhere",
  },
  { action: "nextLink", chord: "ArrowDown", does: "Next link", scope: "sidebar" },
  { action: "previousLink", chord: "ArrowUp", does: "Previous link", scope: "sidebar" },
  { action: "markChannelRead", chord: "e", does: "Mark all as read", scope: "channel row" },
  { action: "toggleSubscription", chord: "s", does: "Subscribe or unsubscribe", scope: "channel row" },
  { action: "highlightNext", chord: "ArrowDown", does: "Highlight the next result", scope: "search box" },
  { action: "highlightPrevious", chord: "ArrowUp", does: "Highlight the previous result", scope: "search box" },
  { action: "openHighlighted", chord: "Enter", does: "Open the highlighted result", scope: "search box" },
  { action: "closeSearch", chord: "Escape", does: "Close the search box", scope: "search box" },
  { action: "leaveTextBox", chord: "Escape", does: "Leave the box, keeping what you typed", scope: "text box" },
  { action: "closeProfile", chord: "Escape", does: "Close the profile", scope: "profile panel" },
  { action: "nextRow", chord: "j", does: "Next row", scope: "inbox" },
  { action: "nextRow", chord: "ArrowDown", does: "Next row", scope: "inbox" },
  { action: "previousRow", chord: "k", does: "Previous row", scope: "inbox" },
  { action: "previousRow", chord: "ArrowUp", does: "Previous row", scope: "inbox" },
  { action: "replyToRow", chord: "Enter", does: "Reply", scope: "inbox" },
  { action: "replyToRow", chord: "r", does: "Reply", scope: "inbox" },
  { action: "markRowRead", chord: "e", does: "Mark read", scope: "inbox" },
  { action: "markRowUnread", chord: "u", does: "Mark unread", scope: "inbox" },
  { action: "openRow", chord: "o", does: "Open in its channel", scope: "inbox" },
  { action: "backToRows", chord: "Escape", does: "Back to the rows", scope: "inbox" },
] as const satisfies readonly {
  readonly action: string;
  readonly chord: string;
  readonly does: string;
  readonly scope: Scope;
}[];

type Key = (typeof KEYS)[number];

type Action = Key["action"];

type ActionOf<Covered extends Scope> = Exclude<Extract<Key, { readonly scope: Covered }>["action"], "openShortcutList">;

export { type Action, type ActionOf, GROUPS, KEYS, type Key, SCOPES, type Scope, TEXT_SCOPES };
