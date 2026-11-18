import { onAnimationFrame } from "./AnimationFrameLoop.ts";

/**
 * Body classes that stand in for `:has()` checks on Spotify's own containers.
 *
 * Rules like `.Root__main-view:has(#SpicyLyricsPage) .x` or
 * `body:has(#SpicyLyricsPage.Fullscreen) .x` make Blink re-check the anchor's whole
 * subtree on every DOM change inside it, so every Spotify click or React update
 * paid for them (5-10x the style and layout work of the same change without them),
 * even with the lyrics page closed. The state they test is cheap to read directly,
 * so it is mirrored here and the rules key off these classes instead.
 *
 * The rewritten selectors keep each rule's specificity: the class sits in an
 * `:is()` with a never-matching id/class list of the same weight as the `:has()`
 * argument it replaces.
 *
 * Synced right after the page mounts, unmounts or changes fullscreen state, and on
 * every rendered frame as a fallback for anything else that moves the page.
 */

const CLASSES = {
  pageInMainView: "SL_PageInMainView",
  pageFullscreen: "SL_PageFullscreen",
  overlayFullscreen: "SL_OverlayFullscreen",
  starryNight: "SL_ThemeStarryNight",
  glassifyAnimated: "SL_ThemeGlassifyAnimated",
} as const;

// Live collections: reading .length costs nothing when the theme isn't installed.
const starryNight = document.getElementsByClassName("starrynight-bg-container");
const glassify = document.getElementsByClassName("glassify-bg");

const set = (body: HTMLElement, cls: string, on: boolean) => {
  if (body.classList.contains(cls) !== on) body.classList.toggle(cls, on);
};

export function syncPageStateClasses(): void {
  const body = document.body;
  if (!body) return;

  let inMainView = false;
  let fullscreen = false;
  let overlayFullscreen = false;
  // Card mode in the NPV also uses the page id, so every instance is checked.
  for (const page of document.querySelectorAll("#SpicyLyricsPage")) {
    if (!inMainView && page.parentElement?.closest(".Root__main-view, #main-view")) inMainView = true;
    if (page.classList.contains("Fullscreen")) {
      fullscreen = true;
      if (page.parentElement?.closest(".Root__main-view-overlay")) overlayFullscreen = true;
    }
  }

  let glassifyAnimated = false;
  for (const el of glassify) {
    if (el.querySelector(".bg.animated")) {
      glassifyAnimated = true;
      break;
    }
  }

  set(body, CLASSES.pageInMainView, inMainView);
  set(body, CLASSES.pageFullscreen, fullscreen);
  set(body, CLASSES.overlayFullscreen, overlayFullscreen);
  set(body, CLASSES.starryNight, starryNight.length > 0);
  set(body, CLASSES.glassifyAnimated, glassifyAnimated);
}

onAnimationFrame(syncPageStateClasses);
