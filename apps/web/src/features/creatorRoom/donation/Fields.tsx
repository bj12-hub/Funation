"use client";

import { useId, type ReactNode } from "react";
import { formatNumber } from "@/lib/format";
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
  const field = (
    <label className={room.field}>
      <span className={room.fieldLabel}>
        후원 금액
        {hint}
      </span>
      <span className={`${room.inputBox} ${error ? styles.inputError : ""}`}>
        <input
          className={room.input}
          aria-label="후원 금액"
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
      <div className={styles.quickAmounts} role="group" aria-label="빠른 금액 추가">
        {QUICK_AMOUNTS.map((q) => (
          <button key={q.add} type="button" className={styles.quickAmount} aria-label={`${formatNumber(q.add)} FN 더하기`} onClick={() => onChange(addAmount(value, q.add))}>
            {q.label}
          </button>
        ))}
        <button
          type="button"
          className={styles.quickAmount}
          disabled={all === null}
          aria-label={all === null ? "보유 FN 전액" : `보유 FN 전액 (${formatNumber(all)} FN)`}
          onClick={() => all !== null && onChange(String(all))}
        >
          전액
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
        {!compact && <span className={room.voiceDetail}>보이스 / 상품 선택  ·  미리듣기 ▶</span>}
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

const Balance = ({ balance }: { balance: number | null }) => (balance === null ? null : <span className={styles.hintAccent}>보유 {formatNumber(balance)} FN</span>);

// ── 일반 후원 (851:4546) ──────────────────────────────────────────────────────

export function TextFields({ value, onChange, catalog, balance, error }: Props<TextState> & { error: string | null }) {
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
        label="후원 메시지"
        value={value.message}
        onChange={(message) => onChange({ ...value, message })}
        max={catalog.maxLength.message}
        placeholder="크리에이터에게 전할 메시지를 입력하세요"
        tall
      />
      {catalog.voices.map((v) => (
        <VoiceCard key={v.id} voice={v} selected={value.voiceId === v.id} onToggle={() => onChange({ ...value, voiceId: value.voiceId === v.id ? null : v.id })} />
      ))}
      <p className={`${room.validation} ${error ? room.validationError : ""}`} role={error ? "alert" : undefined}>
        {error ? `! ${error}` : `✓ 최소 ${formatNumber(catalog.minAmount.TEXT)} FN부터 후원할 수 있어요`}
      </p>
    </>
  );
}

// ── 미니 후원 (851:4665) ──────────────────────────────────────────────────────

