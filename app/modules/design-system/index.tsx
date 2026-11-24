/**
 * The design system: hand-written Tailwind components styled after shadcn/ui
 * (its token names and its card), in a Vercel-like neutral look with small
 * pops of colour (ADR 0080). Every view builds from these and none
 * styles itself, so no component takes classes. `styles.css` is the Tailwind
 * theme, which `index.html` loads: its tokens are CSS variables, dark by
 * default, light under `data-theme="light"` on the root element, and light
 * under `prefers-color-scheme: light` unless `data-theme="dark"`; components
 * read tokens, never raw colours. Text and the UI are sans, times and channel
 * names mono.
 *
 * `Workspace` is the page around every route once logged in: a `Sidebar` on
 * the left (on a narrow screen, behind a button that opens and closes it),
 * which a button at its top collapses to a narrow rail holding only that
 * button on a wide screen (`collapsed`), and, given an `edge`, is as wide as
 * it says, its right edge a `PanelEdge` (`side` `right`; no `onClose`, so a
 * drag stops at its narrowest),
 * with its `SidebarBody` of links (following one, but not pressing a button, closes it on a narrow screen)
 * and its `SidebarFooter`, and a `WorkspaceMain` of the route's panes on the
 * right, in a `WorkspaceColumn` under any `StatusBar`: a named polite live
 * region that shows its text in a bar, in the attention colours, only while
 * `shown`, such as "Reconnecting…". In the sidebar, `NavLink` is one link, bold when
 * it has something new (`marked`), highlighted when it is the open item, with
 * an icon and any `Pill` after it: a count read out by its label, loud (the
 * unread colour), quiet, or unseen (read out only); a `menu` is its `ActionMenu`.
 * `ActionMenu` is a menu outside a message: right-clicking its children, or Shift+F10 or the menu key in them, opens
 * its `choices` as a context menu named by its `label`; a More actions button (or `buttonLabel`), shown on hover or
 * focus (`inline`: before a name), opens them as a dropdown. `PersonMenu` is a name's. `NavHeading` heads a
 * `NavList` of links, with any `HeadingButton` on its line, a plus named by
 * its label that starts something new, such as a channel; in the footer, `FooterLink` is a link
 * with a gear, such as Settings, highlighted when open. `Pane` is
 * the main column, with a `PaneHeader` (title, description and any action on
 * its right, such as a `PressButton`, a button that is on or off), a
 * named `Page` that scrolls a centred column of `PageSection`s, each headed by
 * a link to itself, its heading focused when `focused` (such as Settings,
 * where `ChoiceGroup` picks one of a few choices), a
 * named `ScrollArea` that stays scrolled to the end as what it counts grows, unless
 * scrolled up, and anything under it, such as a message box in a `BoxFrame`
 * with its keyboard hint; `SidePanel` is a
 * named column on its right with a close link (the whole width on a narrow
 * screen), its title an `ActionMenu`'s target given a `menu`. Given an `edge`, a `SidePanel` or `ConversationPanel` is as wide as
 * its edge says on a wide screen (never more than 60% of the space beside it),
 * and its left edge is a `PanelEdge`: a focusable vertical separator, a line on
 * hover and focus, that a drag or the arrow keys resize (Left widens), Home and
 * End take to its narrowest and widest, and a drag released past its
 * narrowest closes (`onClose`); it isn't shown on a narrow screen. A split view, such as the inbox's, is a `ListPane` (the main column,
 * hidden on a narrow screen while `hiddenWhenNarrow`) beside a
 * `ConversationPanel`, a named column with a `BackLink` arrow (shown only on a
 * narrow screen, where the panel takes the whole width), its detail, its
 * header's `actions` as small buttons and any `open` link, each naming its `Shortcut` (its keys as the keymap names
 * them) in `aria-keyshortcuts` and a tooltip, its
 * `message` being what an identity card's Message does in it (an `IdentityCardComposer`), or beside
 * a `ConversationEmpty`, a named column holding only a
 * muted line (hidden on a narrow screen); a
 * `DividerButton` is a divider line led by a quiet button, such as one that
 * shows the replies folded under it. A name's avatar is its coloured initials, one of eight hues hashed
 * from the name, a circle for a human and a rounded square for an agent, with
 * its `PresenceDot` in the corner once its presence is known: filled in the
 * online colour while online, a hollow grey ring while offline, a ring in the
 * accent with a dot in its middle for the owner's warning ("Offline, went
 * offline unexpectedly"), named for a
 * screen reader and as a tooltip ("Offline, last seen 5 minutes ago"), as a
 * `Suggestions` option shows it beside the name;
 * `Author` is a message's avatar and name (a display name, with the `@name`
 * muted beside it), with an `agent` tag for an agent;
 * `Tag` is one such small tag, such as `admin`. `IdentityLink` is the
 * logged-in identity's avatar and name as a link, highlighted when open.
 * Wherever an identity has a display name (`IdentityLink`, `IdentityRow`,
 * `ProfileName`, a `Suggestions` option's muted detail) it shows first and the
 * `@name` muted beside it. `LineForm` is a named form of one labelled line of
 * text, whose text its owner holds, with a Save button (disabled while
 * saving; `submit` names its button, `Save` unless given) and anything under
 * it, such as an `Alert`. `AreaForm` is its form of a few growing lines of
 * text, up to `limit` characters shown as a counter, where Enter starts a new
 * line and Ctrl/Cmd+Enter saves. `ActionGroup` is a named group of what can be done
 * to one thing, `ButtonRow` puts buttons side by side, and `TokenText` shows a
 * secret, such as a fresh token, to copy.
 * `ConfirmDialog` asks before an action, in a modal shadcn AlertDialog on Radix's primitives (ADR 0080), the one
 * part built on a library: its title, a body naming exactly what happens, Cancel and a confirm button, in the
 * destructive colour when the action can't be undone. It holds focus inside while open, Escape or Cancel calls
 * `onCancel`, and focus goes back to what opened it when it closes. While `pending` both buttons are disabled and
 * the confirm button says so; an `error` shows inside it. Its owner decides when it is `open`, so it never closes.
 * `FormDialog` is a Radix modal form; `RunList`, `FieldNote`; `MoreActions`. `ShortcutList` is a Radix modal of
 * keyboard shortcuts, each group a list named by its heading, each row what a shortcut does beside its keys;
 * Escape calls `onClose`, and focus goes back to what was focused when it opened.
 * `PaneHeader`'s title is mono, as a channel's name, unless `sans`. A
 * `Toolbar` under it holds a `FilterField` (a labelled box whose text its
 * owner holds) and `Chip`s, buttons pressed or not; a named `ListArea` scrolls
 * from the top, and its `IdentityRow`s are links to identities, each with
 * its avatar, name, any tags and a muted detail line, highlighted when open.
 * `Profile` is one identity's large avatar beside its `ProfileName` (its
 * name and any tags, as a heading) and its details; `DateText` is a moment as a date, in mono.
 *
 * `Feed` is a named, centred column that scrolls, such as the inbox, read
 * from the top: a `FeedHeading` heads a part of it, with its count, or, with
 * no count, as a divider line; a `FeedList` is a named list of `FeedRow`s,
 * each a link over the whole row (named by its text) leading with why it is
 * there (`why`), then a message with its author's avatar and name (its own
 * link, to `authorHref`, above the row's), what they did (`action`) and in which channel, a
 * short time, a `Closed` marker when it is `closed` (its thread is closed), any `count` of how many of its messages are new ("3 new") and any
 * `context` line (a reply's thread), then what it holds: its `FeedText`, up to
 * two lines, and any `RowButton`, a small button raised above the row's link; given a `menu`, it is an `ActionMenu`'s target. A `for-you` row has an accent dot and why,
 * a bold name and bright text; an `activity` row has a muted dot and why, a
 * bold name and bright text; a `read` one is muted. A `current` row, the one
 * whose conversation is shown, is highlighted and its link marked as the current page. A `FeedNoticeRow` sits in
 * a `FeedList` for an Inbox entry about an identity rather than a message: its
 * why, then the identity's avatar and name (a link to `href`) and a short
 * time, then any buttons; `for-you` or `read` as a `FeedRow`. `Mention` is
 * an `@` mention in a message's text, in the mention colour when it is the
 * reader's own (`mine`). `FeedNote` is a muted line in a feed: why a part is
 * `empty`, or that it has reached the `end`; `MoreButton` is a quiet
 * full-width row under a list that loads more of it, with a spinner while
 * `loading`.
 * `MessageList` is a named list of `MessageItem`s: one message each, which
 * takes focus, with its avatar, name and time, or only its time on hover when
 * `grouped` under the one before; the day's separator and the "New" line above it when it starts them; a
 * mark (`for-you`, the filled accent block, when it mentions or answers the reader, or `open`); and, shown on hover or
 * focus, a "Quick actions" group of icon buttons, each with no text and named by its tooltip: a button for each of its
 * `menu`'s `reactions` that is `inHoverBar`, then, when `replyOnHover`, its action (such as Reply: a link, or a button
 * with `onAction`), then its thread choice when `threadOnHover`, then More actions. A reaction's
 * `key`, pressed while the message itself has focus, leaves it too, in or out of the hover bar. Its `menu` gives it one actions menu (the action,
 * then each reaction, then Mark unread, then the thread choice, such as Close, if any), drawn two ways on Radix: right-clicking the message, or the context-menu key or Shift+F10 on it, opens it as a context menu at the pointer, and the
 * More actions button opens it as a dropdown. Every menu item draws its `icon` (a `ThreadChoice` names one too), which its type requires, before its label. An item may be `disabled`, dimmed and not chosen. Radix gives both their keyboard and focus behaviour; a chosen item's
 * action runs once the menu has closed. An item given `keys` (a `Shortcut`) names them in `aria-keyshortcuts` and shows their label at its end. Mark unread's tooltip names its shortcut, `Alt-click`: an Alt-click (Option-click
 * on macOS) on the message, but not on a link, button or other interactive element in it, runs Mark unread at once and
 * focuses and selects nothing; `StandaloneMessage` does the same. `StandaloneMessage` is one named message on its own, such as a
 * thread's parent. A message's author name and an `@name` in its text are each an `IdentityCard`: hovering it
 * (after a short delay) or focusing it opens a card, a Radix tooltip beside the name, kept inside the window: a
 * labelled `dialog` led by a square avatar tile (grey when deactivated; an Agent chip on an agent's), then its name,
 * `@name` handle, presence or a red Deactivated, kind, description, and Message (calls the nearest
 * `IdentityCardComposer`; disabled when deactivated or with none) and View profile. Tab on the name moves into it;
 * Escape or Tab past either end closes it, focus back on the name. Its card comes from the
 * `IdentityCards` source the views provide; with none, the name is drawn alone. In a message, `MessageBody` holds its rendered Markdown text, `Mention` an
 * `@name` in it, `CallChip` a command call
 * and its data, `DataToggle` its data folded away, and `ThreadSummary` a link to
 * its thread: its repliers' avatars, its reply count, how many replies are new (bold, after an accent dot and with how many are to the reader when any is) and when it was last replied to. A message's time
 * takes focus, and hovering or focusing it opens a tooltip with the full date and time and, when the message has one, its read receipt. `ReactionChips` is a message's named row of
 * `ReactionChip`s, each a reaction and its count, pressed (in the accent) when one is the reader's own, with who
 * reacted as its tooltip. `RepliesDivider` heads a thread's replies, `ChannelStart` says a
 * channel has nothing older, and `QuietButton` is a muted centred button,
 * such as loading older messages. `ClosedFold` is a row of a message list standing for closed threads folded away,
 * a button on a dashed line that unfolds them; given a `day`, the day's label (a separator to a screen reader) shares
 * that line, in place of a day separator of its own beside it: the label in the line's centre, the button at its right end,
 * shortening rather than overlapping the label on a narrow line. `ThreadBar` is a muted bar across the top of a thread: a line of text
 * and one icon button named by its tooltip, such as who closed it and Reopen thread; `QuietLink` is a muted link in such a line, such as a name
 * linking to its profile. `TextArea` takes focus when it first appears
 * if `focused`.
 *
 * `AppShell` is the page around the login view; `Card`, centred in a scrolling column, `CardHeader`, `Heading` and
 * `Muted` are a shadcn-style card and its title row, `CardBody` a padded section under it; `MutedLines` is muted text
 * that keeps its line breaks; `LinkList` and `LinkRow` are a named list of links, and `ItemList` and `ItemRow` a named
 * list of plain rows; `Alert` is a refusal, read out by screen readers; `Announcement` a polite live region (its text
 * again as its count moves); `Notice` is a passing word on what just
 * happened, read out politely; `Skeleton` stands in while something loads. `Form` hands one field's value to `onSubmit`
 * without reloading the page; `TextField` is a labelled secret input in it, such as a token, `TextArea` a labelled box
 * to write in, such as a reply, whose text and caret its owner holds, where Enter sends the form and Shift+Enter starts
 * a new line, and, while its owner is `choosing` from suggestions, is a combobox naming the highlighted option as its
 * active descendant, where the arrows move it, Enter or Tab picks it and Escape closes the list; `SubmitButton` sends
 * it, and `SendButton` is its paper-plane icon form, named and tooltipped by `label`; `Suggestions` is a named listbox
 * of options under a box, such as mentions or commands (each with any muted detail), one selected, which leaves the box
 * focused even when a pointer picks one; it sits in the overlay layer, above all in the pane. `ComboboxField` is a
 * named search input (`box` its ID) that is a combobox controlling the listbox `list`, its option at `active` the
 * active one while `expanded`; `ResultList` is a named listbox (`list` its ID) of named `ResultGroup`s of
 * `ResultOption`s, each a label, any muted detail and its children, highlighted (and scrolled into view) when
 * `highlighted`; pressing one calls `onChoose` with its `href`, leaving the box focused. `DataArea` is a labelled box
 * to write JSON in, whose text its owner holds. `PromptForm` is a named card in place of a message box that asks for a
 * command's data, titled, with a Cancel and a submit button, its first field focused, and Escape anywhere in it calls
 * `onEscape`; in it `InputField` (text, a number, an integer, a date or a time), `PickField` (one of a list, or none)
 * and `CheckField` (a checkbox) are labelled fields whose value their owner holds, each marked when required, with its
 * help text and any error under it, both read out as its description.
 */
