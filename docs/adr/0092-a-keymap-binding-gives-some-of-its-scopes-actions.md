# A keymap binding gives some of its scope's actions

2026-11-24 (mattpocock/cookout#423, spec #417). Builds on [ADR 0087](0087-one-keymap-owns-every-keyboard-shortcut.md). These are the chief of staff's implementation choices, pending Matt.

## Decision

- **A binding gives some or all of its scope's actions.** `bind` used to need every action of its scope. `everywhere` now has actions owned by different views: the search box binds Ctrl/Cmd+K, and the sidebar's channel keys bind Alt+↑/↓ and Alt+Shift+↑/↓. Each view binds only its own, and an action no view has bound does nothing.
- **Two more scopes.** `SCOPES` is now: the search box, a text box, the profile panel, a channel row, the sidebar, the Inbox, everywhere. A channel row and the sidebar come before the Inbox because the Inbox's keys (↑/↓, e) cover the whole page while it shows. With focus in the sidebar, ↑/↓ move between its links, and e marks the focused channel read instead of an Inbox row.
- **The sidebar is one Tab stop.** Its links rove one `tabindex`: the last one focused, else the current page's, else the first. Its rows' More actions buttons leave the tab order, since Shift+F10 and the context-menu key open the same menu on the row. The roving runs in the sidebar's own view code, not in the keymap, which owns keys and not focus.
- **The cost.** With one binding per scope, the type check failed on an action left unbound. With several bindings sharing a scope, no single `bind` call can know the others, so an action nobody binds is no longer a type error. A test of the key, which every new key has, catches it instead.

## Considered options

- **One view binds every `everywhere` action**: rejected. It would have to know about the search box, the channel list and every later global key, and every ticket adding one would edit it.
- **A scope per owner** (`search`, `channels`): rejected. Scopes say where a key applies, not who handles it.
