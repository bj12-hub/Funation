import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join, relative } from "node:path";
import ts from "typescript";
import { describe, expect, it } from "vitest";

/**
 * Service time is Asia/Seoul. A console screen that formats a date itself formats it in the zone it runs in — the
 * operator's browser for a client component (and for any module one imports), this server's otherwise (not pinned to
 * Korea) — so every date a screen shows goes through the Korea-time helpers (lib/format.ts formatKst · formatKstDate ·
 * formatKstTime · kstParts · kstIsoString) or passes `timeZone` itself. This parses the screen code (app, components,
 * features, hooks) with the TypeScript parser and lists every date formatted any other way. Same check as the site's
 * src/lib/dateFormatGuard.test.ts.
 *
 * Caught: toLocaleDateString / toLocaleTimeString without `timeZone`; toLocaleString without `timeZone` on a Date (a
 * `new Date(…)`, a name bound to one or typed `Date`, or called with date / time options); Intl.DateTimeFormat without
 * `timeZone`; the local-zone getters (getFullYear · getMonth · getDate · getDay · getHours · getMinutes · getSeconds)
 * and toDateString / toTimeString.
 */

const SRC = join(__dirname, "..");
const SCREEN_DIRS = ["app", "components", "features", "hooks"];
const LOCAL_ZONE_METHODS = new Set(["getFullYear", "getMonth", "getDate", "getDay", "getHours", "getMinutes", "getSeconds", "toDateString", "toTimeString"]);
const DATE_OPTIONS = new Set(["year", "month", "day", "weekday", "era", "hour", "minute", "second", "dateStyle", "timeStyle", "hour12", "hourCycle", "dayPeriod", "timeZoneName", "fractionalSecondDigits"]);

const unwrap = (e: ts.Expression): ts.Expression =>
  ts.isParenthesizedExpression(e) || ts.isAsExpression(e) || ts.isSatisfiesExpression(e) || ts.isTypeAssertionExpression(e) ? unwrap(e.expression) : e;
const isNewDate = (e: ts.Expression) => {
  const x = unwrap(e);
  return ts.isNewExpression(x) && ts.isIdentifier(x.expression) && x.expression.text === "Date";
};
const isIntlDateTimeFormat = (e: ts.Expression) =>
  ts.isPropertyAccessExpression(e) && e.name.text === "DateTimeFormat" && ts.isIdentifier(e.expression) && e.expression.text === "Intl";

/** Every finding names one of these; a file without any is not parsed. */
const MAY_FORMAT = /\b(toLocale(Date|Time)?String|DateTimeFormat|get(FullYear|Month|Date|Day|Hours|Minutes|Seconds)|to(Date|Time)String)\b/;

/** `file:line why: code` for every date the source formats in the runtime's zone. */
function zoneDependentFormats(fileName: string, text: string): string[] {
  if (!MAY_FORMAT.test(text)) return [];
  const sf = ts.createSourceFile(fileName, text, ts.ScriptTarget.Latest, false, fileName.endsWith(".tsx") ? ts.ScriptKind.TSX : ts.ScriptKind.TS);
  // Names bound to a Date (`const d = new Date(…)`, `(d: Date)`) and to an object literal (options passed by name).
  const dates = new Set<string>();
  const objects = new Map<string, ts.ObjectLiteralExpression>();
  const collect = (n: ts.Node) => {
    if ((ts.isVariableDeclaration(n) || ts.isParameter(n)) && ts.isIdentifier(n.name)) {
      if (n.type?.getText(sf) === "Date" || (n.initializer && isNewDate(n.initializer))) dates.add(n.name.text);
      const init = n.initializer && unwrap(n.initializer);
      if (init && ts.isObjectLiteralExpression(init)) objects.set(n.name.text, init);
    }
    ts.forEachChild(n, collect);
  };
  collect(sf);

  const optionKeys = (arg?: ts.Expression) => {
    const e = arg && unwrap(arg);
    const o = e && (ts.isObjectLiteralExpression(e) ? e : ts.isIdentifier(e) ? objects.get(e.text) : undefined);
    return new Set(o?.properties.flatMap((p) => (p.name && (ts.isIdentifier(p.name) || ts.isStringLiteral(p.name)) ? [p.name.text] : [])) ?? []);
  };
  const found: string[] = [];
  const report = (n: ts.Node, why: string) => {
    const line = sf.getLineAndCharacterOfPosition(n.getStart(sf)).line + 1;
    found.push(`${fileName}:${line} ${why}: ${n.getText(sf).replace(/\s+/g, " ").slice(0, 120)}`);
  };
  const visit = (n: ts.Node) => {
    if (ts.isCallExpression(n) && ts.isPropertyAccessExpression(n.expression)) {
      const method = n.expression.name.text;
      const receiver = unwrap(n.expression.expression);
      const keys = optionKeys(n.arguments[1]);
      if (LOCAL_ZONE_METHODS.has(method)) report(n, `${method}() reads the runtime's zone`);
      else if ((method === "toLocaleDateString" || method === "toLocaleTimeString") && !keys.has("timeZone")) report(n, `${method} without timeZone`);
      else if (method === "toLocaleString" && !keys.has("timeZone")) {
        const isDate = isNewDate(receiver) || (ts.isIdentifier(receiver) && dates.has(receiver.text)) || [...keys].some((k) => DATE_OPTIONS.has(k));
        if (isDate) report(n, "toLocaleString of a date without timeZone");
      }
    }
    if ((ts.isNewExpression(n) || ts.isCallExpression(n)) && isIntlDateTimeFormat(n.expression) && !optionKeys(n.arguments?.[1]).has("timeZone")) {
      report(n, "Intl.DateTimeFormat without timeZone");
    }
    ts.forEachChild(n, visit);
  };
  visit(sf);
  return found;
}

