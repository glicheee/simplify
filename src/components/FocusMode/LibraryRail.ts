// Focus Mode library: a slim column of covers that slides in from the left.
import { getLibraryItems } from "../../utils/FocusMode/library.ts";
import { playItem } from "../../utils/FocusMode/play.ts";
import { focusLog } from "../../utils/FocusMode/log.ts";
import type { FocusItem } from "../../utils/FocusMode/types.ts";
import { createTooltip } from "../../utils/tooltip.ts";
import type { FocusPanelHandle } from "./SearchPanel.ts";

const CLOSE_MS = 320;
const PLACEHOLDERS = 8;

// Loaded on first open, reused afterwards and refreshed quietly in the background.
let cached: FocusItem[] | null = null;
let loading: Promise<FocusItem[]> | null = null;
function loadLibrary(): Promise<FocusItem[]> {
  loading ??= getLibraryItems()
    .then((items) => (cached = items))
    .catch((err) => {
      focusLog("library-error", { err: String(err).slice(0, 200) });
      return cached ?? [];
    })
    .finally(() => (loading = null));
  return loading;
}

export function mountLibraryRail(page: HTMLElement, onPicked: () => void): FocusPanelHandle {
  const root = document.createElement("div");
  root.className = "FocusPanel FocusLibrary";
  const scroller = document.createElement("div");
  scroller.className = "FocusLibraryList";
  root.append(scroller);
  const tooltips: Array<{ destroy?: () => void } | undefined> = [];
  let closing: Promise<void> | null = null;

  let shownKey = "";
  const render = (items: FocusItem[]) => {
    const key = items.map((i) => i.uri).join("|");
    if (key === shownKey && scroller.childElementCount > 0) return; // background refresh found no change
    shownKey = key;
    tooltips.splice(0).forEach((t) => t?.destroy?.());
    if (items.length === 0) {
      const hint = document.createElement("div");
      hint.className = "FocusTile is-hint";
      hint.textContent = "!";
      tooltips.push(createTooltip(hint, { content: "Library unavailable", placement: "right", offset: [0, 12] }) as any);
      scroller.replaceChildren(hint);
      return;
    }
    const tiles = items.map((item, i) => {
      const tile = document.createElement("button");
      tile.type = "button";
      tile.className = `FocusTile${item.type === "artist" ? " is-round" : ""}${item.image ? "" : " is-liked"}`;
      tile.style.setProperty("--i", String(Math.min(i, 14)));
      tile.setAttribute("aria-label", item.name);
      if (item.image) {
        const img = document.createElement("img");
        img.alt = "";
        img.decoding = "async";
        img.loading = "lazy";
        img.addEventListener("load", () => img.classList.add("is-loaded"), { once: true });
        img.src = item.image;
        tile.append(img);
      }
      tile.addEventListener("click", () => {
        focusLog("library-pick", { type: item.type });
        void playItem(item);
        onPicked();
      });
      tooltips.push(createTooltip(tile, { content: item.name, placement: "right", offset: [0, 12] }) as any);
      return tile;
    });
    scroller.replaceChildren(...tiles);
  };

  if (cached) render(cached);
  else scroller.replaceChildren(...Array.from({ length: PLACEHOLDERS }, (_, i) => {
    const ph = document.createElement("div");
    ph.className = "FocusTile is-placeholder";
    ph.style.setProperty("--i", String(i));
    return ph;
  }));
  void loadLibrary().then((items) => {
    if (!closing && root.isConnected) render(items);
  });

  page.append(root);

  return {
    open() {
      closing = null;
      void root.offsetHeight;
      root.classList.add("is-open");
      page.classList.add("FocusLibraryOpen");
    },
    close() {
      if (closing) return closing;
      root.classList.remove("is-open");
      page.classList.remove("FocusLibraryOpen");
      closing = new Promise((resolve) =>
        setTimeout(() => {
          tooltips.splice(0).forEach((t) => t?.destroy?.());
          root.remove();
          resolve();
        }, CLOSE_MS)
      );
      return closing;
    },
    destroy() {
      tooltips.splice(0).forEach((t) => t?.destroy?.());
      page.classList.remove("FocusLibraryOpen");
      root.remove();
    },
  };
}
