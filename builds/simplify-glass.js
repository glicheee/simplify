// Simplify Glass: a slowly moving, blurred copy of the current album cover behind the
// whole app, with see-through panels on top of it. Part of Simplify
// (https://github.com/glicheee/simplify), AGPL-3.0.
//
// Kept cheap on purpose:
//  - The cover is blurred once per song into a tiny 96x96 canvas. The GPU stretches
//    that small texture to the window, so there is no live blur (no backdrop-filter,
//    no CSS filter) and the texture stays a few KB.
//  - The motion is a CSS transform animation, which runs on the compositor: no style,
//    layout or paint work on the main thread while it moves.
//  - It pauses while the fullscreen lyrics view covers everything, and the
//    browser stops it on its own while Spotify is minimized or hidden.
//  - Panels get a fixed translucent color. Nothing on :root changes, so a song change
//    only touches the background's own elements.
// Uninstall it in Marketplace to undo everything.
(function spotifyGlass() {
  if (!window.Spicetify?.Player?.addEventListener || !document.body || !document.head) {
    setTimeout(spotifyGlass, 300);
    return;
  }

  const PANEL = "rgba(18, 18, 18, 0.5)";
  const style = document.createElement("style");
  style.id = "spotify-glass-style";
  style.textContent = `
#spotify-glass-bg { position: fixed; inset: 0; z-index: -1; overflow: hidden; pointer-events: none; background: #000; contain: strict; }
#spotify-glass-bg::after { content: ""; position: absolute; inset: 0; background: rgba(0, 0, 0, 0.32); }
#spotify-glass-bg .sg-layer { position: absolute; inset: 0; opacity: 0; transition: opacity 1.4s ease; }
#spotify-glass-bg .sg-layer.sg-on { opacity: 1; }
#spotify-glass-bg canvas { position: absolute; left: 50%; top: 50%; width: 160vmax; height: 160vmax; margin: -80vmax 0 0 -80vmax; will-change: transform; }
#spotify-glass-bg canvas.sg-a { transform-origin: 42% 46%; animation: sg-turn 75s steps(1500) infinite; /* 20 redraws a second, not one per screen refresh (165 Hz) */ }
#spotify-glass-bg canvas.sg-b { transform-origin: 58% 54%; animation: sg-turn 110s steps(2200) infinite reverse; /* same 50 ms step, so both canvases redraw together */ opacity: 0.55; }
#spotify-glass-bg.sg-paused canvas { animation-play-state: paused; }
@keyframes sg-turn { from { transform: rotate(0deg) scale(1.15); } to { transform: rotate(360deg) scale(1.15); } }
@media (prefers-reduced-motion: reduce) { #spotify-glass-bg canvas { animation: none !important; } }

.Root__top-container, #global-nav-bar, .Root__nav-bar, .Root__now-playing-bar,
.Root__right-sidebar-peek, .main-yourLibraryX-libraryContainer { background: transparent !important; }
.main-yourLibraryX-library, .Root__main-view, #Desktop_PanelContainer_Id { background-color: ${PANEL} !important; }
.main-home-homeHeader { -webkit-mask-image: linear-gradient(#000, transparent); mask-image: linear-gradient(#000, transparent); }
`;
  document.head.appendChild(style);

  const bg = document.createElement("div");
  bg.id = "spotify-glass-bg";
  document.body.prepend(bg);

  const note = (ev) => {
    try {
      const k = "spotify-glass:log";
      const a = JSON.parse(localStorage.getItem(k) || "[]");
      a.push({ t: Date.now(), ...ev });
      localStorage.setItem(k, JSON.stringify(a.slice(-30)));
    } catch {}
  };

  const imageUrl = (meta) => {
    const id = meta?.image_url || meta?.image_large_url || meta?.image_small_url || meta?.image_xlarge_url;
    if (!id) return null;
    return id.startsWith("spotify:image:") ? "https://i.scdn.co/image/" + id.slice(14) : id;
  };

  const SIZE = 96;
  const paint = (canvas, src, flip) => {
    canvas.width = SIZE; canvas.height = SIZE;
    const ctx = canvas.getContext("2d");
    ctx.filter = "blur(5px) saturate(1.8) brightness(0.75)"; // capped so text stays readable on white covers
    if (flip) { ctx.translate(SIZE, SIZE); ctx.rotate(Math.PI); }
    // Drawn larger than the canvas so the blur has no see-through edges.
    ctx.drawImage(src, -16, -16, SIZE + 32, SIZE + 32);
  };

  let current = null, shownUrl = "";
  const show = async (url) => {
    if (!url || url === shownUrl) return;
    shownUrl = url;
    try {
      const blob = await (await fetch(url)).blob();
      const bmp = await createImageBitmap(blob, { resizeWidth: 128, resizeHeight: 128, resizeQuality: "medium" });
      if (url !== shownUrl) { bmp.close(); return; }
      const layer = document.createElement("div");
      layer.className = "sg-layer";
      const a = document.createElement("canvas"); a.className = "sg-a"; paint(a, bmp, false);
      const b = document.createElement("canvas"); b.className = "sg-b"; paint(b, bmp, true);
      bmp.close();
      layer.append(a, b);
      bg.append(layer);
      const old = current;
      current = layer;
      requestAnimationFrame(() => requestAnimationFrame(() => layer.classList.add("sg-on")));
      if (old) setTimeout(() => old.remove(), 1600);
    } catch (err) {
      note({ ev: "failed", err: String(err).slice(0, 200) });
      shownUrl = "";
    }
  };

  const onSong = () => {
    const url = imageUrl(Spicetify.Player.data?.item?.metadata);
    if (!url) return void setTimeout(onSong, 1000); // player not ready yet
    show(url);
  };
  Spicetify.Player.addEventListener("songchange", onSong);
  onSong();

  // Spicy Lyrics' fullscreen view hides the whole app; stop the motion under it.
  setInterval(() => {
    bg.classList.toggle("sg-paused", !!document.getElementById("SpicyLyricsPage")?.classList.contains("Fullscreen"));
  }, 1500);
  note({ ev: "start" });
})();
