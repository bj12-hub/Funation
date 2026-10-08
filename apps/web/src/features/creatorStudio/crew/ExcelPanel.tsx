"use client";

import { useState } from "react";
import { formatNumber } from "@/lib/format";
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
      <summary>자동엑셀 · 원화 환산 · 배수</summary>
      <div className={feed.excel}>
        <div className={styles.addRow}>
          <span className={styles.muted}>점수 기준</span>
          <span className={styles.segment} role="group" aria-label="점수 기준">
            {(["FN", "KRW"] as const).map((u) => (
              <button key={u} type="button" aria-pressed={settings.unit === u} disabled={pending} onClick={() => settings.unit !== u && send({ unit: u })}>
                {u === "FN" ? "FN 그대로" : "원화 환산"}
              </button>
            ))}
          </span>
        </div>
        <p className={styles.note}>
          {krw
            ? "모든 후원을 원으로 바꿔 점수로 써요 (1원 = 1점). 환산값을 비워 둔 단위는 0점으로 두고 표시만 해요."
            : "썸네이션 FN 후원만 점수에 들어가요 (1 FN = 1점). 플랫폼 후원까지 합치려면 원화 환산으로 바꿔 주세요."}
        </p>

        {krw && (
          <fieldset className={feed.rates}>
            <legend>환산값 (1단위 = 원) — 직접 입력, 기본값 없음</legend>
            {RATE_UNITS.map((u) => (
              <label key={u.key} className={feed.rate}>
                <span>1 {u.label}</span>
                <input
                  key={`${u.key}-${settings.rates[u.key] ?? ""}`}
                  className={styles.inputSmall}
                  inputMode="decimal"
                  aria-label={`${u.label} 환산값(원)`}
                  placeholder="미설정"
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
          <strong>배수 규칙</strong>
          <p className={styles.note}>
            {krw ? "원화" : "FN"} 기준 금액 이상인 후원의 기여도에 배수를 곱해요. 여러 규칙에 맞으면 가장 높은 기준을 써요. 후원마다 기여도를 직접 입력하면 그 값이 우선이에요.
          </p>
          <ul className={feed.ruleList}>
            {settings.rules.map((r, i) => (
              <li key={`${r.min}-${r.multiplier}`}>
                <input
                  className={styles.inputSmall}
                  inputMode="numeric"
                  aria-label={`규칙 ${i + 1} 기준 금액`}
                  defaultValue={r.min}
                  onBlur={(e) => {
                    const min = toNumber(e.target.value);
                    if (min !== null && min !== r.min) setRule(i, { ...r, min });
                  }}
                />
                <span className={styles.muted}>{krw ? "원" : "FN"} 이상 ×</span>
                <input
                  className={styles.inputSmall}
                  inputMode="decimal"
                  aria-label={`규칙 ${i + 1} 배수`}
                  defaultValue={r.multiplier}
                  onBlur={(e) => {
                    const multiplier = toNumber(e.target.value);
                    if (multiplier !== null && multiplier !== r.multiplier) setRule(i, { ...r, multiplier });
                  }}
                />
                <button type="button" className={styles.ghost} disabled={pending} onClick={() => setRule(i, null)}>
                  삭제
                </button>
              </li>
            ))}
            {draft.map((d, i) => (
              <li key={`draft-${i}`}>
                <input
                  className={styles.inputSmall}
                  inputMode="numeric"
                  aria-label="새 규칙 기준 금액"
                  placeholder="기준 금액"
                  value={d.min}
                  onChange={(e) => setDraft(draft.map((x, j) => (j === i ? { ...x, min: e.target.value.replace(/[^\d]/g, "") } : x)))}
                  onBlur={() => commitDraft(i)}
                />
                <span className={styles.muted}>{krw ? "원" : "FN"} 이상 ×</span>
                <input
                  className={styles.inputSmall}
                  inputMode="decimal"
                  aria-label="새 규칙 배수"
                  placeholder="배수"
                  value={d.multiplier}
                  onChange={(e) => setDraft(draft.map((x, j) => (j === i ? { ...x, multiplier: e.target.value.replace(/[^\d.]/g, "") } : x)))}
                  onBlur={() => commitDraft(i)}
                />
                <button type="button" className={styles.ghost} onClick={() => setDraft(draft.filter((_, j) => j !== i))}>
                  삭제
                </button>
              </li>
            ))}
          </ul>
          {settings.rules.length + draft.length < EXCEL_RULES_MAX && (
            <div className={styles.actions}>
              <button type="button" className={styles.ghost} onClick={() => setDraft([...draft, { min: "", multiplier: "" }])}>
                + 규칙 추가
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
  const used = SOURCES.filter((s) => rows.some((r) => r.points[s.key] !== undefined));
  const shown = used.length ? used : SOURCES.slice(0, 1);
  return (
    <div className={feed.tableWrap}>
      <table className={feed.table}>
        <caption>플랫폼 · BJ별 기여도</caption>
        <thead>
          <tr>
            <th scope="col">BJ</th>
            {shown.map((s) => (
              <th key={s.key} scope="col">
                {s.label}
              </th>
            ))}
            <th scope="col">합계</th>
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
