"use client";

import { useId, type ReactNode } from "react";
import { formatCompact, formatNumber } from "@/lib/format";
import { useI18n } from "@/lib/i18n/I18nProvider";
import type { DonationCatalog, Voice } from "@/services/donations/donationCatalog";
import { parseYouTubeId } from "@/services/donations/donationTypes";
import { AMOUNT_INPUT_MAX, QUICK_AMOUNTS, addAmount, parseClock, type MiniState, type SignatureState, type TextState, type VideoState, type WishlistState } from "./drafts";
import room from "../room.module.css";
import styles from "./donation.module.css";

type Props<S> = { value: S; onChange: (next: S) => void; catalog: DonationCatalog; balance: number | null };

const onlyDigits = (raw: string) => raw.replace(/[^\d]/g, "").replace(/^0+/, "").slice(0, 9);

// ── Shared pieces ────────────────────────────────────────────────────────────

function AmountField({
  value,
  onChange,
  hint,
  error,
  quick
}: {
  value: string;
  onChange: (v: string) => void;
  hint?: ReactNode;
  error?: boolean;
  /** Shows the 빠른 금액 추가 row; 전액 needs the balance. */
  quick?: { balance: number | null };
}) {
  const { t, locale } = useI18n();
  const field = (
    <label className={room.field}>
      <span className={room.fieldLabel}>
        {t("roomDonate.amount")}
        {hint}
      </span>
      <span className={`${room.inputBox} ${error ? styles.inputError : ""}`}>
        <input
          className={room.input}
          aria-label={t("roomDonate.amount")}
          inputMode="numeric"
          placeholder="0"
          value={value ? formatNumber(Number(value)) : ""}
          onChange={(e) => onChange(onlyDigits(e.target.value))}
          aria-invalid={error}
        />
        <span className={room.suffix}>FN</span>
      </span>
    </label>
  );
  if (!quick) return field;
  const all = quick.balance !== null && quick.balance > 0 ? Math.min(quick.balance, AMOUNT_INPUT_MAX) : null;
  return (
    <div className={styles.amountGroup}>
      {field}
      <div className={styles.quickAmounts} role="group" aria-label={t("roomDonate.quickAmounts")}>
        {QUICK_AMOUNTS.map((q) => (
          <button key={q.add} type="button" className={styles.quickAmount} aria-label={t("roomDonate.addAmount", { amount: formatNumber(q.add) })} onClick={() => onChange(addAmount(value, q.add))}>
            {`+${formatCompact(q.add, locale)}`}
          </button>
        ))}
        <button
          type="button"
          className={styles.quickAmount}
          disabled={all === null}
          aria-label={all === null ? t("roomDonate.allBalance") : t("roomDonate.allBalanceAmount", { amount: formatNumber(all) })}
          onClick={() => all !== null && onChange(String(all))}
        >
          {t("roomDonate.all")}
        </button>
      </div>
    </div>
  );
}

function MessageField({ label, value, onChange, max, placeholder, tall = false }: { label: string; value: string; onChange: (v: string) => void; max: number; placeholder: string; tall?: boolean }) {
  return (
    <label className={room.field}>
      <span className={room.fieldLabel}>
        {label}
        <span>
          {value.length}/{max}
        </span>
      </span>
      <span className={room.inputBox}>
        {tall ? (
          <textarea className={room.textarea} placeholder={placeholder} maxLength={max} value={value} onChange={(e) => onChange(e.target.value)} />
        ) : (
          <input className={room.input} placeholder={placeholder} maxLength={max} value={value} onChange={(e) => onChange(e.target.value)} />
        )}
      </span>
    </label>
  );
}

function VoiceCard({ voice, selected, onToggle, compact = false }: { voice: Voice; selected: boolean; onToggle: () => void; compact?: boolean }) {
  const { t } = useI18n();
  return (
    <button type="button" className={room.voice} aria-pressed={selected} onClick={onToggle}>
      <span className={room.voiceEmoji} aria-hidden="true">
        {voice.emoji}
      </span>
      <span className={room.voiceText}>
        <span className={room.voiceTitle}>
          {voice.name} · {voice.description}
        </span>
        {/* TODO: voice catalog and preview audio are TBD. */}
        {!compact && <span className={room.voiceDetail}>{t("roomDonate.voiceDetail")}</span>}
      </span>
      {selected && (
        <span className={room.voiceCheck} aria-hidden="true">
          ✓
        </span>
      )}
    </button>
  );
}

