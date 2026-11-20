// Simplify Polish: small look tweaks for Spotify. Part of Simplify
// (https://github.com/glicheee/simplify), AGPL-3.0.
//   1. Accent color follows the album cover: everything Spotify paints in its green
//      (play buttons, shuffle/repeat when on, the playing row, toggles, tab underline)
//      takes a tuned color from the current cover instead.
//   2. Declutter: hides the podcast rows on Home ("Shows to try", "Episodes you might
//      like").
//   3. Softer look: rounder panels, cards and rows, a little more space between the
//      panels, smooth hover fades and a slight cover zoom on hovered cards.
// Uninstall it in Marketplace to undo everything.
(function spotifyPolish() {
  if (!window.Spicetify?.Player?.addEventListener || !document.head) {
    setTimeout(spotifyPolish, 300);
    return;
  }

  // ---- 2. Declutter ---------------------------------------------------------------
  const HIDE_HOME_SHELVES = ["Shows to try", "Episodes you might like"];
  const declutter = document.createElement("style");
  declutter.id = "spotify-polish-declutter";
  declutter.textContent =
    'section[data-testid="component-shelf"]:is(' +
    HIDE_HOME_SHELVES.map((t) => '[aria-label="' + t.replace(/"/g, '\\"') + '"]').join(", ") +
    ") { display: none !important; }";
  document.head.appendChild(declutter);

  // ---- 3. Softer look ---------------------------------------------------------------
  // Rounder panels, cards, rows and covers, a little more space between the panels,
  // smooth hover fades and a slight cover zoom on hovered cards. Static rules only:
  // nothing here changes while Spotify runs, so it adds no style work after startup.
  const soft = document.createElement("style");
  soft.id = "spotify-polish-soft";
  soft.textContent = `
.Root__top-container { gap: 12px !important; padding: 12px !important; }
.Root__nav-bar, .main-yourLibraryX-library, .Root__main-view, #Desktop_PanelContainer_Id { border-radius: 16px !important; }
div[data-encore-id="card"] { border-radius: 12px !important; }
.main-cardImage-imageWrapper, .main-cardImage-imageWrapper img.main-image-image:not(.main-avatar-image) { border-radius: 10px !important; }
.main-cardImage-imageWrapper { overflow: hidden; }
.view-homeShortcutsGrid-shortcut { border-radius: 10px !important; overflow: hidden; }
div[data-encore-id="listRow"], .main-trackList-trackListRow { border-radius: 10px !important; }
.x-entityImage-imageContainer, .x-entityImage-imageContainer > span, .x-entityImage-imageContainer img { border-radius: 8px !important; }
div[data-encore-id="card"], div[data-encore-id="listRow"], .main-trackList-trackListRow, .view-homeShortcutsGrid-shortcut { transition: background-color .2s ease; }
.main-cardImage-imageWrapper img.main-image-image { transition: transform .35s cubic-bezier(.2,.7,.2,1); }
div[data-encore-id="card"]:hover .main-cardImage-imageWrapper img.main-image-image { transform: scale(1.04); }
`;
  document.head.appendChild(soft);

  // ---- 1. Accent from the cover -----------------------------------------------------
  // Spotify's green comes from these Spicetify variables (colors.css on :root); every
  // accent in the app resolves through them. `html:root` outranks colors.css' `:root`.
  const accent = document.createElement("style");
  accent.id = "spotify-polish-accent";
  document.head.appendChild(accent);

  const hexToRgb = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
  const rgbToHex = (r) => "#" + r.map((v) => Math.round(v).toString(16).padStart(2, "0")).join("");
  const rgbToHsl = ([r, g, b]) => {
    r /= 255; g /= 255; b /= 255;
    const max = Math.max(r, g, b), min = Math.min(r, g, b), l = (max + min) / 2;
    if (max === min) return [0, 0, l];
    const d = max - min;
    const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    const h = max === r ? (g - b) / d + (g < b ? 6 : 0) : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
    return [h / 6, s, l];
  };
  const hslToRgb = ([h, s, l]) => {
    if (s === 0) return [l * 255, l * 255, l * 255];
    const q = l < 0.5 ? l * (1 + s) : l + s - l * s, p = 2 * l - q;
    const f = (t) => {
      if (t < 0) t += 1; if (t > 1) t -= 1;
      if (t < 1 / 6) return p + (q - p) * 6 * t;
      if (t < 1 / 2) return q;
      if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
      return p;
    };
    return [f(h + 1 / 3) * 255, f(h) * 255, f(h - 1 / 3) * 255];
  };

  const luminance = (rgb) => {
    const [r, g, b] = rgb.map((v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; });
    return 0.2126 * r + 0.7152 * g + 0.0722 * b;
  };

  // Tuned so it reads on Spotify's near-black background and keeps the black play
  // icon on top of it legible: fairly light, fairly saturated. Grey covers keep green.
  const DEFAULT = { button: "#1db954", active: "#1ed760" };
  const tune = (hex) => {
    if (!/^#[0-9a-f]{6}$/i.test(hex || "")) return DEFAULT;
    const [h, s, l] = rgbToHsl(hexToRgb(hex));
    if (s < 0.18) return DEFAULT;
    const S = Math.min(0.85, Math.max(0.55, s));
    let L = Math.min(0.66, Math.max(0.56, l));
    // Blues and purples look dark at the same lightness: raise them until the color
    // has enough contrast with the background (about 4.5:1 against #121212).
    while (luminance(hslToRgb([h, S, L])) < 0.24 && L < 0.8) L += 0.02;
    return { button: rgbToHex(hslToRgb([h, S, L])), active: rgbToHex(hslToRgb([h, S, Math.min(0.74, L + 0.06)])) };
  };

  // Last few events, for checking it works: localStorage "spotify-polish:log".
  const note = (ev) => {
    try {
      const k = "spotify-polish:log";
      const a = JSON.parse(localStorage.getItem(k) || "[]");
      a.push({ t: Date.now(), ...ev });
      localStorage.setItem(k, JSON.stringify(a.slice(-30)));
    } catch {}
  };
  note({ ev: "start" });

  // Spicetify.colorExtractor returns nothing on Spotify 1.3.10, so the cover is read
  // directly: its 64px thumbnail, scaled to 24x24, binned by hue and weighted by how
  // colorful each pixel is. The strongest hue wins.
  const imageUrl = (meta) => {
    const id = meta?.image_small_url || meta?.image_url || meta?.image_large_url || meta?.image_xlarge_url;
    if (!id) return null;
    return id.startsWith("spotify:image:") ? "https://i.scdn.co/image/" + id.slice(14) : id;
  };
  const coverColor = async (url) => {
    const blob = await (await fetch(url)).blob();
    const bmp = await createImageBitmap(blob, { resizeWidth: 24, resizeHeight: 24, resizeQuality: "medium" });
    const cv = new OffscreenCanvas(24, 24);
    const ctx = cv.getContext("2d", { willReadFrequently: true });
    ctx.drawImage(bmp, 0, 0);
    bmp.close();
    const px = ctx.getImageData(0, 0, 24, 24).data;
    const bins = Array.from({ length: 24 }, () => ({ w: 0, r: 0, g: 0, b: 0 }));
    let total = 0;
    for (let i = 0; i < px.length; i += 4) {
      const rgb = [px[i], px[i + 1], px[i + 2]];
      const [h, s, l] = rgbToHsl(rgb);
      const w = s * s * Math.max(0, 1 - Math.abs(l - 0.5) * 2);
      total += w;
      if (w < 0.02) continue;
      const bin = bins[Math.floor(h * 24) % 24];
      bin.w += w; bin.r += rgb[0] * w; bin.g += rgb[1] * w; bin.b += rgb[2] * w;
    }
    // Neighbouring hues count together so a gradient isn't split across bins.
    let best = -1, bestW = 0;
    for (let i = 0; i < 24; i++) {
      const w = bins[i].w + 0.5 * (bins[(i + 23) % 24].w + bins[(i + 1) % 24].w);
      if (w > bestW) { bestW = w; best = i; }
    }
    if (best < 0 || total / 576 < 0.03) return null; // grey or black-and-white cover
    const b = bins[best];
    return rgbToHex([b.r / b.w, b.g / b.w, b.b / b.w]);
  };

  const cache = new Map();
  const colorFor = (meta) => {
    const url = imageUrl(meta);
    if (!url) return Promise.resolve(DEFAULT);
    if (!cache.has(url)) {
      cache.set(url, coverColor(url)
        .then((hex) => { const c = hex ? tune(hex) : DEFAULT; note({ ev: "color", url: url.slice(-12), cover: hex, button: c.button }); return c; })
        .catch((err) => { note({ ev: "color-failed", url: url.slice(-12), err: String(err).slice(0, 200) }); return DEFAULT; }));
      if (cache.size > 60) cache.delete(cache.keys().next().value);
    }
    return cache.get(url);
  };

  let applied = "";
  const apply = (c) => {
    const key = c.button + c.active;
    if (key === applied) return;
    applied = key;
    accent.textContent = c === DEFAULT ? "" :
      "html:root{--spice-button:" + c.button + ";--spice-button-active:" + c.active +
      ";--spice-rgb-button:" + hexToRgb(c.button).join(",") + ";--spice-rgb-button-active:" + hexToRgb(c.active).join(",") + "}";
  };

  // The next track's color is worked out ahead of time (cached by cover), so on a song
  // change it lands in the same frame as Spotify's own redraw instead of a second one.
  const ready = new Map();
  const prefetch = () => {
    const next = Spicetify.Queue?.nextTracks?.[0]?.contextTrack?.metadata;
    const url = imageUrl(next);
    if (url && !ready.has(url)) colorFor(next).then((c) => { ready.set(url, c); if (ready.size > 60) ready.delete(ready.keys().next().value); });
  };

  const onSong = () => {
    const meta = Spicetify.Player.data?.item?.metadata;
    const url = imageUrl(meta);
    if (!url) return void setTimeout(onSong, 1000); // player not ready yet
    if (ready.has(url)) apply(ready.get(url));
    else colorFor(meta).then((c) => { ready.set(url, c); if (imageUrl(Spicetify.Player.data?.item?.metadata) === url) apply(c); });
    setTimeout(prefetch, 3000);
  };
  Spicetify.Player.addEventListener("songchange", onSong);
  onSong();
})();