export function MiniFields({ value, onChange, catalog, error, onEnter }: Props<MiniState> & { error: string | null; onEnter: () => void }) {
  return (
    <>
      <p className={styles.intro}>짧은 메시지를 빠르게 띄우는 미니 후원이에요.</p>
      <AmountField
        value={value.amount}
        onChange={(amount) => onChange({ ...value, amount })}
        hint={<span className={styles.hintAccent}>최소 {formatNumber(catalog.minAmount.MINI)} FN</span>}
        error={!!error}
      />
      <label className={room.field}>
        <span className={room.fieldLabel}>
          텍스트 내용
          <span>
            {value.text.length}/{catalog.maxLength.mini}
          </span>
        </span>
        <span className={room.inputBox}>
          <input
            className={room.input}
            placeholder="화면에 띄울 짧은 메시지"
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
        <span className={room.fieldLabel}>텍스트 색상</span>
        <div className={styles.swatches} role="radiogroup" aria-label="텍스트 색상">
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
        label="Enter 키로 바로 후원"
        sub="메시지 입력 후 Enter를 누르면 실행돼요"
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
export function VideoFields({ value, onChange, balance, error, audio = false }: Props<VideoState> & { error: string | null; audio?: boolean }) {
  const videoId = value.url ? parseYouTubeId(value.url) : null;
  const start = parseClock(value.start);
  const end = parseClock(value.end);
  const length = start !== null && end !== null && end > start ? end - start : null;

  return (
    <>
      <AmountField value={value.amount} onChange={(amount) => onChange({ ...value, amount })} hint={<Balance balance={balance} />} quick={{ balance }} />
      <label className={room.field}>
        <span className={room.fieldLabel}>{audio ? "YouTube 주소 (소리만 재생)" : "영상 URL"}</span>
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
      <div className={styles.preview} aria-hidden={!videoId}>
        <span className={styles.previewPlay} aria-hidden="true">
          ▶
        </span>
        <span className={styles.previewLabel}>
          {videoId ? `YouTube · ${videoId}${audio ? " · 소리만" : ""}` : audio ? "노래나 목소리가 담긴 YouTube 주소를 넣어 주세요" : "영상 URL을 입력하면 미리보기가 표시돼요"}
        </span>
      </div>
      <div className={styles.clockGrid}>
        <label className={room.field}>
          <span className={room.fieldLabel}>시작</span>
          <span className={room.inputBox}>
            <input className={room.input} value={value.start} placeholder="00:00" maxLength={5} onChange={(e) => onChange({ ...value, start: e.target.value })} />
          </span>
        </label>
        <label className={room.field}>
          <span className={room.fieldLabel}>종료</span>
          <span className={room.inputBox}>
            <input className={room.input} value={value.end} placeholder="00:30" maxLength={5} onChange={(e) => onChange({ ...value, end: e.target.value })} />
          </span>
        </label>
        <div className={room.field}>
          <span className={room.fieldLabel}>재생</span>
          <span className={`${room.inputBox} ${styles.readonlyBox}`}>{length === null ? "-" : `${length}초`}</span>
        </div>
      </div>
      {audio && <p className={`${room.validation} ${styles.audioNote}`}>방송 화면 구석의 작은 플레이어에서 소리 위주로 재생돼요. 공유할 권리가 있는 영상만 보내 주세요.</p>}
      <SwitchRow label={audio ? "음성 후원 이용약관 동의 (필수)" : "영상 후원 이용약관 동의 (필수)"} checked={value.terms} onChange={(terms) => onChange({ ...value, terms })} />
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
  const byRank = [...catalog.signatures].sort((a, b) => a.rank - b.rank);
  const selected = catalog.signatures.find((s) => s.id === value.signatureId) ?? null;
  // Four cards; a pick from 전체보기 that is not among them is shown first.
  const cards = selected && !byRank.slice(0, 4).includes(selected) ? [selected, ...byRank.slice(0, 3)] : byRank.slice(0, 4);

  return (
    <>
      <div className={styles.sectionHead}>
        <span>시그니처 선택</span>
        <button type="button" className={styles.linkButton} onClick={onOpenAll} aria-haspopup="dialog">
          전체보기 〉
        </button>
      </div>
      {cards.length === 0 && <p className={styles.selectedNote}>아직 준비된 시그니처가 없어요.</p>}
      <div className={styles.signatureGrid} role="radiogroup" aria-label="시그니처">
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
              <span className={s.favorite ? styles.starOn : styles.star} aria-label={s.favorite ? "즐겨찾기" : undefined}>
                ★
              </span>
              <strong>{formatNumber(s.price)} FN</strong>
            </span>
            <span className={styles.signatureName}>{s.name}</span>
          </button>
        ))}
      </div>
      {selected && <p className={styles.selectedNote}>✓ {selected.name} 선택됨</p>}
      <MessageField
        label="메시지"
        value={value.message}
        onChange={(message) => onChange({ ...value, message })}
        max={catalog.maxLength.message}
        placeholder="크리에이터에게 전할 메시지"
      />
    </>
  );
}

// ── 위시 후원 (851:5054) ──────────────────────────────────────────────────────

export function WishlistFields({ value, onChange, catalog, creatorName, error }: Props<WishlistState> & { creatorName: string; error: string | null }) {
  const selected = catalog.wishlist.find((w) => w.id === value.itemId) ?? null;
  return (
    <>
      <div className={styles.sectionHead}>
        <span>{creatorName}님의 위시리스트</span>
        <span className={styles.count}>{catalog.wishlist.length}개</span>
      </div>
      {catalog.wishlist.length === 0 ? (
        <p className={styles.empty}>등록된 위시 상품이 없어요.</p>
      ) : (
        <div className={styles.wishList} role="radiogroup" aria-label="위시 상품">
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
      {selected && !error && <p className={room.validation}>● 선택 상품 재고 있음 · 바로 후원 가능</p>}
      {error && (
        <p className={`${room.validation} ${room.validationError}`} role="alert">
          ! {error}
        </p>
      )}
      <MessageField
        label="후원 메시지"
        value={value.message}
        onChange={(message) => onChange({ ...value, message })}
        max={catalog.maxLength.message}
        placeholder="크리에이터에게 전할 메시지"
      />
      {catalog.voices.map((v) => (
        <VoiceCard key={v.id} voice={v} compact selected={value.voiceId === v.id} onToggle={() => onChange({ ...value, voiceId: value.voiceId === v.id ? null : v.id })} />
      ))}
    </>
  );
}
