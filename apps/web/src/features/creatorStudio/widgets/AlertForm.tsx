"use client";

import Link from "next/link";
import { useEffect, useId, useRef, useState } from "react";
import { PreviewStage } from "@/features/overlayTheme/PreviewStage";
import { useI18n } from "@/lib/i18n/I18nProvider";
import type { MessageKey } from "@/lib/i18n/translate";
import { ThemeChoiceField } from "@/features/overlayTheme/ThemeChoiceField";
import { assetUrl } from "@/services/creator/assetTypes";
import { OVERLAY_MOTIONS, resolveTheme } from "@/services/creator/overlayThemeTypes";
import { ALERT_HEADLINE_MAX, ALERT_LAYOUTS, ALERT_SOUND_MAX_SEC, ALERT_TEXT_SCALES, ALERT_TOKENS, SIG_FETCH_MODES } from "@/services/creator/widgetSettingsTypes";
import { AlertCard, type AlertCardData } from "../remote/AlertCard";
import { Radios, Row, Section, Select, SwitchText } from "./fields";
import type { FormProps } from "./forms";
import { LibrarySoundField } from "./library/LibrarySounds";
import { optionText, translatedOptions } from "./widgetFormLabels";
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

/** The sample tabs' labels as message keys (the sample donations themselves stay as written, like the OBS card). */
const SAMPLE_KEYS: Record<string, MessageKey> = { fn: "widgetFormAlert.sampleFn", signature: "widgetFormAlert.sampleSignature", platform: "widgetFormAlert.samplePlatform" };

