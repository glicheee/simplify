// Focus Mode keyboard shortcuts and the panel each key leads to. Kept free of
// Spicetify and DOM access so it can be tested on its own.

export type FocusAction = "search" | "library" | "lyrics" | "escape" | "toggleMode";
export type FocusPanel = "none" | "search" | "library";

/** The one place the keys are defined. `key` is compared to KeyboardEvent.key, ignoring case. */
export const FOCUS_SHORTCUTS: ReadonlyArray<{ action: FocusAction; key: string; ctrl: boolean; shift: boolean }> = [
  { action: "search", key: "k", ctrl: true, shift: false },
  // Plain L: Spotify's desktop app takes Ctrl+L (go to search) before the page sees it.
  { action: "lyrics", key: "l", ctrl: false, shift: false },
  { action: "library", key: "b", ctrl: true, shift: false },
  { action: "escape", key: "escape", ctrl: false, shift: false },
  { action: "toggleMode", key: "f", ctrl: true, shift: true },
];

type KeyInfo = Pick<KeyboardEvent, "key" | "ctrlKey" | "shiftKey" | "altKey" | "metaKey">;

export function matchShortcut(e: KeyInfo): FocusAction | null {
  if (e.altKey || e.metaKey || typeof e.key !== "string") return null;
  const key = e.key.toLowerCase();
  for (const s of FOCUS_SHORTCUTS) {
    if (s.key === key && s.ctrl === e.ctrlKey && s.shift === e.shiftKey) return s.action;
  }
  return null;
}

/** Shortcuts without Ctrl (other than Escape) are just letters while typing in a field. */
export function ignoredWhileTyping(e: KeyInfo, typingInField: boolean): boolean {
  return typingInField && !e.ctrlKey && e.key !== "Escape";
}

/** Search and library toggle their own panel and replace the other; Escape closes. */
export function nextPanel(current: FocusPanel, action: FocusAction): FocusPanel {
  if (action === "search" || action === "library") return current === action ? "none" : action;
  if (action === "escape") return "none";
  return current;
}

/** Escape is only taken while a panel is open, so Spicy's settings and Spotify's dialogs still get it. */
export function consumesKey(action: FocusAction, panel: FocusPanel): boolean {
  return action !== "escape" || panel !== "none";
}
