"use client";

import Image from "next/image";
import { useState } from "react";
import { formatNumber } from "@/lib/format";
import { useI18n } from "@/lib/i18n/I18nProvider";
import { PreviewStage } from "@/features/overlayTheme/PreviewStage";
import { ThemeChoiceField } from "@/features/overlayTheme/ThemeChoiceField";
import { resolveTheme } from "@/services/creator/overlayThemeTypes";
import {
  RANKING_BOARDS,
  RANKING_EXCLUDED_MAX,
  RANKING_MAX_RANKS,
  RANKING_NAME_TYPES,
  RANKING_SPEEDS,
  RANKING_STYLES,
  RANKING_WIDGET_PERIODS,
  type RankTierStyle
} from "@/services/creator/widgetSettingsTypes";
import { ColorField, FontFields, NumberField, Radios, Row, Section, Select, SwitchText } from "./fields";
import type { FormProps } from "./forms";
import styles from "./widgets.module.css";
import { RankingView } from "./WidgetViews";
import { periodText, translatedOptions } from "./widgetFormLabels";

/**
 * 후원랭킹 위젯 설정 — Figma 315:650. 랭킹 종류 (크루 후원 순위 · 수단별 보드) is code-first (2026-10-06); 랭킹제외 (2026-10-28,
 * StreamDonate 후원자 랭킹 "랭킹제외") too.
 */
