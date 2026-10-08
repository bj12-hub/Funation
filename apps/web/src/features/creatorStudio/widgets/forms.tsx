"use client";

import { useState } from "react";
import { DownloadIcon } from "@/components/icons";
import { ChatLines } from "@/features/broadcast/ChatLines";
import { QrView, TotalView } from "./WidgetViews";
import { PreviewStage } from "@/features/overlayTheme/PreviewStage";
import { ThemeChoiceField } from "@/features/overlayTheme/ThemeChoiceField";
import type { ChatOverlayLine } from "@/services/broadcast/chatTypes";
import { effectLabel, resolveTheme } from "@/services/creator/overlayThemeTypes";
import {
  ALERT_EFFECTS_IN,
  ALERT_EFFECTS_OUT,
  CHAT_MAX_FILTERS,
  CHAT_MAX_LINES,
  CHAT_STYLES,
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
import { ColorField, FontFields, NumberField, Radios, Row, Section, Select, SwitchText } from "./fields";
import styles from "./widgets.module.css";

export type FormProps<K extends EditableWidgetKey> = {
  value: WidgetSettingsMap[K];
  onChange: (v: WidgetSettingsMap[K]) => void;
  live: WidgetLiveData;
};

// ── 채팅창 (364:6) ─────────────────────────────────────────────────────────────

/** Sample lines for the preview (fictional names, one per platform). */
const CHAT_SAMPLE: ChatOverlayLine[] = [
  { id: "s1", platform: "YOUTUBE", name: "도도쭈", roles: [], text: "안녕하세요! 오늘도 왔어요", at: "" },
  { id: "s2", platform: "CHZZK", name: "밤톨게임", roles: ["MODERATOR"], text: "배틀 가자!", at: "" },
  { id: "s3", platform: "SOOP", name: "새벽감성", roles: [], text: "오늘 방송 콘텐츠 대박이네요 ㅋㅋㅋ", at: "" },
  { id: "s4", platform: "FLEXTV", name: "하루봄", roles: ["OWNER"], text: "다들 반가워요~", at: "" }
];

export function ChatForm({ value: v, onChange, live }: FormProps<"CHAT">) {
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
      <Section title="미리보기">
        {/* The overlay's own lines (ChatLines) at the 400px OBS width; nothing hides here. */}
        <PreviewStage width={420} minHeight={200} label="채팅창 미리보기">
          <ChatLines lines={CHAT_SAMPLE} settings={v} theme={resolveTheme(live.appearance, v.theme)} now={null} />
        </PreviewStage>
      </Section>
      <Section title="테마">
        <ThemeChoiceField value={v.theme} onChange={(x) => set("theme", x)} appearance={live.appearance} />
      </Section>
      <Section title="기본 설정">
        <div className={styles.rows}>
          <Row label="위젯 스타일">
            <Radios name="chat-style" label="위젯 스타일" options={CHAT_STYLES} value={v.style} onChange={(x) => set("style", x)} />
          </Row>
          <Row label="알림 효과">
            <div className={styles.inline}>
              <Select label="나타나는 효과" value={v.effectIn} options={ALERT_EFFECTS_IN} width={170} format={effectLabel} onChange={(x) => set("effectIn", x)} />
              <Select label="사라지는 효과" value={v.effectOut} options={ALERT_EFFECTS_OUT} width={170} format={effectLabel} onChange={(x) => set("effectOut", x)} />
            </div>
          </Row>
          <Row label="폰트 설정">
            <div className={styles.inline}>
              <FontFields label="채팅" value={v.font} onChange={(x) => set("font", x)} />
              <span className={styles.hint}>글자 색은 “한 줄 테두리 없음”에 쓰이고, 상자 스타일은 테마 색을 써요.</span>
            </div>
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

export function QrForm({ value: v, onChange, live }: FormProps<"QR">) {
  const set = <P extends keyof typeof v>(k: P, x: (typeof v)[P]) => onChange({ ...v, [k]: x });
  return (
    <>
      <Section title="미리보기">
        <PreviewStage width={300} minHeight={300} label="후원 QR코드 미리보기">
          <QrView settings={v} imageUrl={live.qrImageUrl} theme={resolveTheme(live.appearance, v.theme)} />
        </PreviewStage>
      </Section>
      <Section title="테마">
        <ThemeChoiceField value={v.theme} onChange={(x) => set("theme", x)} appearance={live.appearance} />
      </Section>
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
            <a href={live.qrImageUrl} download="ssumnation-donate-qr.png" className={styles.outlineButton}>
              <DownloadIcon aria-hidden="true" />
              고화질 QR 이미지 다운로드 (.PNG)
            </a>
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
      <Section title="미리보기">
        <PreviewStage width={600} minHeight={120} label="후원누적금액 미리보기">
          <TotalView settings={v} total={live.totalAmount} theme={resolveTheme(live.appearance, v.theme)} />
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
