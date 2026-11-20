// Focus Mode: Spotify opens into the in-window fullscreen view with the cover on its
// own. Search, the library and the lyrics are brought in with keyboard shortcuts, and
// every change is animated. See docs/superpowers/specs/2026-11-20-focus-mode-design.md.
import Global from "../../components/Global/Global.ts";
import Session from "../../components/Global/Session.ts";
import Fullscreen, { IsFullscreenClosing } from "../../components/Utils/Fullscreen.ts";
import { PageContainer } from "../../components/Pages/PageView.ts";
import { SyncNoLyricsLayout } from "../Lyrics/LyricsNotice.ts";
import { $experiment, isExperimentEnabled } from "../experiments.ts";
import { consumesKey, ignoredWhileTyping, matchShortcut, nextPanel, type FocusPanel } from "./shortcuts.ts";
import { $focusActive, $focusLyricsShown, $focusPanel } from "./state.ts";
import { FOCUS_PATHNAME, shouldWrapNavigation } from "./navigation.ts";

import { focusLog } from "./log.ts";
import { initFocusPanels } from "../../components/FocusMode/Panels.ts";

const PAGE_CLASS = "FocusMode";
let openCinema: () => void = () => {};
let entering = false;
let enterFailTimer: ReturnType<typeof setTimeout> | undefined;
const failListeners: Array<() => void> = [];

/** Called when entering at startup fails (the page never opened). */
export function onFocusEnterFailed(cb: () => void) {
  failListeners.push(cb);
}

export function onFocusPanelChange(cb: (p: FocusPanel) => void): () => void {
  return $focusPanel.listen(cb);
}

// Ctrl+Shift+F pressed again while the exit animation plays: come back once it ends.
let reenterAfterExit = false;

/** Slightly longer than the 5 s the page-mount wait in app.tsx gives up after. */
const ENTER_TIMEOUT_MS = 6000;

export function enterFocusMode() {
  if ($focusActive.get()) return;
  if (entering) {
    focusLog("enter-pending");
    return;
  }
  entering = true;
  reenterAfterExit = false;
  focusLog("enter-request", snapshot());
  clearTimeout(enterFailTimer);
  enterFailTimer = setTimeout(() => {
    if (!entering) return;
    entering = false;
    focusLog("enter-failed", snapshot());
    failListeners.forEach((cb) => cb());
  }, ENTER_TIMEOUT_MS);
  openCinema();
}

export async function exitFocusMode(): Promise<void> {
  if (!$focusActive.get()) return;
  focusLog("exit-request");
  $focusPanel.set("none");
  if (await Fullscreen.Close()) Session.GoBackFrom(FOCUS_PATHNAME);
  if (reenterAfterExit) {
    reenterAfterExit = false;
    if (isExperimentEnabled("focusMode")) enterFocusMode();
  }
}

/**
 * The startup cover (scripts/focus-cover.css, loaded with Spotify's own UI) hides
 * normal Spotify until Focus Mode is on screen. One class on <html>, set once.
 */
let coverLifted = false;
const coverUp = () => {
  if (coverLifted) return false;
  // Without the cover CSS installed (other people's setups) ::after has no content.
  const cs = getComputedStyle(document.documentElement, "::after");
  return cs.content !== "none" && cs.content !== "normal" && cs.opacity !== "0";
};
function liftCover(reason: string) {
  if (coverLifted) return;
  coverLifted = true;
  document.documentElement.classList.add("SL_FocusCoverOff");
  focusLog("cover-off", { reason });
}

/** State of the page and Spotify's main view, for the log while switching is checked. */
function snapshot(): Record<string, unknown> {
  const page = PageContainer;
  const main = document.querySelector<HTMLElement>("#main");
  const cs = page ? getComputedStyle(page) : null;
  const r = page?.getBoundingClientRect();
  return {
    path: Spicetify.Platform.History.location?.pathname,
    page: !!page,
    connected: page?.isConnected,
    parent: page?.parentElement ? page.parentElement.tagName + "." + (page.parentElement.className || "").toString().slice(0, 40) : null,
    cls: page?.className.slice(0, 160),
    transform: cs?.transform,
    opacity: cs?.opacity,
    visibility: cs?.visibility,
    display: cs?.display,
    rect: r ? [Math.round(r.x), Math.round(r.y), Math.round(r.width), Math.round(r.height)] : null,
    mainStyle: main?.getAttribute("style")?.slice(0, 120) ?? null,
    isOpen: Fullscreen.IsOpen,
    cinema: Fullscreen.CinemaViewOpen,
    docFs: !!document.fullscreenElement,
  };
}

function onOpened() {
  if (!entering) return;
  entering = false;
  clearTimeout(enterFailTimer);
  const page = PageContainer;
  if (page && coverUp()) {
    // First open at startup: the cover fades away over the finished view instead.
    page.classList.add(PAGE_CLASS);
    setTimeout(() => liftCover("opened"), 400);
  } else if (page) {
    // Open() moves the page onto <body> in one go. Slide it up from below the window
    // (same distance and curve as Spicy's own exit) so it never just appears. A Web
    // Animation always finishes in place, unlike a class swap that waits on a frame.
    page.classList.add(PAGE_CLASS);
    page.animate([{ transform: "translateY(100%)" }, { transform: "none" }], {
      duration: 600,
      easing: "cubic-bezier(0.78, 0, 0.22, 1)",
    });
  }
  $focusActive.set(true);
  SyncNoLyricsLayout();
  focusLog("enter");
  setTimeout(() => focusLog("diag-after-enter", snapshot()), 1200);
}

