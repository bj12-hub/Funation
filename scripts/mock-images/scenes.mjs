// Original illustrations for the mock data (no photos, no third-party art).
// Every function returns an SVG string; render.mjs turns them into the PNG/JPG files under apps/web/public/mock.

/** mulberry32 with a hashed seed, so neighbouring seeds look different. */
export function rng(seed) {
  let s = Math.imul((seed >>> 0) ^ 0x9e3779b9, 0x85ebca6b) >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const SKIN = ["#f6d3b8", "#eec1a0", "#e0a982", "#c98d66", "#f3cdb1", "#fbe0cc"];
const HAIR = ["#2b2233", "#4a3426", "#7a4b2e", "#c9a26b", "#e7d3a8", "#ff8fb7", "#9b87f5", "#5fb4ff", "#1f1f2b", "#d9604c"];
const BG = [
  ["#8b5cf6", "#ec4899"],
  ["#6366f1", "#22d3ee"],
  ["#f59e0b", "#ef4444"],
  ["#10b981", "#3b82f6"],
  ["#ec4899", "#f97316"],
  ["#0ea5e9", "#8b5cf6"],
  ["#a855f7", "#6366f1"],
  ["#14b8a6", "#84cc16"]
];

const esc = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;");
const svg = (w, h, body, defs = "") =>
  `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}"><defs>${defs}</defs>${body}</svg>`;
const lin = (id, a, b, x2 = 1, y2 = 1) => `<linearGradient id="${id}" x1="0" y1="0" x2="${x2}" y2="${y2}"><stop offset="0" stop-color="${a}"/><stop offset="1" stop-color="${b}"/></linearGradient>`;
const rad = (id, a, b) => `<radialGradient id="${id}" cx="0.5" cy="0.4" r="0.7"><stop offset="0" stop-color="${a}"/><stop offset="1" stop-color="${b}"/></radialGradient>`;

/** A friendly bust (head + shoulders) centered at cx, with the head top at y and the given head radius. */
export function person(cx, y, r, seed, opts = {}) {
  const R = rng(seed);
  const skin = opts.skin ?? SKIN[Math.floor(R() * SKIN.length)];
  const hair = opts.hair ?? HAIR[Math.floor(R() * HAIR.length)];
  const shirt = opts.shirt ?? BG[Math.floor(R() * BG.length)][Math.floor(R() * 2)];
  const style = opts.style ?? Math.floor(R() * 5);
  const cy = y + r;
  const eyeY = cy + r * 0.08;
  const eyeDx = r * 0.36;
  const eye = opts.anime
    ? `<ellipse cx="${cx - eyeDx}" cy="${eyeY}" rx="${r * 0.14}" ry="${r * 0.2}" fill="#2b2233"/><ellipse cx="${cx + eyeDx}" cy="${eyeY}" rx="${r * 0.14}" ry="${r * 0.2}" fill="#2b2233"/><circle cx="${cx - eyeDx + r * 0.05}" cy="${eyeY - r * 0.07}" r="${r * 0.05}" fill="#fff"/><circle cx="${cx + eyeDx + r * 0.05}" cy="${eyeY - r * 0.07}" r="${r * 0.05}" fill="#fff"/>`
    : `<circle cx="${cx - eyeDx}" cy="${eyeY}" r="${r * 0.08}" fill="#2b2233"/><circle cx="${cx + eyeDx}" cy="${eyeY}" r="${r * 0.08}" fill="#2b2233"/>`;
  const mouth = opts.mouth === "open"
    ? `<ellipse cx="${cx}" cy="${cy + r * 0.45}" rx="${r * 0.16}" ry="${r * 0.12}" fill="#9f3b4b"/>`
    : `<path d="M${cx - r * 0.22} ${cy + r * 0.38} Q${cx} ${cy + r * 0.58} ${cx + r * 0.22} ${cy + r * 0.38}" stroke="#9f3b4b" stroke-width="${Math.max(1.5, r * 0.07)}" fill="none" stroke-linecap="round"/>`;
  const blush = `<circle cx="${cx - r * 0.55}" cy="${cy + r * 0.3}" r="${r * 0.13}" fill="#ff8fa3" opacity="0.45"/><circle cx="${cx + r * 0.55}" cy="${cy + r * 0.3}" r="${r * 0.13}" fill="#ff8fa3" opacity="0.45"/>`;
  const back = [
    `<path d="M${cx - r * 1.05} ${cy + r * 0.2} Q${cx - r * 1.15} ${cy - r * 1.2} ${cx} ${cy - r * 1.12} Q${cx + r * 1.15} ${cy - r * 1.2} ${cx + r * 1.05} ${cy + r * 0.2} L${cx + r * 1.05} ${cy + r * 1.1} L${cx - r * 1.05} ${cy + r * 1.1} Z" fill="${hair}"/>`,
    "",
    `<path d="M${cx - r * 1.05} ${cy} Q${cx - r * 1.2} ${cy + r * 1.6} ${cx - r * 0.6} ${cy + r * 1.9} L${cx + r * 0.6} ${cy + r * 1.9} Q${cx + r * 1.2} ${cy + r * 1.6} ${cx + r * 1.05} ${cy} Z" fill="${hair}"/>`,
    `<circle cx="${cx + r * 0.95}" cy="${cy - r * 0.7}" r="${r * 0.45}" fill="${hair}"/>`,
    ""
  ][style];
  const front = [
    `<path d="M${cx - r * 1.0} ${cy - r * 0.05} Q${cx - r * 0.7} ${cy - r * 1.25} ${cx + r * 0.2} ${cy - r * 1.05} Q${cx + r * 1.1} ${cy - r * 0.9} ${cx + r * 1.0} ${cy - r * 0.05} Q${cx + r * 0.4} ${cy - r * 0.6} ${cx - r * 1.0} ${cy - r * 0.05} Z" fill="${hair}"/>`,
    `<path d="M${cx - r * 1.02} ${cy - r * 0.15} Q${cx} ${cy - r * 1.55} ${cx + r * 1.02} ${cy - r * 0.15} Q${cx + r * 0.3} ${cy - r * 0.75} ${cx - r * 1.02} ${cy - r * 0.15} Z" fill="${hair}"/>`,
    `<path d="M${cx - r * 1.02} ${cy - r * 0.1} Q${cx - r * 0.2} ${cy - r * 1.5} ${cx + r * 1.02} ${cy - r * 0.1} L${cx + r * 0.6} ${cy - r * 0.55} L${cx + r * 0.1} ${cy - r * 0.3} L${cx - r * 0.3} ${cy - r * 0.6} Z" fill="${hair}"/>`,
    `<path d="M${cx - r * 1.0} ${cy - r * 0.1} Q${cx} ${cy - r * 1.45} ${cx + r * 1.0} ${cy - r * 0.1} Q${cx} ${cy - r * 0.55} ${cx - r * 1.0} ${cy - r * 0.1} Z" fill="${hair}"/>`,
    `<path d="M${cx - r * 1.08} ${cy - r * 0.2} Q${cx} ${cy - r * 1.35} ${cx + r * 1.08} ${cy - r * 0.2} L${cx + r * 1.2} ${cy - r * 0.05} L${cx - r * 1.2} ${cy - r * 0.05} Z" fill="${shirt}"/><rect x="${cx - r * 0.2}" y="${cy - r * 1.3}" width="${r * 0.4}" height="${r * 0.2}" rx="${r * 0.1}" fill="${shirt}"/>`
  ][style];
  const ears = opts.ears === "bunny"
    ? `<ellipse cx="${cx - r * 0.5}" cy="${cy - r * 1.55}" rx="${r * 0.22}" ry="${r * 0.6}" fill="#fff"/><ellipse cx="${cx + r * 0.5}" cy="${cy - r * 1.55}" rx="${r * 0.22}" ry="${r * 0.6}" fill="#fff"/><ellipse cx="${cx - r * 0.5}" cy="${cy - r * 1.5}" rx="${r * 0.1}" ry="${r * 0.42}" fill="#ffc2d6"/><ellipse cx="${cx + r * 0.5}" cy="${cy - r * 1.5}" rx="${r * 0.1}" ry="${r * 0.42}" fill="#ffc2d6"/>`
    : "";
  const headset = opts.headset
    ? `<path d="M${cx - r * 1.08} ${cy} Q${cx} ${cy - r * 1.6} ${cx + r * 1.08} ${cy}" stroke="#1f1f2b" stroke-width="${r * 0.16}" fill="none"/><rect x="${cx - r * 1.25}" y="${cy - r * 0.2}" width="${r * 0.32}" height="${r * 0.6}" rx="${r * 0.12}" fill="#1f1f2b"/><rect x="${cx + r * 0.93}" y="${cy - r * 0.2}" width="${r * 0.32}" height="${r * 0.6}" rx="${r * 0.12}" fill="#1f1f2b"/><path d="M${cx - r * 1.1} ${cy + r * 0.3} Q${cx - r * 0.8} ${cy + r * 0.8} ${cx - r * 0.25} ${cy + r * 0.62}" stroke="#1f1f2b" stroke-width="${r * 0.07}" fill="none"/><circle cx="${cx - r * 0.22}" cy="${cy + r * 0.62}" r="${r * 0.08}" fill="#1f1f2b"/>`
    : "";
  return `<g>${ears}${back}<path d="M${cx - r * 1.9} ${cy + r * 3.4} Q${cx - r * 1.8} ${cy + r * 1.35} ${cx} ${cy + r * 1.3} Q${cx + r * 1.8} ${cy + r * 1.35} ${cx + r * 1.9} ${cy + r * 3.4} Z" fill="${shirt}"/><rect x="${cx - r * 0.3}" y="${cy + r * 0.75}" width="${r * 0.6}" height="${r * 0.7}" fill="${skin}"/><circle cx="${cx}" cy="${cy}" r="${r}" fill="${skin}"/>${blush}${eye}${mouth}${front}${headset}</g>`;
}

/** Square character avatar. */
export function avatar(size, seed, opts = {}) {
  const R = rng(seed * 7 + 3);
  const [a, b] = opts.bg ?? BG[Math.floor(R() * BG.length)];
  const r = size * 0.24;
  return svg(size, size, `<rect width="${size}" height="${size}" fill="url(#bg)"/><circle cx="${size * 0.82}" cy="${size * 0.18}" r="${size * 0.22}" fill="#fff" opacity="0.12"/>${person(size / 2, size * 0.2, r, seed, opts)}`, lin("bg", a, b));
}

const chatBubbles = (x, y, w, n, R) =>
  Array.from({ length: n }, (_, i) => {
    const bw = w * (0.55 + R() * 0.45);
    return `<g opacity="${0.9 - i * 0.08}"><circle cx="${x + 9}" cy="${y + i * 34 + 11}" r="8" fill="${BG[i % BG.length][0]}"/><rect x="${x + 22}" y="${y + i * 34 + 3}" width="${bw}" height="16" rx="8" fill="#ffffff" opacity="0.18"/></g>`;
  }).join("");

const room = (w, h, R, wall = ["#2a1f4a", "#14112a"]) =>
  `<rect width="${w}" height="${h}" fill="url(#wall)"/><rect x="${w * 0.06}" y="${h * 0.12}" width="${w * 0.22}" height="${h * 0.04}" rx="4" fill="#ffffff" opacity="0.08"/>` +
  `<rect x="${w * 0.08}" y="${h * 0.05}" width="${w * 0.05}" height="${h * 0.07}" rx="3" fill="${BG[Math.floor(R() * BG.length)][0]}" opacity="0.7"/><rect x="${w * 0.15}" y="${h * 0.07}" width="${w * 0.04}" height="${h * 0.05}" rx="3" fill="#f59e0b" opacity="0.7"/>` +
  `<circle cx="${w * 0.78}" cy="${h * 0.2}" r="${h * 0.16}" fill="#ec4899" opacity="0.18"/><circle cx="${w * 0.2}" cy="${h * 0.75}" r="${h * 0.3}" fill="#8b5cf6" opacity="0.12"/>`;

const wallDefs = (a = "#2a1f4a", b = "#14112a") => lin("wall", a, b, 0, 1);

/** Personal broadcast: one streamer at a desk with a mic and a chat column. */
export function talkThumb(w, h, seed, opts = {}) {
  const R = rng(seed);
  const r = h * 0.15;
  const neon = opts.neon ?? ["ON AIR", "LIVE", "소통", "TALK"][seed % 4];
  return svg(w, h,
    room(w, h, R) +
      `<text x="${w * 0.33}" y="${h * 0.2}" font-family="sans-serif" font-weight="800" font-size="${h * 0.09}" fill="none" stroke="#f472b6" stroke-width="2.5">${esc(neon)}</text>` +
      person(w * 0.42, h * 0.3, r, seed, opts) +
      `<rect x="0" y="${h * 0.8}" width="${w}" height="${h * 0.2}" fill="#0d0b1a"/><rect x="${w * 0.12}" y="${h * 0.78}" width="${w * 0.6}" height="${h * 0.04}" rx="4" fill="#3b2f63"/>` +
      `<path d="M${w * 0.62} ${h * 0.78} L${w * 0.62} ${h * 0.62} L${w * 0.55} ${h * 0.56}" stroke="#d1d5db" stroke-width="4" fill="none"/><rect x="${w * 0.52}" y="${h * 0.48}" width="${h * 0.07}" height="${h * 0.12}" rx="${h * 0.035}" fill="#4b5563" transform="rotate(-25 ${w * 0.55} ${h * 0.54})"/>` +
      `<rect x="${w * 0.74}" y="${h * 0.08}" width="${w * 0.22}" height="${h * 0.84}" rx="10" fill="#000" opacity="0.35"/>` +
      chatBubbles(w * 0.755, h * 0.12, w * 0.16, Math.max(3, Math.floor(h * 0.84 / 34) - 1), R),
    wallDefs(...(opts.wall ?? [])));
}

/** Singing broadcast: stage light cones, a mic stand and notes. */
export function singThumb(w, h, seed) {
  const R = rng(seed);
  const notes = Array.from({ length: 6 }, (_, i) => `<text x="${w * (0.1 + R() * 0.8)}" y="${h * (0.15 + R() * 0.4)}" font-size="${h * (0.07 + R() * 0.05)}" fill="#fff" opacity="${0.4 + R() * 0.4}">${["♪", "♫", "♬"][i % 3]}</text>`).join("");
  return svg(w, h,
    `<rect width="${w}" height="${h}" fill="url(#wall)"/>` +
      `<path d="M${w * 0.3} 0 L${w * 0.18} ${h} L${w * 0.5} ${h} Z" fill="#f9a8d4" opacity="0.18"/><path d="M${w * 0.7} 0 L${w * 0.5} ${h} L${w * 0.86} ${h} Z" fill="#a5b4fc" opacity="0.18"/>` +
      notes + person(w * 0.5, h * 0.26, h * 0.15, seed, { mouth: "open" }) +
      `<line x1="${w * 0.5}" y1="${h * 0.72}" x2="${w * 0.5}" y2="${h}" stroke="#9ca3af" stroke-width="5"/><rect x="${w * 0.485}" y="${h * 0.62}" width="${w * 0.03}" height="${h * 0.12}" rx="${w * 0.015}" fill="#e5e7eb"/>` +
      `<rect x="0" y="${h * 0.9}" width="${w}" height="${h * 0.1}" fill="#0d0b1a"/>`,
    wallDefs("#3b1150", "#120a24"));
}

/** Game broadcast: the game on screen with a small webcam bubble. */
export function gameThumb(w, h, seed) {
  const R = rng(seed);
  const hills = `<path d="M0 ${h * 0.7} Q${w * 0.2} ${h * 0.45} ${w * 0.4} ${h * 0.62} T${w * 0.8} ${h * 0.55} T${w} ${h * 0.6} L${w} ${h} L0 ${h} Z" fill="#14532d"/><path d="M0 ${h * 0.8} Q${w * 0.3} ${h * 0.62} ${w * 0.6} ${h * 0.78} T${w} ${h * 0.72} L${w} ${h} L0 ${h} Z" fill="#166534"/>`;
  const castle = `<rect x="${w * 0.55}" y="${h * 0.32}" width="${w * 0.12}" height="${h * 0.3}" fill="#475569"/><rect x="${w * 0.53}" y="${h * 0.26}" width="${w * 0.04}" height="${h * 0.1}" fill="#475569"/><rect x="${w * 0.65}" y="${h * 0.26}" width="${w * 0.04}" height="${h * 0.1}" fill="#475569"/><rect x="${w * 0.595}" y="${h * 0.48}" width="${w * 0.03}" height="${h * 0.14}" rx="6" fill="#1e293b"/>`;
  const hero = `<circle cx="${w * 0.3}" cy="${h * 0.6}" r="${h * 0.035}" fill="#fde68a"/><rect x="${w * 0.285}" y="${h * 0.63}" width="${w * 0.03}" height="${h * 0.07}" fill="#ef4444"/><line x1="${w * 0.32}" y1="${h * 0.64}" x2="${w * 0.36}" y2="${h * 0.58}" stroke="#e5e7eb" stroke-width="3"/>`;
  const hud = `<rect x="16" y="14" width="${w * 0.22}" height="12" rx="6" fill="#000" opacity="0.4"/><rect x="16" y="14" width="${w * 0.15}" height="12" rx="6" fill="#ef4444"/><rect x="16" y="32" width="${w * 0.22}" height="10" rx="5" fill="#000" opacity="0.4"/><rect x="16" y="32" width="${w * 0.1 + R() * w * 0.1}" height="10" rx="5" fill="#3b82f6"/>`;
  const camR = h * 0.17;
  return svg(w, h,
    `<rect width="${w}" height="${h}" fill="url(#sky)"/><circle cx="${w * 0.82}" cy="${h * 0.2}" r="${h * 0.08}" fill="#fef3c7"/>` + hills + castle + hero + hud +
      `<g><circle cx="${w - camR - 14}" cy="${h - camR - 14}" r="${camR + 4}" fill="#8b5cf6"/><clipPath id="cam"><circle cx="${w - camR - 14}" cy="${h - camR - 14}" r="${camR}"/></clipPath><g clip-path="url(#cam)"><rect x="${w - camR * 2 - 14}" y="${h - camR * 2 - 14}" width="${camR * 2}" height="${camR * 2}" fill="#1f1b3a"/>${person(w - camR - 14, h - camR * 2 - 4, camR * 0.42, seed, { headset: true })}</g></g>`,
    lin("sky", "#38bdf8", "#a5f3fc", 0, 1));
}

/** Mukbang: table with bowls and steam in front of the streamer. */
export function mukbangThumb(w, h, seed) {
  const R = rng(seed);
  const bowl = (x, c) => `<ellipse cx="${x}" cy="${h * 0.8}" rx="${w * 0.09}" ry="${h * 0.05}" fill="#f8fafc"/><ellipse cx="${x}" cy="${h * 0.79}" rx="${w * 0.075}" ry="${h * 0.032}" fill="${c}"/><path d="M${x - 10} ${h * 0.72} q-6 -14 0 -26 M${x + 8} ${h * 0.72} q6 -14 0 -26" stroke="#fff" stroke-width="3" opacity="0.4" fill="none"/>`;
  return svg(w, h,
    room(w, h, R) + person(w * 0.5, h * 0.18, h * 0.15, seed, { mouth: "open" }) +
      `<rect x="0" y="${h * 0.72}" width="${w}" height="${h * 0.28}" fill="#7c4a2d"/><rect x="0" y="${h * 0.72}" width="${w}" height="${h * 0.03}" fill="#9a5f3a"/>` +
      bowl(w * 0.25, "#ef4444") + bowl(w * 0.5, "#f59e0b") + bowl(w * 0.75, "#fb923c") +
      `<line x1="${w * 0.6}" y1="${h * 0.62}" x2="${w * 0.66}" y2="${h * 0.78}" stroke="#d6a76e" stroke-width="4"/><line x1="${w * 0.63}" y1="${h * 0.61}" x2="${w * 0.68}" y2="${h * 0.77}" stroke="#d6a76e" stroke-width="4"/>`,
    wallDefs("#3a2a1a", "#1a120c"));
}

/** Late-night radio talk: window with the moon and a headset. */
export function radioThumb(w, h, seed) {
  const R = rng(seed);
  const stars = Array.from({ length: 14 }, () => `<circle cx="${w * (0.06 + R() * 0.36)}" cy="${h * (0.1 + R() * 0.4)}" r="${1 + R() * 1.6}" fill="#fff" opacity="${0.4 + R() * 0.5}"/>`).join("");
  return svg(w, h,
    `<rect width="${w}" height="${h}" fill="url(#wall)"/><rect x="${w * 0.05}" y="${h * 0.08}" width="${w * 0.4}" height="${h * 0.5}" rx="8" fill="#0b1026"/>${stars}<circle cx="${w * 0.35}" cy="${h * 0.2}" r="${h * 0.07}" fill="#fde68a"/><circle cx="${w * 0.37}" cy="${h * 0.19}" r="${h * 0.06}" fill="#0b1026"/><rect x="${w * 0.05}" y="${h * 0.32}" width="${w * 0.4}" height="4" fill="#1e293b"/><rect x="${w * 0.245}" y="${h * 0.08}" width="4" height="${h * 0.5}" fill="#1e293b"/>` +
      person(w * 0.66, h * 0.28, h * 0.15, seed, { headset: true }) +
      `<rect x="0" y="${h * 0.82}" width="${w}" height="${h * 0.18}" fill="#0d0b1a"/><circle cx="${w * 0.2}" cy="${h * 0.78}" r="${h * 0.05}" fill="#f59e0b" opacity="0.8"/><rect x="${w * 0.185}" y="${h * 0.78}" width="${w * 0.03}" height="${h * 0.06}" fill="#b45309"/>`,
    wallDefs("#1e1b4b", "#0b0a1f"));
}

/** Virtual streamer: pastel room, anime-style eyes, bunny ears. */
export function virtualThumb(w, h, seed) {
  const R = rng(seed);
  const hearts = Array.from({ length: 7 }, () => `<text x="${w * (0.05 + R() * 0.9)}" y="${h * (0.15 + R() * 0.6)}" font-size="${h * (0.05 + R() * 0.05)}" fill="#fff" opacity="0.7">${R() > 0.5 ? "♥" : "✦"}</text>`).join("");
  return svg(w, h,
    `<rect width="${w}" height="${h}" fill="url(#wall)"/>${hearts}` +
      person(w * 0.5, h * 0.3, h * 0.17, seed, { anime: true, ears: "bunny", hair: HAIR[5 + (seed % 3)] }) +
      `<rect x="${w * 0.04}" y="${h * 0.78}" width="${w * 0.3}" height="${h * 0.14}" rx="12" fill="#ffffff" opacity="0.85"/><rect x="${w * 0.07}" y="${h * 0.82}" width="${w * 0.2}" height="${h * 0.025}" rx="4" fill="#f472b6"/><rect x="${w * 0.07}" y="${h * 0.865}" width="${w * 0.14}" height="${h * 0.02}" rx="4" fill="#c4b5fd"/>`,
    wallDefs("#fbcfe8", "#c4b5fd"));
}

/** Excel broadcast: crew members in a row under a spreadsheet-style scoreboard. */
export function excelThumb(w, h, seed, opts = {}) {
  const R = rng(seed);
  const members = opts.members ?? ["하늘", "바다", "솔", "길동", "별", "구름"];
  const n = Math.min(members.length, opts.count ?? 5);
  const scores = members.slice(0, n).map(() => Math.round(30 + R() * 270)).sort((a, b) => b - a);
  const bx = w * 0.06, by = h * 0.07, bw = w * 0.88, rowH = Math.min(h * 0.072, 26), bh = rowH * (n + 1);
  const max = scores[0];
  const rows = scores.map((s, i) => {
    const y = by + rowH * (i + 1);
    return `<rect x="${bx}" y="${y}" width="${bw}" height="${rowH}" fill="${i % 2 ? "#ffffff" : "#f1f5f9"}"/>` +
      `<text x="${bx + 10}" y="${y + rowH * 0.7}" font-family="sans-serif" font-weight="800" font-size="${rowH * 0.6}" fill="${i < 3 ? "#d97706" : "#334155"}">${i + 1}</text>` +
      `<text x="${bx + bw * 0.08 + 8}" y="${y + rowH * 0.7}" font-family="sans-serif" font-weight="700" font-size="${rowH * 0.58}" fill="#0f172a">${esc(members[i])}</text>` +
      `<rect x="${bx + bw * 0.32}" y="${y + rowH * 0.25}" width="${(bw * 0.5 * s) / max}" height="${rowH * 0.5}" rx="${rowH * 0.25}" fill="${i === 0 ? "#ec4899" : "#8b5cf6"}"/>` +
      `<text x="${bx + bw - 10}" y="${y + rowH * 0.7}" text-anchor="end" font-family="sans-serif" font-weight="800" font-size="${rowH * 0.58}" fill="#0f172a">${s}</text>`;
  }).join("");
  const grid = Array.from({ length: n + 2 }, (_, i) => `<line x1="${bx}" y1="${by + rowH * i}" x2="${bx + bw}" y2="${by + rowH * i}" stroke="#cbd5e1" stroke-width="1"/>`).join("") +
    [0.08, 0.3, 0.86].map((f) => `<line x1="${bx + bw * f}" y1="${by}" x2="${bx + bw * f}" y2="${by + bh}" stroke="#cbd5e1" stroke-width="1"/>`).join("");
  const header = `<rect x="${bx}" y="${by}" width="${bw}" height="${rowH}" fill="#15803d"/><text x="${bx + 10}" y="${by + rowH * 0.7}" font-family="sans-serif" font-weight="800" font-size="${rowH * 0.56}" fill="#fff">${esc(opts.title ?? "엑셀방송 · 시즌2")}</text><text x="${bx + bw - 10}" y="${by + rowH * 0.7}" text-anchor="end" font-family="sans-serif" font-weight="700" font-size="${rowH * 0.5}" fill="#dcfce7">점수</text>`;
  const top = by + bh + h * 0.04;
  const space = h - top;
  const pr = Math.min(space * 0.22, (w / n) * 0.2);
  const crew = Array.from({ length: n }, (_, i) => person(w * ((i + 0.5) / n), top + space * 0.12, pr, seed * 13 + i * 7)).join("");
  return svg(w, h,
    `<rect width="${w}" height="${h}" fill="url(#wall)"/><path d="M0 ${h} L${w * 0.2} ${top} L${w * 0.8} ${top} L${w} ${h} Z" fill="#ffffff" opacity="0.04"/>` +
      `<g filter="url(#sh)"><rect x="${bx - 4}" y="${by - 4}" width="${bw + 8}" height="${bh + 8}" rx="8" fill="#0f172a"/></g>${header}${rows}${grid}` + crew +
      `<rect x="0" y="${h - 6}" width="${w}" height="6" fill="url(#bar)"/>`,
    wallDefs(...(opts.wall ?? ["#1e1b4b", "#0f0c24"])) + lin("bar", "#8b5cf6", "#ec4899", 1, 0) + `<filter id="sh"><feDropShadow dx="0" dy="6" stdDeviation="8" flood-opacity="0.45"/></filter>`);
}

/** Wide hero / promo art (no text so the page copy stays readable on top). */
export function heroArt(w, h, seed, kind = "excel") {
  const R = rng(seed);
  const confetti = Array.from({ length: 40 }, () => {
    const x = R() * w, y = R() * h * 0.7, c = BG[Math.floor(R() * BG.length)][Math.floor(R() * 2)];
    return `<rect x="${x}" y="${y}" width="${6 + R() * 8}" height="${3 + R() * 4}" fill="${c}" opacity="${0.5 + R() * 0.4}" transform="rotate(${R() * 180} ${x} ${y})"/>`;
  }).join("");
  if (kind === "promo") {
    const coins = Array.from({ length: 7 }, (_, i) => {
      const x = w * (0.55 + R() * 0.4), y = h * (0.2 + R() * 0.6), r = h * (0.06 + R() * 0.06);
      return `<circle cx="${x}" cy="${y}" r="${r}" fill="#fbbf24"/><circle cx="${x}" cy="${y}" r="${r * 0.72}" fill="none" stroke="#f59e0b" stroke-width="${r * 0.12}"/><text x="${x}" y="${y + r * 0.3}" text-anchor="middle" font-family="sans-serif" font-weight="900" font-size="${r * 0.8}" fill="#b45309">FN</text>`;
    }).join("");
    const gift = `<rect x="${w * 0.62}" y="${h * 0.42}" width="${h * 0.42}" height="${h * 0.36}" rx="12" fill="#ec4899"/><rect x="${w * 0.6}" y="${h * 0.34}" width="${h * 0.46}" height="${h * 0.12}" rx="8" fill="#f472b6"/><rect x="${w * 0.62 + h * 0.18}" y="${h * 0.34}" width="${h * 0.06}" height="${h * 0.44}" fill="#fde68a"/>`;
    return svg(w, h, `<rect width="${w}" height="${h}" fill="url(#bg)"/>${confetti}${gift}${coins}`, lin("bg", "#4c1d95", "#be185d", 1, 0.6));
  }
  if (kind === "trophy") {
    const rays = Array.from({ length: 12 }, (_, i) => `<path d="M${w * 0.75} ${h * 0.5} L${w * 0.75 + Math.cos((i * Math.PI) / 6) * w} ${h * 0.5 + Math.sin((i * Math.PI) / 6) * w} L${w * 0.75 + Math.cos((i * Math.PI) / 6 + 0.12) * w} ${h * 0.5 + Math.sin((i * Math.PI) / 6 + 0.12) * w} Z" fill="#fbbf24" opacity="0.06"/>`).join("");
    const t = `<g transform="translate(${w * 0.75 - h * 0.25} ${h * 0.18}) scale(${h * 0.5 / 24})"><path d="M7 4H17V9C17 11.7614 14.7614 14 12 14C9.23858 14 7 11.7614 7 9V4ZM7 6H5C3.89543 6 3 6.89543 3 8C3 9.10457 3.89543 10 5 10H7M17 6H19C20.1046 6 21 6.89543 21 8C21 9.10457 20.1046 10 19 10H17M12 14V17M9 17H15L16 20H8L9 17Z" stroke="#fbbf24" stroke-width="1.6" fill="#f59e0b" fill-opacity="0.25" stroke-linejoin="round"/></g>`;
    return svg(w, h, `<rect width="${w}" height="${h}" fill="url(#bg)"/>${rays}${confetti}${t}`, lin("bg", "#0f0c24", "#3b0764", 1, 0.4));
  }
  // excel finale stage: scoreboard on the right, crew on stage, spotlights
  // The page puts its copy on the left, so the stage (scoreboard + crew) sits on the right half.
  const board = excelThumb(w * 0.4, h * 0.7, seed + 9, { count: 6, title: "시즌2 결승 · 실시간 점수" }).replace(/<svg[^>]*>/, "").replace(/<\/svg>$/, "").replace(/id="(wall|bar|sh)"/g, 'id="b$1"').replace(/url\(#(wall|bar|sh)\)/g, "url(#b$1)");
  return svg(w, h,
    `<rect width="${w}" height="${h}" fill="url(#bg)"/><path d="M${w * 0.62} 0 L${w * 0.52} ${h} L${w * 0.78} ${h} Z" fill="#f9a8d4" opacity="0.1"/><path d="M${w * 0.88} 0 L${w * 0.76} ${h} L${w * 1.02} ${h} Z" fill="#a5b4fc" opacity="0.1"/>${confetti}` +
      `<rect x="0" y="${h * 0.9}" width="${w}" height="${h * 0.1}" fill="#0d0b1a"/><g transform="translate(${w * 0.56} ${h * 0.14})">${board}</g>`,
    lin("bg", "#140f33", "#581c87", 1, 0.5));
}

/** Empty room for the offline player. */
export function offlineArt(w, h, seed) {
  const R = rng(seed);
  return svg(w, h,
    room(w, h, R) + `<rect x="${w * 0.36}" y="${h * 0.5}" width="${w * 0.28}" height="${h * 0.32}" rx="18" fill="#312e81"/><rect x="${w * 0.33}" y="${h * 0.3}" width="${w * 0.34}" height="${h * 0.26}" rx="24" fill="#3730a3"/>` +
      `<rect x="0" y="${h * 0.84}" width="${w}" height="${h * 0.16}" fill="#0d0b1a"/><circle cx="${w * 0.5}" cy="${h * 0.42}" r="${h * 0.06}" fill="none" stroke="#a5b4fc" stroke-width="5" opacity="0.6"/><path d="M${w * 0.5} ${h * 0.39} L${w * 0.5} ${h * 0.43} L${w * 0.52} ${h * 0.44}" stroke="#a5b4fc" stroke-width="5" fill="none" opacity="0.6" stroke-linecap="round"/>`,
    wallDefs("#1f1b3a", "#0b0a1f"));
}

/** Small square panel (signatures, banners). */
export function panelArt(w, h, seed, label) {
  const R = rng(seed);
  const [a, b] = BG[seed % BG.length];
  const sparkles = Array.from({ length: 8 }, () => `<text x="${w * R()}" y="${h * R()}" font-size="${h * (0.08 + R() * 0.08)}" fill="#fff" opacity="0.6">✦</text>`).join("");
  return svg(w, h, `<rect width="${w}" height="${h}" fill="url(#bg)"/>${sparkles}${label ? `<text x="${w / 2}" y="${h * 0.58}" text-anchor="middle" font-family="sans-serif" font-weight="900" font-size="${h * 0.2}" fill="#fff">${esc(label)}</text>` : ""}`, lin("bg", a, b));
}
