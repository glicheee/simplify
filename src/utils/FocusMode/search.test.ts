/// <reference types="bun" />
import { describe, expect, test } from "bun:test";
import fixture from "./__fixtures__/search-modal.json";
import { createSearch, FocusSearchError, mapSearchResponse } from "./search.ts";

describe("mapSearchResponse", () => {
  test("real response: songs, playlists and artists, nothing else", () => {
    const items = mapSearchResponse(fixture);
    expect(items.length).toBeGreaterThan(20);
    for (const i of items) {
      expect(i.uri.startsWith("spotify:")).toBe(true);
      expect(["track", "album", "playlist", "artist"]).toContain(i.type);
      expect(i.name.length).toBeGreaterThan(0);
    }
    expect(items.some((i) => i.type === "track")).toBe(true);
    expect(items.some((i) => i.type === "playlist")).toBe(true);
    expect(items.some((i) => i.type === "artist")).toBe(true);
    expect(items.some((i) => /:(episode|show|user):/.test(i.uri))).toBe(false);
  });

  test("no duplicate results", () => {
    const uris = mapSearchResponse(fixture).map((i) => i.uri);
    expect(new Set(uris).size).toBe(uris.length);
  });

  test("track: name, artists joined, small cover", () => {
    const first = mapSearchResponse(fixture)[0];
    expect(first).toEqual({
      uri: "spotify:track:6IbnUaczZBT34DhaD6S18F",
      type: "track",
      name: "Bubblegum Bitch",
      subtitle: "MARINA",
      image: "https://i.scdn.co/image/ab67616d00004851203e4c6a048df02a21cdd813",
    });
  });

  test("album wrapper is understood", () => {
    const album = {
      item: {
        __typename: "AlbumResponseWrapper",
        data: {
          __typename: "Album",
          name: "Froot",
          uri: "spotify:album:x",
          artists: { items: [{ profile: { name: "MARINA" } }] },
          coverArt: { sources: [{ url: "https://i.scdn.co/image/a300", width: 300 }] },
        },
      },
    };
    const items = mapSearchResponse({ data: { searchV2: { topResultsV2: { itemsV2: [album] } } } });
    expect(items).toEqual([{ uri: "spotify:album:x", type: "album", name: "Froot", subtitle: "MARINA", image: "https://i.scdn.co/image/a300" }]);
  });

  test("bad input gives an empty list instead of throwing", () => {
    expect(mapSearchResponse(null)).toEqual([]);
    expect(mapSearchResponse({})).toEqual([]);
    expect(mapSearchResponse({ data: { searchV2: null } })).toEqual([]);
    expect(mapSearchResponse({ data: { searchV2: { topResultsV2: { itemsV2: [null, {}, { item: { data: {} } }] } } } })).toEqual([]);
  });
});

describe("createSearch", () => {
  const deferred = () => {
    let resolve!: (v: unknown) => void;
    const promise = new Promise((r) => (resolve = r));
    return { promise, resolve };
  };

  test("an older query answering late is dropped", async () => {
    const a = deferred();
    const ab = deferred();
    const search = createSearch((q) => (q === "a" ? a.promise : ab.promise) as Promise<unknown>);
    const first = search("a");
    const second = search("ab");
    ab.resolve(fixture);
    a.resolve(fixture);
    expect(await first).toBeNull();
    expect((await second)!.length).toBeGreaterThan(0);
  });

  test("a blank query returns nothing without asking Spotify", async () => {
    let calls = 0;
    const search = createSearch(async () => {
      calls++;
      return fixture;
    });
    expect(await search("   ")).toEqual([]);
    expect(calls).toBe(0);
  });

  test("a failed request rejects with FocusSearchError", async () => {
    const search = createSearch(async () => {
      throw new Error("offline");
    });
    await expect(search("x")).rejects.toBeInstanceOf(FocusSearchError);
  });

  test("the request gets an abort signal that fires when superseded", async () => {
    const signals: AbortSignal[] = [];
    const search = createSearch((_q, signal) => {
      signals.push(signal);
      return new Promise(() => {});
    });
    void search("a");
    void search("ab");
    expect(signals[0].aborted).toBe(true);
    expect(signals[1].aborted).toBe(false);
  });
});

describe("createSearch failure handling", () => {
  test("cancel() drops an answer still on its way", async () => {
    let resolve!: (v: unknown) => void;
    const search = createSearch(() => new Promise((r) => (resolve = r)));
    const pending = search("abc");
    search.cancel();
    resolve(fixture);
    expect(await pending).toBeNull();
  });
  test("a request that never answers times out as FocusSearchError", async () => {
    const search = createSearch(() => new Promise(() => {}), 30);
    await expect(search("x")).rejects.toBeInstanceOf(FocusSearchError);
  });
  test("a GraphQL error response counts as a failure, not as no results", async () => {
    const search = createSearch(async () => ({ errors: [{ message: "offline" }], data: null }));
    await expect(search("x")).rejects.toBeInstanceOf(FocusSearchError);
  });
});
