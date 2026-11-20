// The user's library as a flat, playable list for Focus Mode's library rail.
import type { FocusItem, FocusItemType } from "./types.ts";

const LIBRARY_TYPES: ReadonlySet<string> = new Set(["playlist", "album", "artist"]);
const IMAGE_BASE = "https://i.scdn.co/image/";

/** First usable cover URL from a Spotify images array. Mosaics use their first tile. */
export function imageFor(images: unknown): string | null {
  if (!Array.isArray(images)) return null;
  for (const img of images) {
    const url = (img as { url?: unknown } | null)?.url;
    if (typeof url !== "string" || !url) continue;
    if (url.startsWith("spotify:mosaic:")) return IMAGE_BASE + url.slice(15).split(":")[0];
    if (url.startsWith("spotify:image:")) return IMAGE_BASE + url.slice(14);
    return url;
  }
  return null;
}

const names = (list: unknown): string =>
  Array.isArray(list)
    ? list.map((a) => (a as { name?: unknown } | null)?.name).filter((n): n is string => typeof n === "string").join(", ")
    : "";

function toItem(raw: any): FocusItem | null {
  if (!raw || typeof raw !== "object") return null;
  const { type, uri, name } = raw;
  if (!LIBRARY_TYPES.has(type) || typeof uri !== "string" || typeof name !== "string" || !name) return null;
  const subtitle = type === "artist" ? "Artist" : type === "album" ? names(raw.artists) : (raw.owner?.name ?? "");
  return { uri, type: type as FocusItemType, name, subtitle, image: imageFor(raw.images) };
}

/**
 * Spotify's library order with pinned items first. Folders are replaced in place by
 * their contents; podcasts, episodes and anything unknown are left out.
 */
export function flattenLibrary(raw: unknown): FocusItem[] {
  const pinned: FocusItem[] = [];
  const rest: FocusItem[] = [];
  const walk = (list: unknown, insideFolder: boolean) => {
    if (!Array.isArray(list)) return;
    for (const entry of list) {
      if ((entry as any)?.type === "folder") {
        walk((entry as any).items, true);
        continue;
      }
      const item = toItem(entry);
      if (!item) continue;
      (!insideFolder && (entry as any).pinned ? pinned : rest).push(item);
    }
  };
  walk((raw as any)?.items, false);
  return [...pinned, ...rest];
}

const LIKED_SONGS_FALLBACK = "spotify:collection:tracks";

/** Liked Songs is not part of getContents' list, so it is added at the top. */
export function likedSongsItem(): FocusItem {
  const uri = (Spicetify.Platform as any)?.LibraryAPI?._likedSongsUri;
  return { uri: typeof uri === "string" && uri ? uri : LIKED_SONGS_FALLBACK, type: "playlist", name: "Liked Songs", subtitle: "", image: null };
}

/** Reads the library, opening folders (their contents are fetched separately). */
export async function getLibraryItems(): Promise<FocusItem[]> {
  const api = (Spicetify.Platform as any).LibraryAPI;
  const fetchList = async (folderUri?: string): Promise<any[]> => {
    const res = await api.getContents(folderUri ? { folderUri, limit: 200, offset: 0 } : { limit: 200, offset: 0 });
    const items: any[] = Array.isArray(res?.items) ? res.items : [];
    for (const item of items) {
      if (item?.type === "folder" && typeof item.uri === "string") item.items = await fetchList(item.uri);
    }
    return items;
  };
  const items = flattenLibrary({ items: await fetchList() });
  const liked = likedSongsItem();
  return [liked, ...items.filter((i) => i.uri !== liked.uri)];
}
