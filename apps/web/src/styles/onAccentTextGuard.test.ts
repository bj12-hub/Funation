import { readdirSync, readFileSync } from "node:fs";
import { join, relative } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * Text on a filled accent or gradient background uses `--color-text-on-accent` (white in both themes) or another
 * colour that stays light. The `--color-text-*` tokens flip with the theme — light in dark, dark in light — so on a
 * purple, pink or blue fill they pass in the dark theme and fail in the light one (the 로그인 button showed near-black text
 * on its gradient, 2.9:1; 2026-10-17). This parses every CSS Module and lists each rule that sets both a filled
 * background and a theme-flipping text colour.
 *
 * Not caught: a fill rule whose text colour comes from another rule (a base class, an ancestor). Those surface in the
 * light-theme contrast check; give the fill rule its own `color` when you add one. The shared Button, whose variants
 * inherit `.button`'s colour, is checked on its own.
 */

const SRC = join(__dirname, "..");

/** Background values that are a solid accent or brand fill. Scrim gradients over media are not fills. */
const FILL_TOKEN = /var\(--color-(primary|accent|info|charge|success|danger|warning|live|gold|bronze|highlight|platform-live|platform-success|profile-blue|notice-blue|notice-red)\)/;
const SCRIM_GRADIENT = /var\(--gradient-(hero-overlay|hof-hero-overlay|thumbnail-overlay|player-controls)\)/;
const isFill = (value: string) => FILL_TOKEN.test(value) || /gradient\(/.test(value) || (/var\(--gradient-/.test(value) && !SCRIM_GRADIENT.test(value));

/** Text tokens whose value flips with the theme (`--color-text-on-accent` and `--color-text-inverse` do not). */
const FLIPPING_TEXT = /var\(--color-text-(primary|secondary|tertiary|soft|faint|dim)\)/;

/** Intended combinations, `path selector` → why the text stays readable in both themes. Keep it short. */
const ALLOWED: Record<string, string> = {
  "features/creatorStudio/settings/setupGuides.module.css .tile":
    "a 15% / 8% tint over the surface, not a fill; the text sits on the page surface and flips with it",
  "features/creatorRoom/donation/donation.module.css .preview":
    "the video preview is a dark screen in both themes and carries data-theme=\"dark\" (Fields.tsx), so its text tokens keep their dark values"
};

type Rule = { selector: string; line: number; decls: Map<string, string> };

/** Flat list of style rules (inside @media / @supports too) with their declarations; comments, strings and url() kept intact. */
function parseRules(css: string): Rule[] {
  const src = css.replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, " "));
  const rules: Rule[] = [];
  const stack: { prelude: string; line: number; decls: string[] }[] = [];
  let buf = "";
  let quote = "";
  let paren = 0;
  let line = 1;
  for (const ch of src) {
    if (ch === "\n") line++;
    if (quote) {
      buf += ch;
      if (ch === quote) quote = "";
      continue;
    }
    if (ch === '"' || ch === "'") quote = ch;
    else if (ch === "(") paren++;
    else if (ch === ")") paren = Math.max(0, paren - 1);
    else if (paren === 0 && ch === "{") {
      stack.push({ prelude: buf.trim(), line, decls: [] });
      buf = "";
      continue;
    } else if (paren === 0 && ch === "}") {
      const block = stack.pop();
      if (block) {
        block.decls.push(buf);
        if (!block.prelude.startsWith("@")) {
          const decls = new Map<string, string>();
          for (const d of block.decls) {
            const i = d.indexOf(":");
            if (i > 0) decls.set(d.slice(0, i).trim().toLowerCase(), d.slice(i + 1).trim());
          }
          rules.push({ selector: block.prelude.replace(/\s+/g, " "), line: block.line, decls });
        }
      }
      buf = "";
      continue;
    } else if (paren === 0 && ch === ";") {
      stack.at(-1)?.decls.push(buf);
      buf = "";
      continue;
    }
    buf += ch;
  }
  return rules;
}

