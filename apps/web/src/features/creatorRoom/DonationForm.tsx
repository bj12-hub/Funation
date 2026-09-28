"use client";

import { useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { formatNumber } from "@/lib/format";
import type { CreatorRoom, DonationType } from "@/services/creators/creatorRoom";
import styles from "./room.module.css";

const MAX_MESSAGE = 100;

/**
 * Figma 610:138 donation tab. The form is interactive, but submitting is disabled:
 * a donation is a financial mutation that needs the FN wallet, server validation and an
 * idempotency key (docs: Transaction Security). Balance is display-only from the server.
 */
export function DonationForm({
  name,
  donation,
  signedIn,
  fnBalance
}: {
  name: string;
  donation: CreatorRoom["donation"];
  signedIn: boolean;
  fnBalance: number | null;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const [typeIndex, setTypeIndex] = useState(0);
  const [amount, setAmount] = useState("");
  const [message, setMessage] = useState("");
  const [voiceId, setVoiceId] = useState<string | null>(donation.voices[0]?.id ?? null);
  const [hideProfile, setHideProfile] = useState(false);

  const type: DonationType = donation.types[typeIndex];
  const value = Number(amount);
  const tooSmall = amount !== "" && value < donation.minAmount;

  return (
    <div className={styles.donation}>
      <div className={styles.typeRow}>
        <button type="button" className={styles.typeArrow} aria-label="이전 후원 유형" disabled={typeIndex === 0} onClick={() => setTypeIndex((i) => i - 1)}>
          ‹
        </button>
        <div className={styles.types} role="radiogroup" aria-label="후원 유형">
          {donation.types.map((t, i) => (
            <button
              key={t.key}
              type="button"
              role="radio"
              aria-checked={i === typeIndex}
              className={`${styles.type} ${i === typeIndex ? styles.typeOn : ""}`}
              onClick={() => setTypeIndex(i)}
            >
              <span aria-hidden="true">{t.emoji}</span>
              <span>{t.label}</span>
            </button>
          ))}
        </div>
        <button
          type="button"
          className={styles.typeArrow}
          aria-label="다음 후원 유형"
          disabled={typeIndex === donation.types.length - 1}
          onClick={() => setTypeIndex((i) => i + 1)}
        >
          ›
        </button>
      </div>

      <div className={styles.titleRow}>
        <h2 className={styles.formTitle}>{type.title}</h2>
        {fnBalance !== null && <span className={styles.balance}>보유 {formatNumber(fnBalance)} FN</span>}
      </div>

      <form className={styles.form} onSubmit={(e) => e.preventDefault()} noValidate>
        <label className={styles.field}>
          <span className={styles.fieldLabel}>후원 금액</span>
          <span className={styles.inputBox}>
            <input
              className={styles.input}
              aria-label="후원 금액"
              inputMode="numeric"
              placeholder={`${formatNumber(donation.minAmount)}`}
              value={amount ? formatNumber(value) : ""}
              onChange={(e) => setAmount(e.target.value.replace(/[^\d]/g, "").slice(0, 9))}
              aria-invalid={tooSmall}
              aria-describedby="donation-amount-hint"
            />
            <span className={styles.suffix}>FN</span>
          </span>
        </label>

        <label className={styles.field}>
          <span className={styles.fieldLabel}>
            후원 메시지
            <span>
              {message.length}/{MAX_MESSAGE}
            </span>
          </span>
          <span className={styles.inputBox}>
            <textarea
              className={styles.textarea}
              placeholder="크리에이터에게 전할 메시지를 입력하세요"
              maxLength={MAX_MESSAGE}
              value={message}
              onChange={(e) => setMessage(e.target.value)}
            />
          </span>
        </label>

        {donation.voices.map((v) => (
          <button
            key={v.id}
            type="button"
            className={styles.voice}
            aria-pressed={voiceId === v.id}
            onClick={() => setVoiceId((current) => (current === v.id ? null : v.id))}
          >
            <span className={styles.voiceEmoji} aria-hidden="true">
              {v.emoji}
            </span>
            <span className={styles.voiceText}>
              <span className={styles.voiceTitle}>
                {v.name} · {v.description}
              </span>
              {/* TODO: voice catalog and preview audio are TBD. */}
              <span className={styles.voiceDetail}>보이스 / 상품 선택  ·  미리듣기 ▶</span>
            </span>
            {voiceId === v.id && (
              <span className={styles.voiceCheck} aria-hidden="true">
                ✓
              </span>
            )}
          </button>
        ))}

        <p id="donation-amount-hint" className={`${styles.validation} ${tooSmall ? styles.validationError : ""}`}>
          {tooSmall ? "!" : "✓"} 최소 {formatNumber(donation.minAmount)} FN부터 후원할 수 있어요
        </p>

        <div className={styles.toggleRow}>
          <button type="button" role="switch" aria-checked={hideProfile} aria-label="프로필 숨기기" className={styles.miniToggle} onClick={() => setHideProfile((h) => !h)} />
          <span aria-hidden="true">프로필 숨기기</span>
        </div>
      </form>

      {signedIn ? (
        <>
          {/* TODO: enable with the FN wallet (server-side balance check + idempotency key). */}
          <button type="button" className={styles.submit} aria-disabled="true" title="준비 중인 기능입니다">
            {name}님에게 후원하기
          </button>
          <p className={styles.hint}>후원 결제는 FN 지갑 연동 후 제공됩니다.</p>
        </>
      ) : (
        <button type="button" className={styles.submit} onClick={() => router.push(`/login?next=${encodeURIComponent(pathname)}`)}>
          로그인하고 후원하기
        </button>
      )}
    </div>
  );
}
