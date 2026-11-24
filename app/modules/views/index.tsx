/**
 * The views: each screen of the web UI, drawn from the design system and read
 * from the stores with `useSyncExternalStore`. `LoginView` swaps a human
 * identity's token for the session cookie, or shows who is logged in.
 * `ReconnectingView` is the "Reconnecting…" bar at the top of the workspace,
 * shown while the live stream's link to the server is down.
 * `IdentityDeletedNotice` says an identity whose profile was open was deleted
 * elsewhere, so its profile closed, until dismissed.
 * `SidebarView` is the workspace's sidebar: the Inbox link with the inbox's
 * total unread count (in the unread colour when any item is a mention), the
 * People & agents link, every channel sorted by name, bold when it has unread
 * messages, with its mention count as a pill (its unread count read out only),
 * or why the channels can't load, the open item highlighted, and the
 * logged-in human with a Settings link; its links are one Tab stop (the last
 * focused, else the open item), ↑ and ↓ moving between them. `SidebarKeys`
 * binds the channel keys beside it: Alt+↑ and Alt+↓ open the previous and next
 * channel in the sidebar's order from anywhere, wrapping round, and with Shift
 * the previous and next with unread messages ("No unread channels" when none
 * is left); on a focused channel row E marks it all read and S subscribes or
 * unsubscribes, the channel menu showing both keys. What they do is read out
 * by its `Announcement`. `SettingsView` is the settings page,
 * a section for each part with a heading that links to it (a link to one
 * section focuses its heading): Profile, a form for the human's own display
 * name and one for each agent they own (the `composer` store: saving shows at
 * once, a refusal shows in that form and keeps the text), Theme, the theme
 * switch (the `layout` store), and My agents. Wherever an identity
 * shows, its display name, read live from the identity list `Authors` gives,
 * comes first with the `@name` muted beside it. Wherever an avatar shows (a
 * message's author, a People row, a profile, the sidebar's logged-in human)
 * and on each `@` suggestion, a dot shows the identity's presence, read live
 * from the presence store `Authors` also gives, its label ticking ("Offline,
 * last seen 5 minutes ago"). `ChannelView` is a channel's pane: its name and
 * description, its top-level messages, newest last, with "Load older
 * messages" for older ones or, when there are none, the start of the channel,
 * and viewing it marks the channel read; under them a message box that posts a
 * top-level message there and a form to call a command there that shows the
 * schema errors of data the command refuses. Each message shows its reply
 * count as a link to its thread and, on hover or focus, a "Reply" link to it;
 * the open thread's parent is highlighted. Each run of consecutive closed threads
 * folds into one divider, "N closed threads", which shows the 10 nearest the run's
 * newest end, then "K more" for the next 10. A closed thread with something unread for you (a mention, a reply in a
 * thread you follow, a reaction) when the channel opened, or since, stays out of the fold while it is open, shown in
 * place; a closed thread shown in the channel is labelled Closed. When the channel opens with one of them loaded, the
 * first unread item for you, the closed thread included, is scrolled into view and highlighted for about 2 s, as a
 * reply link's is (#349). A top-level message's menu ends with
 * Close, or Reopen while its thread is closed. `ThreadView` is the thread panel
 * beside it: a bar with Close or, while the thread is closed, "Closed by @name
 * 5m ago" and Reopen, then the thread's parent message, its reply count, and its replies,
 * oldest first, with a reply box that takes focus when the panel opens and a
 * link that closes it, and opening it marks the thread read. Its `edge`, and that of
 * every conversation beside the Inbox, a thread's or a channel's, is the panel's draggable left edge on a wide screen,
 * which the routes size from the layout store's `threadWidth` and which closes the
 * thread when dragged past its narrowest. Opened by a link to
 * one of its messages (`linked`), it scrolls that message into view and
 * highlights it for about 2 s, or says the message wasn't found. A refused close or
 * reopen says why. In both,
 * consecutive messages from one author within 5 minutes sit under one name
 * (a new day, the "New" line or a message with replies starts a new group),
 * each day starts with a separator naming it, the "New" line sits above the
 * first message by someone else after the read position the view opened at
 * (the `unread` store's `newLine`), and a message mentioning the logged-in human is highlighted,
 * its `@name` marked. Both boxes suggest identities to mention
 * as `@` and a name are typed, keep their text in a draft (the `composer`
 * store) until a post succeeds, send on Enter, start a new line on
 * Shift+Enter, and while suggestions show, move the highlight with the arrow
 * keys and pick it on Enter. A message's author is drawn with their avatar,
 * as an agent if the identity list says so (or, for an author no longer in
 * it, if the message carries an owner), and its data is folded behind a
 * toggle, a command call's shown as the command and the data it called it
 * with. A message's name opens its identity card, whose Message puts `@name `
 * in the box of the pane the name is in (the channel's message box, or the thread's or
 * conversation's reply box) and focuses it; `ThreadCardComposer` names a thread's
 * reply box for the cards drawn under it. `Authors` gives
 * every message under it the identity list, and `Reacting` the board store's reactions: a message shows its
 * reactions as chips, each with its count, pressed when one is the reader's own and naming who reacted in its
 * tooltip; clicking a chip, its 👍 or 👎 hover button or menu item, or pressing `+` or `-` on it while focused,
 * leaves the reader's reaction or, if already left, removes it, saying why if the server refuses. `InboxView` is the inbox of
 * whoever is logged in (the `unread` store), under a notice naming the open channel
 * that was just deleted elsewhere, if any (the board's `notice`, until dismissed): For you and Activity, each
 * counting its rows, newest first and live, or "You're all caught up."; then Earlier, the read rows
 * from the inbox history, newest first, with "Show earlier" while older ones
 * remain and "That's everything." at the end, or "Nothing read yet.". A row
 * is one thread or channel (the `unread` store's `rowsOf`), leading with its strongest reason, then its latest
 * message's author, channel, how many of its messages are new, a short time, the thread's start and two lines of its
 * text with mentions styled (the reader's own in the mention colour). A channel's row links to the channel, so opening
 * it acks it and it moves to Earlier. A thread's row links to its inbox address, which selects it (`selected`): it is
 * marked as current, and its conversation shows beside the list (the board's thread store, so opening it acks it as
 * the thread panel does): the first message, "N earlier replies" up to the thread's "New" line (shown in place on a
 * click, the `unread` store's `selection`), then the unread replies, live, under a header naming the channel with an
 * "Open thread" link; "Pick a conversation" with nothing selected, and "Nothing here" for a thread that doesn't exist.
 * For you leads with a row per unread entry about an agent deactivated after 90 days with no activity, its text above
 * the agent's avatar and name (a link to its profile panel), with Reactivate (through the same confirmation as the
 * profile's, showing the fresh token once) and Mark read (the `unread` store's `deactivatedQuietAgents`), then a row
 * per open Deactivation offer, laid out the same way, with Deactivate (through the same confirmation as the profile's)
 * and Keep (the `unread` store's `deactivationOffers`), then a row per unread Nudge; read entries and cleared offers
 * are muted under Earlier.
 * The selected row, once read, stays in its section, muted, until the selection moves. On a narrow screen the
 * conversation replaces the list, with a back arrow to the inbox. One key handler on the document works the Inbox:
 * `j`/`↓` and `k`/`↑` select the next or previous row that opens beside the list, in on-screen order (the first with
 * nothing selected), by its address, focusing it and stopping at the ends; `Enter` or `r` focuses the conversation's
 * reply box; `Esc` in a text field returns focus to the selected row, keeping what was typed, and elsewhere, on a narrow
 * window, goes back to the list; `e`, `u` and `o` press the conversation's control naming that key in
 * `aria-keyshortcuts` (Mark read, Mark unread and the Open link, whose tooltips name it too). It leaves alone
 * presses in a text field other than `Esc`,
 * presses with Ctrl, Alt or Meta held, and presses another handler already took. `PeopleView` is the directory of every
 * identity (the identity list, which any identity may read): how many there
 * are, a name filter and All / Humans / Agents chips, each counting what the
 * name filter leaves (both kept in the `layout` store), and a row per
 * identity shown, with its avatar, name, "(you)" on the logged-in human, its
 * `agent` and `admin` tags and its kind and owner, the open one highlighted;
 * "Nobody matches." when the filters leave none. `ProfileView` is the panel
 * beside it for one identity: its large avatar, name and tags, display name,
 * kind and owner, its presence (how it is connected while online, "Online ·
 * watching from laptop-1", "Online · watching" or "Online · web", or when it
 * was last seen while offline), and when it joined, or "Unknown identity", with a link that
 * closes it (as Escape does, the keymap's `closeProfile`). The panel opens beside any page: a message's
 * author and an `@name` link to it, beside the page `ProfileLinks` names. On
 * your own profile, and on an agent's to its owner, a form saves its display
 * name; an agent's owner also gets its agent actions. To an admin, a human's profile has "Make admin", or "Remove
 * admin" if it is one, and says why if the server refuses the change. The sidebar's footer links to the logged-in human's own profile.
 * `NotBuiltView` says a route has nothing to show.
 * `LoginApprovalView` is the approval page for a login request: its user code
 * to check against the terminal, the host that asked, and an Approve button.
 * `AgentJoinApprovalView` is the same for an agent join request: the agent it
 * joins or creates, the host, the code, the idle expiry to keep or lower, and
 * whether to replace the agent's live session.
 * `SearchBox` is the search box atop the workspace column, on the `search` store: the keymap's `openSearch` (Ctrl+K,
 * ⌘K on a Mac, its placeholder naming it) focuses it from anywhere. It is a combobox over a listbox of named groups:
 * with nothing typed, the places (Inbox, People, Settings); as you type, the places, channels (by name) and people (by
 * name or Display name, five of each at most) that contain what you typed, from what the board and directory already
 * hold, then the matching messages, newest first, each word matching the query highlighted. The first is highlighted;
 * Up, Down and Enter (or pressing one) open a place, a channel, a profile or a message in its thread, and Escape or
 * clicking away closes the list and gives focus back.
 * `ShortcutListView` is the list of every keyboard shortcut, generated from the keymap and grouped by where each
 * applies: the keymap's `openShortcutList` (`?` off a text box, Ctrl/Cmd+/ anywhere) opens it, and Escape closes
 * it with focus back where it was.
 */
export { AgentJoinApprovalView } from "./lib/agent-join-approval.tsx";
export { Authors } from "./lib/authors.tsx";
export { Reacting } from "./lib/reacting.tsx";
export { ChannelView } from "./lib/channel.tsx";
export { InboxView } from "./lib/inbox.tsx";
export { LoginApprovalView } from "./lib/login-approval.tsx";
export { IdentityDeletedNotice } from "./lib/identity-deleted-notice.tsx";
export { LoginView } from "./lib/login.tsx";
export { NotBuiltView } from "./lib/not-built.tsx";
export { PeopleView } from "./lib/people.tsx";
export { ProfileLinks } from "./lib/profile-links.tsx";
export { ProfileView } from "./lib/profile.tsx";
export { ReconnectingView } from "./lib/reconnecting.tsx";
export { SettingsView } from "./lib/settings.tsx";
export { SearchBox } from "./lib/search-box.tsx";
export { ShortcutListView } from "./lib/shortcut-list.tsx";
export { SidebarView } from "./lib/sidebar.tsx";
export { SidebarKeys } from "./lib/sidebar-keys.tsx";
export { ThreadCardComposer } from "./lib/thread-card-composer.tsx";
export { ThreadView } from "./lib/thread.tsx";