export function SwitchRow({ label, sub, checked, onChange }: { label: string; sub?: string; checked: boolean; onChange: (v: boolean) => void }) {
  const id = useId();
  return (
    <div className={styles.switchRow}>
      <span className={styles.switchText}>
        <span id={id}>{label}</span>
        {sub && <span className={styles.switchSub}>{sub}</span>}
      </span>
      <button type="button" role="switch" aria-checked={checked} aria-labelledby={id} className={room.miniToggle} onClick={() => onChange(!checked)} />
    </div>
  );
}

function Balance({ balance }: { balance: number | null }) {
  const { t } = useI18n();
  return balance === null ? null : <span className={styles.hintAccent}>{t("roomDonate.balance", { amount: formatNumber(balance) })}</span>;
}

// ── 일반 후원 (851:4546) ──────────────────────────────────────────────────────

export function TextFields({ value, onChange, catalog, balance, error }: Props<TextState> & { error: string | null }) {
  const { t } = useI18n();
  return (
    <>
      <AmountField
        value={value.amount}
        onChange={(amount) => onChange({ ...value, amount })}
        hint={<Balance balance={balance} />}
        error={!!error}
        quick={{ balance }}
      />
      <MessageField
        label={t("roomDonate.message")}
        value={value.message}
        onChange={(message) => onChange({ ...value, message })}
        max={catalog.maxLength.message}
        placeholder={t("roomDonate.messagePlaceholder")}
        tall
      />
      {catalog.readAloudChoice && <ReadAloudToggle checked={value.readAloud} onChange={(readAloud) => onChange({ ...value, readAloud })} />}
      {catalog.voices.map((v) => (
        <VoiceCard key={v.id} voice={v} selected={value.voiceId === v.id} onToggle={() => onChange({ ...value, voiceId: value.voiceId === v.id ? null : v.id })} />
      ))}
      <p className={`${room.validation} ${error ? room.validationError : ""}`} role={error ? "alert" : undefined}>
        {error ? `! ${error}` : `✓ ${t("roomDonate.minAmount", { amount: formatNumber(catalog.minAmount.TEXT) })}`}
      </p>
    </>
  );
}

// ── 미니 후원 (851:4665) ──────────────────────────────────────────────────────

export function MiniFields({ value, onChange, catalog, error, onEnter }: Props<MiniState> & { error: string | null; onEnter: () => void }) {
  const { t } = useI18n();
  return (
    <>
      <p className={styles.intro}>{t("roomDonate.miniIntro")}</p>
      <AmountField
        value={value.amount}
        onChange={(amount) => onChange({ ...value, amount })}
        hint={
          <span className={styles.hintAccent}>
            {formatNumber(catalog.minAmount.MINI)} ~ {formatNumber(catalog.maxAmount.MINI)} FN
          </span>
        }
        error={!!error}
      />
      <label className={room.field}>
        <span className={room.fieldLabel}>
          {t("roomDonate.miniText")}
          <span>
            {value.text.length}/{catalog.maxLength.mini}
          </span>
        </span>
        <span className={room.inputBox}>
          <input
            className={room.input}
            placeholder={t("roomDonate.miniPlaceholder")}
            maxLength={catalog.maxLength.mini}
            value={value.text}
            onChange={(e) => onChange({ ...value, text: e.target.value })}
            onKeyDown={(e) => {
              if (e.key === "Enter" && value.enterToSend && !e.nativeEvent.isComposing) {
                e.preventDefault();
                onEnter();
              }
            }}
          />
        </span>
      </label>
      <div className={room.field}>
        <span className={room.fieldLabel}>{t("roomDonate.miniColor")}</span>
        <div className={styles.swatches} role="radiogroup" aria-label={t("roomDonate.miniColor")}>
          {catalog.miniColors.map((c) => (
            <button
              key={c.id}
              type="button"
              role="radio"
              aria-checked={value.colorId === c.id}
              aria-label={c.label}
              className={`${styles.swatch} ${value.colorId === c.id ? styles.swatchOn : ""}`}
              style={{ background: c.hex }}
              onClick={() => onChange({ ...value, colorId: c.id })}
            />
          ))}
        </div>
      </div>
      <SwitchRow
        label={t("roomDonate.enterToSend")}
        sub={t("roomDonate.enterToSendSub")}
        checked={value.enterToSend}
        onChange={(enterToSend) => onChange({ ...value, enterToSend })}
      />
      {error && (
        <p className={`${room.validation} ${room.validationError}`} role="alert">
          ! {error}
        </p>
      )}
    </>
  );
}

// ── 영상 후원 (851:4788) ──────────────────────────────────────────────────────

