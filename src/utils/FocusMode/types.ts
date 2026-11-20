export type FocusItemType = "track" | "album" | "playlist" | "artist";

/** One playable thing shown in Focus Mode's search results or library rail. */
export interface FocusItem {
  uri: string;
  type: FocusItemType;
  name: string;
  /** Artists for a track or album, the owner for a playlist, "Artist" for an artist. */
  subtitle: string;
  image: string | null;
}
