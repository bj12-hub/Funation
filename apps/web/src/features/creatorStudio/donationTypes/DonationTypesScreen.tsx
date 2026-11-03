"use client";

import { useRouter } from "next/navigation";
import { useCallback, useState, useTransition, type ReactNode } from "react";
import { Toast } from "@/components/ui/Toast";
import { formatNumber } from "@/lib/format";
import { useI18n } from "@/lib/i18n/I18nProvider";
import type { MessageKey } from "@/lib/i18n/translate";
import { saveDonationTypeSettings } from "@/services/creator/flextvDonationTypes";
import {
  MINI_MAX_FN,
  MINI_PALETTE,
  QUEST_TIME_MIN,
  WISHLIST_MAX,
  WISHLIST_NAME_MAX,
  WISHLIST_NOTE_MAX,
  parseTypeSettings,
  type DonationTypeSettings,
  type GachaDraft
} from "@/services/creator/donationTypeSettings";
import { GACHA_MAX, GACHA_NAME_MAX, GACHA_PRIZES_MAX, ROULETTE_ITEMS_MAX, ROULETTE_ITEMS_MIN, ROULETTE_ITEM_MAX_CHARS } from "@/services/creator/widgetSettingsTypes";
import styles from "./donationTypes.module.css";

const num = (value: string) => (value === "" ? 0 : Math.max(0, Math.floor(Number(value)) || 0));

/** 글자 색 names by palette id; a color this table doesn't know shows the palette's own label. */
const COLOR_LABELS: Record<string, MessageKey> = {
  white: "flextvDonationTypes.colorWhite",
  pink: "flextvDonationTypes.colorPink",
  lavender: "flextvDonationTypes.colorLavender",
  cyan: "flextvDonationTypes.colorCyan",
  yellow: "flextvDonationTypes.colorYellow"
};

/**
 * 후원 종류 설정 (phase 6; code-first, no Figma frame). Route `/creator/donation-types`, with FLEXTV and its Ssumnation
 * endpoints. What a FLEXTV channel's room offers besides 일반 · 시그니처 · 영상: 미니 · 위시리스트 · 그림 · 룰렛 · 뽑기.
 * The screen shows the server's own check before saving; FLEXTV keeps the settings.
 */
