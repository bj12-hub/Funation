"use client";

import { PreviewStage } from "@/features/overlayTheme/PreviewStage";
import { useI18n } from "@/lib/i18n/I18nProvider";
import type { MessageKey } from "@/lib/i18n/translate";
import { ThemeChoiceField } from "@/features/overlayTheme/ThemeChoiceField";
import { resolveTheme } from "@/services/creator/overlayThemeTypes";
import { PRIZE_MAX, QUEST_STYLES } from "@/services/creator/widgetSettingsTypes";
import { QUEST_EXTEND_MINUTES } from "@/services/donations/questTypes";
import { DesignOnlyNotice } from "./DesignOnlyNotice";
import { ColorFontFields, Help, NumberField, Radios, Row, Section, SwitchText } from "./fields";
import { QuestView } from "./GameViews";
import type { FormProps } from "./forms";
import { translatedOptions } from "./widgetFormLabels";
import styles from "./widgets.module.css";

// ── 퀘스트 (373:1598) ──────────────────────────────────────────────────────────

/** 성공결정권한 table cells as message keys; "-" stays as is. */
const AUTHORITY_TABLE: (MessageKey | "-")[][] = [
  ["widgetFormQuest.menuOn", "widgetFormQuest.authorityOn", "widgetFormQuest.both"],
  ["widgetFormQuest.menuOn", "widgetFormQuest.authorityOff", "widgetFormQuest.donorOnly"],
  ["widgetFormQuest.menuOff", "-", "widgetFormQuest.both"]
];

