import { atom } from "nanostores";
import { persistAtom } from "../stores.ts";
import type { FocusPanel } from "./shortcuts.ts";

/** True while Focus Mode owns the screen (its Cinema view is open). */
export const $focusActive = atom<boolean>(false);
/** The panel slid in over Focus Mode, if any. */
export const $focusPanel = atom<FocusPanel>("none");
/** Lyrics shown in Focus Mode. Off means the cover-only look. Kept across restarts. */
export const $focusLyricsShown = persistAtom<boolean>("focusMode:lyricsShown", false);
