// Stored in the Somnation Admin file shared plugin data somnation/adminRenderer; run as new Function("return " + src)()(D).
// D = [{ id, name, group, url, chrome, active, crumb, tree, overlays? }] — trees from admin-walker.js.
async function ADMIN(D) {
const FONT = 'Noto Sans KR';
const STYLE_NAME = { '24/700': 'Admin/Display', '18/700': 'Admin/Title', '15/500': 'Admin/Subtitle', '14/400': 'Admin/Body', '14/500': 'Admin/Body Strong', '12/400': 'Admin/Caption', '12/500': 'Admin/Label', '24/600': 'Admin/Number' };
const WEIGHT = { 300: 'Light', 400: 'Regular', 500: 'Medium', 600: 'SemiBold', 700: 'Bold', 800: 'ExtraBold', 900: 'Black' };
const loaded = new Set();
async function font(style) { const k = FONT + style; if (loaded.has(k)) return style; try { await figma.loadFontAsync({ family: FONT, style }); loaded.add(k); return style; } catch (e) { if (style !== 'Regular') return font(style === 'SemiBold' ? 'Medium' : 'Bold'); throw e; } }
await font('Regular'); await font('Bold');
const styles = {}; for (const s of await figma.getLocalTextStylesAsync()) { styles[s.name] = s; await figma.loadFontAsync(s.fontName); }
const vars = {}; for (const v of await figma.variables.getLocalVariablesAsync('COLOR')) if (v.name.startsWith('color/')) vars[v.name] = v;
const N = (id) => figma.getNodeByIdAsync(id);
const SET = { button: await N('2:14'), badge: await N('2:25'), input: await N('2:30'), tab: await N('2:37') };
const SIDEBAR = await N('3:29'), TOPBAR = await N('3:63');
const variant = (set, props) => set.children.find(c => Object.entries(props).every(([k, v]) => c.variantProperties[k] === v));
const setProp = (inst, name, value) => { const key = Object.keys(inst.componentProperties).find(k => k.split('#')[0] === name); if (key) inst.setProperties({ [key]: value }); };
// "bg-page" → color/bg/page, "status-success-bg" → color/status/success-bg
const varOf = (tok) => { const i = tok.indexOf('-'); return i > 0 ? vars['color/' + tok.slice(0, i) + '/' + tok.slice(i + 1)] : null; };
function paintOf(tok) {
  if (!tok) return null;
  if (tok === 'grad') tok = 'accent-default';
  const v = varOf(tok);
  if (v) { const raw = Object.values(v.valuesByMode)[0]; const base = raw && typeof raw === 'object' && 'r' in raw ? { r: raw.r, g: raw.g, b: raw.b } : { r: 0, g: 0, b: 0 }; return figma.variables.setBoundVariableForPaint({ type: 'SOLID', color: base }, 'color', v); }
  const h = tok.replace('#', ''); const n = (i) => parseInt(h.slice(i, i + 2), 16) / 255;
  return { type: 'SOLID', color: { r: n(0), g: n(2), b: n(4) }, opacity: h.length === 8 ? n(6) : 1 };
}
const stats = { frames: 0, texts: 0, comps: 0 };
async function textNode([_, s, key, color, w]) {
  const t = figma.createText();
  const st = styles[STYLE_NAME[key]];
  if (st) await t.setTextStyleIdAsync(st.id);
  else { const [fs, fw] = key.split('/').map(Number); t.fontName = { family: FONT, style: await font(WEIGHT[Math.round(fw / 100) * 100] || 'Regular') }; t.fontSize = fs || 14; t.lineHeight = { unit: 'PERCENT', value: 145 }; }
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
  if (!sel && !area && h >= 32 && h <= 46) { const i = variant(SET.input, { State: 'Default' }).createInstance(); setProp(i, 'Placeholder', s || ' '); i.resize(Math.max(w, 40), h); if (!ph) { const tx = i.findOne(n => n.type === 'TEXT'); if (tx) tx.fills = [paintOf('text-primary')]; } stats.comps++; return i; }
  const f = figma.createFrame(); f.name = sel ? 'Select' : area ? 'Textarea' : 'Input'; f.layoutMode = 'HORIZONTAL'; f.counterAxisAlignItems = area ? 'MIN' : 'CENTER'; f.primaryAxisAlignItems = sel ? 'SPACE_BETWEEN' : 'MIN';
  f.paddingLeft = f.paddingRight = 12; f.paddingTop = f.paddingBottom = area ? 10 : 0; f.resize(Math.max(w, 20), Math.max(h, 20)); f.primaryAxisSizingMode = 'FIXED'; f.counterAxisSizingMode = 'FIXED';
  f.fills = [paintOf('bg-surface')]; f.strokes = [paintOf('border-strong')]; f.strokeWeight = 1; f.cornerRadius = 6;
  const t = await textNode(['t', s || ' ', '14/400', ph ? 'text-tertiary' : 'text-primary', w - 24]); f.appendChild(t); t.textAutoResize = 'HEIGHT'; t.layoutSizingHorizontal = 'FILL';
  if (sel) { const c = await textNode(['t', '▾', '12/400', 'text-tertiary', 10]); f.appendChild(c); c.textAutoResize = 'WIDTH_AND_HEIGHT'; }
  return f;
}
function checkNode([_, checked, radio]) {
  const f = figma.createFrame(); f.name = radio ? 'Radio' : 'Checkbox'; f.resize(16, 16); f.cornerRadius = radio ? 8 : 4;
  if (checked) f.fills = [paintOf('accent-default')]; else { f.fills = [paintOf('bg-surface')]; f.strokes = [paintOf('border-strong')]; f.strokeWeight = 1; }
  return f;
}
function mediaNode([_, w, h, r, color]) {
  const small = w <= 28 && h <= 28;
  const m = figma.createRectangle(); m.name = small ? 'Icon' : 'Image'; m.resize(Math.max(w, 1), Math.max(h, 1)); m.cornerRadius = Math.min(r || (small ? 4 : 6), Math.min(w, h) / 2);
  m.fills = [paintOf(small ? (color || 'text-tertiary') : 'bg-hover')]; if (small) m.opacity = 0.7;
  return m;
}
const onlyText = (o) => o.c && o.c.length === 1 && Array.isArray(o.c[0]) && o.c[0][0] === 't' ? o.c[0][1] : null;
function buttonStyle(o) {
  if (o.k !== 'btn' || !onlyText(o) || !o.h || o.h < 32 || o.h > 42 || o.r !== 6) return null;
  if (o.f === 'accent-default') return 'Primary';
  if (o.f === 'status-danger' || o.s === 'status-danger' || o.s === 'status-danger-text') return 'Danger';
  if (o.s === 'border-strong' || o.s === 'border-default') return 'Secondary';
  return null;
}
const TONE = { 'status-success-bg': 'Success', 'status-warning-bg': 'Warning', 'status-danger-bg': 'Danger', 'status-info-bg': 'Info', 'bg-hover': 'Neutral' };
function badgeTone(o) { return o.r >= 999 && o.h && o.h <= 24 && onlyText(o) && TONE[o.f] ? TONE[o.f] : null; }
const isActiveTab = (o) => o && !Array.isArray(o) && o.s === 'accent-default' && Array.isArray(o.b) && o.b[2] === 2 && o.b[0] === 0 && onlyText(o);
async function render(o) {
  if (Array.isArray(o)) {
    if (o[0] === 't') return await textNode(o);
    if (o[0] === 'i') return await inputNode(o);
    if (o[0] === 'c') return checkNode(o);
    if (o[0] === 'm') return mediaNode(o);
    return null;
  }
  const bs = buttonStyle(o);
  if (bs) { const b = variant(SET.button, { Style: bs, State: 'Default' }).createInstance(); setProp(b, 'Label', onlyText(o)); stats.comps++; return b; }
  const tone = badgeTone(o);
  if (tone) { const b = variant(SET.badge, { Tone: tone }).createInstance(); setProp(b, 'Label', onlyText(o)); stats.comps++; return b; }
  const f = figma.createFrame(); stats.frames++;
  f.name = o.k === 'btn' ? 'Button' : (o.f === 'bg-surface' && o.s) ? 'Card' : 'Frame';
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
  const tabRow = (o.c || []).some(isActiveTab);
  for (const c of o.c || []) {
    let n;
    if (tabRow && !Array.isArray(c) && onlyText(c)) { n = variant(SET.tab, { State: isActiveTab(c) ? 'Active' : 'Inactive' }).createInstance(); setProp(n, 'Label', onlyText(c)); stats.comps++; }
    else n = await render(c);
    if (!n) continue;
    if (n.type === 'TEXT') placeText(n, f); else f.appendChild(n);
  }
  if (f.layoutMode === 'HORIZONTAL' && f.layoutWrap !== 'WRAP' && f.children.length === 1 && f.children[0].type === 'TEXT' && f.cornerRadius > 0 && f.height <= 48) { const t = f.children[0]; t.textAutoResize = 'WIDTH_AND_HEIGHT'; if (t.width > f.width - f.paddingLeft - f.paddingRight + 1) f.primaryAxisSizingMode = 'AUTO'; }
  return f;
}
function setNav(sb, label) {
  for (const i of sb.findAll(n => n.type === 'INSTANCE' && n.name.startsWith('Nav/'))) { const on = i.name === 'Nav/' + label; try { i.setProperties({ State: on ? 'Active' : 'Default' }); } catch (e) {} }
}
async function sectionFor(page, name) {
  let s = page.children.find(n => n.type === 'SECTION' && n.name === name);
  if (!s) { s = figma.createSection(); s.name = name; page.appendChild(s); const bottom = Math.max(0, ...page.children.filter(n => n !== s).map(n => n.y + n.height)); s.x = 0; s.y = bottom + 240; s.resizeWithoutConstraints(1600, 1600); }
  return s;
}
let page = figma.root.children.find(p => p.name === 'Layouts');
if (!page) { page = figma.createPage(); page.name = 'Layouts'; }
await figma.setCurrentPageAsync(page);
const out = [];
for (const d of D) {
  const screen = figma.createFrame(); screen.name = `${d.id} ${d.name} — ${d.url}`; screen.clipsContent = true; screen.fills = [paintOf('bg-page')];
  const main = await render(d.tree); main.name = 'Main';
  if (d.chrome) {
    screen.layoutMode = 'HORIZONTAL'; screen.primaryAxisSizingMode = 'FIXED'; screen.counterAxisSizingMode = 'AUTO'; screen.resize(1440, 900);
    const sb = SIDEBAR.createInstance(); screen.appendChild(sb); sb.layoutSizingVertical = 'FILL'; setNav(sb, d.active);
    const colF = figma.createFrame(); colF.name = 'Column'; colF.layoutMode = 'VERTICAL'; colF.fills = []; screen.appendChild(colF); colF.layoutSizingHorizontal = 'FILL'; colF.primaryAxisSizingMode = 'AUTO';
    const tb = TOPBAR.createInstance(); colF.appendChild(tb); tb.layoutSizingHorizontal = 'FILL'; if (d.crumb) setProp(tb, 'Breadcrumb', d.crumb);
    colF.appendChild(main); main.layoutSizingHorizontal = 'FILL';
    colF.layoutSizingVertical = 'HUG'; screen.counterAxisSizingMode = 'FIXED'; screen.resize(1440, Math.max(900, Math.ceil(colF.height)));
  } else {
    screen.layoutMode = 'VERTICAL'; screen.counterAxisSizingMode = 'FIXED'; screen.resize(1440, 900); screen.primaryAxisSizingMode = 'AUTO';
    screen.appendChild(main); main.layoutSizingVertical = 'FILL';
    if (screen.height < 900) { screen.primaryAxisSizingMode = 'FIXED'; screen.resize(1440, 900); }
  }
  for (const o of d.overlays || []) { const f = await render(o.tree); f.name = 'Overlay'; screen.appendChild(f); f.layoutPositioning = 'ABSOLUTE'; f.x = o.x; f.y = o.y; }
  const sec = await sectionFor(page, d.group);
  const xs = sec.children.filter(n => n.type === 'FRAME').map(n => n.x + n.width); const x = xs.length ? Math.max(...xs) + 160 : 120;
  for (const [txt, y, key, color] of [[`${d.id} · ${d.name}`, 120, '24/700', 'text-primary'], [d.url, 160, '14/400', 'text-tertiary']]) { const t = await textNode(['t', txt, key, color, 10]); sec.appendChild(t); t.x = x; t.y = y; }
  sec.appendChild(screen); screen.x = x; screen.y = 230;
  sec.resizeWithoutConstraints(Math.max(sec.width, x + screen.width + 120), Math.max(sec.height, 230 + screen.height + 120));
  out.push({ id: d.id, node: screen.id, h: Math.round(screen.height) });
}
let y = 0; for (const s of page.children.filter(n => n.type === 'SECTION').sort((a, b) => a.y - b.y)) { s.x = 0; s.y = y; y += s.height + 240; }
return { out, stats };
}
