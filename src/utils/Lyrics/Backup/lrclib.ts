// Backup lyrics from LRCLIB (https://lrclib.net), a free public lyrics database.
// Used only when the main lyrics service gives nothing for a track. LRCLIB has line
// timing, not per-word timing, so these show as Line (or Static) lyrics.

export interface LineLyric {
  Text: string;
  StartTime: number;
  EndTime: number;
}

/** How long the last line stays when the song's length is unknown, in seconds. */
const LAST_LINE_FALLBACK_S = 5;
const STAMP = /\[(\d{1,3}):(\d{1,2}(?:\.\d{1,3})?)\]/g;

/** Parses LRC text into lines with start and end times in seconds. */
export function parseLrc(lrc: string, durationS: number): LineLyric[] {
  const stamped: Array<{ t: number; text: string }> = [];
  for (const raw of (lrc ?? "").split(/\r?\n/)) {
    const times: number[] = [];
    let rest = raw;
    STAMP.lastIndex = 0;
    let m: RegExpExecArray | null;
    let consumed = 0;
    while ((m = STAMP.exec(raw)) && m.index === consumed) {
      times.push(Number(m[1]) * 60 + Number(m[2]));
      consumed = STAMP.lastIndex;
    }
    if (times.length === 0) continue; // metadata tags like [ar:...] or untimed text
    rest = raw.slice(consumed).trim();
    for (const t of times) stamped.push({ t, text: rest });
  }
  stamped.sort((a, b) => a.t - b.t);
  const out: LineLyric[] = [];
  for (let i = 0; i < stamped.length; i++) {
    const { t, text } = stamped[i];
    if (!text) continue; // an empty stamp only marks where the previous line stops
    const next = stamped[i + 1]?.t;
    const end = next ?? (durationS > t ? durationS : t + LAST_LINE_FALLBACK_S);
    out.push({ Text: text, StartTime: round(t), EndTime: round(end) });
  }
  return out;
}

const round = (n: number) => Math.round(n * 1000) / 1000;

/** An LRCLIB record as Line lyrics (synced) or Static lyrics (plain), or null if neither. */
export function lrclibToLyrics(record: any): { Type: "Line"; StartTime: number; Content: LineLyric[] } | { Type: "Static"; Lines: { Text: string }[] } | null {
  if (!record || record.instrumental) return null;
  if (typeof record.syncedLyrics === "string" && record.syncedLyrics.trim()) {
    const content = parseLrc(record.syncedLyrics, Number(record.duration) || 0);
    if (content.length > 0) return { Type: "Line", StartTime: content[0].StartTime, Content: content };
  }
  if (typeof record.plainLyrics === "string" && record.plainLyrics.trim()) {
    const lines = record.plainLyrics.split(/\r?\n/).map((t: string) => t.trim()).filter(Boolean);
    if (lines.length > 0) return { Type: "Static", Lines: lines.map((Text: string) => ({ Text })) };
  }
  return null;
}

export interface TrackInfo {
  title: string;
  artist: string;
  album: string;
  durationS: number;
}

/**
 * Looks the track up on LRCLIB. Resolves null when it has nothing or can't be reached.
 * The request carries only the track's title, artist, album and length.
 */
export async function fetchLrclibLyrics(track: TrackInfo, signal?: AbortSignal) {
  const params = new URLSearchParams({
    track_name: track.title,
    artist_name: track.artist,
    album_name: track.album,
    duration: String(Math.round(track.durationS)),
  });
  try {
    const res = await fetch(`https://lrclib.net/api/get?${params}`, {
      signal,
      headers: { "Lrclib-Client": "Simplify (https://github.com/glicheee/simplify)" },
    });
    if (!res.ok) return null;
    return lrclibToLyrics(await res.json());
  } catch {
    return null;
  }
}