/** 영상 후원, or 음성 후원 (`audio`): the same YouTube link and range; 음성 plays the sound with a small player. */
export function VideoFields({ value, onChange, catalog, balance, error, audio = false }: Props<VideoState> & { error: string | null; audio?: boolean }) {
  const { t } = useI18n();
  const videoId = value.url ? parseYouTubeId(value.url) : null;
  const start = parseClock(value.start);
  const end = parseClock(value.end);
  const length = start !== null && end !== null && end > start ? end - start : null;
  // A room that prices by the second (a FLEXTV streamer's 영상 후원): the amount follows the range.
  const pricing = catalog.mediaPricing?.[audio ? "AUDIO" : "VIDEO"];

  return (
    <>
      {pricing ? (
        <div className={room.field}>
          <span className={room.fieldLabel}>{t("roomDonate.amount")}</span>
          <span className={`${room.inputBox} ${styles.readonlyBox}`}>{length === null ? "-" : `${formatNumber(length * pricing.perSecond)} FN`}</span>
          <span className={room.validation}>
            {t("roomDonate.perSecond", {
              price: formatNumber(pricing.perSecond),
              min: formatNumber(audio ? catalog.minAmount.AUDIO : catalog.minAmount.VIDEO),
              max: formatNumber(pricing.maxSec)
            })}
          </span>
        </div>
      ) : (
        <AmountField value={value.amount} onChange={(amount) => onChange({ ...value, amount })} hint={<Balance balance={balance} />} quick={{ balance }} />
      )}
      <label className={room.field}>
        <span className={room.fieldLabel}>{audio ? t("roomDonate.audioUrl") : t("roomDonate.videoUrl")}</span>
        <span className={room.inputBox}>
          <input
            className={room.input}
            inputMode="url"
            placeholder="youtube.com/watch?v=..."
            value={value.url}
            onChange={(e) => onChange({ ...value, url: e.target.value.slice(0, 200) })}
          />
        </span>
      </label>
      {/* A dark video screen in both themes, so its text keeps the dark theme's colours. */}
      <div className={styles.preview} aria-hidden={!videoId} data-theme="dark">
        <span className={styles.previewPlay} aria-hidden="true">
          ▶
        </span>
        <span className={styles.previewLabel}>
          {videoId ? `YouTube · ${videoId}${audio ? t("roomDonate.soundOnly") : ""}` : audio ? t("roomDonate.audioPreviewEmpty") : t("roomDonate.videoPreviewEmpty")}
        </span>
      </div>
      <div className={styles.clockGrid}>
        <label className={room.field}>
          <span className={room.fieldLabel}>{t("roomDonate.start")}</span>
          <span className={room.inputBox}>
            <input className={room.input} value={value.start} placeholder="00:00" maxLength={5} onChange={(e) => onChange({ ...value, start: e.target.value })} />
          </span>
        </label>
        <label className={room.field}>
          <span className={room.fieldLabel}>{t("roomDonate.end")}</span>
          <span className={room.inputBox}>
            <input className={room.input} value={value.end} placeholder="00:30" maxLength={5} onChange={(e) => onChange({ ...value, end: e.target.value })} />
          </span>
        </label>
        <div className={room.field}>
          <span className={room.fieldLabel}>{t("roomDonate.play")}</span>
          <span className={`${room.inputBox} ${styles.readonlyBox}`}>{length === null ? "-" : t("roomDonate.seconds", { sec: length })}</span>
        </div>
      </div>
      {audio && <p className={`${room.validation} ${styles.audioNote}`}>{t("roomDonate.audioNote")}</p>}
      <SwitchRow label={audio ? t("roomDonate.audioTerms") : t("roomDonate.videoTerms")} checked={value.terms} onChange={(terms) => onChange({ ...value, terms })} />
      {error && (
        <p className={`${room.validation} ${room.validationError}`} role="alert">
          ! {error}
        </p>
      )}
    </>
  );
}

// ── 시그니처 후원 (851:4929) ──────────────────────────────────────────────────

