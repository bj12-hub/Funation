"use client";

import type { ReactNode } from "react";
import { formatNumber } from "@/lib/format";
import { PreviewStage } from "@/features/overlayTheme/PreviewStage";
import { ThemeChoiceField } from "@/features/overlayTheme/ThemeChoiceField";
import { effectLabel, resolveTheme } from "@/services/creator/overlayThemeTypes";
import { eventLines, recentLines } from "@/services/creator/widgetOverlayCore";
import { EventView, RecentView } from "./WidgetViews";
import { SAMPLE_ALERTS } from "./widgetSamples";
import {
  EVENT_ORDERS,
  EVENT_STYLES,
  RECENT_EFFECTS,
  RECENT_PLATFORMS,
  RECENT_SCROLL_SPEEDS,
  TEMPLATE_MAX
} from "@/services/creator/widgetSettingsTypes";
import { FontFields, NumberField, Preview, Radios, Row, Section, Select, SwitchText } from "./fields";
import type { FormProps } from "./forms";
import { fontStyle } from "./previewStyle";
import styles from "./widgets.module.css";


function Stacked({ label, children, htmlFor }: { label: string; children: ReactNode; htmlFor?: string }) {
  return (
    <Row stacked label={label} htmlFor={htmlFor}>
      {children}
    </Row>
  );
}

function SwitchLine({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <div className={styles.switchLine}>
      <span className={styles.rowLabel}>{label}</span>
      <SwitchText label={label} checked={checked} onChange={onChange} />
    </div>
  );
}

// ── 최근알림 (531:1370) ────────────────────────────────────────────────────────

export function RecentForm({ value: v, onChange, live }: FormProps<"RECENT">) {
  const set = <P extends keyof typeof v>(k: P, x: (typeof v)[P]) => onChange({ ...v, [k]: x });
  return (
    <>
      <Section title="미리보기">
        <PreviewStage width={800} minHeight={120} label="최근알림 미리보기">
          <RecentView settings={v} lines={recentLines(SAMPLE_ALERTS, v)} theme={resolveTheme(live.appearance, v.theme)} />
        </PreviewStage>
      </Section>
      <Section title="테마">
        <div className={styles.rows}>
          <ThemeChoiceField value={v.theme} onChange={(x) => set("theme", x)} appearance={live.appearance} />
          <SwitchText label="배경 카드" checked={v.card} onChange={(x) => set("card", x)} text="테마 카드 위에 그려요. 끄면 글자만 방송 화면 위에 (아래 글자 색 · 외곽선 사용)" />
        </div>
      </Section>
      <Section title="기본 설정">
        <div className={styles.rows}>
          <div className={styles.grid2}>
            <Stacked label="알림 효과">
              <Select label="알림 효과" value={v.effect} options={RECENT_EFFECTS} width={220} format={effectLabel} onChange={(x) => set("effect", x)} />
            </Stacked>
            <Stacked label="표시 개수">
              <NumberField label="표시 개수" value={v.count} max={10} width={120} suffix="개" onChange={(x) => set("count", x)} />
            </Stacked>
            <Stacked label="줄 간격">
              <NumberField label="줄 간격" value={v.lineGap} max={50} width={120} suffix="px" onChange={(x) => set("lineGap", x)} />
            </Stacked>
            <Stacked label="스크롤 이동 속도">
              <Select label="스크롤 이동 속도" value={v.scrollSpeedSec} options={RECENT_SCROLL_SPEEDS} format={(s) => `${s}초`} onChange={(x) => set("scrollSpeedSec", x)} />
            </Stacked>
          </div>
          <Stacked label="알림 폰트 설정">
            <FontFields label="알림" value={v.font} onChange={(x) => set("font", x)} />
          </Stacked>
          <SwitchLine label="닉네임 컬러 사용하기" checked={v.nicknameColor} onChange={(x) => set("nicknameColor", x)} />
          <SwitchLine label="텍스트 외곽선 표시하기" checked={v.textOutline} onChange={(x) => set("textOutline", x)} />
          <div className={styles.subCard}>
            <strong>플랫폼별 알림 템플릿</strong>
            <p className={styles.hint}>
              {"{nickname}"} 닉네임 · {"{amount}"} 금액 · {"{count}"} 개수
            </p>
            {RECENT_PLATFORMS.map((p) => (
              <Stacked key={p.key} label={`${p.label} 템플릿`} htmlFor={`tpl-${p.key}`}>
                <input
                  id={`tpl-${p.key}`}
                  className={styles.input}
                  maxLength={TEMPLATE_MAX}
                  value={v.templates[p.key]}
                  onChange={(e) => set("templates", { ...v.templates, [p.key]: e.target.value })}
                />
              </Stacked>
            ))}
          </div>
        </div>
      </Section>
    </>
  );
}

// ── 이벤트 (531:1598) ──────────────────────────────────────────────────────────

