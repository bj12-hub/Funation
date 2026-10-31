"use client";

import { useState } from "react";
import { formatNumber } from "@/lib/format";
import { useI18n } from "@/lib/i18n/I18nProvider";
import type { MessageKey } from "@/lib/i18n/translate";
import { setExcelSettings } from "@/services/crew/crewFeed";
import {
  EXCEL_RULES_MAX,
  EXCEL_UNITS,
  type BroadcastResult,
  type ExcelSettings,
  type ExcelUnit,
  type FeedSourceKey,
  type FeedSummaryRow,
  type MultiplierRule
} from "@/services/crew/crewTypes";
import { PLATFORM_LABEL } from "@/types/platform";
import styles from "./crew.module.css";
import feed from "./feed.module.css";

const SOURCES: { key: FeedSourceKey; label: string }[] = [
  { key: "SSUMNATION", label: "썸네이션" },
  { key: "YOUTUBE", label: PLATFORM_LABEL.YOUTUBE },
  { key: "SOOP", label: PLATFORM_LABEL.SOOP },
  { key: "CHZZK", label: PLATFORM_LABEL.CHZZK },
  { key: "FLEXTV", label: PLATFORM_LABEL.FLEXTV },
  { key: "BANK", label: "계좌" }
];
/** Source labels that read differently per language; platform names show as written. */
const SOURCE_KEY: Partial<Record<FeedSourceKey, MessageKey>> = { SSUMNATION: "crewOpsFeed.originSsumnation", BANK: "crewOpsFeed.originBank" };
/** 원 is the 원화 기준 itself; every other unit takes a value from the creator. */
const RATE_UNITS = EXCEL_UNITS.filter((u) => u.key !== "KRW");
const toNumber = (s: string) => (s.trim() === "" ? null : Number(s.replace(/,/g, "")));

/**
 * 자동엑셀 — code-first (no Figma frame), inside the 후원 리스트 while live. 점수 기준 (FN 그대로 /
 * 원화 환산), the creator's own 환산값 (1 unit = N원; no defaults — platform rates are TBD) and 배수
 * 규칙. Every edit is sent at once (blur / Enter); the server recomputes all scores.
 */
