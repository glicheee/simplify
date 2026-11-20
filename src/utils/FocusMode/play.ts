import Logger from "../Logger.ts";
import type { FocusItem } from "./types.ts";

const log = new Logger("FocusMode");

/** Plays an item now. A track plays on its own; Spotify's autoplay continues after it. */
export async function playItem(item: FocusItem): Promise<void> {
  try {
    await Spicetify.Player.playUri(item.uri);
  } catch (err) {
    log.warn("Could not play", item.uri, err);
  }
}
