"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Modal } from "@/components/ui/Modal";
import { ChargeModal, ChargeTrigger } from "@/features/walletCharge";
import { formatNumber } from "@/lib/format";
import { quotePlatformDonation, requestPlatformDonation } from "@/services/platformDonation/platformDonation";
import { MESSAGE_MAX, PLATFORMS, type PlatformCreatorDetail, type PlatformDonationResult, type PlatformQuote } from "@/services/platformDonation/platformTypes";
import { Avatar, LivePill, PlatformHeader } from "./parts";
import styles from "./platformDonation.module.css";

type Step = "product" | "message" | "processing" | "success" | "error";
type Quote = Extract<PlatformQuote, { status: "OK" }>;
type Success = Extract<PlatformDonationResult, { status: "COMPLETED" }>;
type ErrorKind = "API_ERROR" | "UNAVAILABLE" | "NOT_FOUND" | "PENDING" | "IN_PROGRESS" | "NETWORK" | "INVALID";

const fn = (n: number) => `${formatNumber(n)} FN`;

/**
 * Figma SOOP 817:9242 → 9334 → 9411 → 9509 → 9553 / 9618 · FlexTV 817:8597 → 8684 → 8761 → 8843 → 8886 / 8948,
 * plus 817:7699 (FN 부족) and 817:7872 (세션 만료). Prices, balance and the result come from the server;
 * the browser only keeps the selection, the message and one Idempotency-Key per confirmation.
 */
