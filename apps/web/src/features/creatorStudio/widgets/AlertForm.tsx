"use client";

import Link from "next/link";
import { useId, useRef, useState } from "react";
import { PreviewStage } from "@/features/overlayTheme/PreviewStage";
import { ThemeChoiceField } from "@/features/overlayTheme/ThemeChoiceField";
import { OVERLAY_MOTIONS, resolveTheme } from "@/services/creator/overlayThemeTypes";
import { ALERT_HEADLINE_MAX, ALERT_LAYOUTS, ALERT_TOKENS } from "@/services/creator/widgetSettingsTypes";
import { AlertCard, type AlertCardData } from "../remote/AlertCard";
import { Row, Section, Select, SwitchText } from "./fields";
import type { FormProps } from "./forms";
import a from "./alertForm.module.css";
import styles from "./widgets.module.css";

/** Sample donations for the preview (fictional names; display only). */
const SAMPLES: { key: string; label: string; alert: AlertCardData }[] = [
  {
    key: "fn",
    label: "썸네이션 후원",
    alert: { id: "sample-fn", donor: "하루봄", message: "오늘 방송도 너무 재밌어요! 끝까지 달려요 🔥", fnAmount: 10_000, typeLabel: "텍스트 후원", badges: ["플래티넘", "다이아", "열혈 팬"] }
  },
  {
    key: "signature",
    label: "시그니처 후원",
    alert: { id: "sample-sig", donor: "도도쭈", message: "시그 나와라 얍!", fnAmount: 50_000, typeLabel: "시그니처 후원", imageUrl: "/mock/room/signatures/sig-3.png", badges: ["골드"] }
  },
  {
    key: "platform",
    label: "치지직 후원",
    alert: { id: "sample-chzzk", donor: "밤톨게임", message: "치지직에서 보내요~", fnAmount: 0, amountLabel: "1,000 치즈", typeLabel: "치지직 후원", platform: "CHZZK" }
  }
];

/**
 * 후원 알림 디자인 (code-first, 2026-10-08 오버레이 테마 개편). The preview is the OBS card itself (AlertCard) on a
 * stream-like backdrop; 표시 시간 · 볼륨 · 최소 금액 stay on the 리모컨.
 */
