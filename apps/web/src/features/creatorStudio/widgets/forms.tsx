"use client";

import Image from "next/image";
import { useState } from "react";
import { DownloadIcon } from "@/components/icons";
import { formatNumber } from "@/lib/format";
import {
  ALERT_EFFECTS_IN,
  ALERT_EFFECTS_OUT,
  CHAT_MAX_FILTERS,
  CHAT_MAX_LINES,
  CHAT_STYLES,
  GOAL_AMOUNT_MAX,
  GOAL_STYLES,
  GOAL_TITLE_MAX,
  NICKNAME_BG,
  NICKNAME_MAX,
  QR_CAPTION_MAX,
  QR_STYLES,
  TOTAL_TEMPLATE_MAX,
  TOTAL_TEMPLATE_TOKEN,
  TOTAL_TITLE_MAX,
  type EditableWidgetKey,
  type WidgetLiveData,
  type WidgetSettingsMap
} from "@/services/creator/widgetSettingsTypes";
import { ColorField, FontFields, NumberField, Preview, Radios, Row, Section, Select, SwitchText } from "./fields";
import { fontStyle } from "./previewStyle";
import styles from "./widgets.module.css";

export type FormProps<K extends EditableWidgetKey> = {
  value: WidgetSettingsMap[K];
  onChange: (v: WidgetSettingsMap[K]) => void;
  live: WidgetLiveData;
};

// ── 채팅창 (364:6) ─────────────────────────────────────────────────────────────

const CHAT_SAMPLE = [
  { flag: "🇰🇷", nick: "홍길동", color: "#a78bfa", text: "안녕하세요! 반갑습니다." },
  { flag: "🇺🇸", nick: "James", color: "#60a5fa", text: "Awesome stream!" },
  { flag: "🇰🇷", nick: "시청자A", color: "#34d399", text: "오늘 방송 콘텐츠 대박이네요 ㅋㅋㅋ" }
];

