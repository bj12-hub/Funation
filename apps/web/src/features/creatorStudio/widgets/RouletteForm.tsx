"use client";

import { formatNumber } from "@/lib/format";
import { useI18n } from "@/lib/i18n/I18nProvider";
import { ROULETTE_DAILY_LIMIT_MAX, ROULETTE_ITEMS_MAX, ROULETTE_ITEMS_MIN, ROULETTE_ITEM_MAX_CHARS, ROULETTE_SPIN_SEC, PRIZE_MAX, type RouletteItem } from "@/services/creator/widgetSettingsTypes";
import { rouletteColor } from "@/services/donations/rouletteTypes";
import { PreviewStage } from "@/features/overlayTheme/PreviewStage";
import { ThemeChoiceField } from "@/features/overlayTheme/ThemeChoiceField";
import { resolveTheme } from "@/services/creator/overlayThemeTypes";
import { NumberField, Row, Section, SwitchText } from "./fields";
import { RouletteView } from "./GameViews";
import type { FormProps } from "./forms";
import styles from "./widgets.module.css";

const uid = () => `rl-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;

/**
 * 룰렛 설정 — code-first (펀페이 1009:510 · 1009:355). Prizes are the creator's own (2026-10-04 결정: FN 지급
 * 없음). The server draws when a viewer pays; the wheel spins on the 룰렛 overlay and the 리모컨 starts it
 * when 자동 시작 is off.
 */
export function RouletteForm({ value: v, onChange, live }: FormProps<"ROULETTE">) {
  const set = <P extends keyof typeof v>(k: P, x: (typeof v)[P]) => onChange({ ...v, [k]: x });
  const setItem = (id: string, patch: Partial<RouletteItem>) => set("items", v.items.map((it) => (it.id === id ? { ...it, ...patch } : it)));
  const total = v.items.reduce((sum, it) => sum + it.percent, 0);
  const { t } = useI18n();

  return (
    <>
      <Section title={t("widgetForm.preview")}>
        <PreviewStage width={640} minHeight={240} label={t("widgetFormRoulette.previewAria")}>
          <div style={{ opacity: v.enabled ? 1 : 0.4 }}>
            <RouletteView
              stage={{ id: "sample", no: "R-0001", status: "SPINNING", donor: "하루봄", amount: v.minAmount, items: total === 100 ? v.items : [{ name: "합계를 100%로", percent: 100 }], nth: 1, limit: v.dailyLimit, result: null, endsAt: "" }}
              theme={resolveTheme(live.appearance, v.theme)}
            />
          </div>
        </PreviewStage>
        <div className={styles.roulettePreview}>
          <ul className={styles.wheelLegend}>
            {v.items.map((it, i) => (
              <li key={it.id}>
                <span className={styles.wheelDot} style={{ background: rouletteColor(it.name, i) }} aria-hidden="true" />
                {it.name.trim() || t("widgetForm.itemN", { n: i + 1 })} · {it.percent}%
              </li>
            ))}
          </ul>
        </div>
      </Section>
      <Section title={t("widgetForm.theme")}>
        <ThemeChoiceField value={v.theme} onChange={(x) => set("theme", x)} appearance={live.appearance} />
      </Section>

      <Section title={t("widgetForm.basic")}>
        <div className={styles.rows}>
          <p className={styles.notice}>{t("widgetFormRoulette.notice")}</p>
          <Row label={t("widgetFormRoulette.accept")}>
            <SwitchText
              label={t("widgetFormRoulette.acceptLabel")}
              checked={v.enabled}
              onChange={(x) => set("enabled", x)}
              text={v.enabled ? t("widgetFormRoulette.acceptOn") : t("widgetFormRoulette.acceptOff")}
            />
          </Row>
          <Row label={t("widgetFormRoulette.minAmount")}>
            <NumberField
              label={t("widgetFormRoulette.minAmount")}
              value={v.minAmount}
              max={PRIZE_MAX}
              grouped
              width={140}
              suffix={t("widgetFormRoulette.minSuffix")}
              onChange={(x) => set("minAmount", x)}
            />
          </Row>
          <Row label={t("widgetFormRoulette.limit")}>
            <NumberField
              label={t("widgetFormRoulette.limitLabel")}
              value={v.dailyLimit}
              max={ROULETTE_DAILY_LIMIT_MAX}
              suffix={v.dailyLimit === 0 ? t("widgetFormRoulette.limitNone") : t("widgetForm.limitSuffix")}
              onChange={(x) => set("dailyLimit", x)}
            />
          </Row>
          <Row label={t("widgetFormRoulette.spin")}>
            <NumberField
              label={t("widgetFormRoulette.spin")}
              value={v.spinSec}
              max={ROULETTE_SPIN_SEC.max}
              suffix={t("widgetFormRoulette.spinSuffix", { min: ROULETTE_SPIN_SEC.min, max: ROULETTE_SPIN_SEC.max })}
              onChange={(x) => set("spinSec", x)}
            />
          </Row>
          <Row label={t("widgetFormRoulette.reveal")}>
            <SwitchText
              label={t("widgetFormRoulette.reveal")}
              checked={v.autoReveal}
              onChange={(x) => set("autoReveal", x)}
              text={v.autoReveal ? t("widgetFormRoulette.revealOn") : t("widgetFormRoulette.revealOff")}
            />
          </Row>
          <Row label={t("widgetFormRoulette.autoStart")}>
            <SwitchText
              label={t("widgetFormRoulette.autoStartLabel")}
              checked={v.autoStart}
              onChange={(x) => set("autoStart", x)}
              text={v.autoStart ? t("widgetFormRoulette.autoStartOn") : t("widgetFormRoulette.autoStartOff")}
            />
          </Row>
        </div>
      </Section>

      <Section
        title={t("widgetFormRoulette.items")}
        aside={
          <button
            type="button"
            className={styles.blueButton}
            disabled={v.items.length >= ROULETTE_ITEMS_MAX}
            onClick={() => set("items", [...v.items, { id: uid(), name: "", percent: 0 }])}
          >
            {t("widgetFormRoulette.addItem")}
          </button>
        }
      >
        <div className={styles.rows}>
          <p className={styles.notice}>{t("widgetFormRoulette.itemsNotice")}</p>
          <ul className={styles.prizeList}>
            {v.items.map((it, i) => (
              <li key={it.id}>
                <input
                  aria-label={t("widgetFormRoulette.itemName", { n: i + 1 })}
                  className={styles.input}
                  maxLength={ROULETTE_ITEM_MAX_CHARS}
                  placeholder={t("widgetFormRoulette.itemPlaceholder", { max: ROULETTE_ITEM_MAX_CHARS })}
                  value={it.name}
                  onChange={(e) => setItem(it.id, { name: e.target.value })}
                />
                <NumberField label={t("widgetFormRoulette.itemProb", { n: i + 1 })} value={it.percent} max={100} width={70} suffix="%" onChange={(x) => setItem(it.id, { percent: x })} />
                {v.items.length > ROULETTE_ITEMS_MIN && (
                  <button
                    type="button"
                    className={styles.iconButton}
                    aria-label={t("widgetForm.itemDelete", { n: i + 1 })}
                    onClick={() => set("items", v.items.filter((x) => x.id !== it.id))}
                  >
                    ✕
                  </button>
                )}
              </li>
            ))}
          </ul>
          <p className={total === 100 ? styles.okText : styles.warnText} role="status">
            {t("widgetForm.probTotal", { total })} {total === 100 ? "" : t("widgetForm.probWarn")}
          </p>
          <p className={styles.hint}>{t("widgetFormRoulette.footHint", { min: formatNumber(v.minAmount) })}</p>
        </div>
      </Section>
    </>
  );
}
