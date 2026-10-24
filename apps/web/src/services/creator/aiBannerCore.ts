import { AI_BANNER_COUNT, AI_HEADLINE_MAX, AI_PROMPT_MAX, AI_QUALITIES, AI_RATIOS, AI_STYLES, AI_SUBLINE_MAX, type AiBannerImage, type AiBannerRequest, type AiStyle } from "./aiBannerTypes";

/**
 * AI 배너 (server-only) — code-first. `BannerProvider` is where a real AI image service plugs in (TBD: provider, cost,
 * content review, AI disclosure). `mockBannerProvider` draws deterministic SVG samples: the same request and seed always
 * give the same images, a new seed new ones. Every text is XML-escaped; the SVG holds no scripts, links or external refs.
 */

export interface BannerProvider {
  generate(req: AiBannerRequest): Promise<AiBannerImage[]>;
}

const rec = (input: unknown) => (typeof input === "object" && input !== null ? input : {}) as Record<string, unknown>;

export function parseBannerRequest(input: unknown, forbidden: string[]): AiBannerRequest | { message: string } {
  const v = rec(input);
  const text = (x: unknown) => (typeof x === "string" ? x.trim() : "");
  const prompt = text(v.prompt);
  const headline = text(v.headline);
  const subline = text(v.subline);
  if (!prompt && !headline) return { message: "설명이나 배너 문구 중 하나는 넣어 주세요." };
  if (prompt.length > AI_PROMPT_MAX) return { message: `설명은 ${AI_PROMPT_MAX}자까지 넣을 수 있어요.` };
  if (headline.length > AI_HEADLINE_MAX) return { message: `배너 문구는 ${AI_HEADLINE_MAX}자까지 넣을 수 있어요.` };
  if (subline.length > AI_SUBLINE_MAX) return { message: `작은 문구는 ${AI_SUBLINE_MAX}자까지 넣을 수 있어요.` };
  if ([prompt, headline, subline].some((t) => forbidden.some((w) => t.toLowerCase().includes(w)))) return { message: "사용할 수 없는 단어가 포함되어 있어요." };
  const style = AI_STYLES.find((s) => s.key === v.style)?.key;
  const ratio = AI_RATIOS.find((r) => r.key === v.ratio)?.key;
  const quality = AI_QUALITIES.find((q) => q.key === v.quality)?.key;
  const seed = typeof v.seed === "number" && Number.isInteger(v.seed) && v.seed >= 0 && v.seed <= 1_000_000_000 ? v.seed : null;
  if (!style || !ratio || !quality || seed === null) return { message: "설정을 확인해 주세요." };
  return { prompt, headline, subline, style, ratio, quality, seed };
}

/** A small seeded random (mulberry32) so the mock is deterministic. */
function random(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const hash = (s: string) => [...s].reduce((h, c) => (Math.imul(h, 31) + c.charCodeAt(0)) >>> 0, 2166136261);
export const escapeXml = (s: string) => s.replace(/[<>&"']/g, (c) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;", '"': "&quot;", "'": "&#39;" })[c]!);

