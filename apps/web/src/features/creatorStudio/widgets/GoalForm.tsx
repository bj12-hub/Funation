"use client";

import { useId, useState } from "react";
import { PreviewStage } from "@/features/overlayTheme/PreviewStage";
import { ThemeChoiceField } from "@/features/overlayTheme/ThemeChoiceField";
import { formatNumber } from "@/lib/format";
import { useI18n } from "@/lib/i18n/I18nProvider";
import { resolveTheme } from "@/services/creator/overlayThemeTypes";
import { raisedGoal } from "@/services/creator/widgetOverlayCore";
import { GOAL_ALTERNATE_SEC, GOAL_AMOUNT_MAX, GOAL_SHAPES, GOAL_STYLES, GOAL_TITLE_MAX } from "@/services/creator/widgetSettingsTypes";
import { ColorField, FontFields, NumberField, Radios, Row, Section, SwitchText } from "./fields";
import type { FormProps } from "./forms";
import { GoalView } from "./GoalView";
import { translatedOptions } from "./widgetFormLabels";
import gf from "./goalForm.module.css";
import styles from "./widgets.module.css";

/** Whole days left until the end of `to` in Korea time, as the overlay counts them (widgetOverlayCore.ts, server time). */
function daysLeft(to: string) {
  const end = new Date(`${to}T23:59:59.999+09:00`).getTime();
  if (Number.isNaN(end)) return null;
  return Math.max(0, Math.ceil((end - Date.now()) / 86_400_000));
}

const progress = (start: number, goal: number, donated: number, step = 0) => {
  const current = start + donated;
  const target = raisedGoal(goal, current, step);
  return { current, target, percent: target > 0 ? Math.round(Math.min(100, (current / target) * 100) * 10) / 10 : 0 };
};

/**
 * 후원목표 (Figma 364:265; 2026-10-08 오버레이 테마 · 모양 · 두 번째 목표, code-first). The preview is the OBS goal
 * itself (GoalView) at the 800px source width; amounts use the server's donated sum for the period.
 */