export function EventForm({ value: v, onChange, live }: FormProps<"EVENT">) {
  const set = <P extends keyof typeof v>(k: P, x: (typeof v)[P]) => onChange({ ...v, [k]: x });
  return (
    <>
      <Section title="미리보기">
        <PreviewStage width={500} minHeight={160} label="이벤트 미리보기">
          <EventView settings={v} lines={eventLines(SAMPLE_ALERTS, v)} theme={resolveTheme(live.appearance, v.theme)} now={null} />
        </PreviewStage>
      </Section>
      <Section title="테마">
        <ThemeChoiceField value={v.theme} onChange={(x) => set("theme", x)} appearance={live.appearance} />
      </Section>
      <Section title="기본 설정">
        <div className={styles.rows}>
          <Stacked label="위젯 스타일">
            <Radios name="event-style" label="위젯 스타일" options={EVENT_STYLES} value={v.style} onChange={(x) => set("style", x)} />
          </Stacked>
          <div className={styles.grid2}>
            <Stacked label="표시 순서">
              <Select label="표시 순서" value={v.order} options={EVENT_ORDERS} onChange={(x) => set("order", x)} />
            </Stacked>
            <Stacked label="알림 효과">
              <Select label="알림 효과" value={v.effect} options={RECENT_EFFECTS} width={220} format={effectLabel} onChange={(x) => set("effect", x)} />
            </Stacked>
          </div>
          <Stacked label="폰트 설정">
            <FontFields label="이벤트" value={v.font} onChange={(x) => set("font", x)} />
          </Stacked>
          <SwitchLine label="닉네임 컬러 사용하기" checked={v.nicknameColor} onChange={(x) => set("nicknameColor", x)} />
          <Stacked label="닉네임 배경 사용">
            <Radios
              name="event-nick-bg"
              label="닉네임 배경 사용"
              options={[
                { key: "ON", label: "사용함" },
                { key: "OFF", label: "사용 안 함" }
              ]}
              value={v.nicknameBackground ? "ON" : "OFF"}
              onChange={(x) => set("nicknameBackground", x === "ON")}
            />
          </Stacked>
          <div className={styles.grid2}>
            <Stacked label="최대 표시 줄">
              <NumberField label="최대 표시 줄" value={v.maxLines} max={20} width={120} suffix="줄" onChange={(x) => set("maxLines", x)} />
            </Stacked>
            <Stacked label="감추기 시간">
              <NumberField label="감추기 시간" value={v.hideAfterSec} max={3600} width={120} suffix="초" onChange={(x) => set("hideAfterSec", x)} />
            </Stacked>
          </div>
          <SwitchLine label="자동으로 감추기 사용" checked={v.autoHide} onChange={(x) => set("autoHide", x)} />
        </div>
      </Section>
    </>
  );
}

// ── 미니후원 (531:1826) ────────────────────────────────────────────────────────

export function MiniForm({ value: v, onChange, live }: FormProps<"MINI">) {
  const set = <P extends keyof typeof v>(k: P, x: (typeof v)[P]) => onChange({ ...v, [k]: x });
  const sampleAmount = Math.max(500, live.miniMinAmount);
  const shown = sampleAmount >= v.minAmount;
  return (
    <>
      <Preview>
        <div className={`${styles.miniPreview} ${v.style === "BUBBLE" ? styles.miniBubble : ""}`}>
          {shown ? (
            <p
              className={v.style === "SCROLL" ? (v.direction === "RTL" ? styles.marqueeRtl : styles.marqueeLtr) : undefined}
              style={{ ...fontStyle(v.font, v.textOutline), animationDuration: `${Math.round(22 - v.speed / 5)}s`, paddingLeft: `${v.startPercent}%` }}
            >
              💸 {v.showNickname && "홍길동님 "}
              {v.showAmount && `${formatNumber(sampleAmount)} FN `}후원! &quot;항상 응원합니다 화이팅!&quot;
            </p>
          ) : (
            <p className={styles.hint}>최소 표시 금액보다 작은 후원은 표시되지 않아요.</p>
          )}
        </div>
      </Preview>
      <Section title="기본 설정">
        <div className={styles.rows}>
          <div className={styles.grid2}>
            <Stacked label="스타일">
              <Radios
                name="mini-style"
                label="스타일"
                options={[
                  { key: "SCROLL", label: "스크롤형" },
                  { key: "BUBBLE", label: "말풍선형" }
                ]}
                value={v.style}
                onChange={(x) => set("style", x)}
              />
            </Stacked>
            <Stacked label="방향">
              <Radios
                name="mini-dir"
                label="방향"
                options={[
                  { key: "RTL", label: "오른쪽에서 왼쪽" },
                  { key: "LTR", label: "왼쪽에서 오른쪽" }
                ]}
                value={v.direction}
                onChange={(x) => set("direction", x)}
              />
            </Stacked>
            <Stacked label="속도">
              <NumberField label="속도" value={v.speed} max={100} width={120} suffix="(1~100)" onChange={(x) => set("speed", Math.max(1, x))} />
            </Stacked>
            <Stacked label="텍스트 시작 위치">
              <NumberField label="텍스트 시작 위치" value={v.startPercent} max={100} width={120} suffix="%" onChange={(x) => set("startPercent", x)} />
            </Stacked>
          </div>
          <SwitchLine label="금액 표시하기" checked={v.showAmount} onChange={(x) => set("showAmount", x)} />
          <SwitchLine label="닉네임 표시하기" checked={v.showNickname} onChange={(x) => set("showNickname", x)} />
          <Stacked label="최소 표시 금액">
            <NumberField label="최소 표시 금액" value={v.minAmount} max={1_000_000} grouped width={160} suffix="FN" onChange={(x) => set("minAmount", x)} />
          </Stacked>
          <Stacked label="폰트 설정">
            <FontFields label="미니후원" value={v.font} onChange={(x) => set("font", x)} />
          </Stacked>
          <SwitchLine label="텍스트 외곽선 표시" checked={v.textOutline} onChange={(x) => set("textOutline", x)} />
        </div>
      </Section>
    </>
  );
}
