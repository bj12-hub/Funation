"use client";

import { useState } from "react";
import { useI18n } from "@/lib/i18n/I18nProvider";
import { PreviewStage } from "@/features/overlayTheme/PreviewStage";
import { ThemeChoiceField } from "@/features/overlayTheme/ThemeChoiceField";
import { resolveTheme } from "@/services/creator/overlayThemeTypes";
import {
  VOTE_COLORS,
  VOTE_DURATION_MAX_SEC,
  VOTE_ITEMS_MAX,
  VOTE_ITEMS_MIN,
  VOTE_ITEM_MAX_CHARS,
  VOTE_NAME_MAX,
  VOTE_PRESET_MAX,
  type VotePreset
} from "@/services/creator/widgetSettingsTypes";
import { FontFields, Row, Section, SwitchText } from "./fields";
import { VoteView } from "./GameViews";
import type { FormProps } from "./forms";
import styles from "./widgets.module.css";

const pad = (n: number) => String(n).padStart(2, "0");
const toHms = (sec: number) => `${pad(Math.floor(sec / 3600))}:${pad(Math.floor((sec % 3600) / 60))}:${pad(sec % 60)}`;
const fromHms = (s: string) => {
  const m = /^(\d{1,2}):([0-5]\d):([0-5]\d)$/.exec(s.trim());
  return m ? Number(m[1]) * 3600 + Number(m[2]) * 60 + Number(m[3]) : null;
};

/** Preview sample counts (the widget shows live counts from the server). */
const SAMPLE_COUNTS = [114, 83, 76, 10, 5, 3, 2, 1, 1, 0];

const newPreset = (index: number): VotePreset => ({
  id: `preset-${Date.now().toString(36)}-${index}`,
  name: "",
  color: VOTE_COLORS[index % VOTE_COLORS.length],
  durationSec: 300,
  items: ["", ""]
});

/**
 * 투표 위젯 설정 — Figma 315:858. Presets are started and ended from the 리모컨; voting is free
 * (2026-10-04 결정: one vote per signed-in viewer, no FN price or 무료 투표권).
 */
export function VoteForm({ value: v, onChange, live }: FormProps<"VOTE">) {
  const set = <P extends keyof typeof v>(k: P, x: (typeof v)[P]) => onChange({ ...v, [k]: x });
  const [openId, setOpenId] = useState<string | null>(v.presets[0]?.id ?? null);
  const [checked, setChecked] = useState<string[]>([]);
  // The preview follows the preset being edited.
  const preview = v.presets.find((p) => p.id === openId) ?? v.presets[0];
  const items = preview && preview.items.some((i) => i.trim()) ? preview.items : ["Item 3", "Item 2", "Item 4", "Item 1"];

  const updatePreset = (id: string, patch: Partial<VotePreset>) => set("presets", v.presets.map((p) => (p.id === id ? { ...p, ...patch } : p)));
  const { t } = useI18n();

  return (
    <>
      <Section title={t("widgetForm.preview")}>
        <PreviewStage width={600} minHeight={240} label={t("widgetFormVote.previewAria")}>
          <VoteView
            settings={{ ...v, enabled: true }}
            vote={{
              id: "sample",
              name: preview?.name.trim() || "투표 예시",
              color: preview?.color ?? VOTE_COLORS[0],
              items: items.map((item, i) => ({ label: item.trim() || `항목 ${i + 1}`, count: SAMPLE_COUNTS[i] ?? 0 })),
              total: items.reduce((sum, _, i) => sum + (SAMPLE_COUNTS[i] ?? 0), 0),
              startedAt: new Date(0).toISOString(),
              endsAt: new Date((preview?.durationSec ?? 300) * 1000).toISOString(),
              ended: false
            }}
            theme={resolveTheme(live.appearance, v.theme)}
            now={0}
          />
        </PreviewStage>
        <p className={styles.hint}>{t("widgetFormVote.previewHint")}</p>
      </Section>
      <Section title={t("widgetForm.theme")}>
        <ThemeChoiceField value={v.theme} onChange={(x) => set("theme", x)} appearance={live.appearance} />
      </Section>

      <Section title={t("widgetForm.basic")}>
        <div className={styles.rows}>
          <p className={styles.notice}>{t("widgetFormVote.notice")}</p>
          <Row label={t("widgetForm.use")}>
            <SwitchText label={t("widgetFormVote.useLabel")} checked={v.enabled} onChange={(x) => set("enabled", x)} />
          </Row>
          <Row label={t("widgetForm.titleFont")}>
            <FontFields label={t("widgetForm.titleLabel")} value={v.titleFont} onChange={(x) => set("titleFont", x)} />
          </Row>
          <Row label={t("widgetFormVote.infoFont")}>
            <FontFields label={t("widgetFormVote.infoLabel")} value={v.infoFont} onChange={(x) => set("infoFont", x)} />
          </Row>
          <Row label={t("widgetFormVote.itemFont")}>
            <FontFields label={t("widgetFormVote.itemLabel")} value={v.itemFont} onChange={(x) => set("itemFont", x)} />
          </Row>
        </div>
      </Section>

      <Section
        title={t("widgetFormVote.presets")}
        aside={
          <div className={styles.inline}>
            <button
              type="button"
              className={styles.iconButton}
              aria-label={t("widgetFormVote.deleteSelected")}
              disabled={checked.length === 0}
              onClick={() => {
                set("presets", v.presets.filter((p) => !checked.includes(p.id)));
                setChecked([]);
              }}
            >
              🗑️
            </button>
            <button
              type="button"
              className={styles.blueButton}
              disabled={v.presets.length >= VOTE_PRESET_MAX}
              onClick={() => {
                const p = newPreset(v.presets.length);
                set("presets", [...v.presets, p]);
                setOpenId(p.id);
              }}
            >
              {t("widgetFormVote.addPreset")}
            </button>
          </div>
        }
      >
        <p className={styles.notice}>{t("widgetFormVote.presetNotice")}</p>
        <p className={styles.notice}>{t("widgetFormVote.freeNotice")}</p>
        {v.presets.length === 0 && <p className={styles.hint}>{t("widgetFormVote.empty")}</p>}
        <ul className={styles.presetList}>
          {v.presets.map((p, index) => {
            const open = openId === p.id;
            const label = p.name.trim() || t("widgetFormVote.presetN", { n: index + 1 });
            return (
              <li key={p.id} className={styles.preset}>
                <div className={styles.presetHead}>
                  <label className={styles.radio}>
                    <input
                      type="checkbox"
                      checked={checked.includes(p.id)}
                      onChange={(e) => setChecked((c) => (e.target.checked ? [...c, p.id] : c.filter((x) => x !== p.id)))}
                    />
                    {label}
                  </label>
                  <span className={styles.colorChips} role="radiogroup" aria-label={t("widgetFormVote.color", { label })}>
                    {VOTE_COLORS.map((c) => (
                      <button
                        key={c}
                        type="button"
                        role="radio"
                        aria-checked={p.color === c}
                        aria-label={c}
                        className={p.color === c ? styles.chipOn : undefined}
                        style={{ background: c }}
                        onClick={() => updatePreset(p.id, { color: c })}
                      />
                    ))}
                  </span>
                  <button type="button" className={styles.linkButton} aria-expanded={open} onClick={() => setOpenId(open ? null : p.id)}>
                    {t("widgetForm.settings")} {open ? "∧" : "∨"}
                  </button>
                </div>
                {open && <PresetFields preset={p} onChange={(patch) => updatePreset(p.id, patch)} />}
              </li>
            );
          })}
        </ul>
      </Section>
    </>
  );
}

