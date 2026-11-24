/**
 * The keymap: the one owner of the web UI's keyboard shortcuts. `KEYS`, in
 * `lib/keys.ts`, is the one table of them: each row is a key chord, the action
 * it does and the scope it applies in. `createKeymap` is made once in the web
 * entry, for the browser's platform, and passed down through `CookoutApp`,
 * whose `listen` adds the page's one key listener.
 * A view says what an action does with `bind`: a scope, what some or all of its
 * actions do there (several views may each bind their own actions of one scope, such as `everywhere`) and, optionally, the element the scope covers (without one it covers
 * the page while bound). On each key not already handled (nor mid-composition, nor
 * without a key, as autofill sends), the listener walks
 * `SCOPES` from the innermost (the search box) out to `everywhere`, takes the
 * bound scopes that cover the focused element, most recently bound first, and
 * runs the first action whose chord matches and that says it acted, which
 * stops the browser's own handling. Off a text field every row fires. In a
 * text field only chords held with Ctrl, Cmd or Alt fire, and the rows of the
 * text scopes (the search box and text box), which fire only there, so a
 * letter typed or dictated is always typed. `Mod` is Cmd on a Mac (⌘, `Meta`)
 * and Ctrl elsewhere (`Control`), and only that key matches it, so on a Mac
 * Ctrl+K stays the text box's own delete-to-end-of-line.
 * `shortcutOf` names an action's chords, for `aria-keyshortcuts` and for
 * people (⌘K and ⌥ on a Mac, Ctrl+K and Alt elsewhere), so no view writes a
 * key by hand. The browser's own keys (F6, and Ctrl or Cmd with T, W, N, L, D
 * or P) are never bound.
 * The keymap is also a store (`subscribe`, `snapshot`): its state holds the shortcut list, generated from `KEYS`
 * as one group per scope under its heading in `GROUPS` and one row per action with its chords as this platform
 * shows them, and whether that list is open (`openShortcutList`, `closeShortcutList`). The keymap binds the
 * `openShortcutList` action (`?`, Ctrl/Cmd+/) itself, so no view binds it. While the list is open, the keymap
 * acts on no key, since the list is a modal dialog with its own keys. A scope's heading in the list is in
 * `GROUPS`, and the list shows the scopes outermost first.
 */
import type { Action, ActionOf, Key, Scope } from "./lib/keys.ts";
import { KEYS, SCOPES, TEXT_SCOPES } from "./lib/keys.ts";
import { ariaOf, chordOf, isModified, matches, shownOf } from "./lib/chords.ts";
import type { KeymapStore } from "./lib/state.ts";
import type { Platform } from "./lib/chords.ts";
import { createKeymapStore } from "./lib/state.ts";

type Act = (event: KeyboardEvent) => boolean;

interface Binding<Covered extends Scope> {
  readonly scope: Covered;
  readonly actions: Readonly<Partial<Record<ActionOf<Covered>, Act>>>;
  readonly within?: () => Element | null;
}

interface Shortcut {
  readonly keys: string;
  readonly label: string;
}

type KeyTarget = Pick<Document, "addEventListener" | "removeEventListener">;

interface Keymap extends KeymapStore {
  readonly listen: (target: KeyTarget) => () => void;
  readonly bind: <Covered extends Scope>(binding: Binding<Covered>) => () => void;
  readonly shortcutOf: (action: Action) => Shortcut;
}

interface Row {
  readonly key: Key;
  readonly act: Act;
}

interface Bound {
  readonly scope: Scope;
  readonly rows: readonly Row[];
  readonly within: (() => Element | null) | null;
}

interface Pressing {
  readonly bound: Bound;
  readonly event: KeyboardEvent;
  readonly platform: Platform;
}

const MAC = /^(?:Mac|iPhone|iPad|iPod)/u;
const TEXT_FIELDS: ReadonlySet<string> = new Set(["INPUT", "SELECT", "TEXTAREA"]);
const KEY_SEPARATOR = " ";
const LABEL_SEPARATOR = " or ";

function platformOf(platform: string): Platform {
  if (MAC.test(platform)) {
    return "mac";
  }
  return "other";
}

function isTextField(target: EventTarget | null): boolean {
  return target instanceof HTMLElement && (target.isContentEditable || TEXT_FIELDS.has(target.tagName));
}

function fires(key: Key, inTextField: boolean): boolean {
  if (TEXT_SCOPES.has(key.scope)) {
    return inTextField;
  }
  return !inTextField || isModified(chordOf(key.chord));
}

function covers(bound: Bound, target: EventTarget | null): boolean {
  if (bound.within === null) {
    return true;
  }
  const element = bound.within();
  return element !== null && target instanceof Node && element.contains(target);
}

function rowsOf(scope: Scope, actions: Readonly<Partial<Record<string, Act>>>): readonly Row[] {
  return KEYS.filter((key) => key.scope === scope).flatMap((key) => {
    const act = actions[key.action];
    if (typeof act !== "function") {
      return [];
    }
    return [{ act, key }];
  });
}

function actOn({ bound, event, platform }: Pressing): boolean {
  const inTextField = isTextField(event.target);
  return bound.rows.some(
    ({ act, key }) => fires(key, inTextField) && matches({ chord: chordOf(key.chord), event, platform }) && act(event),
  );
}

function boundInOrder(bindings: readonly Bound[], target: EventTarget | null): readonly Bound[] {
  const newestFirst = bindings.toReversed();
  return SCOPES.flatMap((scope) => newestFirst.filter((bound) => bound.scope === scope && covers(bound, target)));
}

function isLeft(event: KeyboardEvent): boolean {
  return event.defaultPrevented || event.isComposing || typeof Reflect.get(event, "key") !== "string";
}

function createKeymap(options: { readonly platform: string }): Keymap {
  const platform = platformOf(options.platform);
  const store = createKeymapStore(platform);
  function openList(): boolean {
    store.openShortcutList();
    return true;
  }
  let bindings: readonly Bound[] = [
    { rows: rowsOf("everywhere", { openShortcutList: openList }), scope: "everywhere", within: null },
  ];
  function pressed(event: KeyboardEvent): void {
    if (isLeft(event) || store.snapshot().shortcutListOpen) {
      return;
    }
    if (boundInOrder(bindings, event.target).some((bound) => actOn({ bound, event, platform }))) {
      event.preventDefault();
    }
  }
  return {
    ...store,
    bind: (binding) => {
      const bound: Bound = {
        rows: rowsOf(binding.scope, binding.actions),
        scope: binding.scope,
        within: binding.within ?? null,
      };
      bindings = [...bindings, bound];
      return () => {
        bindings = bindings.filter((each) => each !== bound);
      };
    },
    listen: (target) => {
      target.addEventListener("keydown", pressed);
      return () => {
        target.removeEventListener("keydown", pressed);
      };
    },
    shortcutOf: (action) => {
      const chords = [...new Set(KEYS.filter((key) => key.action === action).map((key) => key.chord))].map((chord) =>
        chordOf(chord),
      );
      return {
        keys: chords.map((chord) => ariaOf({ chord, platform })).join(KEY_SEPARATOR),
        label: chords.map((chord) => shownOf({ chord, platform })).join(LABEL_SEPARATOR),
      };
    },
  };
}

export type { Action } from "./lib/keys.ts";
export { type Act, type Keymap, createKeymap };