export {
  AppShell,
  BoxFrame,
  Card,
  CardBody,
  CardHeader,
  HeadingButton,
  NavHeading,
  NavLink,
  NavList,
  Pane,
  ListPane,
  ConversationEmpty,
  ConversationPanel,
  PaneHeader,
  Page,
  PageSection,
  FooterLink,
  SidePanel,
  ScrollArea,
  Sidebar,
  SidebarBody,
  SidebarFooter,
  Workspace,
  WorkspaceMain,
  WorkspaceColumn,
  StatusBar,
  ListArea,
  Toolbar,
} from "./lib/layout.ts";
export type { PanelAction, PanelEdgeParts, ShortcutLinkParts } from "./lib/layout.ts";
export {
  CallChip,
  ChannelStart,
  DataToggle,
  MessageBody,
  MessageItem,
  MessageList,
  ClosedFold,
  ThreadBar,
  RepliesDivider,
  ThreadSummary,
  StandaloneMessage,
  Mention,
  IdentityCard,
  PersonMenu,
  IdentityCardComposer,
  IdentityCards,
  ReactionChip,
  ReactionChips,
} from "./lib/messages.ts";
export type {
  IdentityCardLink,
  IdentityCardParts,
  IdentityCardSource,
  ActionMenuParts,
  MenuChoice,
  ReactionChoice,
  ThreadChoice,
} from "./lib/messages.ts";
export {
  FeedRowClosed,
  MoreButton,
  Feed,
  FeedHeading,
  FeedList,
  FeedNote,
  FeedNoticeRow,
  FeedRow,
  FeedText,
  RowButton,
} from "./lib/feed-rows.ts";
export {
  ActionGroup,
  ConfirmDialog,
  FormDialog,
  ShortcutList,
  FieldNote,
  RunList,
  MoreActions,
  ButtonRow,
  TokenText,
  QuietButton,
  Button,
  CheckField,
  ChoiceGroup,
  DataArea,
  Form,
  LineForm,
  AreaForm,
  InputField,
  DividerButton,
  PressButton,
  PickField,
  PromptForm,
  Suggestions,
  ComboboxField,
  ResultGroup,
  ResultList,
  ResultOption,
  SendButton,
  SubmitButton,
  TextArea,
  TextField,
  Chip,
  FilterField,
} from "./lib/controls.ts";
export {
  Alert,
  Announcement,
  Heading,
  ItemList,
  ItemRow,
  LinkList,
  LinkRow,
  Muted,
  MutedLines,
  QuietLink,
  Notice,
  Pill,
  Skeleton,
  Tag,
  IdentityLink,
  DateText,
  IdentityRow,
  Profile,
  ProfileName,
} from "./lib/content.ts";