/** With FLEXTV (`live.designOnly`, phase 8) only the look and how many quests show; the rules are 후원 종류 설정's. */
export function QuestForm({ value: v, onChange, live }: FormProps<"QUEST">) {
  const set = <P extends keyof typeof v>(k: P, x: (typeof v)[P]) => onChange({ ...v, [k]: x });
  const prize = Math.max(3_000, v.minAmount);
  const { t } = useI18n();
  const styleOptions = translatedOptions(QUEST_STYLES, t);

  return (
    <>
      <Section title={t("widgetForm.preview")}>
        <PreviewStage width={600} minHeight={160} label={t("widgetFormQuest.previewAria")}>
          <div style={{ opacity: v.enabled ? 1 : 0.4 }}>
            {/* A sample quest 4:59 before its time limit (the clock is fixed so it does not tick here). */}
            <QuestView settings={{ ...v, enabled: true }} quests={[{ id: "sample", title: "노래 한 곡 불러주세요", amount: prize, endsAt: new Date(299_000).toISOString(), extendedMin: 0 }]} theme={resolveTheme(live.appearance, v.theme)} now={0} />
          </div>
        </PreviewStage>
        <p className={styles.hint}>{t("widgetFormQuest.previewHint")}</p>
      </Section>
      <Section title={t("widgetForm.theme")}>
        <ThemeChoiceField value={v.theme} onChange={(x) => set("theme", x)} appearance={live.appearance} />
      </Section>
      <Section title={t("widgetForm.basic")}>
        <div className={styles.rows}>
          <Row label={t("widgetForm.use")}>
            <SwitchText label={t("widgetFormQuest.useLabel")} checked={v.enabled} onChange={(x) => set("enabled", x)} />
          </Row>
          <Row label={t("widgetForm.widgetStyle")}>
            <div className={styles.filterBox}>
              <Radios name="quest-style" label={t("widgetForm.widgetStyle")} options={styleOptions} value={v.style} onChange={(x) => set("style", x)} />
              <div className={styles.questThumbs}>
                {styleOptions.map((s) => (
                  <button
                    key={s.key}
                    type="button"
                    aria-pressed={v.style === s.key}
                    aria-label={t("widgetForm.styleSelect", { label: s.label })}
                    className={`${s.key === "FANCY" ? styles.questThumbFancy : styles.questThumbSimple} ${v.style === s.key ? styles.thumbOn : ""}`}
                    onClick={() => set("style", s.key)}
                  >
                    <b>QUEST</b>
                    {s.key === "FANCY" ? t("widgetFormQuest.fancyThumb") : t("widgetFormQuest.simpleThumb")}
                  </button>
                ))}
              </div>
            </div>
          </Row>
          {/* Code-first copy (2026-10-18): quests run as soon as they arrive; the 리모컨 퀘스트 card and 받은 후원 › 퀘스트 settle them. */}
          {!live.designOnly && (
            <Row label={t("widgetFormQuest.accept")}>
              <span className={styles.inline}>
                <span className={styles.remoteChip}>{t("widgetFormQuest.remoteChip")}</span>
                <span className={styles.noticePink}>{t("widgetFormQuest.acceptNote")}</span>
              </span>
            </Row>
          )}
          <Row label={t("widgetForm.titleFont")}>
            <ColorFontFields label={t("widgetForm.titleLabel")} value={v.titleFont} onChange={(x) => set("titleFont", x)} />
          </Row>
          <Row label={t("widgetFormQuest.timeFont")}>
            <ColorFontFields label={t("widgetFormQuest.timeLabel")} value={v.timeFont} onChange={(x) => set("timeFont", x)} />
          </Row>
          <Row label={t("widgetFormQuest.prizeFont")}>
            <ColorFontFields label={t("widgetFormQuest.prizeLabel")} value={v.prizeFont} onChange={(x) => set("prizeFont", x)} />
          </Row>
        </div>
      </Section>
      {live.designOnly ? (
        <Section title={t("widgetFormQuest.display")}>
          <div className={styles.rows}>
            <Row label={t("widgetFormQuest.maxShown")}>
              <NumberField label={t("widgetFormQuest.maxShown")} value={v.maxCount} max={50} suffix={t("widgetForm.unitItems")} onChange={(x) => set("maxCount", x)} />
            </Row>
            <DesignOnlyNotice rules={t("widgetFormQuest.designRules")} />
          </div>
        </Section>
      ) : (
        <>
          <Section title={t("widgetFormQuest.more")}>
            <div className={styles.rows}>
              <Row
                label={
                  <>
                    {t("widgetFormQuest.minFn")} <Help text={t("widgetFormQuest.minFnHelp")} />
                  </>
                }
              >
                <NumberField label={t("widgetFormQuest.minFn")} value={v.minAmount} max={PRIZE_MAX} grouped width={140} suffix="FN" onChange={(x) => set("minAmount", x)} />
              </Row>
              {/* 2026-10-04 결정: failed or cancelled quests refund everything (no 실패 · 취소 패널티); past the time limit a quest waits for a decision.
                  The refund line is refund-policy wording and stays Korean until an approved translation exists (2026-11-01). */}
              <Row label={t("widgetFormQuest.failed")}>
                <span className={styles.hint}>후원한 FN이 후원자에게 전액 환불돼요 (패널티 없음).</span>
              </Row>
              <Row label={t("widgetFormQuest.timeout")}>
                <span className={styles.hint}>{t("widgetFormQuest.timeoutHint")}</span>
              </Row>
              <Row
                label={
                  <>
                    {t("widgetFormQuest.maxCount")} <Help text={t("widgetFormQuest.maxCountHelp")} />
                  </>
                }
              >
                <NumberField label={t("widgetFormQuest.maxCount")} value={v.maxCount} max={50} suffix={t("widgetForm.unitItems")} onChange={(x) => set("maxCount", x)} />
              </Row>
              <Row
                label={
                  <>
                    {t("widgetFormQuest.interval")} <Help text={t("widgetFormQuest.intervalHelp")} />
                  </>
                }
              >
                <NumberField label={t("widgetFormQuest.interval")} value={v.intervalSec} max={3600} suffix={t("widgetForm.unitSec")} onChange={(x) => set("intervalSec", x)} />
              </Row>
              {/* 2026-10-18 결정: on = the 리모컨 퀘스트 card offers 시간 연장 on each running quest (questTypes QUEST_EXTEND_MINUTES). */}
              <Row
                label={
                  <>
                    {t("widgetFormQuest.extend")} <Help text={t("widgetFormQuest.extendHelp")} />
                  </>
                }
              >
                <SwitchText
                  label={t("widgetFormQuest.extend")}
                  checked={v.allowExtension}
                  onChange={(x) => set("allowExtension", x)}
                  text={t("widgetFormQuest.extendHint", { min: QUEST_EXTEND_MINUTES.min, max: QUEST_EXTEND_MINUTES.max })}
                />
              </Row>
              <Row label={t("widgetFormQuest.authorityMenu")}>
                <SwitchText label={t("widgetFormQuest.authorityMenu")} checked={v.showSuccessAuthorityMenu} onChange={(x) => set("showSuccessAuthorityMenu", x)} />
              </Row>
            </div>
          </Section>
          <div className={styles.subCard}>
            <strong>{t("widgetFormQuest.notesTitle")}</strong>
            <p className={styles.notice}>{t("widgetFormQuest.note1")}</p>
            <p className={styles.notice}>{t("widgetFormQuest.note2")}</p>
            <table className={styles.noteTable}>
              <thead>
                <tr>
                  <th scope="col">{t("widgetFormQuest.colCreator")}</th>
                  <th scope="col">{t("widgetFormQuest.colDonation")}</th>
                  <th scope="col">{t("widgetFormQuest.colWho")}</th>
                </tr>
              </thead>
              <tbody>
                {AUTHORITY_TABLE.map((r, i) => (
                  <tr key={i}>
                    {r.map((c, j) => (
                      <td key={j}>{c === "-" ? c : t(c)}</td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </>
  );
}
