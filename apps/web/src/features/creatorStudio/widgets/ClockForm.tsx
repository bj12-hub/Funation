"use client";

import { useEffect, useId, useState } from "react";
import { PreviewStage } from "@/features/overlayTheme/PreviewStage";
import { useI18n } from "@/lib/i18n/I18nProvider";
import { ThemeChoiceField } from "@/features/overlayTheme/ThemeChoiceField";
import { resolveTheme } from "@/services/creator/overlayThemeTypes";
import { CLOCK_LABEL_MAX, CLOCK_STYLES } from "@/services/creator/widgetSettingsTypes";
import { ClockView } from "./ClockView";
import { Row, Section, SwitchText } from "./fields";
import type { FormProps } from "./forms";
import { translatedOptions } from "./widgetFormLabels";
import a from "./alertForm.module.css";
import styles from "./widgets.module.css";

/**
 * 시계 위젯 설정 — code-first (2026-10-08, from the legacy FlexTV 도우미 시계). Korean time; the preview ticks on this
 * browser's clock, the overlay on the server's.
 */
export function ClockForm({ value: v, onChange, live }: FormProps<"CLOCK">) {
  const set = <P extends keyof typeof v>(k: P, x: (typeof v)[P]) => onChange({ ...v, [k]: x });
  const id = useId();
  const [now, setNow] = useState<number | null>(null);
  const { t } = useI18n();
  useEffect(() => {
    setNow(Date.now());
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);

  return (
    <>
      <Section title={t("widgetForm.preview")}>
        <PreviewStage width={600} minHeight={200} label={t("widgetFormClock.previewAria")}>
          <ClockView settings={v} now={now} theme={resolveTheme(live.appearance, v.theme)} />
        </PreviewStage>
        <p className={styles.hint}>{t("widgetFormClock.previewHint")}</p>
      </Section>

      <Section title={t("widgetForm.theme")}>
        <ThemeChoiceField value={v.theme} onChange={(x) => set("theme", x)} appearance={live.appearance} />
      </Section>

      <Section title={t("widgetFormClock.shape")}>
        <div role="radiogroup" aria-label={t("widgetFormClock.shape")} className={a.layouts}>
          {translatedOptions(CLOCK_STYLES, t).map((s) => (
            <label key={s.key} className={a.layout} data-checked={v.style === s.key || undefined}>
              <input type="radio" name={`${id}-style`} className={styles.srOnly} checked={v.style === s.key} onChange={() => set("style", s.key)} />
              <strong>{s.label}</strong>
              <span>{s.hint}</span>
            </label>
          ))}
        </div>
      </Section>

      <Section title={t("widgetForm.display")}>
        <div className={styles.rows}>
          <Row label={t("widgetFormClock.hour12")}>
            <SwitchText label={t("widgetFormClock.hour12")} checked={v.hour12} onChange={(x) => set("hour12", x)} text={t("widgetFormClock.hour12Hint")} />
          </Row>
          <Row label={t("widgetFormClock.seconds")}>
            <SwitchText label={t("widgetFormClock.showSeconds")} checked={v.showSeconds} onChange={(x) => set("showSeconds", x)} />
          </Row>
          <Row label={t("widgetFormClock.date")}>
            <SwitchText label={t("widgetFormClock.showDate")} checked={v.showDate} onChange={(x) => set("showDate", x)} text={t("widgetFormClock.dateHint")} />
          </Row>
          <Row label={t("widgetFormClock.label")} htmlFor={`${id}-label`}>
            <input
              id={`${id}-label`}
              className={styles.input}
              value={v.label}
              maxLength={CLOCK_LABEL_MAX}
              placeholder={t("widgetFormClock.labelPlaceholder")}
              onChange={(e) => set("label", e.target.value)}
            />
          </Row>
        </div>
      </Section>
    </>
  );
}