const PALETTES: Record<AiStyle, string[][]> = {
  NEON: [
    ["#0b0221", "#ff2bd6", "#00f0ff", "#faff00"],
    ["#05010f", "#7c3aed", "#22d3ee", "#f472b6"]
  ],
  PASTEL: [
    ["#ffe4ec", "#c7f0ff", "#e9d5ff", "#7c3aed"],
    ["#fff7d6", "#d1fae5", "#fbcfe8", "#be185d"]
  ],
  RETRO: [
    ["#2b1055", "#ff7b54", "#ffb26b", "#ffd56b"],
    ["#1b1b3a", "#f72585", "#ff9e00", "#ffdd00"]
  ],
  MINIMAL: [
    ["#f8fafc", "#0f172a", "#e2e8f0", "#0f172a"],
    ["#111827", "#f9fafb", "#374151", "#f9fafb"]
  ],
  COMIC: [
    ["#ffde00", "#ff3d00", "#1e88e5", "#111111"],
    ["#00e5ff", "#ff1744", "#ffea00", "#111111"]
  ],
  SPACE: [
    ["#020617", "#1e1b4b", "#a78bfa", "#f0abfc"],
    ["#000814", "#003566", "#ffc300", "#e0e1dd"]
  ]
};
/** Description keywords → a motif drawn on the banner (the style's own motif otherwise). */
const MOTIFS: [RegExp, string][] = [
  [/고양이|냥|cat/i, "🐱"],
  [/강아지|멍|dog/i, "🐶"],
  [/게임|game|롤|배그/i, "🎮"],
  [/음악|노래|music|song/i, "🎵"],
  [/하트|사랑|love|heart/i, "💖"],
  [/생일|birthday|축하/i, "🎂"],
  [/꽃|봄|flower/i, "🌸"],
  [/불|열정|fire|hot/i, "🔥"],
  [/별|star/i, "⭐"],
  [/커피|카페|coffee/i, "☕"]
];
const STYLE_MOTIF: Record<AiStyle, string> = { NEON: "⚡", PASTEL: "🍭", RETRO: "📼", MINIMAL: "●", COMIC: "💥", SPACE: "🪐" };