export function ExcelPanel({
  settings,
  pending,
  run
}: {
  settings: ExcelSettings;
  pending: boolean;
  run: (action: () => Promise<BroadcastResult>, ok?: string) => void;
}) {
  const { t } = useI18n();
  // Rule rows being typed (a row is sent once both numbers are valid).
  const [draft, setDraft] = useState<{ min: string; multiplier: string }[]>([]);
  const send = (next: Partial<ExcelSettings>) => run(() => setExcelSettings({ ...settings, ...next }));
  const krw = settings.unit === "KRW";

  const setRate = (unit: ExcelUnit, raw: string) => {
    const value = toNumber(raw);
    if ((settings.rates[unit] ?? null) === value) return;
    send({ rates: { ...settings.rates, [unit]: value } });
  };
  const setRule = (i: number, next: MultiplierRule | null) => {
    const rules = settings.rules.filter((_, j) => j !== i);
    send({ rules: next ? [...rules, next] : rules });
  };
  const commitDraft = (i: number) => {
    const d = draft[i];
    const min = toNumber(d.min);
    const multiplier = toNumber(d.multiplier);
    if (min === null || multiplier === null) return;
    setDraft(draft.filter((_, j) => j !== i));
    send({ rules: [...settings.rules, { min, multiplier }] });
  };

  return (
    <details className={feed.panel} open>
      <summary>{t("crewOpsFeed.excelTitle")}</summary>
      <div className={feed.excel}>
        <div className={styles.addRow}>
          <span className={styles.muted}>{t("crewOpsFeed.basis")}</span>
          <span className={styles.segment} role="group" aria-label={t("crewOpsFeed.basis")}>
            {(["FN", "KRW"] as const).map((u) => (
              <button key={u} type="button" aria-pressed={settings.unit === u} disabled={pending} onClick={() => settings.unit !== u && send({ unit: u })}>
                {u === "FN" ? t("crewOpsFeed.basisFn") : t("crewOpsFeed.basisKrw")}
              </button>
            ))}
          </span>
        </div>
        <p className={styles.note}>
          {krw
            ? t("crewOpsFeed.krwNote")
            : t("crewOpsFeed.fnNote")}
        </p>

        {krw && (
          <fieldset className={feed.rates}>
            <legend>{t("crewOpsFeed.ratesLegend")}</legend>
            {RATE_UNITS.map((u) => (
              <label key={u.key} className={feed.rate}>
                <span>1 {u.label}</span>
                <input
                  key={`${u.key}-${settings.rates[u.key] ?? ""}`}
                  className={styles.inputSmall}
                  inputMode="decimal"
                  aria-label={t("crewOpsFeed.rateAria", { unit: u.label })}
                  placeholder={t("crewOpsFeed.notSet")}
                  defaultValue={settings.rates[u.key] ?? ""}
                  onBlur={(e) => setRate(u.key, e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && (e.target as HTMLInputElement).blur()}
                />
                <span className={styles.muted}>원</span>
              </label>
            ))}
          </fieldset>
        )}

        <div className={feed.rules}>
          <strong>{t("crewOpsFeed.rulesTitle")}</strong>
          <p className={styles.note}>{t("crewOpsFeed.rulesNote", { basis: krw ? t("crewOpsFeed.krwWord") : "FN" })}</p>
          <ul className={feed.ruleList}>
            {settings.rules.map((r, i) => (
              <li key={`${r.min}-${r.multiplier}`}>
                <input
                  className={styles.inputSmall}
                  inputMode="numeric"
                  aria-label={t("crewOpsFeed.ruleMinAria", { n: i + 1 })}
                  defaultValue={r.min}
                  onBlur={(e) => {
                    const min = toNumber(e.target.value);
                    if (min !== null && min !== r.min) setRule(i, { ...r, min });
                  }}
                />
                <span className={styles.muted}>{t("crewOpsFeed.ruleAtLeast", { unit: krw ? "원" : "FN" })}</span>
                <input
                  className={styles.inputSmall}
                  inputMode="decimal"
                  aria-label={t("crewOpsFeed.ruleMultiplierAria", { n: i + 1 })}
                  defaultValue={r.multiplier}
                  onBlur={(e) => {
                    const multiplier = toNumber(e.target.value);
                    if (multiplier !== null && multiplier !== r.multiplier) setRule(i, { ...r, multiplier });
                  }}
                />
                <button type="button" className={styles.ghost} disabled={pending} onClick={() => setRule(i, null)}>
                  {t("crewOps.delete")}
                </button>
              </li>
            ))}
            {draft.map((d, i) => (
              <li key={`draft-${i}`}>
                <input
                  className={styles.inputSmall}
                  inputMode="numeric"
                  aria-label={t("crewOpsFeed.newRuleMinAria")}
                  placeholder={t("crewOpsFeed.ruleMinPlaceholder")}
                  value={d.min}
                  onChange={(e) => setDraft(draft.map((x, j) => (j === i ? { ...x, min: e.target.value.replace(/[^\d]/g, "") } : x)))}
                  onBlur={() => commitDraft(i)}
                />
                <span className={styles.muted}>{t("crewOpsFeed.ruleAtLeast", { unit: krw ? "원" : "FN" })}</span>
                <input
                  className={styles.inputSmall}
                  inputMode="decimal"
                  aria-label={t("crewOpsFeed.newRuleMultiplierAria")}
                  placeholder={t("crewOps.multiplierLabel")}
                  value={d.multiplier}
                  onChange={(e) => setDraft(draft.map((x, j) => (j === i ? { ...x, multiplier: e.target.value.replace(/[^\d.]/g, "") } : x)))}
                  onBlur={() => commitDraft(i)}
                />
                <button type="button" className={styles.ghost} onClick={() => setDraft(draft.filter((_, j) => j !== i))}>
                  {t("crewOps.delete")}
                </button>
              </li>
            ))}
          </ul>
          {settings.rules.length + draft.length < EXCEL_RULES_MAX && (
            <div className={styles.actions}>
              <button type="button" className={styles.ghost} onClick={() => setDraft([...draft, { min: "", multiplier: "" }])}>
                {t("crewOpsFeed.addRule")}
              </button>
            </div>
          )}
        </div>
      </div>
    </details>
  );
}

/** 플랫폼 · BJ별 정리: 기여도 per source for each member (server values, refreshed with the view). */
export function ExcelSummary({ rows }: { rows: FeedSummaryRow[] }) {
  const { t } = useI18n();
  const used = SOURCES.filter((s) => rows.some((r) => r.points[s.key] !== undefined));
  const shown = used.length ? used : SOURCES.slice(0, 1);
  return (
    <div className={feed.tableWrap}>
      <table className={feed.table}>
        <caption>{t("crewOpsFeed.summaryCaption")}</caption>
        <thead>
          <tr>
            <th scope="col">{t("crewOpsFeed.colBj")}</th>
            {shown.map((s) => (
              <th key={s.key} scope="col">
                {SOURCE_KEY[s.key] ? t(SOURCE_KEY[s.key]!) : s.label}
              </th>
            ))}
            <th scope="col">{t("crewOpsFeed.colTotal")}</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.memberId ?? "none"} data-muted={r.memberId === null ? "" : undefined}>
              <th scope="row">
                {r.color && <span className={styles.dot} style={{ background: r.color }} aria-hidden="true" />} {r.name}
              </th>
              {shown.map((s) => (
                <td key={s.key}>{r.points[s.key] === undefined ? "-" : formatNumber(r.points[s.key]!)}</td>
              ))}
              <td>
                <strong>{formatNumber(r.total)}</strong>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