function PresetFields({ preset: p, onChange }: { preset: VotePreset; onChange: (patch: Partial<VotePreset>) => void }) {
  const [duration, setDuration] = useState(toHms(p.durationSec));
  const durationValid = fromHms(duration) !== null;
  const { t } = useI18n();
  return (
    <div className={styles.rows}>
      <Row label={t("widgetFormVote.name")} htmlFor={`${p.id}-name`}>
        <input
          id={`${p.id}-name`}
          className={styles.input}
          maxLength={VOTE_NAME_MAX}
          placeholder={t("widgetFormVote.namePlaceholder")}
          value={p.name}
          onChange={(e) => onChange({ name: e.target.value })}
        />
      </Row>
      <Row label={t("widgetFormVote.time")} htmlFor={`${p.id}-time`}>
        <input
          id={`${p.id}-time`}
          className={styles.input}
          style={{ width: 120 }}
          aria-invalid={!durationValid || undefined}
          placeholder="00:05:00"
          value={duration}
          onChange={(e) => {
            setDuration(e.target.value);
            const sec = fromHms(e.target.value);
            if (sec !== null) onChange({ durationSec: Math.min(sec, VOTE_DURATION_MAX_SEC) });
          }}
        />
      </Row>
      <div className={styles.sectionHead}>
        <span className={styles.rowLabel}>{t("widgetFormVote.items")}</span>
        <button type="button" className={styles.blueButton} disabled={p.items.length >= VOTE_ITEMS_MAX} onClick={() => onChange({ items: [...p.items, ""] })}>
          {t("widgetFormVote.addItem")}
        </button>
      </div>
      <ol className={styles.voteItems}>
        {p.items.map((item, i) => (
          <li key={i}>
            <label htmlFor={`${p.id}-item-${i}`}>{t("widgetFormVote.itemN", { n: i + 1 })}</label>
            <div className={styles.inline}>
              <input
                id={`${p.id}-item-${i}`}
                className={styles.input}
                style={{ flex: 1 }}
                maxLength={VOTE_ITEM_MAX_CHARS}
                placeholder={t("widgetFormVote.itemPlaceholder", { max: VOTE_ITEM_MAX_CHARS })}
                value={item}
                onChange={(e) => onChange({ items: p.items.map((x, j) => (j === i ? e.target.value : x)) })}
              />
              {p.items.length > VOTE_ITEMS_MIN && (
                <button
                  type="button"
                  className={styles.iconButton}
                  aria-label={t("widgetFormVote.itemDelete", { n: i + 1 })}
                  onClick={() => onChange({ items: p.items.filter((_, j) => j !== i) })}
                >
                  ✕
                </button>
              )}
            </div>
          </li>
        ))}
      </ol>
    </div>
  );
}
