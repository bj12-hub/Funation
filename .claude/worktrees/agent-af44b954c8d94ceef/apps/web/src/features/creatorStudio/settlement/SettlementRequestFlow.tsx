"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { HelpCircleIcon, AlertCircleIcon } from "@/components/icons";
import { Modal } from "@/components/ui/Modal";
import { quoteSettlement, requestSettlement, setAutoSettlement } from "@/services/creator/settlementRequests";
import type { SettlementApplyView, SettlementGate, SettlementQuote } from "@/services/creator/settlementTypes";
import { FeeGuideModal, SettlementGuideModal } from "./SettlementInfoPopups";
import styles from "./apply.module.css";

const fn = (n: number) => n.toLocaleString("ko-KR");
const pct = (rate: number) => `${Math.round(rate * 1000) / 10}%`;

type Step = "request" | "confirm" | "complete" | null;

/**
 * 신청 가능 FN card (458:70) and the request flow: 정산 신청 (469:195 · 469:2) → 정산 신청 확인 (473:2)
 * → 완료 (477:2), plus 정산 관련 안내 (466:2) and 수수료 안내 (475:2). All amounts and fees come from
 * the server; the browser only parses the typed number and formats server values.
 */
export function SettlementRequestFlow({ view }: { view: SettlementApplyView }) {
  const router = useRouter();
  const [step, setStep] = useState<Step>(null);
  const [guide, setGuide] = useState(false);
  const [feeGuide, setFeeGuide] = useState(false);
  const [mode, setMode] = useState<"all" | "part">("part");
  const [input, setInput] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [quote, setQuote] = useState<SettlementQuote | null>(null);
  const [idempotencyKey, setIdempotencyKey] = useState<string | null>(null);
  const [auto, setAuto] = useState(view.autoSettlement);
  const [autoError, setAutoError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const belowMin = view.minFn !== null && view.availableFn < view.minFn;
  const amount = mode === "all" ? view.availableFn : Number(input.replace(/,/g, ""));

  const handleResult = (status: "UNAUTHORIZED" | SettlementGate) => {
    if (status === "UNAUTHORIZED") router.push("/login?role=creator&next=/creator/settlement/apply");
    // 본인인증 missing (e.g. reset after this page loaded): the settlement home opens the 본인인증 notice.
    else if (status === "IDENTITY_REQUIRED") router.push("/creator/settlement?gate=identity");
    else router.push("/creator/settlement");
  };

  const openRequest = () => {
    setMode("part");
    setInput("");
    setError(null);
    setStep("request");
  };

  const toConfirm = () => {
    setError(null);
    startTransition(async () => {
      const res = await quoteSettlement(amount);
      if (res.status === "OK") {
        setQuote(res.quote);
        setIdempotencyKey(crypto.randomUUID());
        setStep("confirm");
      } else if (res.status === "INVALID") setError(res.message);
      else handleResult(res.status);
    });
  };

  const submit = () => {
    if (!quote || !idempotencyKey) return;
    startTransition(async () => {
      const res = await requestSettlement({ amountFn: quote.amountFn, idempotencyKey });
      if (res.status === "REQUESTED") {
        setQuote(res.quote);
        setStep("complete");
      } else if (res.status === "INVALID" || res.status === "CONFLICT") {
        setError(res.status === "INVALID" ? res.message : "요청이 중복되었어요. 금액을 확인하고 다시 신청해 주세요.");
        setStep("request");
      } else handleResult(res.status);
    });
  };

  const finish = () => {
    setStep(null);
    setQuote(null);
    setIdempotencyKey(null);
    router.refresh();
  };

  const toggleAuto = (on: boolean) => {
    if (on === auto) return;
    setAutoError(null);
    setAuto(on);
    startTransition(async () => {
      const res = await setAutoSettlement(on);
      if (res.status !== "SAVED") {
        setAuto(!on);
        if (res.status === "INVALID") setAutoError("저장하지 못했어요. 다시 시도해 주세요.");
        else handleResult(res.status);
      }
    });
  };

  return (
    <>
      <section className={styles.cashCard} aria-labelledby="cash-label">
        <div className={styles.cashHead}>
          <span id="cash-label" className={styles.cashLabel}>
            신청 가능 FN
          </span>
          <strong className={styles.cashValue}>{fn(view.availableFn)} FN &gt;</strong>
        </div>
        <button type="button" className={styles.cashButton} onClick={openRequest} disabled={belowMin} title={belowMin ? "신청 가능 FN이 최소 신청 금액보다 적어요" : undefined}>
          정산 신청
        </button>
        {view.hasPending ? (
          <button type="button" className={`${styles.infoBar} ${styles.pendingBar}`} onClick={() => setGuide(true)}>
            <AlertCircleIcon className={styles.barIcon} aria-hidden="true" />· 정산 승인 대기 중입니다.
          </button>
        ) : (
          <button type="button" className={styles.infoBar} onClick={() => setGuide(true)}>
            <AlertCircleIcon className={styles.barIcon} aria-hidden="true" />
            정산 전, 관련 사항 반드시 읽어주세요!
          </button>
        )}
        <div className={styles.autoRow}>
          <span className={styles.autoLabel}>
            자동 정산 신청
            <button type="button" className={styles.helpButton} onClick={() => setGuide(true)} aria-label="자동 정산 안내 보기">
              <HelpCircleIcon />
            </button>
          </span>
          <span className={styles.toggle} role="group" aria-label="자동 정산 신청">
            {[true, false].map((on) => (
              <button key={String(on)} type="button" aria-pressed={auto === on} onClick={() => toggleAuto(on)} disabled={pending}>
                {on ? "ON" : "OFF"}
              </button>
            ))}
          </span>
        </div>
        {autoError && (
          <p className={styles.cashError} role="alert">
            {autoError}
          </p>
        )}
      </section>

      {/* 469:195 · 469:2 */}
      <Modal
        open={step === "request"}
        onClose={() => setStep(null)}
        title="정산 신청"
        width={480}
        className={styles.popup}
        footer={
          <>
            <button type="button" className={styles.greyButton} onClick={() => setStep(null)}>
              뒤로
            </button>
            <button type="button" className={styles.blueButton} onClick={toConfirm} disabled={pending || !(amount > 0)} aria-busy={pending || undefined}>
              {pending ? "확인 중..." : "정산 신청"}
            </button>
          </>
        }
      >
        <div className={styles.popupBox}>
          <p className={styles.boxTitle}>입금 계좌 정보</p>
          <p className={styles.boxText}>
            {view.bankName} {view.accountMasked}
            <br />
            {view.holder}
          </p>
          <hr className={styles.boxDivider} />
          <p className={styles.boxLabel}>신청 가능 FN</p>
          <div className={styles.boxRow}>
            <strong className={styles.boxAmount}>{fn(view.availableFn)} FN</strong>
            <button type="button" className={styles.smallButton} onClick={() => setFeeGuide(true)}>
              자세히 보기
            </button>
          </div>
        </div>
        <div className={styles.segment} role="group" aria-label="신청 방식">
          {(["all", "part"] as const).map((m) => (
            <button
              key={m}
              type="button"
              aria-pressed={mode === m}
              onClick={() => {
                setMode(m);
                setError(null);
              }}
            >
              {m === "all" ? "전액" : "일부"}
            </button>
          ))}
        </div>
        <div className={styles.amountField}>
          <label htmlFor="settle-amount" className={styles.amountLabel}>
            정산 신청 FN 입력
          </label>
          <span className={styles.amountInputWrap}>
            <input
              id="settle-amount"
              className={styles.amountInput}
              inputMode="numeric"
              placeholder="숫자로 입력"
              value={mode === "all" ? fn(view.availableFn) : input}
              readOnly={mode === "all"}
              onChange={(e) => {
                const digits = e.target.value.replace(/\D/g, "").slice(0, 12);
                setInput(digits ? fn(Number(digits)) : "");
                setError(null);
              }}
              aria-invalid={error ? true : undefined}
              aria-describedby="settle-amount-help"
            />
            <span className={styles.amountSuffix}>FN</span>
          </span>
          <p id="settle-amount-help" className={styles.amountHelp} role={error ? "alert" : undefined}>
            {error ?? (view.minFn !== null && !input && mode === "part" ? `* ${view.minFn} FN 이상 정산신청 가능합니다.` : "")}
          </p>
        </div>
      </Modal>

      {/* 473:2 */}
      <Modal
        open={step === "confirm"}
        onClose={() => setStep(null)}
        title="정산 신청 확인"
        width={440}
        className={styles.popup}
        footer={
          <>
            <button type="button" className={styles.greyButton} onClick={() => setStep("request")} disabled={pending}>
              취소
            </button>
            <button type="button" className={styles.blueButton} onClick={submit} disabled={pending} aria-busy={pending || undefined}>
              {pending ? "신청 중..." : "확인"}
            </button>
          </>
        }
      >
        {quote && (
          <div className={styles.confirm}>
            <p className={styles.confirmRow}>
              <span>정산 신청금액</span>
              <strong>{fn(quote.amountFn)} FN</strong>
            </p>
            <div className={styles.popupBox}>
              <p className={styles.boxTitle}>
                수수료 안내
                <button type="button" className={styles.helpButton} onClick={() => setFeeGuide(true)} aria-label="수수료 안내 보기">
                  <HelpCircleIcon />
                </button>
              </p>
              <p className={styles.feeRow}>
                <span>결제 수수료 ({pct(quote.paymentFeeRate)})</span>
                <span>- {fn(quote.paymentFeeFn)} FN</span>
              </p>
              <p className={styles.feeRow}>
                <span>서비스 이용료 ({pct(quote.serviceFeeRate)})</span>
                <span>- {fn(quote.serviceFeeFn)} FN</span>
              </p>
              <hr className={styles.boxDivider} />
              <p className={`${styles.feeRow} ${styles.feeTotal}`}>
                <span>총 수수료</span>
                <span>- {fn(quote.totalFeeFn)} FN</span>
              </p>
            </div>
            <p className={styles.netRow}>
              <span>실제 정산 금액</span>
              <strong>{fn(quote.netKrw)} 원</strong>
            </p>
            <p className={styles.confirmAsk}>위 금액으로 정산을 신청하시겠습니까?</p>
          </div>
        )}
      </Modal>

      {/* 477:2 */}
      <Modal
        open={step === "complete"}
        onClose={finish}
        title="정산 신청이 완료되었습니다"
        width={420}
        className={styles.popup}
        customHeader={
          <div className={styles.doneHead}>
            <span className={styles.doneMark} aria-hidden="true">
              ✓
            </span>
            <h2 className={styles.doneTitle}>정산 신청이 완료되었습니다</h2>
            <p className={styles.doneText}>승인 완료까지 최대 2~3 영업일이 소요될 수 있습니다.</p>
          </div>
        }
        footer={
          <button type="button" className={styles.blueButton} onClick={finish}>
            확인
          </button>
        }
      >
        {quote && (
          <>
            <div className={styles.popupBox}>
              <p className={styles.feeRow}>
                <span>신청 금액</span>
                <strong>{fn(quote.amountFn)} FN</strong>
              </p>
              <p className={`${styles.feeRow} ${styles.feeTotal}`}>
                <span>수수료</span>
                <span>- {fn(quote.totalFeeFn)} FN</span>
              </p>
              <hr className={styles.boxDivider} />
              <p className={`${styles.feeRow} ${styles.doneNet}`}>
                <span>실제 정산 금액</span>
                <strong>{fn(quote.netKrw)} 원</strong>
              </p>
            </div>
            <p className={styles.doneNote}>정산 현황은 &apos;정산 관리&apos;에서 확인하실 수 있습니다.</p>
          </>
        )}
      </Modal>

      <SettlementGuideModal open={guide} onClose={() => setGuide(false)} minFn={view.minFn} />
      <FeeGuideModal open={feeGuide} onClose={() => setFeeGuide(false)} />
    </>
  );
}
