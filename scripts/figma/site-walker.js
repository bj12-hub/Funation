// Runs inside a site page. Returns a compact layout tree of the main column (or the donation panel with ?tab=donation) for site-renderer.js.
(() => {
  const TOKENS = ["bg-page","bg-subtle","surface","surface-raised","surface-strong","border","border-strong","text-primary","text-secondary","text-tertiary","text-on-accent","primary","primary-light","primary-soft","nav-active-bg","accent","info","success","success-text","success-soft","danger","danger-soft","danger-border","error-text","warning-text","chip-bg","input-bg","neutral-soft"];
  const probe = document.createElement("div");
  document.body.appendChild(probe);
  const norm = (v) => { probe.style.color = ""; probe.style.color = v; return getComputedStyle(probe).color; };
  const root = getComputedStyle(document.documentElement);
  const val = {};
  for (const t of TOKENS) val[t] = norm(root.getPropertyValue("--color-" + t).trim());
  probe.remove();
  const pick = (order) => { const m = {}; for (const t of order) if (val[t] && !(val[t] in m)) m[val[t]] = t; return m; };
  const FILL = pick(["bg-page","bg-subtle","surface","surface-raised","surface-strong","input-bg","chip-bg","primary-soft","nav-active-bg","success-soft","danger-soft","neutral-soft","primary","accent","info","success","danger","border","border-strong"]);
  const STROKE = pick(["border","border-strong","primary","primary-light","danger-border","danger","success","error-text","surface-strong"]);
  const TEXT = pick(["text-primary","text-secondary","text-tertiary","text-on-accent","primary-light","primary","success-text","error-text","warning-text","accent","info","success","danger"]);
  const hex = (c) => { const m = c.match(/rgba?\(([^)]+)\)/); if (!m) return null; const [r, g, b, a = "1"] = m[1].split(",").map((s) => s.trim()); if (Number(a) === 0) return null; const h = "#" + [r, g, b].map((x) => Number(x).toString(16).padStart(2, "0")).join(""); return Number(a) < 1 ? h + Math.round(Number(a) * 255).toString(16).padStart(2, "0") : h; };
  const col = (c, map) => { if (!c || c === "rgba(0, 0, 0, 0)" || c === "transparent") return null; return map[c] ?? hex(c); };
  const px = (v) => Math.round(parseFloat(v) || 0);
  const visible = (el, cs, r) => cs.display !== "none" && cs.visibility !== "hidden" && Number(cs.opacity) > 0.02 && r.width > 0.5 && r.height > 0.5;
  const isInlineOnly = (el) => [...el.childNodes].every((n) => n.nodeType === 3 || n.nodeType === 8 || (n.nodeType === 1 && ["inline", "contents"].includes(getComputedStyle(n).display) && !boxy(n) && n.children.length === 0 && !["IMG","SVG","svg","INPUT","SELECT","TEXTAREA","BUTTON"].includes(n.tagName)));
  const boxy = (el) => { const cs = getComputedStyle(el); return (cs.backgroundColor !== "rgba(0, 0, 0, 0)" && cs.backgroundColor !== "transparent") || cs.backgroundImage !== "none" || parseFloat(cs.borderTopWidth) + parseFloat(cs.borderBottomWidth) + parseFloat(cs.borderLeftWidth) + parseFloat(cs.borderRightWidth) > 0; };
  const txt = (s) => s.replace(/\s+/g, " ").trim().slice(0, 240);
  const textNode = (s, cs, w) => ["t", s, px(cs.fontSize) + "/" + cs.fontWeight, col(cs.color, TEXT) ?? "text-primary", Math.ceil(w)];
  const box = (cs, r) => {
    const o = {};
    const f = cs.backgroundImage.includes("gradient") ? "grad" : col(cs.backgroundColor, FILL); if (f) o.f = f;
    const bw = [cs.borderTopWidth, cs.borderRightWidth, cs.borderBottomWidth, cs.borderLeftWidth].map(px);
    if (bw.some((x) => x > 0)) { const sc = [cs.borderTopColor, cs.borderRightColor, cs.borderBottomColor, cs.borderLeftColor][bw.findIndex((x) => x > 0)]; const s = col(sc, STROKE); if (s) { o.s = s; o.b = bw.every((x) => x === bw[0]) ? bw[0] : bw; } }
    const rad = px(cs.borderTopLeftRadius); if (rad) o.r = Math.min(rad, 999);
    const p = [cs.paddingTop, cs.paddingRight, cs.paddingBottom, cs.paddingLeft].map(px); if (p.some((x) => x)) o.p = p;
    return o;
  };
  const MAX_KIDS = 14;
  function walk(el, depth) {
    const cs = getComputedStyle(el); const r = el.getBoundingClientRect();
    if (!visible(el, cs, r) || depth > 22) return null;
    const tag = el.tagName;
    if (tag === "SCRIPT" || tag === "STYLE" || tag === "NOSCRIPT") return null;
    if (tag === "FOOTER") return ["footer"];
    if (tag === "INPUT" && (el.type === "checkbox" || el.type === "radio")) return ["c", el.checked ? 1 : 0, el.type === "radio" ? 1 : 0];
    if (tag === "INPUT" && el.type === "range") return ["m", Math.round(r.width), 6, 3, "primary"];
    if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") {
      const v = tag === "SELECT" ? (el.options[el.selectedIndex]?.text ?? "") : el.value; const ph = !v; return ["i", txt(v || el.placeholder || ""), Math.round(r.width), Math.round(r.height), ph ? 1 : 0, tag === "SELECT" ? 1 : 0, tag === "TEXTAREA" ? 1 : 0];
    }
    if (["IMG", "VIDEO", "CANVAS", "IFRAME", "svg", "SVG", "PICTURE"].includes(tag)) return ["m", Math.round(r.width), Math.round(r.height), px(cs.borderTopLeftRadius), col(cs.color, TEXT)];
    const o = box(cs, r);
    o.w = Math.round(r.width);
    // Leaf text (possibly inside a box, e.g. chip or button)
    if (isInlineOnly(el)) {
      const s = txt(el.innerText || ""); if (!s && !o.f && !o.s) return null;
      const inner = r.width - (o.p ? o.p[1] + o.p[3] : 0) - (o.b ? (Array.isArray(o.b) ? o.b[1] + o.b[3] : o.b * 2) : 0);
      const t = s ? textNode(s, cs, Math.max(inner, 1)) : null;
      if (!o.f && !o.s && !o.p) return t;
      o.d = "H"; o.a = "C"; o.j = cs.textAlign === "center" || cs.justifyContent === "center" ? "C" : undefined; o.c = t ? [t] : []; if (tag === "BUTTON" || (tag === "A" && (o.f || o.s))) o.k = "btn";
      if (Math.round(r.height) > 0 && (o.f || o.s)) o.h = Math.round(r.height);
      return o;
    }
    const disp = cs.display;
    const kids = [];
    for (const n of el.childNodes) {
      if (n.nodeType === 3) { const s = txt(n.textContent || ""); if (s) { const range = document.createRange(); range.selectNodeContents(n); const rr = range.getBoundingClientRect(); kids.push(textNode(s, cs, rr.width || 10)); } continue; }
      if (n.nodeType !== 1) continue;
      const k = walk(n, depth + 1); if (k) kids.push(k);
      if (kids.length >= 40) break;
    }
    if (!kids.length && !o.f && !o.s) return null;
    { const els = [...el.children]; const cls = els[0] ? els[0].className : null; const same = els.filter((c) => c.className === cls).length; if (kids.length > 6 && cls && same >= els.length * 0.7) kids.length = 6; }
    if (disp.includes("flex")) { o.d = cs.flexDirection.startsWith("column") ? "V" : (cs.flexWrap === "wrap" ? "W" : "H"); o.g = px(o.d === "V" ? cs.rowGap : cs.columnGap); if (o.d === "W") o.rg = px(cs.rowGap); }
    else if (disp.includes("grid")) { const ncols = cs.gridTemplateColumns.split(" ").filter(Boolean).length; o.d = ncols > 1 ? "W" : "V"; o.g = px(ncols > 1 ? cs.columnGap : cs.rowGap); o.rg = px(cs.rowGap); }
    else if (disp === "table-row") { o.d = "H"; o.g = 0; }
    else { o.d = "V"; const els = [...el.children].filter((c) => { const cr = c.getBoundingClientRect(); return cr.height > 0; }); if (els.length > 1) { const a = els[0].getBoundingClientRect(), b = els[1].getBoundingClientRect(); o.g = Math.max(0, Math.round(b.top - a.bottom)); } }
    if (o.d === "H" || o.d === "W") { const ai = cs.alignItems; o.a = ai === "center" ? "C" : ai.includes("end") ? "E" : ai === "baseline" ? "C" : "S"; }
    else { const ai = cs.alignItems; o.a = ai === "center" ? "C" : ai.includes("end") ? "E" : "S"; }
    const jc = cs.justifyContent; if (jc === "space-between") o.j = "B"; else if (jc === "center") o.j = "C"; else if (jc.includes("end")) o.j = "E";
    if ((cs.overflowY === "auto" || cs.overflowY === "hidden" || cs.overflowY === "scroll") && el.scrollHeight > el.clientHeight + 4) { o.h = Math.round(r.height); o.clip = 1; }
    if (tag === "BUTTON") o.k = "btn";
    o.c = kids;
    // Collapse plain single-child wrappers.
    if (!o.f && !o.s && !o.p && !o.h && kids.length === 1 && !Array.isArray(kids[0]) && !o.k) return kids[0];
    if (!o.f && !o.s && !o.p && !o.h && kids.length === 1 && Array.isArray(kids[0]) && kids[0][0] === "t") return kids[0];
    return o;
  }
  const header = document.querySelector('header[class*="GlobalHeader_header"]');
  const side = document.querySelector('aside[class*="SideNav_sidebar"]');
  const panel = location.search.includes("tab=donation") ? document.querySelector('[class*="room_donation"]') : null;
  const main = panel || document.querySelector('[class*="AppShell_main"]') || document.querySelector("main") || document.body;
  const active = side ? (side.querySelector('[aria-current="page"]')?.innerText.replace(/s+/g, " ").trim() ?? null) : null;
  const tops = [...document.querySelectorAll("body *")].filter((el) => { const cs = getComputedStyle(el); if (cs.position !== "fixed") return false; const r = el.getBoundingClientRect(); if (r.width < 200 || r.height < 120) return false; if ((side && side.contains(el)) || el.closest("#site-side-menu")) return false; return !el.closest("header"); });
  const pops = header ? [...header.querySelectorAll("*")].filter((el) => { const cs = getComputedStyle(el); const r = el.getBoundingClientRect(); return (cs.position === "absolute" || cs.position === "fixed") && r.width >= 200 && r.height >= 120; }) : [];
  tops.push(...pops);
  const overlays = tops.filter((el) => !tops.some((o) => o !== el && o.contains(el))).map((el) => { const r = el.getBoundingClientRect(); return { x: Math.round(r.x), y: Math.round(r.y), tree: walk(el, 0) }; }).filter((o) => o.tree);
  const headerKind = header ? (header.querySelector('[class*="rightGuest"]') ? "guest" : "signed") : null;
  const sideOpen = !!side && side.getBoundingClientRect().width > 100;
  return JSON.stringify({ panel: !!panel, active, headerKind: panel ? null : headerKind, sideOpen: panel ? false : sideOpen, w: Math.round(main.getBoundingClientRect().width), tree: walk(main, 0), overlays });
})()
