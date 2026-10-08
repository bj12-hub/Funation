// Stored in the file shared plugin data somnation/siteRenderer; run as new Function("return " + src)()(D).
// D = [{ id, name, group, url, active, headerKind, sideOpen, width, theme?, overlays?, tree }] — trees from site-walker.js.
async function SITE(D) {
const VAR = {"bg-page":"43:6","bg-subtle":"43:7","surface":"43:8","surface-raised":"43:9","surface-strong":"43:10","border":"43:11","border-strong":"43:12","text-primary":"43:13","text-secondary":"43:14","text-tertiary":"43:15","text-on-accent":"43:16","primary":"43:17","primary-light":"43:18","primary-soft":"43:19","nav-active-bg":"43:20","accent":"43:21","info":"43:22","success":"43:23","success-text":"43:24","success-soft":"43:25","danger":"43:26","danger-soft":"43:27","danger-border":"43:28","error-text":"43:29","warning-text":"43:30","chip-bg":"43:31","input-bg":"43:32","neutral-soft":"43:33"};
const STYLE = {"24/900":"S:b306536ebd729e2c7a166c02c55dc4251d67e363,","18/800":"S:37815b49554e6eb31949895519ee75a9641fcea0,","15/500":"S:3036922b4772f1d899484399339bd4788225bedc,","14/400":"S:36ebdd0a63cf034b9ece3632b0670a371affefee,","14/600":"S:8975b71cc71b537584117ddf26d3127f48da4e6f,","13/400":"S:d4991e9160897d18110dcbbae9a0a2cc2d569ba9,","13/600":"S:ebdf288c77a1c05a0babb1688df9abe3a72dc161,","12/400":"S:2190a91a4cf09e8a37a8720221f8b543f59f0cfb,","11/700":"S:5b3b752d2a8dad827cf41d3d5d6bca9b329a5f12,","14/500":"S:1eb45490b3d794668a87cc3c77038d6c7c8c7f5a,","18/400":"S:af5d01dffac00fed6c35fbb282d5bd99a78eab56,","18/700":"S:3eecbba37fc597764092c6da4b72a5fa737b7fd3,"};
const WEIGHT = { 100: 'Thin', 200: 'ExtraLight', 300: 'Light', 400: 'Regular', 500: 'Medium', 600: 'SemiBold', 700: 'Bold', 800: 'ExtraBold', 900: 'Black' };
for (const w of Object.values(WEIGHT)) await figma.loadFontAsync({ family: 'Gothic A1', style: w });
const vars = {}; for (const [k, id] of Object.entries(VAR)) vars[k] = await figma.variables.getVariableByIdAsync('VariableID:' + id);
const N = (id) => figma.getNodeByIdAsync(id);
const SET = { button: await N('45:37'), input: await N('45:44'), checkbox: await N('45:58') };
const C = { select: await N('45:45') };
const variant = (set, props) => set.children.find(c => Object.entries(props).every(([k, v]) => c.variantProperties[k] === v));
const setProp = (inst, name, value) => { const key = Object.keys(inst.componentProperties).find(k => k.split('#')[0] === name); if (key) inst.setProperties({ [key]: value }); };
const GRAD = { type: 'GRADIENT_LINEAR', gradientTransform: [[1, 0, 0], [0, 1, 0]], gradientStops: [{ position: 0, color: { r: 0.545, g: 0.361, b: 0.965, a: 1 } }, { position: 1, color: { r: 0.388, g: 0.4, b: 0.945, a: 1 } }] };
function paintOf(tok) {
  if (!tok) return null;
  if (tok === 'grad') return GRAD;
  if (vars[tok]) { const raw = Object.values(vars[tok].valuesByMode)[0]; const base = raw && typeof raw === 'object' && 'r' in raw ? { r: raw.r, g: raw.g, b: raw.b } : { r: 0, g: 0, b: 0 }; const p = figma.variables.setBoundVariableForPaint({ type: 'SOLID', color: base }, 'color', vars[tok]); return p; }
  const h = tok.replace('#', ''); const n = (i) => parseInt(h.slice(i, i + 2), 16) / 255;
  return { type: 'SOLID', color: { r: n(0), g: n(2), b: n(4) }, opacity: h.length === 8 ? n(6) : 1 };
}
let stats = { frames: 0, texts: 0, comps: 0 };
async function textNode([_, s, key, color, w]) {
  const t = figma.createText();
  if (STYLE[key]) await t.setTextStyleIdAsync(STYLE[key]);
  else { const [fs, fw] = key.split('/').map(Number); t.fontName = { family: 'Gothic A1', style: WEIGHT[Math.round(fw / 100) * 100] || 'Regular' }; t.fontSize = fs || 14; t.lineHeight = { unit: 'PERCENT', value: 145 }; }
  t.characters = s; const p = paintOf(color || 'text-primary'); if (p) t.fills = [p];
  t.name = s.slice(0, 32); stats.texts++;
  t.setSharedPluginData('somnation', 'w', String(w || 10)); return t;
}
function placeText(t, parent) {
  parent.appendChild(t);
  const w = Number(t.getSharedPluginData('somnation', 'w')) || 10;
  const inner = parent.width - (parent.paddingLeft || 0) - (parent.paddingRight || 0);
  if (w > 360 || (parent.layoutMode === 'VERTICAL' || parent.children.length === 1) && w >= inner - 3) { t.textAutoResize = 'HEIGHT'; t.layoutSizingHorizontal = 'FIXED'; t.resize(Math.max(1, Math.min(Math.ceil(w) + 2, inner)), t.height); }
  else t.textAutoResize = 'WIDTH_AND_HEIGHT';
}
async function inputNode([_, s, w, h, ph, sel, area]) {
  if (sel) { const i = C.select.createInstance(); setProp(i, 'Value', s || '선택'); i.resize(Math.max(w, 60), Math.max(h, 30)); stats.comps++; return i; }
  if (!area && h >= 34 && h <= 46) { const i = variant(SET.input, { State: 'Default' }).createInstance(); setProp(i, 'Placeholder', s || ' '); i.resize(Math.max(w, 40), h); if (!ph) { const tx = i.findOne(n => n.type === 'TEXT'); if (tx) tx.fills = [paintOf('text-primary')]; } stats.comps++; return i; }
  const f = figma.createFrame(); f.name = area ? 'Textarea' : 'Input'; f.layoutMode = 'HORIZONTAL'; f.counterAxisAlignItems = area ? 'MIN' : 'CENTER'; f.paddingLeft = f.paddingRight = 12; f.paddingTop = f.paddingBottom = area ? 10 : 0; f.resize(Math.max(w, 20), Math.max(h, 20)); f.primaryAxisSizingMode = 'FIXED'; f.counterAxisSizingMode = 'FIXED';
  f.fills = [paintOf('input-bg')]; f.strokes = [paintOf('border-strong')]; f.strokeWeight = 1; f.cornerRadius = 8;
  const t = await textNode(['t', s || ' ', '14/400', ph ? 'text-tertiary' : 'text-primary', w - 24]); f.appendChild(t); t.textAutoResize = 'HEIGHT'; t.layoutSizingHorizontal = 'FILL';
  return f;
}
function checkNode([_, checked, radio]) {
  const f = figma.createFrame(); f.name = radio ? 'Radio' : 'Checkbox'; f.resize(16, 16); f.cornerRadius = radio ? 8 : 4; f.layoutMode = 'HORIZONTAL'; f.primaryAxisSizingMode = 'FIXED'; f.counterAxisSizingMode = 'FIXED'; f.primaryAxisAlignItems = 'CENTER'; f.counterAxisAlignItems = 'CENTER';
  if (checked) f.fills = [paintOf('primary')]; else { f.fills = [paintOf('input-bg')]; f.strokes = [paintOf('border-strong')]; f.strokeWeight = 1; }
  return f;
}
function mediaNode([_, w, h, r, color]) {
  const small = w <= 28 && h <= 28;
  const m = figma.createRectangle(); m.name = small ? 'Icon' : 'Image'; m.resize(Math.max(w, 1), Math.max(h, 1)); m.cornerRadius = Math.min(r || (small ? 4 : 8), Math.min(w, h) / 2);
  m.fills = [small ? (paintOf(color || 'text-secondary')) : paintOf('surface-strong')]; if (small) m.opacity = 0.7;
  return m;
}
function buttonVariant(o) {
  const t = o.c && o.c.length === 1 && Array.isArray(o.c[0]) && o.c[0][0] === 't' ? o.c[0][1] : null;
  if (!t || !o.h) return null;
  if (o.h >= 34 && o.h <= 38 && o.r === 8) { const style = o.f === 'grad' ? 'Primary' : o.s === 'danger-border' ? 'Danger' : (o.s === 'border-strong' && !o.f) ? 'Ghost' : null; if (style) return [style, 'Default', t]; }
  if (o.h >= 24 && o.h <= 28 && o.r === 6 && !o.f) { const style = o.s === 'danger-border' ? 'Danger' : o.s === 'border-strong' ? 'Ghost' : null; if (style) return [style, 'Mini', t]; }
  return null;
}
function hugLabel(f) {
  if (f.layoutMode !== 'HORIZONTAL' || f.layoutWrap === 'WRAP' || f.children.length !== 1 || f.children[0].type !== 'TEXT') return;
  if (!(f.name === 'Button' || (f.height <= 48 && f.width <= 240 && f.cornerRadius > 0))) return;
  const t = f.children[0]; const inner = f.width - f.paddingLeft - f.paddingRight; t.textAutoResize = 'WIDTH_AND_HEIGHT'; if (t.width > inner + 1) f.primaryAxisSizingMode = 'AUTO';
}
async function render(o, depth = 0) {
  if (Array.isArray(o)) {
    if (o[0] === 't') return await textNode(o);
    if (o[0] === 'i') return await inputNode(o);
    if (o[0] === 'c') return checkNode(o);
    if (o[0] === 'm') return mediaNode(o);
    if (o[0] === 'footer') { const fc = await N(cfg().footer); return fc ? fc.createInstance() : null; }
    return null;
  }
  const bv = o.k === 'btn' ? buttonVariant(o) : null;
  if (bv) { const b = variant(SET.button, { Style: bv[0], Size: bv[1], State: 'Default' }).createInstance(); setProp(b, 'Label', bv[2]); stats.comps++; return b; }
  const f = figma.createFrame(); stats.frames++;
  f.name = o.k === 'btn' ? 'Button' : (o.f && o.s && (o.r || 0) >= 12) ? 'Card' : 'Frame';
  f.layoutMode = o.d === 'V' ? 'VERTICAL' : 'HORIZONTAL'; if (o.d === 'W') { f.layoutWrap = 'WRAP'; f.counterAxisSpacing = o.rg || 0; }
  f.itemSpacing = o.g || 0;
  if (o.p) { [f.paddingTop, f.paddingRight, f.paddingBottom, f.paddingLeft] = o.p; }
  f.primaryAxisAlignItems = o.j === 'B' ? 'SPACE_BETWEEN' : o.j === 'C' ? 'CENTER' : o.j === 'E' ? 'MAX' : 'MIN';
  f.counterAxisAlignItems = o.a === 'C' ? 'CENTER' : o.a === 'E' ? 'MAX' : 'MIN';
  f.fills = o.f ? [paintOf(o.f)] : [];
  if (o.s) { f.strokes = [paintOf(o.s)]; if (Array.isArray(o.b)) { [f.strokeTopWeight, f.strokeRightWeight, f.strokeBottomWeight, f.strokeLeftWeight] = o.b; } else f.strokeWeight = o.b || 1; }
  if (o.r) f.cornerRadius = o.r;
  f.clipsContent = !!o.clip;
  f.resize(Math.max(o.w || 10, 1), Math.max(o.h || 10, 1));
  if (f.layoutMode === 'VERTICAL') { f.counterAxisSizingMode = 'FIXED'; f.primaryAxisSizingMode = o.h ? 'FIXED' : 'AUTO'; }
  else { f.primaryAxisSizingMode = 'FIXED'; f.counterAxisSizingMode = o.h ? 'FIXED' : 'AUTO'; }
  for (const c of o.c || []) {
    const n = await render(c, depth + 1); if (!n) continue;
    if (n.type === 'TEXT') placeText(n, f);
    else f.appendChild(n);
  }
  hugLabel(f);
  return f;
}
async function sectionFor(page, name) {
  let s = page.children.find(n => n.type === 'SECTION' && n.name === name);
  if (!s) { s = figma.createSection(); s.name = name; page.appendChild(s); const bottom = Math.max(0, ...page.children.filter(n => n !== s).map(n => n.y + n.height)); s.x = 0; s.y = bottom + 240; s.resizeWithoutConstraints(1600, 1600); }
  return s;
}
const colorCol = (await figma.variables.getLocalVariableCollectionsAsync()).find(c => c.name === 'Site Color');
const LOGO = { type: 'GRADIENT_LINEAR', gradientTransform: [[1, 0, 0], [0, 1, 0]], gradientStops: [{ position: 0, color: { r: 0.545, g: 0.361, b: 0.965, a: 1 } }, { position: 1, color: { r: 0.925, g: 0.282, b: 0.6, a: 1 } }] };
function fixLogo(root) { for (const t of root.findAll(n => n.type === 'TEXT' && n.characters === 'Somnation')) { const p = t.parent; if (p && p.fills && p.fills[0] && p.fills[0].type === 'GRADIENT_LINEAR') { p.fills = []; t.fills = [LOGO]; } } }
function setNavActive(side, label, on) {
  const t = side.findOne(n => n.type === 'TEXT' && n.characters === label && n.parent && n.parent.paddingLeft === 24); if (!t) return false;
  const item = t.parent; item.fills = on ? [paintOf('nav-active-bg')] : [];
  const icon = item.children.find(c => c.type === 'RECTANGLE'); if (icon) icon.fills = [paintOf(on ? 'accent' : 'text-secondary')];
  t.fills = [paintOf(on ? 'text-primary' : 'text-secondary')]; t.fontName = { family: 'Gothic A1', style: on ? 'SemiBold' : 'Medium' };
  return true;
}
const cfg = () => JSON.parse(figma.root.getSharedPluginData('somnation', 'siteComponents') || '{}');
if (D.chrome) {
  const page = await N('43:3'); await figma.setCurrentPageAsync(page);
  const out = {}; let y = Math.max(...page.children.map(n => n.y + n.height)) + 120;
  const NAMES = { signed: 'Site Header', guest: 'Site Header (Guest)', side: 'Site SideNav', footer: 'Site Footer' };
  for (const [key, tree] of Object.entries(D.chrome)) { const name = NAMES[key];
    const f = await render(tree); page.appendChild(f); fixLogo(f);
    if (key === 'side') setNavActive(f, '홈', false);
    const c = figma.createComponentFromNode(f); c.name = name; c.x = 0; c.y = y; y += c.height + 64;
    c.description = key === 'side' ? 'Site side menu (components/layout/SideNav). Pages highlight their item with nav-active-bg.' : 'Site global header (components/layout/GlobalHeader).';
    out[key] = c.id;
  }
  figma.root.setSharedPluginData('somnation', 'siteComponents', JSON.stringify({ ...cfg(), ...out }));
  return out;
}
const SC = cfg();
const H = { signed: await N(SC.signed), guest: await N(SC.guest) }; const SIDE = await N(SC.side);
let page = figma.root.children.find(p => p.name === '10 레이아웃 · 사이트');
if (!page) { page = figma.createPage(); page.name = '10 레이아웃 · 사이트'; page.backgrounds = [{ type: 'SOLID', color: { r: 0.03, g: 0.03, b: 0.067 } }]; }
await figma.setCurrentPageAsync(page);
const out = [];
for (const d of D) {
  const screen = figma.createFrame(); screen.name = `${d.id} ${d.name} — ${d.url}`; screen.layoutMode = 'VERTICAL'; screen.counterAxisSizingMode = 'FIXED'; screen.resize(d.width || 1440, 100); screen.primaryAxisSizingMode = 'AUTO'; screen.clipsContent = true;
  screen.fills = d.overlay ? [{ type: 'SOLID', color: { r: 0.16, g: 0.17, b: 0.2 } }] : [paintOf('bg-page')];
  if (d.theme === 'light' && colorCol) screen.setExplicitVariableModeForCollection(colorCol, colorCol.modes.find(m => m.name === 'Light').modeId);
  if (d.headerKind && H[d.headerKind]) screen.appendChild(H[d.headerKind].createInstance());
  const main = await render(d.tree); main.name = 'Main';
  if (d.sideOpen) {
    const body = figma.createFrame(); body.name = 'Body'; body.layoutMode = 'HORIZONTAL'; body.fills = []; screen.appendChild(body); body.layoutSizingHorizontal = 'FILL'; body.counterAxisSizingMode = 'AUTO';
    const sb = SIDE.createInstance(); body.appendChild(sb); if (d.active) setNavActive(sb, d.active, true);
    body.appendChild(main);
  } else { screen.appendChild(main); if (d.headerKind) main.layoutAlign = 'CENTER'; }
  for (const o of d.overlays || []) { const f = await render(o.tree); f.name = 'Overlay'; screen.appendChild(f); f.layoutPositioning = 'ABSOLUTE'; f.x = o.x; f.y = o.y; }
  const sec = await sectionFor(page, d.group);
  const xs = sec.children.filter(n => n.type === 'FRAME').map(n => n.x + n.width); const x = xs.length ? Math.max(...xs) + 160 : 120;
  for (const [txt, y, size, color] of [[`${d.id} · ${d.name}`, 120, 32, 'text-primary'], [d.url, 166, 18, 'text-tertiary']]) { const t = figma.createText(); t.fontName = { family: 'Gothic A1', style: size > 20 ? 'Bold' : 'Regular' }; t.fontSize = size; t.characters = txt; t.fills = [paintOf(color)]; sec.appendChild(t); t.x = x; t.y = y; }
  sec.appendChild(screen); screen.x = x; screen.y = 230;
  sec.resizeWithoutConstraints(Math.max(sec.width, x + screen.width + 120), Math.max(sec.height, 230 + screen.height + 120));
  out.push({ id: d.id, node: screen.id, h: Math.round(screen.height) });
}
let y = 0; for (const s of page.children.filter(n => n.type === 'SECTION').sort((a, b) => a.y - b.y)) { s.x = 0; s.y = y; y += s.height + 240; }
return { out, stats };
}
