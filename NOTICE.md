# Notice

Simplify is a modified version of **Spicy Lyrics**
(https://github.com/Spikerko/spicy-lyrics), Copyright © Spikerko and contributors,
licensed under the GNU Affero General Public License v3.0 (see `LICENSE`). Simplify is
distributed under the same license. Its complete source is this repository.

Not affiliated with or endorsed by the Spicy Lyrics project or Spotify.

## Changes from Spicy Lyrics (November 2026, by glicheee)

- **Focus Mode** (`src/utils/FocusMode/`, `src/components/FocusMode/`,
  `src/css/FocusMode.css`): opens into the in-window cover view; search (Ctrl+K),
  library rail (Ctrl+B), lyrics toggle (L), Esc, Ctrl+Shift+F; animated transitions;
  optional startup cover (`scripts/`).
- **Performance**: the dynamic-background overlay rules in
  `src/css/DynamicBG/spicy-dynamic-bg.css` are reordered and gated
  (`src/utils/npvCoverGate.ts`), cutting full style recalculations in Spotify's right
  panel roughly fourfold; `:has()` and background frame-rate tweaks; page state classes.
- **Fullscreen like button** made larger and lower.
- **LRCLIB backup** (`src/utils/Lyrics/Backup/`) when the lyrics service has nothing.
- **Separate identity** (`src/simplify.ts`): own name, `Simplify-Client` request
  header, no update checks, no remote settings or experiment overrides, bug reports
  to this repository, stands down when Spicy Lyrics is also installed, own style id.
- **Extras**: `builds/simplify-glass.js` and `builds/simplify-polish.js`, written for
  Simplify.