export function ChatForm({ value: v, onChange }: FormProps<"CHAT">) {
  const [nick, setNick] = useState("");
  const set = <P extends keyof typeof v>(k: P, x: (typeof v)[P]) => onChange({ ...v, [k]: x });
  const addFilter = () => {
    const n = nick.trim();
    if (!n || v.filteredNicknames.includes(n) || v.filteredNicknames.length >= CHAT_MAX_FILTERS) return;
    set("filteredNicknames", [...v.filteredNicknames, n]);
    setNick("");
  };

  return (
    <>
      <Preview>
        <ul className={`${styles.chatPreview} ${styles[`chat_${v.style}`]}`}>
          {CHAT_SAMPLE.map((m) => (
            <li key={m.nick} style={fontStyle(v.font)}>
              {!v.hidePlatformIcon && <span aria-hidden="true">{m.flag}</span>}
              <b
                className={v.nicknameBackground === "ALWAYS" ? styles.nickBg : undefined}
                style={{ color: v.creatorNicknameColor ? m.color : v.font.color }}
              >
                {m.nick}
              </b>
              <span>{m.text}</span>
            </li>
          ))}
        </ul>
      </Preview>
      <Section title="기본 설정">
        <div className={styles.rows}>
          <Row label="위젯 스타일">
            <Radios name="chat-style" label="위젯 스타일" options={CHAT_STYLES} value={v.style} onChange={(x) => set("style", x)} />
          </Row>
          <Row label="알림 효과">
            <div className={styles.inline}>
              <Select label="나타나는 효과" value={v.effectIn} options={ALERT_EFFECTS_IN} width={120} onChange={(x) => set("effectIn", x)} />
              <Select label="사라지는 효과" value={v.effectOut} options={ALERT_EFFECTS_OUT} width={120} onChange={(x) => set("effectOut", x)} />
            </div>
          </Row>
          <Row label="폰트 설정">
            <FontFields label="채팅" value={v.font} onChange={(x) => set("font", x)} />
          </Row>
          <Row label="닉네임 컬러">
            <SwitchText label="닉네임 컬러" checked={v.creatorNicknameColor} onChange={(x) => set("creatorNicknameColor", x)} text="크리에이터 지정 고유 컬러 사용" />
          </Row>
          <Row label="닉네임 배경">
            <Radios name="nick-bg" label="닉네임 배경" options={NICKNAME_BG} value={v.nicknameBackground} onChange={(x) => set("nicknameBackground", x)} />
          </Row>
          <Row label="채팅 최대 줄">
            <NumberField label="채팅 최대 줄" value={v.maxLines} max={CHAT_MAX_LINES} onChange={(x) => set("maxLines", x)} suffix={`줄 (최대 ${CHAT_MAX_LINES}줄)`} />
          </Row>
          <Row label="자동으로 감추기">
            <SwitchText label="자동으로 감추기" checked={v.autoHide} onChange={(x) => set("autoHide", x)} text="일정 시간 후 채팅 투명화" />
          </Row>
          <Row label="감추기 시간">
            <NumberField label="감추기 시간" value={v.hideAfterSec} max={3600} onChange={(x) => set("hideAfterSec", x)} suffix="초 후 감춤" />
          </Row>
          <Row label="플랫폼 아이콘">
            <SwitchText label="플랫폼 아이콘 숨기기" checked={v.hidePlatformIcon} onChange={(x) => set("hidePlatformIcon", x)} text="유튜브/FlexTV/SOOP 등 플랫폼 아이콘 숨기기" />
          </Row>
          <Row label="필터링 닉네임">
            <div className={styles.filterBox}>
              <div className={styles.inline}>
                <input
                  aria-label="숨길 닉네임"
                  className={styles.input}
                  style={{ width: 200 }}
                  maxLength={NICKNAME_MAX}
                  placeholder="숨길 닉네임 추가..."
                  value={nick}
                  onChange={(e) => setNick(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.nativeEvent.isComposing) {
                      e.preventDefault();
                      addFilter();
                    }
                  }}
                />
                <button type="button" className={styles.smallButton} onClick={addFilter} disabled={!nick.trim() || v.filteredNicknames.length >= CHAT_MAX_FILTERS}>
                  추가
                </button>
              </div>
              {v.filteredNicknames.length > 0 && (
                <ul className={styles.tags}>
                  {v.filteredNicknames.map((n) => (
                    <li key={n}>
                      {n}
                      <button type="button" aria-label={`${n} 삭제`} onClick={() => set("filteredNicknames", v.filteredNicknames.filter((x) => x !== n))}>
                        ✕
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </Row>
        </div>
      </Section>
    </>
  );
}

// ── 후원 QR코드 (364:158) ───────────────────────────────────────────────────────

const QR_RADIUS = { BASIC: 0, ROUND: 12, CIRCLE: 999, SOFT: 24 } as const;

export function QrForm({ value: v, onChange, live }: FormProps<"QR">) {
  const set = <P extends keyof typeof v>(k: P, x: (typeof v)[P]) => onChange({ ...v, [k]: x });
  const caption = v.captionEnabled && v.caption.trim() && (
    <span className={styles.qrCaption} style={{ ...fontStyle(v.captionFont), color: v.borderColor }}>
      {v.caption}
    </span>
  );
  return (
    <>
      <Preview>
        <div className={styles.qrPreview}>
          {v.captionPosition === "TOP" && caption}
          <span className={styles.qrTile} style={{ borderColor: v.borderColor, borderRadius: Math.min(QR_RADIUS[v.codeStyle], 70) }}>
            <Image src={live.qrImageUrl} alt="후원 QR코드" width={120} height={120} />
            {v.centerLogo && (
              <span className={styles.qrLogo} aria-hidden="true">
                F
              </span>
            )}
          </span>
          {v.captionPosition === "BOTTOM" && caption}
        </div>
      </Preview>
      <Section title="기본 설정">
        <div className={styles.rows}>
          <Row label="코드 스타일">
            <Radios name="qr-style" label="코드 스타일" options={QR_STYLES} value={v.codeStyle} onChange={(x) => set("codeStyle", x)} />
          </Row>
          <Row label="테두리 색상">
            <ColorField label="테두리 색상" value={v.borderColor} onChange={(x) => set("borderColor", x)} />
          </Row>
          <Row label="중앙 로고">
            <Radios
              name="qr-logo"
              label="중앙 로고"
              options={[
                { key: "ON", label: "기본 로고 사용" },
                { key: "OFF", label: "사용 안 함" }
              ]}
              value={v.centerLogo ? "ON" : "OFF"}
              onChange={(x) => set("centerLogo", x === "ON")}
            />
          </Row>
          <Row label="문구 정보">
            <Radios
              name="qr-caption"
              label="문구 정보"
              options={[
                { key: "ON", label: "사용하기" },
                { key: "OFF", label: "사용 안함" }
              ]}
              value={v.captionEnabled ? "ON" : "OFF"}
              onChange={(x) => set("captionEnabled", x === "ON")}
            />
          </Row>
          <Row label="문구 입력" htmlFor="qr-caption-text">
            <input
              id="qr-caption-text"
              className={styles.input}
              value={v.caption}
              maxLength={QR_CAPTION_MAX}
              disabled={!v.captionEnabled}
              onChange={(e) => set("caption", e.target.value)}
            />
          </Row>
          <Row label="문구 위치">
            <Radios
              name="qr-pos"
              label="문구 위치"
              options={[
                { key: "TOP", label: "상단 표시" },
                { key: "BOTTOM", label: "하단 표시" }
              ]}
              value={v.captionPosition}
              onChange={(x) => set("captionPosition", x)}
            />
          </Row>
          <Row label="문구 폰트">
            <FontFields label="문구" value={v.captionFont} onChange={(x) => set("captionFont", x)} />
          </Row>
          <Row label="QR 다운로드">
            {/* Mock asset; the backend will render the QR for the creator's donate URL (TBD). */}
            <a href={live.qrImageUrl} download="funation-donate-qr.png" className={styles.outlineButton}>
              <DownloadIcon aria-hidden="true" />
              고화질 QR 이미지 다운로드 (.PNG)
            </a>
          </Row>
        </div>
      </Section>
    </>
  );
}

// ── 후원목표 (364:265) ─────────────────────────────────────────────────────────

function daysLeft(to: string) {
  const end = new Date(`${to}T23:59:59`).getTime();
  if (Number.isNaN(end)) return null;
  return Math.max(0, Math.ceil((end - Date.now()) / 86_400_000));
}

export function GoalForm({ value: v, onChange, live }: FormProps<"GOAL">) {
  const set = <P extends keyof typeof v>(k: P, x: (typeof v)[P]) => onChange({ ...v, [k]: x });
  const current = v.startAmount + live.goalCurrent;
  const pct = v.goalAmount > 0 ? Math.min(100, (current / v.goalAmount) * 100) : 0;
  const left = daysLeft(v.to);
  const text = fontStyle({ ...v.font, color: "#FFFFFF" }, v.textOutline);
  const amount = (
    <strong style={{ ...text, color: v.barColor }}>
      {formatNumber(current)} FN{v.showPercent && ` (${pct.toFixed(1)}%)`}
    </strong>
  );

  return (
    <>
      <Preview>
        <div className={`${styles.goalPreview} ${v.style === "ONE_LINE" ? styles.goalOneLine : ""}`}>
          <div className={styles.goalHead}>
            <span style={text}>{v.title}</span>
            {v.style !== "ONE_LINE" && amount}
          </div>
          <div
            className={styles.goalBar}
            style={{ height: Math.min(v.barHeight, 40), background: v.barBackground }}
            role="progressbar"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={Math.round(pct)}
            aria-label="목표 달성률"
          >
            <span style={{ width: `${pct}%`, background: v.barColor }} />
          </div>
          {v.style === "ONE_LINE" && amount}
          {v.style === "BASIC" && (
            <div className={styles.goalFoot} style={{ ...text, fontSize: 12 }}>
              <span>현재: {formatNumber(current)} FN</span>
              {left !== null && <span>남은 기간: {left}일</span>}
            </div>
          )}
        </div>
      </Preview>
      <Section title="기본 설정">
        <div className={styles.rows}>
          <Row label="위젯 스타일">
            <Radios name="goal-style" label="위젯 스타일" options={GOAL_STYLES} value={v.style} onChange={(x) => set("style", x)} />
          </Row>
          <Row label="목표 제목" htmlFor="goal-title">
            <input id="goal-title" className={styles.input} value={v.title} maxLength={GOAL_TITLE_MAX} onChange={(e) => set("title", e.target.value)} />
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
          <Row label="바 채우기 색상">
            <ColorField label="바 채우기 색상" value={v.barColor} onChange={(x) => set("barColor", x)} />
          </Row>
          <Row label="바 배경 색상">
            <ColorField label="바 배경 색상" value={v.barBackground} onChange={(x) => set("barBackground", x)} />
          </Row>
          <Row label="바 세로 크기">
            <NumberField label="바 세로 크기" value={v.barHeight} max={120} suffix="px" onChange={(x) => set("barHeight", x)} />
          </Row>
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

// ── 후원누적금액 (372:7) ───────────────────────────────────────────────────────

export function TotalForm({ value: v, onChange, live }: FormProps<"TOTAL">) {
  const set = <P extends keyof typeof v>(k: P, x: (typeof v)[P]) => onChange({ ...v, [k]: x });
  return (
    <>
      <Preview>
        <p className={styles.totalPreview}>
          <span style={fontStyle(v.titleFont, v.textOutline)}>{v.title} :</span>
          <strong style={fontStyle(v.contentFont, v.textOutline)}>{v.template.split(TOTAL_TEMPLATE_TOKEN).join(formatNumber(live.totalAmount))}</strong>
        </p>
      </Preview>
      <Section title="기본 설정">
        <div className={styles.rows}>
          <Row stacked label="제목 입력" htmlFor="total-title">
            <input id="total-title" className={styles.input} value={v.title} maxLength={TOTAL_TITLE_MAX} onChange={(e) => set("title", e.target.value)} />
          </Row>
          <Row
            stacked
            htmlFor="total-template"
            label={
              <>
                내용 템플릿{" "}
                <span className={styles.help} title={`${TOTAL_TEMPLATE_TOKEN} 자리에 누적 후원 금액이 표시됩니다.`}>
                  ?
                </span>
              </>
            }
          >
            <input id="total-template" className={styles.input} value={v.template} maxLength={TOTAL_TEMPLATE_MAX} onChange={(e) => set("template", e.target.value)} />
          </Row>
          <Row stacked label="산정 기간">
            <div className={styles.inline}>
              <input type="datetime-local" aria-label="산정 시작" className={styles.input} value={v.from} max={v.to} onChange={(e) => set("from", e.target.value)} />
              <span className={styles.suffix}>~</span>
              <input type="datetime-local" aria-label="산정 종료" className={styles.input} value={v.to} min={v.from} onChange={(e) => set("to", e.target.value)} />
            </div>
          </Row>
          <Row stacked label="제목 폰트 설정">
            <FontFields label="제목" value={v.titleFont} onChange={(x) => set("titleFont", x)} />
          </Row>
          <Row stacked label="내용 폰트 설정">
            <FontFields label="내용" value={v.contentFont} onChange={(x) => set("contentFont", x)} />
          </Row>
          <div className={styles.switchLine}>
            <span className={styles.rowLabel}>텍스트 외곽선 표시하기</span>
            <SwitchText label="텍스트 외곽선 표시하기" checked={v.textOutline} onChange={(x) => set("textOutline", x)} />
          </div>
        </div>
      </Section>
    </>
  );
}
