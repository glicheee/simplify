/**
 * Keeps `SL_NPVCover` on <html> exactly while the document holds a Now Playing
 * cover element (`[data-testid="track-visual-enhancement"]` or
 * `.main-nowPlayingView-coverArtVisualEnhancement`).
 *
 * The Canvas overlay rules in spicy-dynamic-bg.css can only match next to one of
 * those elements, yet their subjects are featureless, so Blink tested every
 * element in the right panel against them on each style recalc. With the Queue
 * open that is ~15k elements and a few hundred milliseconds per recalc. Prefixed
 * with `:where(.SL_NPVCover)`, they are rejected up front by Blink's ancestor
 * filter whenever no cover exists; `:where()` keeps their specificity unchanged.
 *
 * MutationObserver callbacks run before the next rendering step, so the class is
 * in place before any frame shows the cover.
 */

const CLASS = "SL_NPVCover";
const SELECTOR = '[data-testid="track-visual-enhancement"], .main-nowPlayingView-coverArtVisualEnhancement';

const root = document.documentElement;
let present = false;

const apply = (on: boolean) => {
  present = on;
  if (root.classList.contains(CLASS) !== on) root.classList.toggle(CLASS, on);
};

const touches = (node: Node): boolean =>
  node instanceof Element && (node.matches(SELECTOR) || node.querySelector(SELECTOR) !== null);

apply(document.querySelector(SELECTOR) !== null);

const MARKERS = /track-visual-enhancement|main-nowPlayingView-coverArtVisualEnhancement/;

new MutationObserver((records) => {
  if (!present) {
    // A cover arrives with an added subtree, or an existing element takes on the
    // test id / class.
    // The document has the final say, in case the cover already left again.
    for (const r of records) {
      if (r.type === "attributes") {
        if ((r.target as Element).matches(SELECTOR)) return apply(document.querySelector(SELECTOR) !== null);
      } else {
        for (const n of r.addedNodes) if (touches(n)) return apply(document.querySelector(SELECTOR) !== null);
      }
    }
    return;
  }
  // A cover leaves with a removed subtree, or an element drops the test id / class;
  // then the whole document decides.
  for (const r of records) {
    if (r.type === "attributes") {
      if (r.oldValue && MARKERS.test(r.oldValue)) return apply(document.querySelector(SELECTOR) !== null);
    } else {
      for (const n of r.removedNodes) {
        if (touches(n)) return apply(document.querySelector(SELECTOR) !== null);
      }
    }
  }
}).observe(root, {
  childList: true,
  subtree: true,
  attributes: true,
  attributeOldValue: true,
  attributeFilter: ["class", "data-testid"],
});
