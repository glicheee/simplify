/// <reference types="bun" />
import { describe, expect, test } from "bun:test";
import { shouldWrapNavigation } from "./navigation.ts";

describe("shouldWrapNavigation", () => {
  test("leaving Focus Mode's page while active plays the exit first", () => {
    expect(shouldWrapNavigation(true, false, "/album/123")).toBe(true);
    expect(shouldWrapNavigation(true, false, "/")).toBe(true);
  });
  test("staying on the lyrics page is left alone", () => {
    expect(shouldWrapNavigation(true, false, "/SpicyLyrics")).toBe(false);
  });
  test("no wrap when Focus Mode is off or already closing", () => {
    expect(shouldWrapNavigation(false, false, "/album/123")).toBe(false);
    expect(shouldWrapNavigation(true, true, "/album/123")).toBe(false);
  });
  test("a missing target is left alone", () => {
    expect(shouldWrapNavigation(true, false, undefined)).toBe(false);
  });
});
