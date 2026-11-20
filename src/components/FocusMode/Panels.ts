// Mounts and unmounts Focus Mode's panels as $focusPanel changes. Opening one panel
// while another is open closes the old one (animated) and opens the new one at once.
import { PageContainer } from "../Pages/PageView.ts";
import { $focusPanel } from "../../utils/FocusMode/state.ts";
import type { FocusPanel } from "../../utils/FocusMode/shortcuts.ts";
import { mountSearchPanel, type FocusPanelHandle } from "./SearchPanel.ts";
import { mountLibraryRail } from "./LibraryRail.ts";

let current: { panel: FocusPanel; handle: FocusPanelHandle } | null = null;

const closeCurrent = () => {
  if (!current) return;
  void current.handle.close();
  current = null;
};

function show(panel: FocusPanel) {
  if (current?.panel === panel) return;
  closeCurrent();
  const page = PageContainer;
  if (panel === "none" || !page) return;
  const onPicked = () => $focusPanel.set("none");
  const handle = panel === "search" ? mountSearchPanel(page, onPicked) : mountLibraryRail(page, onPicked);
  current = { panel, handle };
  requestAnimationFrame(() => {
    if (current?.handle === handle) handle.open();
  });
}

export function initFocusPanels() {
  $focusPanel.listen(show);
}
