/// <reference types="bun" />
import { describe, expect, test } from "bun:test";
import { lrclibToLyrics, parseLrc } from "./lrclib.ts";

describe("parseLrc", () => {
  test("timed lines become seconds; each line ends where the next begins", () => {
    const lines = parseLrc("[00:01.50] First\n[00:04.00] Second\n[01:02.25] Third", 70);
    expect(lines).toEqual([
      { Text: "First", StartTime: 1.5, EndTime: 4 },
      { Text: "Second", StartTime: 4, EndTime: 62.25 },
      { Text: "Third", StartTime: 62.25, EndTime: 70 },
    ]);
  });

  test("an empty timed line marks a gap: the line before ends there and the gap is not shown", () => {
    const lines = parseLrc("[00:01.00] Sing\n[00:05.00]\n[00:20.00] Again", 30);
    expect(lines).toEqual([
      { Text: "Sing", StartTime: 1, EndTime: 5 },
      { Text: "Again", StartTime: 20, EndTime: 30 },
    ]);
  });

  test("metadata tags, blank lines and out-of-order stamps are handled", () => {
    const lines = parseLrc("[ar:Someone]\n[ti:Song]\n\n[00:10.000] B\n[00:02.1] A", 15);
    expect(lines.map((l) => [l.Text, l.StartTime])).toEqual([
      ["A", 2.1],
      ["B", 10],
    ]);
  });

  test("a line with several stamps appears at each of them", () => {
    const lines = parseLrc("[00:01.00][00:09.00] Chorus\n[00:05.00] Verse", 12);
    expect(lines.map((l) => [l.Text, l.StartTime])).toEqual([
      ["Chorus", 1],
      ["Verse", 5],
      ["Chorus", 9],
    ]);
  });

  test("the last line ends a few seconds after it starts when the song length is unknown", () => {
    expect(parseLrc("[00:03.00] Only", 0)).toEqual([{ Text: "Only", StartTime: 3, EndTime: 8 }]);
  });

  test("nothing usable gives an empty list", () => {
    expect(parseLrc("", 10)).toEqual([]);
    expect(parseLrc("no stamps here", 10)).toEqual([]);
  });
});

describe("lrclibToLyrics", () => {
  test("synced lyrics become Line lyrics", () => {
    const lyrics = lrclibToLyrics({ syncedLyrics: "[00:01.00] Hi\n[00:03.00] There", plainLyrics: "Hi\nThere", duration: 5 });
    expect(lyrics).toEqual({
      Type: "Line",
      StartTime: 1,
      Content: [
        { Text: "Hi", StartTime: 1, EndTime: 3 },
        { Text: "There", StartTime: 3, EndTime: 5 },
      ],
    });
  });

  test("only plain lyrics become Static lyrics, blank lines dropped", () => {
    expect(lrclibToLyrics({ syncedLyrics: null, plainLyrics: "One\n\nTwo\n", duration: 5 })).toEqual({
      Type: "Static",
      Lines: [{ Text: "One" }, { Text: "Two" }],
    });
  });

  test("instrumental or empty records give nothing", () => {
    expect(lrclibToLyrics({ instrumental: true, syncedLyrics: null, plainLyrics: null })).toBeNull();
    expect(lrclibToLyrics({ syncedLyrics: "", plainLyrics: "  " })).toBeNull();
    expect(lrclibToLyrics(null)).toBeNull();
  });
});