export function RankingForm({ value: v, onChange, live }: FormProps<"RANKING">) {
  const set = <P extends keyof typeof v>(k: P, x: (typeof v)[P]) => onChange({ ...v, [k]: x });
  const source: { name: string; amount: number; amountLabel?: string }[] = v.board === "CREW" ? live.crewRanking[v.period] : v.board === "SOURCE" ? live.sourceBoard : live.ranking;
  // 랭킹제외 drops those donors from the preview as it does on stream (the sample rows are no real donors).
  const out = new Set(v.excluded.map((x) => x.name));
  const rows = (v.board === "DONOR" ? source.filter((r) => !out.has(r.name)) : source).slice(0, v.ranks);
  const [pick, setPick] = useState("");
  const choices = live.donors.filter((d) => !v.excluded.some((x) => x.key === d.key));
  const { t } = useI18n();
  const styleOptions = translatedOptions(RANKING_STYLES, t);

  return (
    <>
      <Section title={t("widgetForm.preview")}>
        <PreviewStage width={400} minHeight={200} label={t("widgetFormRanking.previewAria")}>
          <RankingView
            settings={v}
            rows={rows.map((r, i) => ({ rank: i + 1, name: r.name, fnAmount: r.amount, amountLabel: r.amountLabel }))}
            theme={resolveTheme(live.appearance, v.theme)}
            empty={t("widgetFormRanking.empty")}
          />
        </PreviewStage>
      </Section>
      <Section title={t("widgetForm.theme")}>
        <div className={styles.rows}>
          <ThemeChoiceField value={v.theme} onChange={(x) => set("theme", x)} appearance={live.appearance} />
          <SwitchText label={t("widgetForm.bgCard")} checked={v.card} onChange={(x) => set("card", x)} text={t("widgetFormRanking.cardHint")} />
        </div>
      </Section>

      {v.board === "DONOR" && (
        <Section title={t("widgetFormRanking.excluded")}>
          <p className={styles.hint}>{t("widgetFormRanking.excludeHint")}</p>
          <div className={styles.inline}>
            <select className={styles.input} aria-label={t("widgetFormRanking.pickAria")} value={pick} onChange={(e) => setPick(e.target.value)}>
              <option value="">{choices.length ? t("widgetFormRanking.pickPlaceholder") : t("widgetFormRanking.noChoices")}</option>
              {choices.map((d) => (
                <option key={d.key} value={d.key}>
                  {d.name} · {formatNumber(d.amount)} FN
                </option>
              ))}
            </select>
            <button
              type="button"
              className={styles.purpleSmall}
              disabled={!pick || v.excluded.length >= RANKING_EXCLUDED_MAX}
              onClick={() => {
                const d = live.donors.find((x) => x.key === pick);
                if (d) set("excluded", [...v.excluded, { key: d.key, name: d.name }]);
                setPick("");
              }}
            >
              {t("widgetFormRanking.exclude")}
            </button>
          </div>
          {v.excluded.length > 0 ? (
            <ul className={styles.tags} aria-label={t("widgetFormRanking.excludedAria")}>
              {v.excluded.map((x) => (
                <li key={x.key}>
                  {x.name}
                  <button
                    type="button"
                    aria-label={t("widgetFormRanking.restoreAria", { name: x.name })}
                    onClick={() => set("excluded", v.excluded.filter((y) => y.key !== x.key))}
                  >
                    {t("widgetFormRanking.restore")}
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            <p className={styles.hint}>{t("widgetFormRanking.noneExcluded")}</p>
          )}
        </Section>
      )}

      <Section title={t("widgetForm.basic")}>
        <div className={styles.rows}>
          <Row label={t("widgetFormRanking.board")}>
            <Radios name="rank-board" label={t("widgetFormRanking.board")} options={translatedOptions(RANKING_BOARDS, t)} value={v.board} onChange={(x) => set("board", x)} />
          </Row>
          {v.board !== "DONOR" && <p className={styles.hint}>{v.board === "CREW" ? t("widgetFormRanking.crewHint") : t("widgetFormRanking.sourceHint")}</p>}
          <Row label={t("widgetForm.widgetStyle")}>
            <div className={styles.filterBox}>
              <Radios name="rank-style" label={t("widgetForm.widgetStyle")} options={styleOptions} value={v.style} onChange={(x) => set("style", x)} />
              <div className={styles.thumbs}>
                {styleOptions.map((s) => (
                  <button
                    key={s.key}
                    type="button"
                    className={`${styles.thumb} ${v.style === s.key ? styles.thumbOn : ""}`}
                    aria-label={t("widgetForm.styleSelect", { label: s.label })}
                    aria-pressed={v.style === s.key}
                    onClick={() => set("style", s.key)}
                  >
                    <Image src={s.image} alt="" width={120} height={69} />
                  </button>
                ))}
              </div>
            </div>
          </Row>
          <Row label={t("widgetFormRanking.widgetTitle")} htmlFor="rank-title">
            <input id="rank-title" className={styles.input} value={v.title} maxLength={20} onChange={(e) => set("title", e.target.value)} />
          </Row>
          <Row label={t("widgetForm.titleFont")}>
            <FontFields label={t("widgetForm.titleLabel")} value={v.titleFont} onChange={(x) => set("titleFont", x)} />
          </Row>
          <Row label={t("widgetFormRanking.nameType")}>
            <Radios name="rank-name" label={t("widgetFormRanking.nameType")} options={translatedOptions(RANKING_NAME_TYPES, t)} value={v.nameType} onChange={(x) => set("nameType", x)} />
          </Row>
          <Row label={t("widgetForm.period")}>
            <Select label={t("widgetForm.period")} value={v.period} options={RANKING_WIDGET_PERIODS} width={140} format={(x) => periodText(x, t)} onChange={(x) => set("period", x)} />
          </Row>
          <Row label={t("widgetForm.showAmount")}>
            <SwitchText label={t("widgetForm.showAmount")} checked={v.showAmount} onChange={(x) => set("showAmount", x)} />
          </Row>
          <Row label={t("widgetFormRanking.ranks")}>
            <NumberField label={t("widgetFormRanking.ranks")} value={v.ranks} max={RANKING_MAX_RANKS} suffix={t("widgetFormRanking.ranksSuffix")} onChange={(x) => set("ranks", Math.max(1, x))} />
          </Row>
          <Row label={t("widgetFormRanking.format")}>
            <div className={styles.inline}>
              {(["rank", "name", "amount"] as const).map((k) => (
                <input
                  key={k}
                  aria-label={t(k === "rank" ? "widgetFormRanking.formatRank" : k === "name" ? "widgetFormRanking.formatName" : "widgetFormRanking.formatAmount")}
                  className={styles.input}
                  style={{ width: 120 }}
                  maxLength={20}
                  value={v.format[k]}
                  onChange={(e) => set("format", { ...v.format, [k]: e.target.value })}
                />
              ))}
            </div>
          </Row>
        </div>
      </Section>

      <Section title={t("widgetFormRanking.scroll")}>
        <div className={styles.rows}>
          <Row label={t("widgetFormRanking.gapPx")}>
            <NumberField label={t("widgetFormRanking.gap")} value={v.scrollGap} max={200} suffix="px" onChange={(x) => set("scrollGap", x)} />
          </Row>
          <Row label={t("widgetForm.flowSpeed")}>
            <Radios name="rank-speed" label={t("widgetForm.flowSpeed")} options={translatedOptions(RANKING_SPEEDS, t)} value={v.scrollSpeed} onChange={(x) => set("scrollSpeed", x)} />
          </Row>
        </div>
      </Section>

      <TierSection title={t("widgetFormRanking.first")} value={v.first} onChange={(x) => set("first", x)} />
      <TierSection title={t("widgetFormRanking.others")} value={v.others} onChange={(x) => set("others", x)} />
    </>
  );
}

function TierSection({ title, value, onChange }: { title: string; value: RankTierStyle; onChange: (v: RankTierStyle) => void }) {
  const { t } = useI18n();
  return (
    <Section title={title}>
      <div className={styles.rows}>
        <Row label={t("widgetForm.fontSettings")}>
          <FontFields label={title} value={value.font} onChange={(font) => onChange({ ...value, font })} />
        </Row>
        <Row label={t("widgetFormRanking.tierColor")}>
          <ColorField label={t("widgetFormRanking.tierAccent", { title })} value={value.accentColor} onChange={(accentColor) => onChange({ ...value, accentColor })} />
        </Row>
      </div>
    </Section>
  );
}
