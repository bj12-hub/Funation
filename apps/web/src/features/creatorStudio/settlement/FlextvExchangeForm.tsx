"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { formatNumber } from "@/lib/format";
import { requestExchange } from "@/services/creator/flextvSettlement";
import type { ExchangeRequestResult, FlextvSettlementView } from "@/services/creator/flextvSettlementTypes";
import { SUBMIT_UNKNOWN_MESSAGE, keyForQuote } from "./settlementSubmit";
import styles from "./flextv.module.css";

type Step = "request" | "confirm" | "done";

/**
 * 정산 신청 with FLEXTV: 렉스 → 확인 → 완료. The server checks FLEXTV's rules again and FLEXTV sets the payout. A lost or
 * unclear answer keeps the amount and its Idempotency-Key, so 확인 again asks about the same request (settlementSubmit.ts).
 */
export function FlextvExchangeForm({ view }: { view: FlextvSettlementView }) {
  const router = useRouter();
  const [step, setStep] = useState<Step>("request");
  const [input, setInput] = useState("");
  const [business, setBusiness] = useState(false);
  const [key, setKey] = useState<{ key: string | null; amountFn: number | null }>({ key: null, amountFn: null });
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const amount = Number(input);
  const blocked = !view.identityVerified ? "본인인증을 마쳐야 정산 신청을 할 수 있어요." : !view.account ? "정산 계좌를 먼저 등록해 주세요." : view.openRequest ? "처리 중인 정산 신청이 있어요. 끝난 뒤에 다시 신청해 주세요." : !view.open ? "지금은 정산 신청 시간이 아니에요. 매일 0시 1분부터 오후 2시 전까지 신청할 수 있어요." : null;

  const toConfirm = () => {
    setError(null);
    if (!Number.isSafeInteger(amount) || amount <= 0) return setError("정산 신청 렉스를 숫자로 입력해 주세요.");
    if (amount < view.minRex) return setError(`${formatNumber(view.minRex)} 렉스부터 정산 신청할 수 있어요.`);
    if (amount > view.exchangeable) return setError("정산 가능한 렉스보다 많이 신청할 수 없어요.");
    // The same amount keeps the key of a 확인 whose answer was lost.
    setKey((last) => ({ key: keyForQuote(last, amount, () => crypto.randomUUID()), amountFn: amount }));
    setStep("confirm");
  };

  const onAnswer = (r: ExchangeRequestResult) => {
    if (r.status === "REQUESTED") {
      setKey({ key: null, amountFn: null });
      setStep("done");
      router.refresh();
    } else if (r.status === "IN_PROGRESS") setError(SUBMIT_UNKNOWN_MESSAGE);
    else if (r.status === "UNAUTHORIZED") router.push("/login?role=creator&next=/creator/settlement/apply");
    else if (r.status === "IDENTITY_REQUIRED" || r.status === "NO_ACCOUNT") router.push("/creator/settlement");
    else {
      setKey({ key: null, amountFn: null });
      setStep("request");
      setError(r.status === "INVALID" ? r.message : "요청이 중복되었어요. 렉스를 확인하고 다시 신청해 주세요.");
    }
  };

  const submit = () => {
    if (!key.key) return;
    setError(null);
    const idempotencyKey = key.key;
    startTransition(async () => {
      try {
        onAnswer(await requestExchange({ amount, business, idempotencyKey }));
      } catch {
        setError(SUBMIT_UNKNOWN_MESSAGE);
      }
    });
  };

  if (step === "done") {
    return (
      <section className={styles.card} aria-labelledby="fx-done">
        <h2 id="fx-done" className={styles.cardTitle}>
          정산 신청을 마쳤어요
        </h2>
        <p className={styles.help}>{formatNumber(amount)} 렉스를 신청했어요. FLEXTV 검토 뒤 등록된 계좌로 입금돼요. 지급액은 정산 관리에서 확인할 수 있어요.</p>
        <div className={styles.actions}>
          <Link href="/creator/settlement/manage" className={styles.primaryButton}>
            정산 관리로 가기
          </Link>
        </div>
      </section>
    );
  }

  return (
    <section className={styles.card} aria-labelledby="fx-form">
      <h2 id="fx-form" className={styles.cardTitle}>
        {step === "confirm" ? "정산 신청 확인" : "정산 신청"}
      </h2>
      {blocked ? (
        <p className={styles.help}>{blocked}</p>
      ) : step === "request" ? (
        <form
          className={styles.field}
          onSubmit={(e) => {
            e.preventDefault();
            toConfirm();
          }}
        >
          {view.business && (
            <fieldset className={styles.field}>
              <legend className={styles.label}>정산 구분</legend>
              <div className={styles.radios}>
                <label className={styles.check}>
                  <input type="radio" name="kind" checked={!business} onChange={() => setBusiness(false)} />
                  개인
                </label>
                <label className={styles.check}>
                  <input type="radio" name="kind" checked={business} onChange={() => setBusiness(true)} />
                  사업자 (매주 수요일 오후 2시 전)
                </label>
              </div>
            </fieldset>
          )}
          <label className={styles.label} htmlFor="fx-amount">
            신청할 렉스
          </label>
          <div className={styles.amountRow}>
            <input
              id="fx-amount"
              className={styles.input}
              inputMode="numeric"
              value={input}
              onChange={(e) => setInput(e.target.value.replace(/\D/g, "").slice(0, 12))}
              placeholder={`${formatNumber(view.minRex)} 이상`}
              aria-describedby="fx-amount-help"
            />
            <button type="button" className={styles.secondaryButton} onClick={() => setInput(String(view.exchangeable))} disabled={view.exchangeable < view.minRex}>
              전액
            </button>
            <button type="submit" className={styles.primaryButton} disabled={!input}>
              다음
            </button>
          </div>
          <p id="fx-amount-help" className={styles.note}>
            정산 가능 {formatNumber(view.exchangeable)} 렉스 · {formatNumber(view.minRex)} 렉스부터 신청할 수 있어요. 정산 신청은 한 번에 하나씩 처리돼요.
          </p>
        </form>
      ) : (
        <>
          <dl className={styles.confirm}>
            <dt>신청 렉스</dt>
            <dd>{formatNumber(amount)} 렉스</dd>
            <dt>정산 구분</dt>
            <dd>{business ? "사업자" : "개인"}</dd>
            <dt>입금 계좌</dt>
            <dd>
              {view.account!.bankName} {view.account!.accountMasked} ({view.account!.holder})
            </dd>
          </dl>
          <p className={styles.note}>지급액은 FLEXTV가 계약 요율과 세금(원천징수)을 적용해 정하고, 신청 후 정산 관리에서 확인할 수 있어요.</p>
          <div className={styles.actions}>
            <button type="button" className={styles.secondaryButton} disabled={pending} onClick={() => (setError(null), setStep("request"))}>
              취소
            </button>
            <button type="button" className={styles.primaryButton} disabled={pending} aria-busy={pending || undefined} onClick={submit}>
              {pending ? "신청하는 중..." : "확인"}
            </button>
          </div>
        </>
      )}
      {error && (
        <p className={styles.error} role="alert">
          {error}
        </p>
      )}
    </section>
  );
}
