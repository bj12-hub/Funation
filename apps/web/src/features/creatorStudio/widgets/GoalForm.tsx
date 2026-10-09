"use client";

import { useId, useState } from "react";
import { PreviewStage } from "@/features/overlayTheme/PreviewStage";
import { ThemeChoiceField } from "@/features/overlayTheme/ThemeChoiceField";
import { resolveTheme } from "@/services/creator/overlayThemeTypes";
import { GOAL_ALTERNATE_SEC, GOAL_AMOUNT_MAX, GOAL_SHAPES, GOAL_STYLES, GOAL_TITLE_MAX } from "@/services/creator/widgetSettingsTypes";
import { ColorField, FontFields, NumberField, Radios, Row, Section, SwitchText } from "./fields";
import type { FormProps } from "./forms";
import { GoalView } from "./GoalView";
import gf from "./goalForm.module.css";
import styles from "./widgets.module.css";

/** Whole days left until the end of `to` in Korea time, as the overlay counts them (widgetOverlayCore.ts, server time). */
function daysLeft(to: string) {
  const end = new Date(`${to}T23:59:59.999+09:00`).getTime();
  if (Number.isNaN(end)) return null;
  return Math.max(0, Math.ceil((end - Date.now()) / 86_400_000));
}

const progress = (start: number, goal: number, donated: number) => {
  const current = start + donated;
  return { current, percent: goal > 0 ? Math.round(Math.min(100, (current / goal) * 100) * 10) / 10 : 0 };
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

  return (
    <>
      <Section
        title="미리보기"
        aside={
          <label className={styles.hint}>
            <input type="checkbox" checked={vertical} onChange={(e) => setVertical(e.target.checked)} /> 세로 방송으로 보기
          </label>
        }
      >
        <PreviewStage width={vertical ? 1080 : 800} minHeight={bar ? 120 : 200} label="후원목표 미리보기">
          <GoalView
            settings={v}
            first={progress(v.startAmount, v.goalAmount, live.goalCurrent)}
            second={v.second.enabled ? progress(v.second.startAmount, v.second.goalAmount, live.goalCurrent) : null}
            daysLeft={daysLeft(v.to)}
            theme={resolveTheme(live.appearance, v.theme)}
            vertical={vertical}
          />
        </PreviewStage>
        {v.second.enabled && <p className={styles.hint}>두 목표가 {v.alternateSec}초마다 번갈아 보여요.</p>}
      </Section>

      <Section title="테마">
        <ThemeChoiceField value={v.theme} onChange={(x) => set("theme", x)} appearance={live.appearance} />
      </Section>

      <Section title="목표 모양">
        <div role="radiogroup" aria-label="목표 모양" className={gf.shapes}>
          {GOAL_SHAPES.map((s) => (
            <label key={s.key} className={gf.shape} data-checked={v.shape === s.key || undefined}>
              <input type="radio" name={`${id}-shape`} className={styles.srOnly} checked={v.shape === s.key} onChange={() => set("shape", s.key)} />
              <span className={gf.icon} data-shape={s.key} aria-hidden="true" />
              {s.label}
            </label>
          ))}
        </div>
      </Section>

      <Section title="기본 설정">
        <div className={styles.rows}>
          {bar && (
            <Row label="글자 배치">
              <Radios name="goal-style" label="글자 배치" options={GOAL_STYLES} value={v.style} onChange={(x) => set("style", x)} />
            </Row>
          )}
          <Row label="목표 제목" htmlFor={`${id}-title`}>
            <input id={`${id}-title`} className={styles.input} value={v.title} maxLength={GOAL_TITLE_MAX} onChange={(e) => set("title", e.target.value)} />
          </Row>
          <Row label="시작 금액">
            <NumberField label="시작 금액" value={v.startAmount} max={GOAL_AMOUNT_MAX} grouped width={160} suffix="FN" onChange={(x) => set("startAmount", x)} />
          </Row>
          <Row label="목표 금액">
            <NumberField label="목표 금액" value={v.goalAmount} max={GOAL_AMOUNT_MAX} grouped width={160} suffix="FN" onChange={(x) => set("goalAmount", x)} />
          </Row>
          <Row label="산정 기간">
            <div className={styles.inline}>
              <input type="date" aria-label="산정 시작일" className={styles.input} value={v.from} max={v.to} onChange={(e) => set("from", e.target.value)} />
              <span className={styles.suffix}>~</span>
              <input type="date" aria-label="산정 종료일" className={styles.input} value={v.to} min={v.from} onChange={(e) => set("to", e.target.value)} />
            </div>
          </Row>
          <Row label="달성 비율 표시">
            <SwitchText label="달성 비율 표시" checked={v.showPercent} onChange={(x) => set("showPercent", x)} text="퍼센트(%) 정보 실시간 표시" />
          </Row>
        </div>
      </Section>

      <Section title="두 번째 목표">
        <div className={styles.rows}>
          <Row label="번갈아 보여 주기">
            <SwitchText label="두 번째 목표 사용" checked={v.second.enabled} onChange={(x) => setSecond("enabled", x)} text="같은 기간의 후원으로 목표를 하나 더 세우고 번갈아 보여 줘요" />
          </Row>
          {v.second.enabled && (
            <>
              <Row label="두 번째 목표 제목" htmlFor={`${id}-title2`}>
                <input
                  id={`${id}-title2`}
                  className={styles.input}
                  value={v.second.title}
                  maxLength={GOAL_TITLE_MAX}
                  placeholder="예: 이번 달 장기 목표"
                  onChange={(e) => setSecond("title", e.target.value)}
                />
              </Row>
              <Row label="시작 금액">
                <NumberField label="두 번째 목표 시작 금액" value={v.second.startAmount} max={GOAL_AMOUNT_MAX} grouped width={160} suffix="FN" onChange={(x) => setSecond("startAmount", x)} />
              </Row>
              <Row label="목표 금액">
                <NumberField label="두 번째 목표 금액" value={v.second.goalAmount} max={GOAL_AMOUNT_MAX} grouped width={160} suffix="FN" onChange={(x) => setSecond("goalAmount", x)} />
              </Row>
              <Row label="바꾸는 간격">
                <NumberField
                  label="번갈아 보여 줄 간격"
                  value={v.alternateSec}
                  max={GOAL_ALTERNATE_SEC.max}
                  suffix={`초마다 (${GOAL_ALTERNATE_SEC.min}~${GOAL_ALTERNATE_SEC.max}초)`}
                  onChange={(x) => set("alternateSec", x)}
                />
              </Row>
            </>
          )}
        </div>
      </Section>

      <Section title="색상 · 글자">
        <div className={styles.rows}>
          <Row label="색상">
            <SwitchText label="색상 직접 고르기" checked={v.customColors} onChange={(x) => set("customColors", x)} text="끄면 테마의 포인트 색상을 써요" />
          </Row>
          {v.customColors && (
            <>
              <Row label="채우기 색상">
                <ColorField label="채우기 색상" value={v.barColor} onChange={(x) => set("barColor", x)} />
              </Row>
              <Row label="배경 색상">
                <ColorField label="배경 색상" value={v.barBackground} onChange={(x) => set("barBackground", x)} />
              </Row>
            </>
          )}
          {bar && (
            <Row label="바 세로 크기">
              <NumberField label="바 세로 크기" value={v.barHeight} max={120} suffix="px" onChange={(x) => set("barHeight", x)} />
            </Row>
          )}
          <Row label="텍스트 외곽선">
            <SwitchText label="텍스트 외곽선" checked={v.textOutline} onChange={(x) => set("textOutline", x)} text="글꼴 가독성 향상 테두리" />
          </Row>
          <Row label="서체 및 크기">
            <FontFields label="목표" value={v.font} onChange={(x) => set("font", x)} />
          </Row>
        </div>
      </Section>
    </>
  );
}
