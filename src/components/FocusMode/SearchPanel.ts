// Focus Mode search: slides down from the top; the now-playing group shrinks below it.
import { createSearch, FocusSearchError } from "../../utils/FocusMode/search.ts";
import { playItem } from "../../utils/FocusMode/play.ts";
import { focusLog } from "../../utils/FocusMode/log.ts";
import type { FocusItem } from "../../utils/FocusMode/types.ts";

const TYPE_LABEL: Record<FocusItem["type"], string> = { track: "Song", album: "Album", playlist: "Playlist", artist: "Artist" };
const DEBOUNCE_MS = 150;
/** Matches the longest transition in FocusMode.css for the panel. */
const CLOSE_MS = 320;

export interface FocusPanelHandle {
  open(): void;
  close(): Promise<void>;
  destroy(): void;
}

export function mountSearchPanel(page: HTMLElement, onPicked: () => void): FocusPanelHandle {
  const root = document.createElement("div");
  root.className = "FocusPanel FocusSearch";
  root.innerHTML = `
    <label class="FocusSearchField">
      <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><path fill="currentColor" d="M10.5 3a7.5 7.5 0 0 1 5.92 12.1l4.24 4.24-1.42 1.42-4.24-4.24A7.5 7.5 0 1 1 10.5 3Zm0 2a5.5 5.5 0 1 0 0 11 5.5 5.5 0 0 0 0-11Z"/></svg>
      <input type="text" spellcheck="false" autocomplete="off" placeholder="Search songs, albums, playlists, artists" aria-label="Search">
    </label>
    <div class="FocusResults" role="listbox"><div class="FocusHint">Type to search</div></div>`;
  const input = root.querySelector("input")!;
  const list = root.querySelector<HTMLElement>(".FocusResults")!;
  const search = createSearch();
  let items: FocusItem[] = [];
  let active = -1;
  let timer: ReturnType<typeof setTimeout> | undefined;
  let closing: Promise<void> | null = null;

  const setHint = (text: string) => {
    items = [];
    active = -1;
    list.replaceChildren(Object.assign(document.createElement("div"), { className: "FocusHint", textContent: text }));
  };

  const highlight = (i: number, fromKeyboard = true) => {
    const rows = list.querySelectorAll<HTMLElement>(".FocusRow");
    rows[active]?.classList.remove("is-active");
    active = Math.max(0, Math.min(i, rows.length - 1));
    rows[active]?.classList.add("is-active");
    // Only keyboard moves scroll; scrolling under the mouse would move the list it points at.
    if (fromKeyboard) rows[active]?.scrollIntoView({ block: "nearest" });
  };

  const pick = (item: FocusItem | undefined) => {
    if (!item) return;
    focusLog("search-pick", { type: item.type });
    void playItem(item);
    onPicked();
  };

  const render = (results: FocusItem[]) => {
    if (results.length === 0) return setHint("No results");
    items = results;
    active = -1;
    const rows = results.map((item, i) => {
      const row = document.createElement("div");
      row.className = "FocusRow";
      row.setAttribute("role", "option");
      row.style.setProperty("--i", String(Math.min(i, 12)));
      const img = document.createElement("img");
      img.className = item.type === "artist" ? "FocusThumb is-round" : "FocusThumb";
      img.alt = "";
      img.decoding = "async";
      img.loading = "lazy";
      img.addEventListener("load", () => img.classList.add("is-loaded"), { once: true });
      if (item.image) img.src = item.image;
      const text = document.createElement("div");
      text.className = "FocusRowText";
      const name = Object.assign(document.createElement("div"), { className: "FocusRowName", textContent: item.name });
      const sub = Object.assign(document.createElement("div"), {
        className: "FocusRowSub",
        textContent: item.subtitle && item.type !== "artist" ? `${TYPE_LABEL[item.type]} · ${item.subtitle}` : TYPE_LABEL[item.type],
      });
      text.append(name, sub);
      row.append(img, text);
      row.addEventListener("mousemove", () => active !== i && highlight(i, false));
      row.addEventListener("click", () => pick(item));
      return row;
    });
    list.replaceChildren(...rows);
    highlight(0);
  };

  const run = async (q: string) => {
    try {
      const results = await search(q);
      if (results === null || q !== input.value) return; // superseded by newer typing
      render(results);
    } catch (err) {
      if (err instanceof FocusSearchError) {
        focusLog("search-error", { err: err.message.slice(0, 200) });
        setHint("Search unavailable");
      }
    }
  };

  input.addEventListener("input", () => {
    clearTimeout(timer);
    // Drop any answer still on its way for the old text, so it can't land under the new one.
    search.cancel();
    if (!input.value.trim()) return setHint("Type to search");
    timer = setTimeout(() => void run(input.value), DEBOUNCE_MS);
  });
  input.addEventListener("keydown", (e) => {
    if (e.key === "ArrowDown") { e.preventDefault(); highlight(active + 1); }
    else if (e.key === "ArrowUp") { e.preventDefault(); highlight(active - 1); }
    else if (e.key === "Enter") { e.preventDefault(); pick(items[active]); }
  });

  page.append(root);

  return {
    open() {
      closing = null;
      void root.offsetHeight; // start from the hidden state so the entrance animates
      root.classList.add("is-open");
      page.classList.add("FocusSearchOpen");
      input.focus({ preventScroll: true });
    },
    close() {
      if (closing) return closing;
      clearTimeout(timer);
      root.classList.remove("is-open");
      page.classList.remove("FocusSearchOpen");
      input.blur();
      closing = new Promise((resolve) => setTimeout(() => { root.remove(); resolve(); }, CLOSE_MS));
      return closing;
    },
    destroy() {
      clearTimeout(timer);
      page.classList.remove("FocusSearchOpen");
      root.remove();
    },
  };
}