export function AlertForm({ value: v, onChange, live }: FormProps<"ALERT">) {
  const set = <P extends keyof typeof v>(k: P, x: (typeof v)[P]) => onChange({ ...v, [k]: x });
  const [sample, setSample] = useState(SAMPLES[0].key);
  const [replay, setReplay] = useState(0);
  const [vertical, setVertical] = useState(false);
  const headlineRef = useRef<HTMLInputElement>(null);
  const id = useId();
  const theme = resolveTheme(live.appearance, v.theme);
  const current = SAMPLES.find((s) => s.key === sample) ?? SAMPLES[0];
  const headlineOk = v.headline.trim().length > 0 && v.headline.includes(ALERT_TOKENS.donor);

  const insert = (token: string) => {
    const el = headlineRef.current;
    const at = el?.selectionStart ?? v.headline.length;
    const end = el?.selectionEnd ?? at;
    const next = (v.headline.slice(0, at) + token + v.headline.slice(end)).slice(0, ALERT_HEADLINE_MAX);
    set("headline", next);
    requestAnimationFrame(() => {
      el?.focus();
      el?.setSelectionRange(at + token.length, at + token.length);
    });
  };

  return (
    <>
      <Section
        title="미리보기"
        aside={
          <span className={styles.inline}>
            <label className={styles.hint}>
            <input type="checkbox" checked={vertical} onChange={(e) => setVertical(e.target.checked)} /> 세로 방송으로 보기
          </label>
            <button type="button" className={styles.smallButton} onClick={() => setReplay((n) => n + 1)}>
              ↻ 다시 재생
            </button>
          </span>
        }
      >
        <div role="radiogroup" aria-label="미리보기 후원" className={a.samples}>
          {SAMPLES.map((s) => (
            <label key={s.key} className={a.sample} data-checked={sample === s.key || undefined}>
              <input
                type="radio"
                name={`${id}-sample`}
                className={styles.srOnly}
                checked={sample === s.key}
                onChange={() => {
                  setSample(s.key);
                  setReplay((n) => n + 1);
                }}
              />
              {s.label}
            </label>
          ))}
        </div>
        <PreviewStage width={vertical ? 1080 : 800} minHeight={v.layout === "BANNER" ? 180 : 360} label="후원 알림 미리보기">
          <AlertCard alert={current.alert} design={headlineOk ? v : { ...v, headline: `${ALERT_TOKENS.donor}님` }} theme={theme} replay={replay} vertical={vertical} />
        </PreviewStage>
        <p className={styles.hint}>실제 방송에 나가는 알림과 같은 모양이에요. 미리보기는 저장하지 않아도 바로 바뀌어요.</p>
      </Section>

      <Section title="테마">
        <ThemeChoiceField value={v.theme} onChange={(x) => set("theme", x)} appearance={live.appearance} />
      </Section>

      <Section title="알림 모양">
        <div role="radiogroup" aria-label="알림 모양" className={a.layouts}>
          {ALERT_LAYOUTS.map((l) => (
            <label key={l.key} className={a.layout} data-checked={v.layout === l.key || undefined}>
              <input type="radio" name={`${id}-layout`} className={styles.srOnly} checked={v.layout === l.key} onChange={() => set("layout", l.key)} />
              <span className={a.layoutIcon} data-layout={l.key} aria-hidden="true" />
              <strong>{l.label}</strong>
              <span>{l.hint}</span>
            </label>
          ))}
        </div>
      </Section>

      <Section title="문구">
        <div className={styles.rows}>
          <Row label="알림 문구" htmlFor={`${id}-headline`}>
            <div className={a.headlineBox}>
              <input
                ref={headlineRef}
                id={`${id}-headline`}
                className={styles.input}
                value={v.headline}
                maxLength={ALERT_HEADLINE_MAX}
                aria-invalid={!headlineOk || undefined}
                aria-describedby={`${id}-headline-hint`}
                onChange={(e) => set("headline", e.target.value)}
              />
              <span className={a.tokens}>
                <button type="button" className={a.token} onClick={() => insert(ALERT_TOKENS.donor)}>
                  + 닉네임
                </button>
                <button type="button" className={a.token} onClick={() => insert(ALERT_TOKENS.amount)}>
                  + 금액
                </button>
              </span>
              <span id={`${id}-headline-hint`} className={headlineOk ? styles.hint : a.invalid}>
                {headlineOk
                  ? `금액은 따로 크게 보여 줘요. 문장 안에도 넣으려면 ${ALERT_TOKENS.amount}을 쓰세요. (${v.headline.length}/${ALERT_HEADLINE_MAX})`
                  : `${ALERT_TOKENS.donor}을 넣어 주세요.`}
              </span>
            </div>
          </Row>
          <Row label="후원 메시지">
            <SwitchText label="후원 메시지 표시" checked={v.showMessage} onChange={(x) => set("showMessage", x)} text="시청자가 쓴 메시지를 함께 보여 줘요" />
          </Row>
          <Row label="등급 · 칭호">
            <SwitchText label="등급 · 칭호 배지 표시" checked={v.showBadges} onChange={(x) => set("showBadges", x)} text="후원자의 등급 · 칭호 배지" />
          </Row>
          <Row label="후원 종류">
            <SwitchText label="후원 종류 표시" checked={v.showPlatform} onChange={(x) => set("showPlatform", x)} text="시그니처 · 치지직 후원 같은 종류와 플랫폼 표시" />
          </Row>
          <Row label="시그니처 이미지">
            <SwitchText label="시그니처 이미지 표시" checked={v.showImage} onChange={(x) => set("showImage", x)} text="시그니처 후원이면 이미지를 함께" />
          </Row>
        </div>
      </Section>

      <Section title="움직임">
        <div className={styles.rows}>
          <Row label="등장 효과">
            <Select
              label="등장 효과"
              value={v.motion}
              options={OVERLAY_MOTIONS.map((m) => m.key)}
              width={200}
              format={(k) => OVERLAY_MOTIONS.find((m) => m.key === k)?.label ?? k}
              onChange={(x) => {
                set("motion", x);
                setReplay((n) => n + 1);
              }}
            />
          </Row>
          <Row label="금액 올라가기">
            <SwitchText label="금액 올라가는 효과" checked={v.countUp} onChange={(x) => set("countUp", x)} text="0부터 후원 금액까지 숫자가 올라가요" />
          </Row>
        </div>
      </Section>

      <p className={a.remoteNote}>
        알림 표시 시간 · 볼륨 · 최소 금액 · 대기열은 <Link href="/creator/remote">리모컨</Link>에서 바꿔요.
      </p>
    </>
  );
}