export function SignatureFields({ value, onChange, catalog, onOpenAll }: Props<SignatureState> & { onOpenAll: () => void }) {
  const { t } = useI18n();
  const byRank = [...catalog.signatures].sort((a, b) => a.rank - b.rank);
  const selected = catalog.signatures.find((s) => s.id === value.signatureId) ?? null;
  // Four cards; a pick from 전체보기 that is not among them is shown first.
  const cards = selected && !byRank.slice(0, 4).includes(selected) ? [selected, ...byRank.slice(0, 3)] : byRank.slice(0, 4);

  return (
    <>
      <div className={styles.sectionHead}>
        <span>{t("roomDonate.pickSignature")}</span>
        <button type="button" className={styles.linkButton} onClick={onOpenAll} aria-haspopup="dialog">
          {t("roomDonate.viewAll")}
        </button>
      </div>
      {cards.length === 0 && <p className={styles.selectedNote}>{t("roomDonate.noSignatures")}</p>}
      <div className={styles.signatureGrid} role="radiogroup" aria-label={t("roomDonate.signatures")}>
        {cards.map((s) => (
          <button
            key={s.id}
            type="button"
            role="radio"
            aria-checked={s.id === value.signatureId}
            className={`${styles.signatureCard} ${s.id === value.signatureId ? styles.cardOn : ""}`}
            onClick={() => onChange({ ...value, signatureId: s.id })}
          >
            <span className={styles.signatureTop}>
              <span className={s.favorite ? styles.starOn : styles.star} aria-label={s.favorite ? t("roomDonate.favorite") : undefined}>
                ★
              </span>
              <strong>{formatNumber(s.price)} FN</strong>
            </span>
            <span className={styles.signatureName}>{s.name}</span>
          </button>
        ))}
      </div>
      {selected && <p className={styles.selectedNote}>{t("roomDonate.selected", { name: selected.name })}</p>}
      <MessageField
        label={t("roomDonate.shortMessage")}
        value={value.message}
        onChange={(message) => onChange({ ...value, message })}
        max={catalog.maxLength.message}
        placeholder={t("roomDonate.shortMessagePlaceholder")}
      />
      {catalog.readAloudChoice && <ReadAloudToggle checked={value.readAloud} onChange={(readAloud) => onChange({ ...value, readAloud })} />}
    </>
  );
}

/** "메시지 읽어주기" (phase 10, a FLEXTV room): off, the message is not read aloud and only shows in chat. */
function ReadAloudToggle({ checked, onChange }: { checked: boolean; onChange: (checked: boolean) => void }) {
  const { t } = useI18n();
  return <SwitchRow label={t("roomDonate.readAloud")} sub={t(checked ? "roomDonate.readAloudOnSub" : "roomDonate.readAloudOffSub")} checked={checked} onChange={onChange} />;
}

// ── 위시 후원 (851:5054) ──────────────────────────────────────────────────────

export function WishlistFields({ value, onChange, catalog, creatorName, error }: Props<WishlistState> & { creatorName: string; error: string | null }) {
  const { t } = useI18n();
  const selected = catalog.wishlist.find((w) => w.id === value.itemId) ?? null;
  return (
    <>
      <div className={styles.sectionHead}>
        <span>{t("roomDonate.wishlistOf", { name: creatorName })}</span>
        <span className={styles.count}>{t("roomDonate.itemCount", { count: catalog.wishlist.length })}</span>
      </div>
      {catalog.wishlist.length === 0 ? (
        <p className={styles.empty}>{t("roomDonate.noWishes")}</p>
      ) : (
        <div className={styles.wishList} role="radiogroup" aria-label={t("roomDonate.wishItems")}>
          {catalog.wishlist.map((w) => (
            <button
              key={w.id}
              type="button"
              role="radio"
              aria-checked={w.id === value.itemId}
              className={`${room.voice} ${styles.wishItem} ${w.id === value.itemId ? "" : styles.wishOff}`}
              onClick={() => onChange({ ...value, itemId: w.id })}
            >
              <span className={room.voiceEmoji} aria-hidden="true">
                {w.emoji}
              </span>
              <span className={room.voiceText}>
                <span className={room.voiceTitle}>{w.name}</span>
                <span className={room.voiceDetail}>
                  {formatNumber(w.price)} FN · {w.note}
                </span>
              </span>
              {w.id === value.itemId && (
                <span className={room.voiceCheck} aria-hidden="true">
                  ✓
                </span>
              )}
            </button>
          ))}
        </div>
      )}
      {selected && !error && <p className={room.validation}>{t("roomDonate.inStock")}</p>}
      {error && (
        <p className={`${room.validation} ${room.validationError}`} role="alert">
          ! {error}
        </p>
      )}
      <MessageField
        label={t("roomDonate.message")}
        value={value.message}
        onChange={(message) => onChange({ ...value, message })}
        max={catalog.maxLength.message}
        placeholder={t("roomDonate.shortMessagePlaceholder")}
      />
      {catalog.voices.map((v) => (
        <VoiceCard key={v.id} voice={v} compact selected={value.voiceId === v.id} onToggle={() => onChange({ ...value, voiceId: value.voiceId === v.id ? null : v.id })} />
      ))}
    </>
  );
}
