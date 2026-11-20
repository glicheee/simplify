/// <reference types="bun" />
import { describe, expect, test } from "bun:test";
import fixture from "./__fixtures__/library-contents.json";
import { flattenLibrary, imageFor } from "./library.ts";

const pl = (n: number, pinned = false) => ({ type: "playlist", uri: `spotify:playlist:p${n}`, name: `P${n}`, pinned, images: [] });

describe("flattenLibrary", () => {
  test("real library: only playable music items, nothing podcast-like", () => {
    const items = flattenLibrary(fixture);
    expect(items.length).toBeGreaterThan(0);
    for (const i of items) {
      expect(i.uri.startsWith("spotify:")).toBe(true);
      expect(["playlist", "album", "artist"]).toContain(i.type);
      expect(i.name.length).toBeGreaterThan(0);
    }
    // "Your Episodes" is a podcast collection and is left out.
    const episodes = fixture.items.find((i) => i.type === "your-episodes")!;
    expect(items.some((i) => i.uri === episodes.uri)).toBe(false);
    expect(items.length).toBe(fixture.items.filter((i) => i.type !== "your-episodes").length);
  });

  test("keeps Spotify's order, pinned items first", () => {
    const raw = { items: [pl(1), pl(2, true), pl(3), pl(4, true)] };
    expect(flattenLibrary(raw).map((i) => i.uri)).toEqual([
      "spotify:playlist:p2",
      "spotify:playlist:p4",
      "spotify:playlist:p1",
      "spotify:playlist:p3",
    ]);
  });

  test("folders are opened out in place", () => {
    const raw = {
      items: [pl(1), { type: "folder", uri: "spotify:user:u:folder:f", name: "F", items: [pl(2), pl(3)] }, pl(4)],
    };
    expect(flattenLibrary(raw).map((i) => i.uri)).toEqual([
      "spotify:playlist:p1",
      "spotify:playlist:p2",
      "spotify:playlist:p3",
      "spotify:playlist:p4",
    ]);
  });

  test("subtitles: album artists, playlist owner, artist label", () => {
    const items = flattenLibrary({
      items: [
        { type: "album", uri: "spotify:album:a", name: "A", artists: [{ name: "X" }, { name: "Y" }], images: [] },
        { type: "playlist", uri: "spotify:playlist:b", name: "B", owner: { name: "Me" }, images: [] },
        { type: "artist", uri: "spotify:artist:c", name: "C", images: [] },
      ],
    });
    expect(items.map((i) => i.subtitle)).toEqual(["X, Y", "Me", "Artist"]);
  });

  test("bad input gives an empty list instead of throwing", () => {
    expect(flattenLibrary(null)).toEqual([]);
    expect(flattenLibrary({})).toEqual([]);
    expect(flattenLibrary({ items: [null, 3, { type: "playlist" }] })).toEqual([]);
  });
});

describe("imageFor", () => {
  test("plain image URLs pass through; mosaics use their first cover", () => {
    expect(imageFor([{ url: "https://i.scdn.co/image/abc" }])).toBe("https://i.scdn.co/image/abc");
    expect(imageFor([{ url: "spotify:mosaic:aaa:bbb:ccc:ddd" }])).toBe("https://i.scdn.co/image/aaa");
    expect(imageFor([{ url: "spotify:image:zzz" }])).toBe("https://i.scdn.co/image/zzz");
    expect(imageFor([])).toBeNull();
    expect(imageFor(undefined)).toBeNull();
  });
});
