"use client";

import { useEffect, useId, useState } from "react";
import { PreviewStage } from "@/features/overlayTheme/PreviewStage";
import { ThemeChoiceField } from "@/features/overlayTheme/ThemeChoiceField";
import { resolveTheme } from "@/services/creator/overlayThemeTypes";
import { CLOCK_LABEL_MAX, CLOCK_STYLES } from "@/services/creator/widgetSettingsTypes";
import { ClockView } from "./ClockView";
import { Row, Section, SwitchText } from "./fields";
import type { FormProps } from "./forms";
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
  useEffect(() => {
    setNow(Date.now());
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  return (
    <>
      <Section title="미리보기">
        <PreviewStage width={600} minHeight={200} label="시계 미리보기">
          <ClockView settings={v} now={now} theme={resolveTheme(live.appearance, v.theme)} />
        </PreviewStage>
        <p className={styles.hint}>한국 시간으로 보여 줘요. OBS를 켠 PC의 시계가 틀려도 썸네이션 서버 시각에 맞춰요.</p>
      </Section>

      <Section title="테마">
        <ThemeChoiceField value={v.theme} onChange={(x) => set("theme", x)} appearance={live.appearance} />
      </Section>

      <Section title="시계 모양">
        <div role="radiogroup" aria-label="시계 모양" className={a.layouts}>
          {CLOCK_STYLES.map((s) => (
            <label key={s.key} className={a.layout} data-checked={v.style === s.key || undefined}>
              <input type="radio" name={`${id}-style`} className={styles.srOnly} checked={v.style === s.key} onChange={() => set("style", s.key)} />
              <strong>{s.label}</strong>
              <span>{s.hint}</span>
            </label>
          ))}
        </div>
      </Section>

      <Section title="표시">
        <div className={styles.rows}>
          <Row label="12시간제">
            <SwitchText label="12시간제" checked={v.hour12} onChange={(x) => set("hour12", x)} text="오전 · 오후로 보여 줘요 (끄면 24시간제)" />
          </Row>
          <Row label="초">
            <SwitchText label="초 표시" checked={v.showSeconds} onChange={(x) => set("showSeconds", x)} />
          </Row>
          <Row label="날짜">
            <SwitchText label="날짜 표시" checked={v.showDate} onChange={(x) => set("showDate", x)} text="10월 8일 (수)처럼 시각 아래에" />
          </Row>
          <Row label="위 문구" htmlFor={`${id}-label`}>
            <input
              id={`${id}-label`}
              className={styles.input}
              value={v.label}
              maxLength={CLOCK_LABEL_MAX}
              placeholder="예: 오늘 방송 끝 11시"
              onChange={(e) => set("label", e.target.value)}
            />
          </Row>
        </div>
      </Section>
    </>
  );
}
