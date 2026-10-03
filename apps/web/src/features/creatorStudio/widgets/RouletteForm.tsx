"use client";

import { formatNumber } from "@/lib/format";
import { ROULETTE_DAILY_LIMIT_MAX, ROULETTE_ITEMS_MAX, ROULETTE_ITEMS_MIN, ROULETTE_ITEM_MAX_CHARS, ROULETTE_SPIN_SEC, PRIZE_MAX, type RouletteItem } from "@/services/creator/widgetSettingsTypes";
import { rouletteColor, wheelGradient } from "@/services/donations/rouletteTypes";
import { NumberField, Preview, Row, Section, SwitchText } from "./fields";
import type { FormProps } from "./forms";
import styles from "./widgets.module.css";

const uid = () => `rl-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;

/**
 * 룰렛 설정 — code-first (펀페이 1009:510 · 1009:355). Prizes are the creator's own (2026-10-04 결정: FN 지급
 * 없음). The server draws when a viewer pays; the wheel spins on the 룰렛 overlay and the 리모컨 starts it
 * when 자동 시작 is off.
 */
export function RouletteForm({ value: v, onChange }: FormProps<"ROULETTE">) {
  const set = <P extends keyof typeof v>(k: P, x: (typeof v)[P]) => onChange({ ...v, [k]: x });
  const setItem = (id: string, patch: Partial<RouletteItem>) => set("items", v.items.map((it) => (it.id === id ? { ...it, ...patch } : it)));
  const total = v.items.reduce((sum, it) => sum + it.percent, 0);

  return (
    <>
      <Preview>
        <div className={styles.roulettePreview} style={{ opacity: v.enabled ? 1 : 0.4 }}>
          <span className={styles.wheel} style={{ background: total === 100 ? wheelGradient(v.items) : "#334155" }} aria-hidden="true" />
          <ul className={styles.wheelLegend}>
            {v.items.map((it, i) => (
              <li key={it.id}>
                <span className={styles.wheelDot} style={{ background: rouletteColor(it.name, i) }} aria-hidden="true" />
                {it.name.trim() || `항목 ${i + 1}`} · {it.percent}%
              </li>
            ))}
          </ul>
        </div>
      </Preview>

      <Section title="기본 설정">
        <div className={styles.rows}>
          <p className={styles.notice}>※ 룰렛 당첨 항목은 크리에이터가 방송에서 진행하는 상품 · 미션이에요. FN으로 지급되지 않아요.</p>
          <Row label="후원 받기">
            <SwitchText label="룰렛 후원 받기" checked={v.enabled} onChange={(x) => set("enabled", x)} text={v.enabled ? "방송 방에서 참여할 수 있어요" : "방송 방에 '룰렛이 꺼져 있어요'로 보여요"} />
          </Row>
          <Row label="최소 참여 금액">
            <NumberField label="최소 참여 금액" value={v.minAmount} max={PRIZE_MAX} grouped width={140} suffix="FN 이상 · 1회 참여" onChange={(x) => set("minAmount", x)} />
          </Row>
          <Row label="참여 가능 횟수">
            <NumberField
              label="1인 하루 참여 가능 횟수"
              value={v.dailyLimit}
              max={ROULETTE_DAILY_LIMIT_MAX}
              suffix={v.dailyLimit === 0 ? "회 (0 = 제한 없음)" : "회 (1인 하루, 기준 기간 TBD)"}
              onChange={(x) => set("dailyLimit", x)}
            />
          </Row>
          <Row label="회전 시간">
            <NumberField label="회전 시간" value={v.spinSec} max={ROULETTE_SPIN_SEC.max} suffix={`초 (${ROULETTE_SPIN_SEC.min}~${ROULETTE_SPIN_SEC.max})`} onChange={(x) => set("spinSec", x)} />
          </Row>
          <Row label="자동 시작">
            <SwitchText
              label="룰렛 자동 시작"
              checked={v.autoStart}
              onChange={(x) => set("autoStart", x)}
              text={v.autoStart ? "앞 순서가 끝나면 바로 돌아가요" : "리모컨에서 ▶ 시작을 눌러 돌려요"}
            />
          </Row>
        </div>
      </Section>

      <Section
        title="룰렛 항목 및 확률"
        aside={
          <button
            type="button"
            className={styles.blueButton}
            disabled={v.items.length >= ROULETTE_ITEMS_MAX}
            onClick={() => set("items", [...v.items, { id: uid(), name: "", percent: 0 }])}
          >
            + 항목 추가
          </button>
        }
      >
        <div className={styles.rows}>
          <p className={styles.notice}>※ 시청자는 참여 전에 항목과 확률을 볼 수 있어요. &quot;꽝&quot;이라는 이름의 항목은 꽝으로 보여요.</p>
          <ul className={styles.prizeList}>
            {v.items.map((it, i) => (
              <li key={it.id}>
                <input
                  aria-label={`항목 ${i + 1} 이름`}
                  className={styles.input}
                  maxLength={ROULETTE_ITEM_MAX_CHARS}
                  placeholder={`항목 이름 (${ROULETTE_ITEM_MAX_CHARS}자 이내)`}
                  value={it.name}
                  onChange={(e) => setItem(it.id, { name: e.target.value })}
                />
                <NumberField label={`항목 ${i + 1} 확률`} value={it.percent} max={100} width={70} suffix="%" onChange={(x) => setItem(it.id, { percent: x })} />
                {v.items.length > ROULETTE_ITEMS_MIN && (
                  <button type="button" className={styles.iconButton} aria-label={`항목 ${i + 1} 삭제`} onClick={() => set("items", v.items.filter((x) => x.id !== it.id))}>
                    ✕
                  </button>
                )}
              </li>
            ))}
          </ul>
          <p className={total === 100 ? styles.okText : styles.warnText} role="status">
            확률 합계 {total}% {total === 100 ? "" : "— 합계가 100%가 되어야 저장할 수 있어요."}
          </p>
          <p className={styles.hint}>최소 {formatNumber(v.minAmount)} FN 이상 후원하면 1회 참여해요. 금액이 커도 1회예요.</p>
        </div>
      </Section>
    </>
  );
}
