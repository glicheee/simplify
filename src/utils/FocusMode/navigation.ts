export const FOCUS_PATHNAME = "/SpicyLyrics";

/**
 * Whether a navigation must wait for Focus Mode's exit animation: only while Focus
 * Mode is active, not already closing, and the target is a different page.
 */
export function shouldWrapNavigation(active: boolean, closing: boolean, target: string | undefined): boolean {
  return active && !closing && typeof target === "string" && target !== FOCUS_PATHNAME;
}
