"use client";

import { useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { ChargeModal } from "@/features/walletCharge";
import { formatNumber } from "@/lib/format";
import type { CreatorRoom, DonationType } from "@/services/creators/creatorRoom";
import { requestDonation } from "@/services/donations/donate";
import { MAX_DONATION_MESSAGE as MAX_MESSAGE } from "@/services/donations/donationTypes";
import { DonationCompleteDialog, DonationConfirmDialog, InsufficientFnDialog } from "./DonationDialogs";
import styles from "./room.module.css";

type Dialog =
  | { kind: "NONE" }
  | { kind: "CONFIRM" }
  | { kind: "COMPLETE"; fnAmount: number; balance: number }
  | { kind: "INSUFFICIENT"; balance: number }
  | { kind: "CHARGE" };

/**
 * Figma 610:138 donation tab → 613:6 확인 → 613:122 완료, or 613:237 FN 부족 → FN 충전 modal.
 * The server validates, checks the balance and debits; each confirmed submission carries an
 * idempotency key so a double click or a retry never debits twice. Balance is display-only.
 */
export function DonationForm({
  creatorId,
  name,
  donation,
  signedIn,
  fnBalance,
  onDonated
}: {
  creatorId: string;
  name: string;
  donation: CreatorRoom["donation"];
  signedIn: boolean;
  fnBalance: number | null;
  onDonated: (donation: { fnAmount: number; message: string; anonymous: boolean }) => void;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const [typeIndex, setTypeIndex] = useState(0);
  const [amount, setAmount] = useState("");
  const [message, setMessage] = useState("");
  const [voiceId, setVoiceId] = useState<string | null>(donation.voices[0]?.id ?? null);
  const [hideProfile, setHideProfile] = useState(false);
  const [dialog, setDialog] = useState<Dialog>({ kind: "NONE" });
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // One key per confirmed request; kept when the outcome is unknown so a retry cannot debit twice.
  const keyRef = useRef<string | null>(null);

  const type: DonationType = donation.types[typeIndex];
  const value = Number(amount);
  const tooSmall = amount !== "" && value < donation.minAmount;
  const loginHref = `/login?next=${encodeURIComponent(pathname)}`;

  /** Any edit makes it a different request. */
  const edit = <T,>(apply: () => T) => {
    keyRef.current = null;
    return apply();
  };

  const open = () => {
    if (!amount || tooSmall) return;
    // UX pre-check with the server-provided balance; the server checks again on submit.
    if (fnBalance !== null && value > fnBalance) {
      setDialog({ kind: "INSUFFICIENT", balance: fnBalance });
      return;
    }
    setError(null);
    setDialog({ kind: "CONFIRM" });
  };

  const confirm = async () => {
    keyRef.current ??= crypto.randomUUID();
    const text = message.trim();
    setPending(true);
    setError(null);
    try {
      const result = await requestDonation({ creatorId, type: type.key, amount: value, message: text, voiceId, hideProfile, idempotencyKey: keyRef.current });
      switch (result.status) {
        case "COMPLETED":
          keyRef.current = null;
          setDialog({ kind: "COMPLETE", fnAmount: result.fnAmount, balance: result.balance });
          onDonated({ fnAmount: result.fnAmount, message: text, anonymous: hideProfile });
          setAmount("");
          setMessage("");
          router.refresh(); // header, side nav and this tab show the new server balance
          break;
        case "INSUFFICIENT_FN":
          keyRef.current = null;
          setDialog({ kind: "INSUFFICIENT", balance: result.balance });
          break;
        case "IN_PROGRESS":
          setError("후원을 처리하고 있습니다. 잠시 후 다시 시도해 주세요.");
          break;
        case "UNAUTHORIZED":
          router.push(loginHref);
          break;
        default:
          keyRef.current = null;
          setError("후원 정보를 다시 확인해 주세요.");
      }
    } catch {
      setError("후원 결과를 확인하지 못했습니다. 다시 시도해 주세요.");
    } finally {
      setPending(false);
    }
  };

  return (
    <div className={styles.donation}>
      <div className={styles.typeRow}>
        <button
          type="button"
          className={styles.typeArrow}
          aria-label="이전 후원 유형"
          disabled={typeIndex === 0}
          onClick={() => edit(() => setTypeIndex((i) => i - 1))}
        >
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
              onClick={() => edit(() => setTypeIndex(i))}
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
          onClick={() => edit(() => setTypeIndex((i) => i + 1))}
        >
          ›
        </button>
      </div>

      <div className={styles.titleRow}>
        <h2 className={styles.formTitle}>{type.title}</h2>
        {fnBalance !== null && <span className={styles.balance}>보유 {formatNumber(fnBalance)} FN</span>}
      </div>

      <form
        className={styles.form}
        noValidate
        onSubmit={(e) => {
          e.preventDefault();
          if (signedIn) open();
        }}
      >
        <label className={styles.field}>
          <span className={styles.fieldLabel}>후원 금액</span>
          <span className={styles.inputBox}>
            <input
              className={styles.input}
              aria-label="후원 금액"
              inputMode="numeric"
              placeholder={`${formatNumber(donation.minAmount)}`}
              value={amount ? formatNumber(value) : ""}
              onChange={(e) => edit(() => setAmount(e.target.value.replace(/[^\d]/g, "").replace(/^0+/, "").slice(0, 9)))}
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
              onChange={(e) => edit(() => setMessage(e.target.value))}
            />
          </span>
        </label>

        {donation.voices.map((v) => (
          <button
            key={v.id}
            type="button"
            className={styles.voice}
            aria-pressed={voiceId === v.id}
            onClick={() => edit(() => setVoiceId((current) => (current === v.id ? null : v.id)))}
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
          <button
            type="button"
            role="switch"
            aria-checked={hideProfile}
            aria-label="프로필 숨기기"
            className={styles.miniToggle}
            onClick={() => edit(() => setHideProfile((h) => !h))}
          />
          <span aria-hidden="true">프로필 숨기기</span>
        </div>
      </form>

      {signedIn ? (
        <button type="button" className={styles.submit} disabled={!amount || tooSmall} onClick={open}>
          {name}님에게 후원하기
        </button>
      ) : (
        <button type="button" className={styles.submit} onClick={() => router.push(loginHref)}>
          로그인하고 후원하기
        </button>
      )}

      <DonationConfirmDialog
        open={dialog.kind === "CONFIRM"}
        creatorName={name}
        amount={value}
        message={message.trim()}
        pending={pending}
        error={error}
        onCancel={() => setDialog({ kind: "NONE" })}
        onConfirm={() => void confirm()}
      />
      <DonationCompleteDialog
        open={dialog.kind === "COMPLETE"}
        fnAmount={dialog.kind === "COMPLETE" ? dialog.fnAmount : 0}
        balance={dialog.kind === "COMPLETE" ? dialog.balance : 0}
        onClose={() => setDialog({ kind: "NONE" })}
      />
      <InsufficientFnDialog
        open={dialog.kind === "INSUFFICIENT"}
        balance={dialog.kind === "INSUFFICIENT" ? dialog.balance : 0}
        onCancel={() => setDialog({ kind: "NONE" })}
        onCharge={() => setDialog({ kind: "CHARGE" })}
      />
      {dialog.kind === "CHARGE" && <ChargeModal onClose={() => setDialog({ kind: "NONE" })} />}
    </div>
  );
}