const hasFill = (r: Rule) => isFill(["background", "background-color", "background-image"].map((p) => r.decls.get(p) ?? "").join(" "));

/** Rules that set a filled background and a theme-flipping text colour. */
function flippingTextOnFill(css: string): Rule[] {
  return parseRules(css).filter((r) => hasFill(r) && FLIPPING_TEXT.test(r.decls.get("color") ?? ""));
}

function cssModules(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const p = join(dir, e.name);
    if (e.isDirectory()) return cssModules(p);
    return e.name.endsWith(".module.css") ? [p] : [];
  });
}

describe("text on accent and gradient fills", () => {
  const findings = cssModules(SRC).flatMap((file) =>
    flippingTextOnFill(readFileSync(file, "utf8")).map((r) => ({
      key: `${relative(SRC, file).replace(/\\/g, "/")} ${r.selector}`,
      where: `${relative(SRC, file).replace(/\\/g, "/")}:${r.line} ${r.selector} → color: ${r.decls.get("color")}`
    }))
  );

  it("uses a colour that stays light in both themes (--color-text-on-accent)", () => {
    expect(findings.filter((f) => !Object.hasOwn(ALLOWED, f.key)).map((f) => f.where)).toEqual([]);
  });

  it("keeps the allow-list current", () => {
    const keys = new Set(findings.map((f) => f.key));
    expect(Object.keys(ALLOWED).filter((k) => !keys.has(k))).toEqual([]);
    // The video preview's entry holds only while the element keeps its dark scope.
    const fields = readFileSync(join(SRC, "features", "creatorRoom", "donation", "Fields.tsx"), "utf8");
    expect(fields).toMatch(/className=\{styles\.preview\}[^>]*data-theme="dark"/);
  });

  it("flags flipping text on gradients and accent fills, and leaves tints, scrims and on-accent text alone", () => {
    const css = `
      .a { background: var(--gradient-primary-button); color: var(--color-text-primary); }
      @media (max-width: 767px) { .b:hover { background-color: var(--color-accent); color: var(--color-text-secondary); } }
      .c { background: url("data:image/svg+xml;utf8,<svg/>") center / 12px no-repeat, linear-gradient(90deg, #8b5cf6, #ec4899); color: var(--color-text-dim); }
      .ok1 { background: var(--gradient-cta); color: var(--color-text-on-accent); }
      .ok2 { background: var(--color-primary-soft); color: var(--color-text-primary); }
      .ok3 { background: var(--gradient-thumbnail-overlay); color: var(--color-text-primary); }
      .ok4 { background: var(--color-surface); color: var(--color-text-primary); }
    `;
    expect(flippingTextOnFill(css).map((r) => r.selector)).toEqual([".a", ".b:hover", ".c"]);
  });

  it("gives the shared Button's filled variants a light text colour of their own", () => {
    // `.button` sets the theme-flipping --color-text-primary and every variant inherits it unless it sets its own: a
    // variant without `color` is the near-black-on-gradient 로그인 button again, and the rule-by-rule check above cannot
    // see an inherited colour.
    const rules = parseRules(readFileSync(join(SRC, "components", "ui", "Button", "Button.module.css"), "utf8"));
    const fills = rules.filter((r) => /^\.[\w-]+$/.test(r.selector) && hasFill(r));
    expect(fills.map((r) => r.selector)).toEqual(expect.arrayContaining([".primary", ".accent", ".cta", ".pink"]));
    expect(fills.filter((r) => !/^var\(--color-text-on-accent\)$/.test(r.decls.get("color") ?? "")).map((r) => `${r.selector} → color: ${r.decls.get("color") ?? "(inherited)"}`)).toEqual([]);
  });

  it("keeps --color-text-on-accent light in the light theme", () => {
    const tokens = readFileSync(join(SRC, "styles", "tokens.css"), "utf8");
    expect(tokens).toMatch(/--color-text-on-accent:\s*#ffffff;/);
    const light = tokens.slice(tokens.indexOf('[data-theme="light"] {'));
    expect(light).not.toMatch(/--color-text-on-accent:/);
  });
});
