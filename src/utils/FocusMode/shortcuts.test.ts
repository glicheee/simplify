/// <reference types="bun" />
import { describe, expect, test } from "bun:test";
import { consumesKey, ignoredWhileTyping, matchShortcut, nextPanel, type FocusAction, type FocusPanel } from "./shortcuts.ts";

const key = (k: string, mods: { ctrl?: boolean; shift?: boolean; alt?: boolean; meta?: boolean } = {}) => ({
  key: k,
  ctrlKey: !!mods.ctrl,
  shiftKey: !!mods.shift,
  altKey: !!mods.alt,
  metaKey: !!mods.meta,
});

describe("matchShortcut", () => {
  test("Ctrl+K opens search, either case", () => {
    expect(matchShortcut(key("k", { ctrl: true }))).toBe("search");
    expect(matchShortcut(key("K", { ctrl: true }))).toBe("search");
  });
  test("L (no modifier) is lyrics; Spotify keeps Ctrl+L for itself", () => {
    expect(matchShortcut(key("l"))).toBe("lyrics");
    expect(matchShortcut(key("L", { shift: true }))).toBeNull();
    expect(matchShortcut(key("l", { ctrl: true }))).toBeNull();
  });
  test("Ctrl+B is library", () => {
    expect(matchShortcut(key("b", { ctrl: true }))).toBe("library");
  });
  test("Escape with no modifiers", () => {
    expect(matchShortcut(key("Escape"))).toBe("escape");
  });
  test("Ctrl+Shift+F toggles the mode; Ctrl+F alone does not", () => {
    expect(matchShortcut(key("F", { ctrl: true, shift: true }))).toBe("toggleMode");
    expect(matchShortcut(key("f", { ctrl: true }))).toBeNull();
  });
  test("letters without Ctrl, or with Alt/Meta, are never shortcuts", () => {
    expect(matchShortcut(key("k"))).toBeNull();
    expect(matchShortcut(key("k", { ctrl: true, alt: true }))).toBeNull();
    expect(matchShortcut(key("k", { ctrl: true, meta: true }))).toBeNull();
    expect(matchShortcut(key("a"))).toBeNull();
  });
  test("typing keys used in the search field pass through", () => {
    expect(matchShortcut(key("ArrowDown"))).toBeNull();
    expect(matchShortcut(key("Backspace"))).toBeNull();
    expect(matchShortcut(key("Enter"))).toBeNull();
  });
});

describe("nextPanel", () => {
  test("search and library toggle their own panel", () => {
    expect(nextPanel("none", "search")).toBe("search");
    expect(nextPanel("search", "search")).toBe("none");
    expect(nextPanel("library", "library")).toBe("none");
  });
  test("opening one panel replaces the other", () => {
    expect(nextPanel("search", "library")).toBe("library");
    expect(nextPanel("library", "search")).toBe("search");
  });
  test("escape closes, and is harmless when nothing is open", () => {
    expect(nextPanel("library", "escape")).toBe("none");
    expect(nextPanel("none", "escape")).toBe("none");
  });
  test("lyrics and mode toggles leave the panel alone", () => {
    expect(nextPanel("search", "lyrics")).toBe("search");
    expect(nextPanel("library", "toggleMode")).toBe("library");
  });
  test("rapid presses end in one consistent panel", () => {
    const fold = (actions: FocusAction[]): FocusPanel => actions.reduce(nextPanel, "none" as FocusPanel);
    expect(fold(["search", "search", "search", "search", "search"])).toBe("search");
    expect(fold(["search", "search", "search", "search"])).toBe("none");
    expect(fold(["search", "library"])).toBe("library");
  });
});

describe("ignoredWhileTyping", () => {
  test("plain-key shortcuts are typed as text in the search field", () => {
    expect(ignoredWhileTyping(key("l"), true)).toBe(true);
    expect(ignoredWhileTyping(key("l"), false)).toBe(false);
  });
  test("Ctrl shortcuts and Escape still work while typing", () => {
    expect(ignoredWhileTyping(key("k", { ctrl: true }), true)).toBe(false);
    expect(ignoredWhileTyping(key("Escape"), true)).toBe(false);
    expect(ignoredWhileTyping(key("F", { ctrl: true, shift: true }), true)).toBe(false);
  });
});

describe("consumesKey", () => {
  test("Escape is only taken when a panel is open, so dialogs and settings still get it", () => {
    expect(consumesKey("escape", "search")).toBe(true);
    expect(consumesKey("escape", "library")).toBe(true);
    expect(consumesKey("escape", "none")).toBe(false);
  });
  test("the other shortcuts are always taken", () => {
    expect(consumesKey("search", "none")).toBe(true);
    expect(consumesKey("lyrics", "none")).toBe(true);
    expect(consumesKey("library", "search")).toBe(true);
  });
});