function sourceFiles(dir: string): string[] {
  if (!existsSync(dir)) return [];
  return readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const path = join(dir, e.name);
    if (e.isDirectory()) return sourceFiles(path);
    return /\.tsx?$/.test(e.name) && !/\.(test|d)\.tsx?$/.test(e.name) ? [path] : [];
  });
}

describe("dates on screens are Korea time", () => {
  it("catches a date formatted without the helpers or a timeZone (the check checks)", () => {
    const zoneDependent = [
      'const t = (iso: string) => new Date(iso).toLocaleTimeString("ko-KR", { hour: "2-digit", minute: "2-digit" });',
      'const d = (iso: string) => new Date(iso).toLocaleDateString("ko-KR");',
      'const w = (iso: string) => new Date(iso).toLocaleString("ko-KR");',
      'const x = new Date(); const s = x.toLocaleString("ko-KR");',
      "const f = (n: Date) => n.toLocaleString();",
      'const y = (v: { at: Date }) => v.at.toLocaleString("ko-KR", { dateStyle: "short", timeStyle: "short" });',
      'const z = new Intl.DateTimeFormat("ko-KR", { month: "long" }).format(new Date());',
      "const h = (d: Date) => d.getHours();",
      "const g = (iso: string) => new Date(iso).getDate();",
      'const OPTS = { hour: "2-digit" } as const; const o = new Date().toLocaleTimeString("ko-KR", OPTS);',
      'const m = <p>{new Date(b.since).toLocaleDateString("ko-KR")} 차단</p>;'
    ];
    const korean = [
      'const t = (iso: string) => formatKstTime(iso, { hour: "2-digit", minute: "2-digit" });',
      'const d = (iso: string) => new Date(iso).toLocaleDateString("ko-KR", { timeZone: "Asia/Seoul" });',
      'const f = new Intl.DateTimeFormat("ko-KR", { timeZone: SERVICE_TIME_ZONE, month: "long" });',
      'const OPTS = { timeZone: "Asia/Seoul", hour: "2-digit" } as const; const o = new Date().toLocaleTimeString("ko-KR", OPTS);',
      'const n = (v: number) => v.toLocaleString("ko-KR");',
      "const a = (x: { amount: number }) => x.amount.toLocaleString();",
      "const u = (d: Date) => d.getUTCHours() + d.getTime();",
      "const k = kstParts(iso).hour;"
    ];
    for (const src of zoneDependent) expect(zoneDependentFormats("sample.tsx", src), src).toHaveLength(1);
    for (const src of korean) expect(zoneDependentFormats("sample.tsx", src), src).toEqual([]);
  });

  it("formats every date on the screens in Korea time", () => {
    const files = SCREEN_DIRS.flatMap((d) => sourceFiles(join(SRC, d)));
    expect(files.length).toBeGreaterThan(30);
    const found = files.flatMap((f) => zoneDependentFormats(relative(SRC, f).replaceAll("\\", "/"), readFileSync(f, "utf8")));
    expect(found, "Format dates with lib/format.ts formatKst · formatKstDate · formatKstTime · kstParts · kstIsoString, or pass timeZone").toEqual([]);
  }, 30_000); // parses every screen file: give a busy machine room
});