/** How long a library sound is (seconds, rounded to 0.1), read from the file in the browser; null until known. */
function useSoundLength(id: string | null) {
  const [length, setLength] = useState<{ id: string; sec: number } | null>(null);
  useEffect(() => {
    if (!id) return;
    const audio = new Audio(assetUrl(id));
    audio.preload = "metadata";
    audio.onloadedmetadata = () => Number.isFinite(audio.duration) && setLength({ id, sec: Math.round(audio.duration * 10) / 10 });
    return () => {
      audio.onloadedmetadata = null;
      audio.src = "";
    };
  }, [id]);
  return id && length?.id === id ? length.sec : null;
}

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
  const soundSec = useSoundLength(v.soundId);
  const { t } = useI18n();
  const sigHint = SIG_FETCH_MODES.find((m) => m.key === v.sigFetch)?.hint;

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
        title={t("widgetForm.preview")}
        aside={
          <span className={styles.inline}>
            <label className={styles.hint}>
            <input type="checkbox" checked={vertical} onChange={(e) => setVertical(e.target.checked)} /> {t("widgetForm.verticalView")}
          </label>
            <button type="button" className={styles.smallButton} onClick={() => setReplay((n) => n + 1)}>
              {t("widgetFormAlert.replay")}
            </button>
          </span>
        }
      >
        <div role="radiogroup" aria-label={t("widgetFormAlert.sampleAria")} className={a.samples}>
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
              {SAMPLE_KEYS[s.key] ? t(SAMPLE_KEYS[s.key]) : s.label}
            </label>
          ))}
        </div>
        <PreviewStage width={vertical ? 1080 : 800} minHeight={v.layout === "BANNER" ? 180 : 360} label={t("widgetFormAlert.previewAria")}>
          <AlertCard alert={current.alert} design={headlineOk ? v : { ...v, headline: `${ALERT_TOKENS.donor}님` }} theme={theme} replay={replay} vertical={vertical} />
        </PreviewStage>
        <p className={styles.hint}>{t("widgetFormAlert.previewHint")}</p>
      </Section>

      <Section title={t("widgetForm.theme")}>
        <ThemeChoiceField value={v.theme} onChange={(x) => set("theme", x)} appearance={live.appearance} />
      </Section>

      <Section title={t("widgetFormAlert.layout")}>
        <div role="radiogroup" aria-label={t("widgetFormAlert.layout")} className={a.layouts}>
          {translatedOptions(ALERT_LAYOUTS, t).map((l) => (
            <label key={l.key} className={a.layout} data-checked={v.layout === l.key || undefined}>
              <input type="radio" name={`${id}-layout`} className={styles.srOnly} checked={v.layout === l.key} onChange={() => set("layout", l.key)} />
              <span className={a.layoutIcon} data-layout={l.key} aria-hidden="true" />
              <strong>{l.label}</strong>
              <span>{l.hint}</span>
            </label>
          ))}
        </div>
      </Section>

      <Section title={t("widgetForm.textSection")}>
        <div className={styles.rows}>
          <Row label={t("widgetFormAlert.headline")} htmlFor={`${id}-headline`}>
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
                  {t("widgetFormAlert.addNickname")}
                </button>
                <button type="button" className={a.token} onClick={() => insert(ALERT_TOKENS.amount)}>
                  {t("widgetFormAlert.addAmount")}
                </button>
              </span>
              <span id={`${id}-headline-hint`} className={headlineOk ? styles.hint : a.invalid}>
                {headlineOk
                  ? t("widgetFormAlert.headlineHint", { amount: ALERT_TOKENS.amount, length: v.headline.length, max: ALERT_HEADLINE_MAX })
                  : t("widgetFormAlert.headlineMissing", { donor: ALERT_TOKENS.donor })}
              </span>
            </div>
          </Row>
          <Row label={t("widgetFormAlert.message")}>
            <SwitchText label={t("widgetForm.showMessage")} checked={v.showMessage} onChange={(x) => set("showMessage", x)} text={t("widgetFormAlert.messageHint")} />
          </Row>
          <Row label={t("widgetFormAlert.badges")}>
            <SwitchText label={t("widgetFormAlert.showBadges")} checked={v.showBadges} onChange={(x) => set("showBadges", x)} text={t("widgetFormAlert.badgesHint")} />
          </Row>
          <Row label={t("widgetFormAlert.kind")}>
            <SwitchText label={t("widgetFormAlert.showKind")} checked={v.showPlatform} onChange={(x) => set("showPlatform", x)} text={t("widgetFormAlert.kindHint")} />
          </Row>
          <Row label={t("widgetFormAlert.image")}>
            <SwitchText label={t("widgetFormAlert.showImage")} checked={v.showImage} onChange={(x) => set("showImage", x)} text={t("widgetFormAlert.imageHint")} />
          </Row>
        </div>
      </Section>

      <Section title={t("widgetForm.textSize")}>
        <div className={styles.rows}>
          {(
            [
              ["amount", t("widgetFormAlert.sizeAmount")],
              ["name", t("widgetFormAlert.sizeName")],
              ["message", t("widgetFormAlert.message")]
            ] as const
          ).map(([k, label]) => (
            <Row key={k} label={label}>
              <Select
                label={t("widgetFormAlert.sizeLabel", { label })}
                value={(v.textScale ?? { amount: 100, name: 100, message: 100 })[k]}
                options={ALERT_TEXT_SCALES}
                width={120}
                format={(x) => (x === 100 ? t("widgetFormAlert.sizeDefault") : `${x}%`)}
                onChange={(x) => set("textScale", { ...(v.textScale ?? { amount: 100, name: 100, message: 100 }), [k]: x })}
              />
            </Row>
          ))}
        </div>
      </Section>

      <Section title={t("widgetFormAlert.motion")}>
        <div className={styles.rows}>
          <Row label={t("widgetFormAlert.entrance")}>
            <Select
              label={t("widgetFormAlert.entrance")}
              value={v.motion}
              options={OVERLAY_MOTIONS.map((m) => m.key)}
              width={200}
              format={(k) => optionText(OVERLAY_MOTIONS.find((m) => m.key === k)?.label ?? k, t)}
              onChange={(x) => {
                set("motion", x);
                setReplay((n) => n + 1);
              }}
            />
          </Row>
          <Row label={t("widgetFormAlert.countUp")}>
            <SwitchText label={t("widgetFormAlert.countUpLabel")} checked={v.countUp} onChange={(x) => set("countUp", x)} text={t("widgetFormAlert.countUpHint")} />
          </Row>
        </div>
      </Section>

      <Section title={t("widgetFormAlert.sound")}>
        <div className={styles.rows}>
          <Row label={t("widgetFormAlert.alertSound")}>
            <LibrarySoundField label={t("widgetFormAlert.alertSoundButton")} buttonClassName={styles.purpleSmall} value={v.soundId} onChange={(id) => set("soundId", id)} />
            <p className={styles.hint}>{t("widgetFormAlert.soundHint", { max: ALERT_SOUND_MAX_SEC })}</p>
            {soundSec !== null && soundSec > ALERT_SOUND_MAX_SEC && <p className={a.invalid}>{t("widgetFormAlert.soundTooLong", { sec: soundSec, max: ALERT_SOUND_MAX_SEC })}</p>}
          </Row>
          <Row label={t("widgetFormAlert.sigAudio")}>
            <Radios name="sig-fetch" label={t("widgetFormAlert.sigFetch")} options={translatedOptions(SIG_FETCH_MODES, t)} value={v.sigFetch} onChange={(x) => set("sigFetch", x)} />
            <p className={styles.hint}>{t("widgetFormAlert.sigFetchHint", { hint: sigHint ? optionText(sigHint, t) : "" })}</p>
          </Row>
        </div>
      </Section>

      <p className={a.remoteNote}>
        {t("widgetFormAlert.remoteNoteBefore")}
        <Link href="/creator/remote">{t("widgetFormAlert.remoteLink")}</Link>
        {t("widgetFormAlert.remoteNoteAfter")}
      </p>
    </>
  );
}