export function DonationTypesScreen({ initial }: { initial: DonationTypeSettings }) {
  const { t } = useI18n();
  const router = useRouter();
  const [s, setS] = useState(initial);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const clear = useCallback(() => setToast(null), []);
  const [pending, startTransition] = useTransition();
  const set = <K extends keyof DonationTypeSettings>(key: K, value: DonationTypeSettings[K]) => setS((prev) => ({ ...prev, [key]: value }));

  const save = () => {
    const checked = parseTypeSettings(s);
    if ("invalid" in checked) return setError(checked.invalid);
    setError(null);
    startTransition(async () => {
      const r = await saveDonationTypeSettings(s);
      if (r.status === "SAVED") {
        setS(r.settings);
        setToast(t("flextvDonationTypes.saved"));
        router.refresh();
      } else if (r.status === "UNAUTHORIZED") router.push("/login?role=creator&next=/creator/donation-types");
      else setError(r.status === "INVALID" ? r.message : t("flextvDonationTypes.saveFailed"));
    });
  };

  const rouletteSum = s.roulette.items.reduce((sum, i) => sum + i.percent, 0);

  return (
    <div className={styles.content}>
      <h1 className={styles.pageTitle}>{t("flextvDonationTypes.title")}</h1>
      <p className={styles.help}>{t("flextvDonationTypes.intro")}</p>

      <Section
        title={t("flextvDonationTypes.miniTitle")}
        toggleLabel={t("flextvDonationTypes.acceptMini")}
        on={s.mini.enabled}
        onToggle={(enabled) => set("mini", { ...s.mini, enabled })}
        help={t("flextvDonationTypes.miniHelp", { max: formatNumber(MINI_MAX_FN) })}
      >
        <div className={styles.row}>
          <NumberField label={t("flextvDonationTypes.minAmount")} value={s.mini.minAmount} onChange={(minAmount) => set("mini", { ...s.mini, minAmount })} max={MINI_MAX_FN} />
          <NumberField label={t("flextvDonationTypes.maxAmount")} value={s.mini.maxAmount} onChange={(maxAmount) => set("mini", { ...s.mini, maxAmount })} max={MINI_MAX_FN} />
        </div>
        <fieldset className={styles.field}>
          <legend className={styles.label}>{t("flextvDonationTypes.textColor")}</legend>
          <div className={styles.chips}>
            {MINI_PALETTE.map((c) => (
              <label key={c.id} className={styles.check}>
                <input
                  type="checkbox"
                  checked={s.mini.colorIds.includes(c.id)}
                  onChange={(e) => set("mini", { ...s.mini, colorIds: e.target.checked ? [...s.mini.colorIds, c.id] : s.mini.colorIds.filter((id) => id !== c.id) })}
                />
                <span className={styles.swatch} style={{ background: c.hex }} aria-hidden="true" />
                {COLOR_LABELS[c.id] ? t(COLOR_LABELS[c.id]) : c.label}
              </label>
            ))}
          </div>
        </fieldset>
      </Section>

      <Section title={t("flextvDonationTypes.wishlistTitle")} help={t("flextvDonationTypes.wishlistHelp", { max: WISHLIST_MAX })}>
        {s.wishlist.length === 0 && <p className={styles.empty}>{t("flextvDonationTypes.wishlistEmpty")}</p>}
        {s.wishlist.map((w, i) => {
          const update = (patch: Partial<typeof w>) => set("wishlist", s.wishlist.map((x, j) => (j === i ? { ...x, ...patch } : x)));
          return (
            <div key={w.id ?? `new-${i}`} className={styles.itemRow}>
              <input className={`${styles.input} ${styles.emoji}`} value={w.emoji} onChange={(e) => update({ emoji: e.target.value.slice(0, 4) })} aria-label={t("flextvDonationTypes.emoji")} />
              <input
                className={styles.input}
                value={w.name}
                onChange={(e) => update({ name: e.target.value })}
                maxLength={WISHLIST_NAME_MAX}
                placeholder={t("flextvDonationTypes.name")}
                aria-label={t("flextvDonationTypes.name")}
              />
              <input
                className={`${styles.input} ${styles.amount}`}
                inputMode="numeric"
                value={w.price || ""}
                onChange={(e) => update({ price: num(e.target.value) })}
                placeholder={t("flextvDonationTypes.pricePlaceholder")}
                aria-label={t("flextvDonationTypes.price")}
              />
              <input
                className={styles.input}
                value={w.note}
                onChange={(e) => update({ note: e.target.value })}
                maxLength={WISHLIST_NOTE_MAX}
                placeholder={t("flextvDonationTypes.notePlaceholder")}
                aria-label={t("flextvDonationTypes.note")}
              />
              <label className={styles.check}>
                <input type="checkbox" checked={w.inStock} onChange={(e) => update({ inStock: e.target.checked })} />
                {t("flextvDonationTypes.inStock")}
              </label>
              <button type="button" className={styles.linkButton} onClick={() => set("wishlist", s.wishlist.filter((_, j) => j !== i))}>
                {t("flextvDonationTypes.delete")}
              </button>
            </div>
          );
        })}
        <button
          type="button"
          className={styles.secondaryButton}
          disabled={s.wishlist.length >= WISHLIST_MAX}
          onClick={() => set("wishlist", [...s.wishlist, { id: null, emoji: "🎁", name: "", price: 0, note: "", inStock: true }])}
        >
          {t("flextvDonationTypes.addItem")}
        </button>
      </Section>

      <Section title={t("flextvDonationTypes.gameTitle")} help={t("flextvDonationTypes.gameHelp")}>
        <NumberField label={t("flextvDonationTypes.gameMinAmount")} value={s.game.minAmount} onChange={(minAmount) => set("game", { minAmount })} />
        <div className={styles.chips}>
          <label className={styles.check}>
            <input type="checkbox" checked={s.drawing.enabled} onChange={(e) => set("drawing", { enabled: e.target.checked })} />
            {t("flextvDonationTypes.acceptDrawing")}
          </label>
          <label className={styles.check}>
            <input type="checkbox" checked={s.quest.enabled} onChange={(e) => set("quest", { ...s.quest, enabled: e.target.checked })} />
            {t("flextvDonationTypes.acceptQuest")}
          </label>
          <label className={styles.check}>
            <input type="checkbox" checked={s.quest.allowExtension} onChange={(e) => set("quest", { ...s.quest, allowExtension: e.target.checked })} />
            {t("flextvDonationTypes.questExtension")}
          </label>
        </div>
        <NumberField
          label={t("flextvDonationTypes.questMaxTime", { min: QUEST_TIME_MIN.min, max: QUEST_TIME_MIN.max })}
          value={Math.round(s.quest.maxTimeSec / 60)}
          onChange={(minutes) => set("quest", { ...s.quest, maxTimeSec: minutes * 60 })}
          max={QUEST_TIME_MIN.max}
        />
      </Section>

      <Section
        title={t("flextvDonationTypes.rouletteTitle")}
        toggleLabel={t("flextvDonationTypes.acceptRoulette")}
        on={s.roulette.enabled}
        onToggle={(enabled) => set("roulette", { ...s.roulette, enabled })}
        help={t("flextvDonationTypes.rouletteHelp")}
      >
        <div className={styles.row}>
          <NumberField label={t("flextvDonationTypes.rouletteMinAmount")} value={s.roulette.minAmount} onChange={(minAmount) => set("roulette", { ...s.roulette, minAmount })} />
          <NumberField label={t("flextvDonationTypes.rouletteDailyLimit")} value={s.roulette.dailyLimit} onChange={(dailyLimit) => set("roulette", { ...s.roulette, dailyLimit })} max={100} />
        </div>
        {s.roulette.items.map((item, i) => (
          <div key={i} className={styles.itemRow}>
            <input
              className={styles.input}
              value={item.name}
              maxLength={ROULETTE_ITEM_MAX_CHARS}
              onChange={(e) => set("roulette", { ...s.roulette, items: s.roulette.items.map((x, j) => (j === i ? { ...x, name: e.target.value } : x)) })}
              placeholder={t("flextvDonationTypes.itemPlaceholder")}
              aria-label={t("flextvDonationTypes.itemAria", { n: i + 1 })}
            />
            <input
              className={`${styles.input} ${styles.amount}`}
              inputMode="numeric"
              value={item.percent || ""}
              onChange={(e) => set("roulette", { ...s.roulette, items: s.roulette.items.map((x, j) => (j === i ? { ...x, percent: num(e.target.value) } : x)) })}
              placeholder="%"
              aria-label={t("flextvDonationTypes.itemOddsAria", { n: i + 1 })}
            />
            <button type="button" className={styles.linkButton} disabled={s.roulette.items.length <= ROULETTE_ITEMS_MIN} onClick={() => set("roulette", { ...s.roulette, items: s.roulette.items.filter((_, j) => j !== i) })}>
              {t("flextvDonationTypes.delete")}
            </button>
          </div>
        ))}
        <div className={styles.inline}>
          <button
            type="button"
            className={styles.secondaryButton}
            disabled={s.roulette.items.length >= ROULETTE_ITEMS_MAX}
            onClick={() => set("roulette", { ...s.roulette, items: [...s.roulette.items, { name: "", percent: 0 }] })}
          >
            {t("flextvDonationTypes.addItem")}
          </button>
          <span className={styles.note} data-tone={rouletteSum === 100 ? undefined : "warn"}>
            {t("flextvDonationTypes.oddsTotal", { total: rouletteSum })}
          </span>
        </div>
      </Section>

      <Section title={t("flextvDonationTypes.gachaTitle")} help={t("flextvDonationTypes.gachaHelp", { max: GACHA_MAX })}>
        {s.gacha.length === 0 && <p className={styles.empty}>{t("flextvDonationTypes.gachaEmpty")}</p>}
        {s.gacha.map((g, i) => (
          <GachaCard
            key={g.id ?? `new-${i}`}
            value={g}
            onChange={(next) => set("gacha", s.gacha.map((x, j) => (j === i ? next : x)))}
            onRemove={() => set("gacha", s.gacha.filter((_, j) => j !== i))}
          />
        ))}
        <button
          type="button"
          className={styles.secondaryButton}
          disabled={s.gacha.length >= GACHA_MAX}
          onClick={() => set("gacha", [...s.gacha, { id: null, enabled: true, name: "", price: 1_000, mode: "PROBABILITY", limit: null, prizes: [{ name: "꽝", blank: true, percent: 50, left: null }, { name: "", blank: false, percent: 50, left: null }] }])}
        >
          {t("flextvDonationTypes.addGacha")}
        </button>
      </Section>

      {error && (
        <p className={styles.error} role="alert">
          {error}
        </p>
      )}
      <div className={styles.saveBar}>
        <button type="button" className={styles.primaryButton} disabled={pending} aria-busy={pending || undefined} onClick={save}>
          {pending ? t("flextvDonationTypes.saving") : t("flextvDonationTypes.save")}
        </button>
      </div>
      <Toast message={toast} tone="neutral" onDone={clear} />
    </div>
  );
}