function onClosed() {
  entering = false;
  if (lyricsLeaveTimer !== undefined) {
    clearTimeout(lyricsLeaveTimer);
    lyricsLeaveTimer = undefined;
  }
  PageContainer?.classList.remove("FocusLyricsLeaving");
  if (!$focusActive.get()) return;
  $focusActive.set(false);
  $focusPanel.set("none");
  PageContainer?.classList.remove(PAGE_CLASS);
  focusLog("exit");
}

/**
 * Hiding the lyrics re-centres the cover, which also changes the lyrics' own padding.
 * Doing both at once shoves the fading lyrics sideways, so they fade out first and the
 * layout changes after. Showing changes the layout first; the lyrics then fade in.
 */
const LYRICS_FADE_MS = 300;
let lyricsLeaveTimer: ReturnType<typeof setTimeout> | undefined;
function toggleLyrics() {
  const page = PageContainer;
  if (lyricsLeaveTimer !== undefined) {
    // Pressed again while fading out: bring them straight back.
    clearTimeout(lyricsLeaveTimer);
    lyricsLeaveTimer = undefined;
    page?.classList.remove("FocusLyricsLeaving");
    focusLog("lyrics:true");
    return;
  }
  if ($focusLyricsShown.get() && page) {
    page.classList.add("FocusLyricsLeaving");
    lyricsLeaveTimer = setTimeout(() => {
      lyricsLeaveTimer = undefined;
      $focusLyricsShown.set(false);
      SyncNoLyricsLayout();
      page.classList.remove("FocusLyricsLeaving");
      focusLog("lyrics:false");
    }, LYRICS_FADE_MS);
    return;
  }
  $focusLyricsShown.set(!$focusLyricsShown.get());
  SyncNoLyricsLayout();
  focusLog("lyrics:" + $focusLyricsShown.get());
}

const typingInField = (target: EventTarget | null) =>
  target instanceof HTMLElement && (target.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName));

function onKeyDown(e: KeyboardEvent) {
  const action = matchShortcut(e);
  if (!action || ignoredWhileTyping(e, typingInField(e.target))) return;
  const active = $focusActive.get();
  if (action === "toggleMode") {
    // Leaving always works, even if Focus Mode was switched off meanwhile.
    if (!active && !isExperimentEnabled("focusMode")) return;
    e.preventDefault();
    e.stopPropagation();
    if (e.repeat) return;
    if (IsFullscreenClosing()) {
      reenterAfterExit = true;
      focusLog("key:toggleMode-queued");
      return;
    }
    focusLog("key:toggleMode");
    if (active) void exitFocusMode();
    else enterFocusMode();
    return;
  }
  if (!active || !consumesKey(action, $focusPanel.get())) return;
  e.preventDefault();
  e.stopPropagation();
  if (e.repeat || IsFullscreenClosing()) return;
  focusLog("key:" + action);
  if (action === "lyrics") {
    toggleLyrics();
    return;
  }
  const next = nextPanel($focusPanel.get(), action);
  if (next !== $focusPanel.get()) {
    $focusPanel.set(next);
    focusLog("panel:" + next);
  }
}

const pathOf = (to: unknown): string | undefined =>
  typeof to === "string" ? to.split(/[?#]/)[0] : typeof (to as any)?.pathname === "string" ? (to as any).pathname : undefined;

/** Navigations made while Focus Mode is open wait for its exit animation. */
function wrapHistory() {
  const history = Spicetify.Platform.History as any;
  for (const method of ["push", "replace"] as const) {
    const original = history[method]?.bind(history);
    if (!original) continue;
    history[method] = (to: unknown, ...rest: unknown[]) => {
      if (!shouldWrapNavigation($focusActive.get(), IsFullscreenClosing(), pathOf(to))) return original(to, ...rest);
      focusLog("nav-exit", { to: pathOf(to) });
      $focusPanel.set("none");
      void Fullscreen.Close().then(() => original(to, ...rest));
    };
  }
}

export function initFocusMode(deps: { openCinema: () => void }) {
  openCinema = deps.openCinema;
  Global.Event.listen("fullscreen:open", onOpened);
  Global.Event.listen("fullscreen:exit", onClosed);
  window.addEventListener("keydown", onKeyDown, true);
  wrapHistory();
  initFocusPanels();
  // Turned off in Settings (or forced off) while open: leave, animated.
  $experiment("focusMode").listen((on) => {
    if (!on) void exitFocusMode();
  });
  onFocusEnterFailed(() => liftCover("failed"));
  if (isExperimentEnabled("focusMode")) enterFocusMode();
  else liftCover("disabled");
}