export function GoalForm({ value: v, onChange, live }: FormProps<"GOAL">) {
  const set = <P extends keyof typeof v>(k: P, x: (typeof v)[P]) => onChange({ ...v, [k]: x });
  const setSecond = <P extends keyof typeof v.second>(k: P, x: (typeof v.second)[P]) => onChange({ ...v, second: { ...v.second, [k]: x } });
  const id = useId();
  const bar = v.shape === "BAR";
  const [vertical, setVertical] = useState(false);
  const { t } = useI18n();

  return (
    <>
      <Section
        title={t("widgetForm.preview")}
        aside={
          <label className={styles.hint}>
            <input type="checkbox" checked={vertical} onChange={(e) => setVertical(e.target.checked)} /> {t("widgetForm.verticalView")}
          </label>
        }
      >
        <PreviewStage width={vertical ? 1080 : 800} minHeight={bar ? 120 : 200} label={t("widgetFormGoal.previewAria")}>
          <GoalView
            settings={v}
            first={progress(v.startAmount, v.goalAmount, live.goalCurrent, v.autoRaise)}
            second={v.second.enabled ? progress(v.second.startAmount, v.second.goalAmount, live.goalCurrent) : null}
            daysLeft={daysLeft(v.to)}
            theme={resolveTheme(live.appearance, v.theme)}
            vertical={vertical}
          />
        </PreviewStage>
        {v.second.enabled && <p className={styles.hint}>{t("widgetFormGoal.alternateHint", { sec: v.alternateSec })}</p>}
      </Section>

      <Section title={t("widgetForm.theme")}>
        <ThemeChoiceField value={v.theme} onChange={(x) => set("theme", x)} appearance={live.appearance} />
      </Section>

      <Section title={t("widgetFormGoal.shape")}>
        <div role="radiogroup" aria-label={t("widgetFormGoal.shape")} className={gf.shapes}>
          {translatedOptions(GOAL_SHAPES, t).map((s) => (
            <label key={s.key} className={gf.shape} data-checked={v.shape === s.key || undefined}>
              <input type="radio" name={`${id}-shape`} className={styles.srOnly} checked={v.shape === s.key} onChange={() => set("shape", s.key)} />
              <span className={gf.icon} data-shape={s.key} aria-hidden="true" />
              {s.label}
            </label>
          ))}
        </div>
      </Section>

      <Section title={t("widgetForm.basic")}>
        <div className={styles.rows}>
          {bar && (
            <Row label={t("widgetFormGoal.textLayout")}>
              <Radios name="goal-style" label={t("widgetFormGoal.textLayout")} options={translatedOptions(GOAL_STYLES, t)} value={v.style} onChange={(x) => set("style", x)} />
            </Row>
          )}
          <Row label={t("widgetFormGoal.goalTitle")} htmlFor={`${id}-title`}>
            <input id={`${id}-title`} className={styles.input} value={v.title} maxLength={GOAL_TITLE_MAX} onChange={(e) => set("title", e.target.value)} />
          </Row>
          <Row label={t("widgetFormGoal.startAmount")}>
            <NumberField label={t("widgetFormGoal.startAmount")} value={v.startAmount} max={GOAL_AMOUNT_MAX} grouped width={160} suffix="FN" onChange={(x) => set("startAmount", x)} />
          </Row>
          <Row label={t("widgetFormGoal.goalAmount")}>
            <NumberField label={t("widgetFormGoal.goalAmount")} value={v.goalAmount} max={GOAL_AMOUNT_MAX} grouped width={160} suffix="FN" onChange={(x) => set("goalAmount", x)} />
          </Row>
          <Row label={t("widgetFormGoal.autoRaise")}>
            <NumberField
              label={t("widgetFormGoal.autoRaise")}
              value={v.autoRaise}
              max={GOAL_AMOUNT_MAX}
              grouped
              width={160}
              suffix={t("widgetFormGoal.autoRaiseSuffix")}
              onChange={(x) => set("autoRaise", x)}
            />
          </Row>
          {v.autoRaise > 0 && (
            <p className={styles.hint}>
              {t("widgetFormGoal.autoRaiseHint", {
                goal: formatNumber(v.goalAmount),
                step: formatNumber(v.autoRaise),
                next: formatNumber(v.goalAmount + v.autoRaise)
              })}
            </p>
          )}
          <Row label={t("widgetForm.period")}>
            <div className={styles.inline}>
              <input type="date" aria-label={t("widgetFormGoal.fromDate")} className={styles.input} value={v.from} max={v.to} onChange={(e) => set("from", e.target.value)} />
              <span className={styles.suffix}>~</span>
              <input type="date" aria-label={t("widgetFormGoal.toDate")} className={styles.input} value={v.to} min={v.from} onChange={(e) => set("to", e.target.value)} />
            </div>
          </Row>
          <Row label={t("widgetFormGoal.showPercent")}>
            <SwitchText label={t("widgetFormGoal.showPercent")} checked={v.showPercent} onChange={(x) => set("showPercent", x)} text={t("widgetFormGoal.showPercentHint")} />
          </Row>
        </div>
      </Section>

      <Section title={t("widgetFormGoal.second")}>
        <div className={styles.rows}>
          <Row label={t("widgetFormGoal.alternate")}>
            <SwitchText label={t("widgetFormGoal.useSecond")} checked={v.second.enabled} onChange={(x) => setSecond("enabled", x)} text={t("widgetFormGoal.useSecondHint")} />
          </Row>
          {v.second.enabled && (
            <>
              <Row label={t("widgetFormGoal.secondTitle")} htmlFor={`${id}-title2`}>
                <input
                  id={`${id}-title2`}
                  className={styles.input}
                  value={v.second.title}
                  maxLength={GOAL_TITLE_MAX}
                  placeholder={t("widgetFormGoal.secondTitlePlaceholder")}
                  onChange={(e) => setSecond("title", e.target.value)}
                />
              </Row>
              <Row label={t("widgetFormGoal.startAmount")}>
                <NumberField
                  label={t("widgetFormGoal.secondStart")}
                  value={v.second.startAmount}
                  max={GOAL_AMOUNT_MAX}
                  grouped
                  width={160}
                  suffix="FN"
                  onChange={(x) => setSecond("startAmount", x)}
                />
              </Row>
              <Row label={t("widgetFormGoal.goalAmount")}>
                <NumberField
                  label={t("widgetFormGoal.secondGoal")}
                  value={v.second.goalAmount}
                  max={GOAL_AMOUNT_MAX}
                  grouped
                  width={160}
                  suffix="FN"
                  onChange={(x) => setSecond("goalAmount", x)}
                />
              </Row>
              <Row label={t("widgetFormGoal.interval")}>
                <NumberField
                  label={t("widgetFormGoal.intervalLabel")}
                  value={v.alternateSec}
                  max={GOAL_ALTERNATE_SEC.max}
                  suffix={t("widgetFormGoal.intervalSuffix", { min: GOAL_ALTERNATE_SEC.min, max: GOAL_ALTERNATE_SEC.max })}
                  onChange={(x) => set("alternateSec", x)}
                />
              </Row>
            </>
          )}
        </div>
      </Section>

      <Section title={t("widgetFormGoal.colorsText")}>
        <div className={styles.rows}>
          <Row label={t("widgetFormGoal.color")}>
            <SwitchText label={t("widgetFormGoal.customColors")} checked={v.customColors} onChange={(x) => set("customColors", x)} text={t("widgetFormGoal.customColorsHint")} />
          </Row>
          {v.customColors && (
            <>
              <Row label={t("widgetFormGoal.fill")}>
                <ColorField label={t("widgetFormGoal.fill")} value={v.barColor} onChange={(x) => set("barColor", x)} />
              </Row>
              <Row label={t("widgetFormGoal.background")}>
                <ColorField label={t("widgetFormGoal.background")} value={v.barBackground} onChange={(x) => set("barBackground", x)} />
              </Row>
            </>
          )}
          {bar && (
            <Row label={t("widgetFormGoal.barHeight")}>
              <NumberField label={t("widgetFormGoal.barHeight")} value={v.barHeight} max={120} suffix="px" onChange={(x) => set("barHeight", x)} />
            </Row>
          )}
          <Row label={t("widgetFormGoal.outline")}>
            <SwitchText label={t("widgetFormGoal.outline")} checked={v.textOutline} onChange={(x) => set("textOutline", x)} text={t("widgetFormGoal.outlineHint")} />
          </Row>
          <Row label={t("widgetFormGoal.font")}>
            <FontFields label={t("widgetFormGoal.fontLabel")} value={v.font} onChange={(x) => set("font", x)} />
          </Row>
        </div>
      </Section>
    </>
  );
}