function Section({
  title,
  toggleLabel,
  help,
  on,
  onToggle,
  children
}: {
  title: string;
  toggleLabel?: string;
  help: string;
  on?: boolean;
  onToggle?: (on: boolean) => void;
  children: ReactNode;
}) {
  const { t } = useI18n();
  return (
    <section className={styles.card} aria-label={title}>
      <div className={styles.cardHead}>
        <h2 className={styles.cardTitle}>{title}</h2>
        {onToggle && (
          <label className={styles.check}>
            <input type="checkbox" checked={!!on} onChange={(e) => onToggle(e.target.checked)} aria-label={toggleLabel} />
            {on ? t("flextvDonationTypes.on") : t("flextvDonationTypes.off")}
          </label>
        )}
      </div>
      <p className={styles.help}>{help}</p>
      {children}
    </section>
  );
}

function NumberField({ label, value, onChange, max }: { label: string; value: number; onChange: (value: number) => void; max?: number }) {
  return (
    <label className={styles.field}>
      <span className={styles.label}>{label}</span>
      <input className={styles.input} inputMode="numeric" value={String(value)} onChange={(e) => onChange(Math.min(max ?? Number.MAX_SAFE_INTEGER, num(e.target.value)))} />
    </label>
  );
}

function GachaCard({ value: g, onChange, onRemove }: { value: GachaDraft; onChange: (next: GachaDraft) => void; onRemove: () => void }) {
  const { t } = useI18n();
  const prize = (i: number, patch: Partial<GachaDraft["prizes"][number]>) => onChange({ ...g, prizes: g.prizes.map((p, j) => (j === i ? { ...p, ...patch } : p)) });
  const sum = g.prizes.reduce((s, p) => s + (p.percent ?? 0), 0);
  return (
    <div className={styles.subCard}>
      <div className={styles.cardHead}>
        <input
          className={styles.input}
          value={g.name}
          onChange={(e) => onChange({ ...g, name: e.target.value })}
          maxLength={GACHA_NAME_MAX}
          placeholder={t("flextvDonationTypes.gachaName")}
          aria-label={t("flextvDonationTypes.gachaName")}
        />
        <label className={styles.check}>
          <input
            type="checkbox"
            checked={g.enabled}
            onChange={(e) => onChange({ ...g, enabled: e.target.checked })}
            aria-label={t("flextvDonationTypes.acceptGacha", { name: g.name || t("flextvDonationTypes.thisGacha") })}
          />
          {g.enabled ? t("flextvDonationTypes.on") : t("flextvDonationTypes.off")}
        </label>
        <button type="button" className={styles.linkButton} onClick={onRemove}>
          {t("flextvDonationTypes.delete")}
        </button>
      </div>
      <div className={styles.row}>
        <NumberField label={t("flextvDonationTypes.gachaPrice")} value={g.price} onChange={(price) => onChange({ ...g, price })} />
        <label className={styles.field}>
          <span className={styles.label}>{t("flextvDonationTypes.gachaDailyLimit")}</span>
          <input className={styles.input} inputMode="numeric" value={g.limit ?? ""} onChange={(e) => onChange({ ...g, limit: e.target.value ? Math.min(100, num(e.target.value)) : null })} />
        </label>
        <label className={styles.field}>
          <span className={styles.label}>{t("flextvDonationTypes.mode")}</span>
          <select
            className={styles.input}
            value={g.mode}
            onChange={(e) => {
              const mode = e.target.value === "STOCK" ? "STOCK" : "PROBABILITY";
              onChange({ ...g, mode, prizes: g.prizes.map((p) => (mode === "STOCK" ? { ...p, percent: null, left: p.left ?? 1 } : { ...p, left: null, percent: p.percent ?? 0 })) });
            }}
          >
            <option value="PROBABILITY">{t("flextvDonationTypes.modeOdds")}</option>
            <option value="STOCK">{t("flextvDonationTypes.modeStock")}</option>
          </select>
        </label>
      </div>
      {g.prizes.map((p, i) => (
        <div key={i} className={styles.itemRow}>
          <input
            className={styles.input}
            value={p.name}
            onChange={(e) => prize(i, { name: e.target.value })}
            maxLength={GACHA_NAME_MAX}
            placeholder={t("flextvDonationTypes.prizePlaceholder")}
            aria-label={t("flextvDonationTypes.prizeAria", { n: i + 1 })}
          />
          {g.mode === "PROBABILITY" ? (
            <input
              className={`${styles.input} ${styles.amount}`}
              inputMode="numeric"
              value={p.percent || ""}
              onChange={(e) => prize(i, { percent: num(e.target.value) })}
              placeholder="%"
              aria-label={t("flextvDonationTypes.prizeOddsAria", { n: i + 1 })}
            />
          ) : (
            <input
              className={`${styles.input} ${styles.amount}`}
              inputMode="numeric"
              value={p.left ?? ""}
              onChange={(e) => prize(i, { left: num(e.target.value) })}
              placeholder={t("flextvDonationTypes.stockPlaceholder")}
              aria-label={t("flextvDonationTypes.prizeStockAria", { n: i + 1 })}
            />
          )}
          <label className={styles.check}>
            <input type="checkbox" checked={p.blank} onChange={(e) => prize(i, { blank: e.target.checked })} />
            {t("flextvDonationTypes.blank")}
          </label>
          <button type="button" className={styles.linkButton} disabled={g.prizes.length <= 1} onClick={() => onChange({ ...g, prizes: g.prizes.filter((_, j) => j !== i) })}>
            {t("flextvDonationTypes.delete")}
          </button>
        </div>
      ))}
      <div className={styles.inline}>
        <button
          type="button"
          className={styles.secondaryButton}
          disabled={g.prizes.length >= GACHA_PRIZES_MAX}
          onClick={() => onChange({ ...g, prizes: [...g.prizes, { name: "", blank: false, percent: g.mode === "PROBABILITY" ? 0 : null, left: g.mode === "STOCK" ? 1 : null }] })}
        >
          {t("flextvDonationTypes.addPrize")}
        </button>
        {g.mode === "PROBABILITY" && (
          <span className={styles.note} data-tone={sum === 100 ? undefined : "warn"}>
            {t("flextvDonationTypes.oddsTotal", { total: sum })}
          </span>
        )}
      </div>
    </div>
  );
}
