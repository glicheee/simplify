// Spotify search for Focus Mode: songs, albums, playlists and artists, in Spotify's
// own ranking. Uses the search behind Spotify's quick-search modal, the search query
// present on this client.
import type { FocusItem, FocusItemType } from "./types.ts";

export class FocusSearchError extends Error {}

const TYPES: Record<string, FocusItemType> = {
  TrackResponseWrapper: "track",
  AlbumResponseWrapper: "album",
  PlaylistResponseWrapper: "playlist",
  ArtistResponseWrapper: "artist",
};

/** Smallest source at least 64 px wide (good for a small row), else the first one. */
function pickImage(sources: unknown): string | null {
  if (!Array.isArray(sources) || sources.length === 0) return null;
  const usable = sources.filter((s) => typeof s?.url === "string" && s.url);
  if (usable.length === 0) return null;
  const sized = usable.filter((s) => typeof s.width === "number" && s.width >= 64).sort((a, b) => a.width - b.width);
  return (sized[0] ?? usable[0]).url;
}

const artistNames = (artists: any): string =>
  Array.isArray(artists?.items)
    ? artists.items.map((a: any) => a?.profile?.name).filter((n: unknown) => typeof n === "string").join(", ")
    : "";

function toItem(hit: any): FocusItem | null {
  const type = TYPES[hit?.item?.__typename];
  const data = hit?.item?.data;
  if (!type || !data || typeof data.uri !== "string" || !data.uri.startsWith("spotify:")) return null;
  const name = type === "artist" ? data.profile?.name : data.name;
  if (typeof name !== "string" || !name) return null;
  switch (type) {
    case "track":
      return { uri: data.uri, type, name, subtitle: artistNames(data.artists), image: pickImage(data.albumOfTrack?.coverArt?.sources) };
    case "album":
      return { uri: data.uri, type, name, subtitle: artistNames(data.artists), image: pickImage(data.coverArt?.sources) };
    case "playlist":
      return { uri: data.uri, type, name, subtitle: data.ownerV2?.data?.name ?? "", image: pickImage(data.images?.items?.[0]?.sources) };
    case "artist":
      return { uri: data.uri, type, name, subtitle: "Artist", image: pickImage(data.visuals?.avatarImage?.sources) };
  }
}

export function mapSearchResponse(json: unknown): FocusItem[] {
  const hits = (json as any)?.data?.searchV2?.topResultsV2?.itemsV2;
  if (!Array.isArray(hits)) return [];
  const seen = new Set<string>();
  const out: FocusItem[] = [];
  for (const hit of hits) {
    const item = toItem(hit);
    if (!item || seen.has(item.uri)) continue;
    seen.add(item.uri);
    out.push(item);
  }
  return out;
}

type Request = (q: string, signal: AbortSignal) => Promise<unknown>;

const SEARCH_VARIABLES = {
  offset: 0,
  limit: 20,
  numberOfTopResults: 20,
  includeAudiobooks: false,
  includeArtistHasConcertsField: false,
  includePreReleases: false,
  includeLocalConcertsField: false,
  includeAuthors: false,
  includeEpisodeContentRatingsV2: false,
};

const spotifyRequest: Request = (q) =>
  (Spicetify as any).GraphQL.Request((Spicetify as any).GraphQL.Definitions.searchModalResults, { searchTerm: q, ...SEARCH_VARIABLES });

export type FocusSearch = ((q: string) => Promise<FocusItem[] | null>) & {
  /** Drops whatever request is in flight (its call resolves null). */
  cancel(): void;
};

const SEARCH_TIMEOUT_MS = 8000;

/** A GraphQL answer carrying errors and no search data is a failure, not "no results". */
const isErrorResponse = (json: any): boolean =>
  !json || (Array.isArray(json.errors) && json.errors.length > 0 && !json.data?.searchV2);

/**
 * Returns a search function where each call supersedes the previous one: a superseded
 * or cancelled call resolves `null` (its answer is dropped even if it arrives later).
 * A request with no answer within `timeoutMs` fails with FocusSearchError.
 */
export function createSearch(request: Request = spotifyRequest, timeoutMs = SEARCH_TIMEOUT_MS): FocusSearch {
  let current: AbortController | null = null;
  const search = (async (q: string) => {
    current?.abort();
    const controller = new AbortController();
    current = controller;
    if (!q.trim()) return [];
    let json: unknown;
    let timer: ReturnType<typeof setTimeout> | undefined;
    try {
      json = await Promise.race([
        request(q.trim(), controller.signal),
        new Promise((_, reject) => (timer = setTimeout(() => reject(new Error("timed out")), timeoutMs))),
      ]);
    } catch (err) {
      if (controller.signal.aborted) return null;
      throw new FocusSearchError(String(err));
    } finally {
      clearTimeout(timer);
    }
    if (controller.signal.aborted) return null;
    if (isErrorResponse(json)) throw new FocusSearchError(JSON.stringify((json as any)?.errors ?? null).slice(0, 200));
    return mapSearchResponse(json);
  }) as FocusSearch;
  search.cancel = () => current?.abort();
  return search;
}