export function PlatformDonationFlow({ detail }: { detail: PlatformCreatorDetail }) {
  const router = useRouter();
  const p = PLATFORMS[detail.platform];
  const { creator, products } = detail;
  const [step, setStep] = useState<Step>("product");
  const [productId, setProductId] = useState<string | null>(null);
  const [custom, setCustom] = useState("");
  const [message, setMessage] = useState("");
  const [quote, setQuote] = useState<Quote | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [insufficient, setInsufficient] = useState<{ balance: number; required: number } | null>(null);
  const [charging, setCharging] = useState(false);
  const [sessionExpired, setSessionExpired] = useState(false);
  const [success, setSuccess] = useState<Success | null>(null);
  const [errorKind, setErrorKind] = useState<ErrorKind | null>(null);
  /** Transaction ID of a PENDING donation (FN held until the platform result is known). */
  const [pendingTxId, setPendingTxId] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [idempotencyKey, setIdempotencyKey] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const product = products.find((x) => x.id === productId) ?? null;
  const customFn = product?.custom ? Number(custom.replace(/,/g, "")) : undefined;
  const displayPrice = product?.priceFn ?? (customFn && customFn > 0 ? customFn : null);

  const reset = () => {
    setStep("product");
    setProductId(null);
    setCustom("");
    setMessage("");
    setQuote(null);
    setSuccess(null);
    setErrorKind(null);
    setIdempotencyKey(null);
    router.refresh();
  };

  const toMessage = () => {
    if (!product) return;
    setFormError(null);
    startTransition(async () => {
      const res = await quotePlatformDonation({ platform: detail.platform, creatorId: creator.id, productId: product.id, customFn });
      if (res.status === "OK") {
        setQuote(res);
        setStep("message");
      } else if (res.status === "UNAUTHORIZED") setSessionExpired(true);
      else if (res.status === "INVALID" && product.custom) {
        setFormError(`${formatNumber(product.custom.minFn)} ~ ${formatNumber(product.custom.maxFn)} FN 사이로 입력해 주세요.`);
      } else {
        setErrorKind(res.status === "UNAVAILABLE" ? "UNAVAILABLE" : res.status === "NOT_FOUND" ? "NOT_FOUND" : "INVALID");
        setStep("error");
      }
    });
  };

  const openConfirm = () => {
    if (!quote) return;
    if (!quote.sufficient) {
      setInsufficient({ balance: quote.balance, required: quote.priceFn });
      return;
    }
    setIdempotencyKey(crypto.randomUUID());
    setConfirmOpen(true);
  };

  const submit = () => {
    if (!product || !idempotencyKey) return;
    setConfirmOpen(false);
    setStep("processing");
    const key = idempotencyKey;
    startTransition(async () => {
      let res: PlatformDonationResult;
      try {
        res = await requestPlatformDonation({ platform: detail.platform, creatorId: creator.id, productId: product.id, customFn, message, idempotencyKey: key });
      } catch {
        // The request may or may not have reached the server; retrying with the same key is safe.
        setErrorKind("NETWORK");
        setStep("error");
        return;
      }
      if (res.status === "COMPLETED") {
        setSuccess(res);
        setStep("success");
        // Re-read the side navigation balance.
        router.refresh();
      } else if (res.status === "INSUFFICIENT_FN") {
        setStep("message");
        setInsufficient({ balance: res.balance, required: res.required });
      } else if (res.status === "UNAUTHORIZED") {
        setStep("message");
        setSessionExpired(true);
      } else if (res.status === "FAILED") {
        setErrorKind(res.reason);
        setStep("error");
      } else if (res.status === "PENDING" || res.status === "IN_PROGRESS") {
        if (res.status === "PENDING") setPendingTxId(res.transactionId);
        setErrorKind(res.status);
        setStep("error");
      } else {
        setErrorKind("INVALID");
        setStep("error");
      }
    });
  };

  /** 다시 시도: a network failure retries with the same key; a platform refusal needs a new one. */
  const retry = () => {
    if (errorKind === "NETWORK" || errorKind === "PENDING" || errorKind === "IN_PROGRESS") {
      submit();
      return;
    }
    setErrorKind(null);
    setIdempotencyKey(null);
    setStep(quote ? "message" : "product");
  };

  // ── Processing / success / error take over the content area (817:9509 · 9553 · 9618) ──

  if (step === "processing") {
    return (
      <div className={styles.content}>
        <div className={styles.stateCard} role="status" aria-live="polite">
          <span className={styles.spinner} aria-hidden="true" />
          <strong className={styles.stateTitle}>후원을 처리하고 있습니다.</strong>
          <p className={styles.muted}>처리 중에는 페이지를 새로고침하거나 뒤로가기를 누르지 마세요.</p>
          <button type="button" className={styles.primaryButton} disabled>
            처리 중...
          </button>
        </div>
      </div>
    );
  }

  if (step === "success" && success) {
    return (
      <div className={styles.content}>
        <div className={styles.stateCard}>
          <span className={styles.successMark} aria-hidden="true">
            ✓
          </span>
          <strong className={styles.stateTitle}>후원이 완료되었습니다.</strong>
          <p className={styles.muted}>{success.creatorName}에게 마음이 전달되었어요.</p>
          <dl className={styles.receipt}>
            <div>
              <dt>후원 대상</dt>
              <dd>{success.creatorName}</dd>
            </div>
            <div>
              <dt>상품</dt>
              <dd>{success.productLabel}</dd>
            </div>
            <div>
              <dt>사용 FN</dt>
              <dd>{fn(success.fnAmount)}</dd>
            </div>
            <div>
              <dt>남은 FN</dt>
              <dd>{fn(success.balance)}</dd>
            </div>
            <div>
              <dt>{p.name} 거래번호</dt>
              <dd>{success.externalTransactionId}</dd>
            </div>
          </dl>
          <div className={styles.actions}>
            <Link href="/donation/history" className={styles.secondaryButton}>
              후원 내역 보기
            </Link>
            <button type="button" className={styles.primaryButton} onClick={reset}>
              다시 후원하기
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (step === "error" && errorKind) {
    const info = ERRORS[errorKind](p.name);
    return (
      <div className={styles.content}>
        <PlatformHeader platform={detail.platform} subtitle="후원 중 발생한 문제를 확인하고 다시 진행해주세요." balance={detail.balance} />
        <div className={styles.stateCard} role="alert">
          <span className={styles.errorMark} aria-hidden="true">
            {info.pending ? "…" : "!"}
          </span>
          <strong className={styles.stateTitle}>{info.title}</strong>
          <p className={styles.muted}>{info.text}</p>
          {info.notCharged && <p className={styles.notCharged}>FN은 차감되지 않았습니다.</p>}
          {errorKind === "PENDING" && pendingTxId && <p className={styles.muted}>결과가 확인될 때까지 FN은 보류됩니다. 거래 ID {pendingTxId}</p>}
          <div className={styles.actions}>
            <Link href="/donation/history" className={styles.secondaryButton}>
              후원 내역
            </Link>
            {info.searchAgain ? (
              <Link href={`/donation/${p.slug}`} className={styles.primaryButton}>
                {p.creatorWord} 검색
              </Link>
            ) : (
              <button type="button" className={styles.primaryButton} onClick={retry} disabled={pending}>
                {info.pending ? "결과 다시 확인" : "다시 시도"}
              </button>
            )}
          </div>
        </div>
      </div>
    );
  }

  // ── Product (817:9242 · 8597) and message (817:9334 · 8684) steps ──

  return (
    <div className={styles.content}>
      <PlatformHeader
        platform={detail.platform}
        subtitle={step === "product" ? `${p.creatorWord} 상세와 후원 상품을 확인해주세요.` : "후원 메시지와 결제 정보를 확인해주세요."}
        balance={quote?.balance ?? detail.balance}
      />

      {step === "product" ? (
        <>
          <section className={styles.creatorCard} aria-label={`${p.creatorWord} 정보`}>
            <Avatar creator={creator} size={56} />
            <span className={styles.creatorText}>
              <span className={styles.creatorName}>
                {creator.nickname} <LivePill live={creator.live} />
              </span>
              <span className={styles.muted}>{creator.handle}</span>
              <span className={styles.muted}>{creator.statusText}</span>
            </span>
          </section>
          {creator.viewers !== null && (
            // 방송 보기 needs the platform's watch URL (TBD), so only the viewer count is shown.
            <p className={styles.muted}>현재 {formatNumber(creator.viewers)}명이 함께 시청 중입니다.</p>
          )}

          <section className={styles.section} aria-labelledby="pd-products">
            <h2 id="pd-products" className={styles.sectionTitle}>
              후원상품
            </h2>
            <ul className={styles.products}>
              {products.map((x) => (
                <li key={x.id}>
                  <button type="button" className={styles.product} aria-pressed={productId === x.id} onClick={() => setProductId(x.id)}>
                    <span className={styles.productIcon} aria-hidden="true">
                      {x.icon}
                    </span>
                    <span className={styles.productLabel}>{x.label}</span>
                    <span className={styles.productPrice}>{x.priceFn !== null ? fn(x.priceFn) : "금액 입력"}</span>
                    {productId === x.id && <span className={styles.selected}>✓ 선택됨</span>}
                  </button>
                </li>
              ))}
            </ul>
            {product?.custom && (
              <label className={styles.customField}>
                <span className={styles.fieldLabel}>후원 금액 직접 입력</span>
                <span className={styles.customInput}>
                  <input
                    inputMode="numeric"
                    value={custom}
                    placeholder={`${formatNumber(product.custom.minFn)} FN 이상`}
                    onChange={(e) => {
                      const d = e.target.value.replace(/\D/g, "").slice(0, 9);
                      setCustom(d ? formatNumber(Number(d)) : "");
                      setFormError(null);
                    }}
                  />
                  FN
                </span>
              </label>
            )}
            {formError && (
              <p className={styles.error} role="alert">
                {formError}
              </p>
            )}
          </section>

          <div className={styles.summaryBar}>
            <span className={styles.summaryText}>
              {creator.nickname}
              {product ? ` · ${product.label}` : ""}
            </span>
            <button type="button" className={styles.primaryButton} onClick={toMessage} disabled={!product || (product.custom && !displayPrice) || pending}>
              {displayPrice ? `${formatNumber(displayPrice)} FN 후원하기` : "후원하기"}
            </button>
          </div>
        </>
      ) : (
        quote && (
          <>
            <section className={styles.creatorCard} aria-label="후원 대상">
              <Avatar creator={creator} />
              <span className={styles.creatorText}>
                <span className={styles.creatorName}>
                  {creator.nickname} · {creator.handle}
                </span>
                <span className={styles.muted}>{quote.productLabel}</span>
              </span>
              <strong className={styles.priceTag}>{fn(quote.priceFn)}</strong>
            </section>

            <div className={styles.checkout}>
              <div className={styles.messageCol}>
                <label htmlFor="pd-message" className={styles.sectionTitle}>
                  후원 메시지
                </label>
                <span className={styles.textareaWrap}>
                  <textarea
                    id="pd-message"
                    className={styles.textarea}
                    value={message}
                    maxLength={MESSAGE_MAX}
                    placeholder="후원 메시지를 입력해주세요."
                    onChange={(e) => setMessage(e.target.value)}
                  />
                  <span className={styles.counter}>
                    {message.length} / {MESSAGE_MAX}
                  </span>
                </span>
                {!quote.sufficient && (
                  <p className={styles.alert} role="alert">
                    <span>⚠ FN 잔액이 부족합니다.</span>
                    <ChargeTrigger className={styles.alertLink}>FN 충전하기</ChargeTrigger>
                  </p>
                )}
              </div>
              <section className={styles.payment} aria-labelledby="pd-payment">
                <h2 id="pd-payment" className={styles.paymentTitle}>
                  결제 정보
                </h2>
                <dl className={styles.receipt}>
                  <div>
                    <dt>현재 보유 FN</dt>
                    <dd>{fn(quote.balance)}</dd>
                  </div>
                  <div>
                    <dt>사용 FN</dt>
                    <dd>{fn(quote.priceFn)}</dd>
                  </div>
                  <div>
                    <dt>결제 후 FN</dt>
                    <dd>{quote.sufficient ? fn(quote.afterFn) : "-"}</dd>
                  </div>
                </dl>
              </section>
            </div>

            <div className={styles.actionsRight}>
              <button type="button" className={styles.secondaryButton} onClick={() => setStep("product")}>
                이전
              </button>
              <button type="button" className={styles.primaryButton} onClick={openConfirm} disabled={pending}>
                후원하기
              </button>
            </div>
          </>
        )
      )}

      {/* 817:9411 · 817:8761 */}
      <Modal
        open={confirmOpen}
        onClose={() => setConfirmOpen(false)}
        title={`${p.name} 후원`}
        footer={
          <>
            <button type="button" className={`${styles.secondaryButton} ${styles.grow}`} onClick={() => setConfirmOpen(false)}>
              취소
            </button>
            <button type="button" className={`${styles.primaryButton} ${styles.grow}`} onClick={submit}>
              후원하기
            </button>
          </>
        }
      >
        {quote && (
          <>
            <dl className={styles.receipt}>
              <div>
                <dt>{p.creatorWord}</dt>
                <dd>{creator.nickname}</dd>
              </div>
              <div>
                <dt>상품</dt>
                <dd>{quote.productLabel}</dd>
              </div>
              <div>
                <dt>결제 금액</dt>
                <dd>{fn(quote.priceFn)}</dd>
              </div>
              <div>
                <dt>현재 FN</dt>
                <dd>{fn(quote.balance)}</dd>
              </div>
              <div>
                <dt>결제 후 FN</dt>
                <dd>{fn(quote.afterFn)}</dd>
              </div>
            </dl>
            <p className={styles.notice}>후원하기를 선택하면 FN이 차감되고 {p.name} 후원이 진행됩니다.</p>
          </>
        )}
      </Modal>

      {/* 817:7699 */}
      <Modal
        open={insufficient !== null}
        onClose={() => setInsufficient(null)}
        title="FN 잔액이 부족합니다."
        width={440}
        footer={
          <>
            <button type="button" className={`${styles.secondaryButton} ${styles.grow}`} onClick={() => setInsufficient(null)}>
              취소
            </button>
            <button
              type="button"
              className={`${styles.primaryButton} ${styles.grow}`}
              onClick={() => {
                setInsufficient(null);
                setCharging(true);
              }}
            >
              FN 충전하기
            </button>
          </>
        }
      >
        {insufficient && (
          <dl className={styles.receipt}>
            <div>
              <dt>현재 잔액</dt>
              <dd>{fn(insufficient.balance)}</dd>
            </div>
            <div>
              <dt>필요 금액</dt>
              <dd>{fn(insufficient.required)}</dd>
            </div>
            <div className={styles.shortRow}>
              <dt>부족 금액</dt>
              <dd>{fn(insufficient.required - insufficient.balance)}</dd>
            </div>
          </dl>
        )}
      </Modal>
      {charging && (
        <ChargeModal
          onClose={() => {
            setCharging(false);
            // Re-read the balance and the quote after a charge.
            router.refresh();
            if (step === "message") toMessage();
          }}
        />
      )}

      {/* 817:7872 */}
      <Modal
        open={sessionExpired}
        onClose={() => setSessionExpired(false)}
        title="로그인이 만료되었습니다."
        description="안전한 이용을 위해 다시 로그인해주세요."
        width={420}
        footer={
          <Link href={`/login?next=/donation/${p.slug}/${creator.id}`} className={`${styles.primaryButton} ${styles.grow}`}>
            다시 로그인
          </Link>
        }
      />
    </div>
  );
}

/** Error copy from 817:9618 · 817:8948. */
const ERRORS: Record<ErrorKind, (platform: string) => { title: string; text: string; notCharged?: boolean; pending?: boolean; searchAgain?: boolean }> = {
  API_ERROR: (name) => ({ title: "후원에 실패했습니다.", text: `${name} 연결이 원활하지 않습니다. 잠시 후 다시 시도해주세요.`, notCharged: true }),
  UNAVAILABLE: () => ({ title: "후원상품을 사용할 수 없음", text: "현재 선택한 상품의 판매가 중지되었습니다.", notCharged: true }),
  NOT_FOUND: () => ({ title: "스트리머를 찾을 수 없음", text: "닉네임 또는 ID를 다시 확인해주세요.", notCharged: true, searchAgain: true }),
  NETWORK: () => ({ title: "네트워크 오류", text: "인터넷 연결을 확인하고 다시 시도해주세요." }),
  PENDING: (name) => ({ title: "처리 결과 확인 중", text: `${name}에서 후원 결과를 확인하고 있습니다.`, pending: true }),
  IN_PROGRESS: () => ({ title: "중복 요청", text: "이미 동일한 후원이 처리 중입니다.", pending: true }),
  INVALID: () => ({ title: "후원에 실패했습니다.", text: "후원 처리 중 문제가 발생했습니다.", notCharged: true })
};