/** One sample banner. `variant` (0 ~ 3) changes the layout and details within the same look. */
export function renderBannerSvg(req: AiBannerRequest, variant: number): AiBannerImage {
  const { width: w, height: h } = AI_RATIOS.find((r) => r.key === req.ratio)!;
  const rnd = random(hash(`${req.style}|${req.prompt}|${req.headline}|${req.seed}|${variant}`));
  const palettes = PALETTES[req.style];
  const [bg, a, b, ink] = palettes[Math.floor(rnd() * palettes.length)];
  const motif = MOTIFS.find(([re]) => re.test(req.prompt))?.[1] ?? STYLE_MOTIF[req.style];
  const short = Math.min(w, h);
  const angle = Math.floor(rnd() * 360);
  const parts: string[] = [];
  const n = (x: number) => Math.round(x);

  // Background.
  parts.push(
    `<defs><linearGradient id="g" gradientTransform="rotate(${angle} .5 .5)"><stop offset="0" stop-color="${bg}"/><stop offset="1" stop-color="${req.style === "MINIMAL" ? bg : a}"/></linearGradient>` +
      `<filter id="glow"><feGaussianBlur stdDeviation="${n(short / 90)}" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter></defs>`,
    `<rect width="${w}" height="${h}" fill="url(#g)"/>`
  );
  // The style's pattern.
  if (req.style === "NEON") {
    for (let i = 0; i < 14; i++) parts.push(`<line x1="${n(rnd() * w)}" y1="0" x2="${n(rnd() * w)}" y2="${h}" stroke="${rnd() < 0.5 ? b : ink}" stroke-width="${n(2 + rnd() * 4)}" opacity=".55" filter="url(#glow)"/>`);
  } else if (req.style === "PASTEL") {
    for (let i = 0; i < 9; i++) parts.push(`<circle cx="${n(rnd() * w)}" cy="${n(rnd() * h)}" r="${n(short * (0.1 + rnd() * 0.3))}" fill="${[a, b, bg][i % 3]}" opacity=".7"/>`);
  } else if (req.style === "RETRO") {
    const cy = n(h * (0.55 + rnd() * 0.15));
    parts.push(`<circle cx="${n(w / 2)}" cy="${cy}" r="${n(short * 0.32)}" fill="${b}"/>`);
    for (let i = 0; i < 6; i++) parts.push(`<rect x="0" y="${cy + i * n(short * 0.05)}" width="${w}" height="${n(short * 0.022)}" fill="${bg}"/>`);
  } else if (req.style === "MINIMAL") {
    parts.push(`<rect x="${n(w * (0.08 + rnd() * 0.5))}" y="${n(h * (0.15 + rnd() * 0.4))}" width="${n(short * 0.35)}" height="${n(short * 0.35)}" fill="${b}"/>`);
  } else if (req.style === "COMIC") {
    for (let y = 0; y < h; y += n(short / 18)) for (let x = (y / n(short / 18)) % 2 ? n(short / 36) : 0; x < w; x += n(short / 18)) parts.push(`<circle cx="${x}" cy="${y}" r="${n(short / 90)}" fill="${ink}" opacity=".12"/>`);
    const cx = w * (0.3 + rnd() * 0.4);
    const cy = h * (0.3 + rnd() * 0.4);
    const pts = Array.from({ length: 24 }, (_, i) => {
      const r = short * (i % 2 ? 0.22 : 0.42);
      const t = (i / 24) * Math.PI * 2;
      return `${n(cx + r * Math.cos(t))},${n(cy + r * Math.sin(t))}`;
    });
    parts.push(`<polygon points="${pts.join(" ")}" fill="${b}" stroke="${ink}" stroke-width="${n(short / 120)}"/>`);
  } else {
    for (let i = 0; i < 70; i++) parts.push(`<circle cx="${n(rnd() * w)}" cy="${n(rnd() * h)}" r="${(0.6 + rnd() * 2.4).toFixed(1)}" fill="${ink}" opacity="${(0.4 + rnd() * 0.6).toFixed(2)}"/>`);
    parts.push(`<circle cx="${n(w * (0.65 + rnd() * 0.25))}" cy="${n(h * (0.2 + rnd() * 0.3))}" r="${n(short * 0.16)}" fill="${b}" opacity=".9"/>`);
  }
  // Motifs.
  for (let i = 0; i < 3 + Math.floor(rnd() * 3); i++) {
    parts.push(`<text x="${n(rnd() * w)}" y="${n(rnd() * h)}" font-size="${n(short * (0.08 + rnd() * 0.12))}" opacity=".85">${escapeXml(motif)}</text>`);
  }
  // The texts, by layout.
  const layout = variant % 3;
  const anchor = layout === 1 ? "start" : "middle";
  const x = layout === 1 ? n(w * 0.07) : n(w / 2);
  const y = layout === 2 ? n(h * 0.78) : n(h * 0.52);
  const font = "'Pretendard','Noto Sans KR','Apple SD Gothic Neo','Malgun Gothic',sans-serif";
  const textInk = req.style === "PASTEL" || req.style === "MINIMAL" ? ink : "#ffffff";
  const stroke = req.style === "COMIC" ? ` stroke="${ink}" stroke-width="${n(short / 80)}" paint-order="stroke"` : "";
  const glow = req.style === "NEON" || req.style === "SPACE" ? ` filter="url(#glow)"` : "";
  if (req.headline) {
    const size = n(Math.min(short * 0.2, (w * 1.6) / Math.max(4, req.headline.length)));
    parts.push(`<text x="${x}" y="${y}" text-anchor="${anchor}" font-family="${font}" font-weight="900" font-size="${size}" fill="${textInk}"${stroke}${glow}>${escapeXml(req.headline)}</text>`);
  }
  if (req.subline) {
    const size = n(Math.min(short * 0.075, (w * 1.4) / Math.max(8, req.subline.length)));
    parts.push(`<text x="${x}" y="${y + n(short * (req.headline ? 0.13 : 0))}" text-anchor="${anchor}" font-family="${font}" font-weight="700" font-size="${size}" fill="${textInk}" opacity=".9">${escapeXml(req.subline)}</text>`);
  }
  const scale = AI_QUALITIES.find((q) => q.key === req.quality)!.scale;
  const width = n(w * scale);
  const height = n(h * scale);
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${w} ${h}">${parts.join("")}</svg>`;
  return { id: `mock-${req.seed}-${variant}`, svg, width, height };
}

/** The mock: AI_BANNER_COUNT samples per request (TBD: a real provider). */
export const mockBannerProvider: BannerProvider = {
  async generate(req) {
    return Array.from({ length: AI_BANNER_COUNT }, (_, i) => renderBannerSvg(req, i));
  }
};
