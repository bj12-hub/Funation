"use client";

import { useState } from "react";
import { DownloadIcon } from "@/components/icons";
import { ChatLines } from "@/features/broadcast/ChatLines";
import { useI18n } from "@/lib/i18n/I18nProvider";
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
import { optionText, translatedOptions } from "./widgetFormLabels";
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
  const [vertical, setVertical] = useState(false);
  const { t } = useI18n();
  const set = <P extends keyof typeof v>(k: P, x: (typeof v)[P]) => onChange({ ...v, [k]: x });
  const addFilter = () => {
    const n = nick.trim();
    if (!n || v.filteredNicknames.includes(n) || v.filteredNicknames.length >= CHAT_MAX_FILTERS) return;
    set("filteredNicknames", [...v.filteredNicknames, n]);
    setNick("");
  };

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
        {/* The overlay's own lines (ChatLines) at the 400px OBS width (세로 방송: 1080); nothing hides here. */}
        <PreviewStage width={vertical ? 1080 : 420} minHeight={200} label={t("widgetFormChat.previewAria")}>
          <ChatLines lines={CHAT_SAMPLE} settings={v} theme={resolveTheme(live.appearance, v.theme)} now={null} vertical={vertical} />
        </PreviewStage>
      </Section>
      <Section title={t("widgetForm.theme")}>
        <ThemeChoiceField value={v.theme} onChange={(x) => set("theme", x)} appearance={live.appearance} />
      </Section>
      <Section title={t("widgetForm.basic")}>
        <div className={styles.rows}>
          <Row label={t("widgetForm.widgetStyle")}>
            <Radios name="chat-style" label={t("widgetForm.widgetStyle")} options={translatedOptions(CHAT_STYLES, t)} value={v.style} onChange={(x) => set("style", x)} />
          </Row>
          <Row label={t("widgetForm.effect")}>
            <div className={styles.inline}>
              <Select
                label={t("widgetFormChat.effectIn")}
                value={v.effectIn}
                options={ALERT_EFFECTS_IN}
                width={170}
                format={(x) => optionText(effectLabel(x), t)}
                onChange={(x) => set("effectIn", x)}
              />
              <Select
                label={t("widgetFormChat.effectOut")}
                value={v.effectOut}
                options={ALERT_EFFECTS_OUT}
                width={170}
                format={(x) => optionText(effectLabel(x), t)}
                onChange={(x) => set("effectOut", x)}
              />
            </div>
          </Row>
          <Row label={t("widgetForm.fontSettings")}>
            <div className={styles.inline}>
              <FontFields label={t("widgetFormChat.fontLabel")} value={v.font} onChange={(x) => set("font", x)} />
              <span className={styles.hint}>{t("widgetFormChat.fontHint")}</span>
            </div>
          </Row>
          <Row label={t("widgetForm.nicknameColor")}>
            <SwitchText
              label={t("widgetForm.nicknameColor")}
              checked={v.creatorNicknameColor}
              onChange={(x) => set("creatorNicknameColor", x)}
              text={t("widgetFormChat.nicknameColorHint")}
            />
          </Row>
          <Row label={t("widgetFormChat.nicknameBg")}>
            <Radios
              name="nick-bg"
              label={t("widgetFormChat.nicknameBg")}
              options={translatedOptions(NICKNAME_BG, t)}
              value={v.nicknameBackground}
              onChange={(x) => set("nicknameBackground", x)}
            />
          </Row>
          <Row label={t("widgetFormChat.maxLines")}>
            <NumberField
              label={t("widgetFormChat.maxLines")}
              value={v.maxLines}
              max={CHAT_MAX_LINES}
              onChange={(x) => set("maxLines", x)}
              suffix={t("widgetFormChat.maxLinesSuffix", { max: CHAT_MAX_LINES })}
            />
          </Row>
          <Row label={t("widgetFormChat.autoHide")}>
            <SwitchText label={t("widgetFormChat.autoHide")} checked={v.autoHide} onChange={(x) => set("autoHide", x)} text={t("widgetFormChat.autoHideHint")} />
          </Row>
          <Row label={t("widgetForm.hideAfter")}>
            <NumberField label={t("widgetForm.hideAfter")} value={v.hideAfterSec} max={3600} onChange={(x) => set("hideAfterSec", x)} suffix={t("widgetFormChat.hideAfterSuffix")} />
          </Row>
          <Row label={t("widgetFormChat.platformIcon")}>
            <SwitchText
              label={t("widgetFormChat.hidePlatformIcon")}
              checked={v.hidePlatformIcon}
              onChange={(x) => set("hidePlatformIcon", x)}
              text={t("widgetFormChat.hidePlatformIconHint")}
            />
          </Row>
          <Row label={t("widgetFormChat.filter")}>
            <div className={styles.filterBox}>
              <div className={styles.inline}>
                <input
                  aria-label={t("widgetFormChat.filterInput")}
                  className={styles.input}
                  style={{ width: 200 }}
                  maxLength={NICKNAME_MAX}
                  placeholder={t("widgetFormChat.filterPlaceholder")}
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
                  {t("widgetForm.add")}
                </button>
              </div>
              {v.filteredNicknames.length > 0 && (
                <ul className={styles.tags}>
                  {v.filteredNicknames.map((n) => (
                    <li key={n}>
                      {n}
                      <button
                        type="button"
                        aria-label={t("widgetForm.removeNamed", { name: n })}
                        onClick={() => set("filteredNicknames", v.filteredNicknames.filter((x) => x !== n))}
                      >
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
  const { t } = useI18n();
  return (
    <>
      <Section title={t("widgetForm.preview")}>
        <PreviewStage width={300} minHeight={300} label={t("widgetFormQr.previewAria")}>
          <QrView settings={v} imageUrl={live.qrImageUrl} theme={resolveTheme(live.appearance, v.theme)} />
        </PreviewStage>
      </Section>
      <Section title={t("widgetForm.theme")}>
        <ThemeChoiceField value={v.theme} onChange={(x) => set("theme", x)} appearance={live.appearance} />
      </Section>
      <Section title={t("widgetForm.basic")}>
        <div className={styles.rows}>
          <Row label={t("widgetFormQr.codeStyle")}>
            <Radios name="qr-style" label={t("widgetFormQr.codeStyle")} options={translatedOptions(QR_STYLES, t)} value={v.codeStyle} onChange={(x) => set("codeStyle", x)} />
          </Row>
          <Row label={t("widgetFormQr.borderColor")}>
            <ColorField label={t("widgetFormQr.borderColor")} value={v.borderColor} onChange={(x) => set("borderColor", x)} />
          </Row>
          <Row label={t("widgetFormQr.centerLogo")}>
            <Radios
              name="qr-logo"
              label={t("widgetFormQr.centerLogo")}
              options={[
                { key: "ON", label: t("widgetFormQr.logoOn") },
                { key: "OFF", label: t("widgetForm.off") }
              ]}
              value={v.centerLogo ? "ON" : "OFF"}
              onChange={(x) => set("centerLogo", x === "ON")}
            />
          </Row>
          <Row label={t("widgetFormQr.caption")}>
            <Radios
              name="qr-caption"
              label={t("widgetFormQr.caption")}
              options={[
                { key: "ON", label: t("widgetForm.use") },
                { key: "OFF", label: t("widgetFormQr.captionOff") }
              ]}
              value={v.captionEnabled ? "ON" : "OFF"}
              onChange={(x) => set("captionEnabled", x === "ON")}
            />
          </Row>
          <Row label={t("widgetFormQr.captionText")} htmlFor="qr-caption-text">
            <input
              id="qr-caption-text"
              className={styles.input}
              value={v.caption}
              maxLength={QR_CAPTION_MAX}
              disabled={!v.captionEnabled}
              onChange={(e) => set("caption", e.target.value)}
            />
          </Row>
          <Row label={t("widgetFormQr.captionPos")}>
            <Radios
              name="qr-pos"
              label={t("widgetFormQr.captionPos")}
              options={[
                { key: "TOP", label: t("widgetFormQr.top") },
                { key: "BOTTOM", label: t("widgetFormQr.bottom") }
              ]}
              value={v.captionPosition}
              onChange={(x) => set("captionPosition", x)}
            />
          </Row>
          <Row label={t("widgetFormQr.captionFont")}>
            <FontFields label={t("widgetFormQr.captionFontLabel")} value={v.captionFont} onChange={(x) => set("captionFont", x)} />
          </Row>
          <Row label={t("widgetFormQr.download")}>
            {/* Mock asset; the backend will render the QR for the creator's donate URL (TBD). */}
            <a href={live.qrImageUrl} download="ssumnation-donate-qr.png" className={styles.outlineButton}>
              <DownloadIcon aria-hidden="true" />
              {t("widgetFormQr.downloadButton")}
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
  const { t } = useI18n();
  return (
    <>
      <Section title={t("widgetForm.preview")}>
        <PreviewStage width={600} minHeight={120} label={t("widgetFormTotal.previewAria")}>
          <TotalView settings={v} total={live.totalAmount} theme={resolveTheme(live.appearance, v.theme)} />
        </PreviewStage>
      </Section>
      <Section title={t("widgetForm.theme")}>
        <div className={styles.rows}>
          <ThemeChoiceField value={v.theme} onChange={(x) => set("theme", x)} appearance={live.appearance} />
          <SwitchText label={t("widgetForm.bgCard")} checked={v.card} onChange={(x) => set("card", x)} text={t("widgetForm.bgCardHint")} />
        </div>
      </Section>
      <Section title={t("widgetForm.basic")}>
        <div className={styles.rows}>
          <Row stacked label={t("widgetFormTotal.titleInput")} htmlFor="total-title">
            <input id="total-title" className={styles.input} value={v.title} maxLength={TOTAL_TITLE_MAX} onChange={(e) => set("title", e.target.value)} />
          </Row>
          <Row
            stacked
            htmlFor="total-template"
            label={
              <>
                {t("widgetFormTotal.template")}{" "}
                <span className={styles.help} title={t("widgetFormTotal.templateHelp", { token: TOTAL_TEMPLATE_TOKEN })}>
                  ?
                </span>
              </>
            }
          >
            <input id="total-template" className={styles.input} value={v.template} maxLength={TOTAL_TEMPLATE_MAX} onChange={(e) => set("template", e.target.value)} />
          </Row>
          <Row stacked label={t("widgetForm.period")}>
            <div className={styles.inline}>
              <input
                type="datetime-local"
                aria-label={t("widgetFormTotal.from")}
                className={styles.input}
                value={v.from}
                max={v.to}
                onChange={(e) => set("from", e.target.value)}
              />
              <span className={styles.suffix}>~</span>
              <input type="datetime-local" aria-label={t("widgetFormTotal.to")} className={styles.input} value={v.to} min={v.from} onChange={(e) => set("to", e.target.value)} />
            </div>
          </Row>
          <Row stacked label={t("widgetForm.titleFont")}>
            <FontFields label={t("widgetForm.titleLabel")} value={v.titleFont} onChange={(x) => set("titleFont", x)} />
          </Row>
          <Row stacked label={t("widgetFormTotal.contentFont")}>
            <FontFields label={t("widgetFormTotal.contentLabel")} value={v.contentFont} onChange={(x) => set("contentFont", x)} />
          </Row>
          <div className={styles.switchLine}>
            <span className={styles.rowLabel}>{t("widgetForm.textOutline")}</span>
            <SwitchText label={t("widgetForm.textOutline")} checked={v.textOutline} onChange={(x) => set("textOutline", x)} />
          </div>
        </div>
      </Section>
    </>
  );
}
