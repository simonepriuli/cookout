# One keymap owns every keyboard shortcut

2026-11-24 (mattpocock/cookout#418, spec #417). Matt asked on the board on 2026-11-24 for every web UI action to work from the keyboard alone, and called it a priority. Keeping every shortcut in one keymap is the chief of staff's implementation direction in spec #417, pending Matt.

## Decision

- **One table.** `app/modules/keymap/lib/keys.ts` holds every shortcut as a row: a key chord, the action it does and the scope it applies in. A new key is a new row, never a new listener. One key may sit in several scopes (Escape in the search box, a text box, the profile panel and the Inbox), and one action may have several chords (j and ↓).
- **One listener.** The keymap is a plain `.ts` module, made once in `app/web.tsx` for the browser's platform and passed down through `CookoutApp`, which adds its one `keydown` listener to the document while drawn. It listens in the bubble phase and skips a key a widget already handled (`defaultPrevented`), a key mid-composition, and a key event without a key (autofill), so a widget's own keys come first.
- **Views bind actions, not keys.** A view calls `bind` with a scope, what each of its actions does there, and optionally the element the scope covers; without one it covers the page while bound. An action returns whether it acted: if it didn't, the key goes on outward, and if it did, the keymap stops the browser's own handling.
- **The scope rule.** `SCOPES` lists the scopes innermost first: the search box, a text box, the profile panel, the Inbox, everywhere. On a key, the keymap walks them in that order, takes the bound ones that cover the focused element (most recently bound first), and runs the first action whose chord matches. Later scopes (a message, a channel row, a person, the shortcut list) take their place in that order by how they nest on the page.
- **Text fields keep their letters.** Off a text field every row fires. In a text field only chords held with Ctrl, Cmd or Alt fire, plus the rows of the text scopes (the search box and a text box), which fire only in a text field. A letter typed or dictated into a box is always typed.
- **Labels come from the table.** `shortcutOf(action)` names an action's chords for `aria-keyshortcuts` and for people. The design system's shortcut controls (`PanelActionButton`, `ShortcutLink`) take that `Shortcut` instead of a string, and the search box's placeholder and `aria-keyshortcuts` come from it, so no view writes a key by hand. `CONVERSATION_KEYS` is gone.
- **Platform.** A chord written with `Mod` matches Ctrl or Cmd on every platform, as Ctrl/Cmd+K did before. It is named Cmd on a Mac (⌘K, `Meta+K`) and Ctrl elsewhere (Ctrl+K, `Control+K`). On a Mac, Alt shows as ⌥, Shift as ⇧ and Control as ⌃.
- **The lint rule.** `web-rules/keymap-owner` fails a `keydown`, `keyup` or `keypress` listener (or `onkey…` handler) on `document`, `window` or `globalThis` outside `app/modules/keymap/`, and outside test files, which may record keys to check them. Two canaries hold it: one listener outside the keymap must be reported, one inside it must not.
- **Keys the browser keeps are never bound:** F6, and Ctrl or Cmd with T, W, N, L, D or P.
- **What stays on its widget.** Keys that are a widget's own behaviour rather than shortcuts stay with the widget: the message box's Enter and Shift+Enter, its suggestion list's keys, a panel edge's arrows, the identity card's focus trap and Radix's menu and dialog keys. Element listeners that later tickets move in (the reaction keys, the prompt form's Escape) aren't caught by the lint rule, which looks only at the page.

## Considered options

- **Keep each view's own document listener, ordered by capture phase and `defaultPrevented`**: rejected. Nothing lists the keys, labels drift from the keys that work, and every new key risks a clash nobody sees.
- **Mark scopes on the page with data attributes**: rejected. A binding's own element (or none, for the whole page) says what it covers, and the fixed scope order says which comes first, without markup only the keymap reads.
- **Match `Mod` strictly by platform** (Cmd only on a Mac): not now. Ctrl+K and Cmd+K both worked everywhere before, and their tests stay; it can tighten later without changing a view.
- **React context for the keymap**: rejected. The frontend passes its stores down through `CookoutApp`'s props (`docs/web-components.md`), and the keymap is one more.

Superseded in part on 2026-11-24 by [ADR 0090](0090-tests-get-no-keymap-owner-exemption.md): test files no longer get the lint rule's exemption.

Superseded in part on 2026-11-24 by [ADR 0091](0091-mod-is-cmd-on-a-mac-and-ctrl-elsewhere.md): `Mod` matches Cmd on a Mac and Ctrl elsewhere, not either key everywhere.

Superseded in part on 2026-11-24 by [ADR 0092](0092-a-keymap-binding-gives-some-of-its-scopes-actions.md): a binding gives some or all of its scope's actions, and a channel row and the sidebar join `SCOPES` before the Inbox.
