// Audits src/css selectors for style-recalc cost: rightmost compounds that match
// broadly (no class/id), :has() usage, and rules not scoped to Spicy's own DOM.
import { readFileSync, readdirSync } from "fs";
import postcss from "postcss";
import nesting from "postcss-nesting";
import parser from "postcss-selector-parser";

const dir = "src/css";
const files = readdirSync(dir).filter((f) => f.endsWith(".css") && !f.includes("backup"));
const SPICY = /#SpicyLyrics|\.Spicy|\.spicy|\.sl-|sl-generic|\.SL|#SL|\.Exp_|\.LyricsContent|\.ContentBox|\.NowBar|spicy-|Spicy/;

const stats = { rules: 0, selectors: 0, has: 0, broadRight: 0, unscoped: 0, unscopedBroad: 0, unscopedHas: 0 };
const examples = { unscopedBroad: [], unscopedHas: [], broadRight: [] };
const perFile = {};

for (const f of files) {
  const css = readFileSync(`${dir}/${f}`, "utf8");
  let root;
  try { root = postcss([nesting]).process(css, { from: f }).root; } catch (e) { console.log("parse fail", f, e.message); continue; }
  perFile[f] = { sel: 0, broad: 0, has: 0, unscoped: 0 };
  root.walkRules((rule) => {
    if (rule.parent?.type === "atrule" && /keyframes/.test(rule.parent.name)) return;
    stats.rules++;
    for (const sel of rule.selectors) {
      stats.selectors++; perFile[f].sel++;
      let broad = false;
      try {
        parser((s) => {
          s.each((complex) => {
            // rightmost compound
            const nodes = complex.nodes;
            let i = nodes.length - 1;
            const comp = [];
            while (i >= 0 && nodes[i].type !== "combinator") comp.unshift(nodes[i--]);
            const hasClassOrId = comp.some((n) => n.type === "class" || n.type === "id");
            if (!hasClassOrId) broad = true;
          });
        }).processSync(sel);
      } catch { /* odd selector */ }
      const has = sel.includes(":has(");
      const scoped = SPICY.test(sel);
      if (has) { stats.has++; perFile[f].has++; }
      if (broad) { stats.broadRight++; perFile[f].broad++; if (examples.broadRight.length < 0) examples.broadRight.push(sel); }
      if (!scoped) {
        stats.unscoped++; perFile[f].unscoped++;
        if (broad) { stats.unscopedBroad++; if (examples.unscopedBroad.length < 25) examples.unscopedBroad.push(`${f}: ${sel}`); }
        if (has) { stats.unscopedHas++; if (examples.unscopedHas.length < 25) examples.unscopedHas.push(`${f}: ${sel}`); }
      }
    }
  });
}
console.log(stats);
console.log("per file:", perFile);
console.log("\nUNSCOPED + broad rightmost (checked against many Spotify elements):");
examples.unscopedBroad.forEach((s) => console.log("  " + s.replace(/\s+/g, " ").slice(0, 160)));
console.log("\nUNSCOPED :has():");
examples.unscopedHas.forEach((s) => console.log("  " + s.replace(/\s+/g, " ").slice(0, 160)));
