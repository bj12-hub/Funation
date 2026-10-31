"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Modal } from "@/components/ui/Modal";
import { ChargeModal, ChargeTrigger } from "@/features/walletCharge";
import { formatNumber } from "@/lib/format";
import { useI18n } from "@/lib/i18n/I18nProvider";
import { quotePlatformDonation, requestPlatformDonation } from "@/services/platformDonation/platformDonation";
import { MESSAGE_MAX, PLATFORMS, type PlatformCreatorDetail, type PlatformDonationResult, type PlatformQuote } from "@/services/platformDonation/platformTypes";
import { platformErrorCopy, type PlatformErrorKind as ErrorKind } from "./errorCopy";
import { Avatar, LivePill, PlatformHeader } from "./parts";
import { PLATFORM_WORDS } from "./words";
import styles from "./platformDonation.module.css";

type Step = "product" | "message" | "processing" | "success" | "error";
type Quote = Extract<PlatformQuote, { status: "OK" }>;
type Success = Extract<PlatformDonationResult, { status: "COMPLETED" }>;

const fn = (n: number) => `${formatNumber(n)} FN`;

/**
 * Figma SOOP 817:9242 → 9334 → 9411 → 9509 → 9553 / 9618 · FlexTV 817:8597 → 8684 → 8761 → 8843 → 8886 / 8948,
 * plus 817:7699 (FN 부족) and 817:7872 (세션 만료). Prices, balance and the result come from the server;
 * the browser only keeps the selection, the message and one Idempotency-Key per confirmation.
 */
export function PlatformDonationFlow({ detail }: { detail: PlatformCreatorDetail }) {
  const router = useRouter();
  const { t } = useI18n();
  const p = PLATFORMS[detail.platform];
  const words = PLATFORM_WORDS[detail.platform];
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
  /** RESULT_FAILED: whether the held FN went back (FN 반환). */
  const [fnReturned, setFnReturned] = useState(false);
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
      let res: PlatformQuote;
      try {
        res = await quotePlatformDonation({ platform: detail.platform, creatorId: creator.id, productId: product.id, customFn });
      } catch {
        // Nothing was sent to the platform: the choice stays and 후원하기 can be pressed again.
        setFormError(t("page.errorDescription"));
        return;
      }
      if (res.status === "OK") {
        setQuote(res);
        setStep("message");
      } else if (res.status === "UNAUTHORIZED") setSessionExpired(true);
      else if (res.status === "INVALID" && product.custom) {
        setFormError(t("platformDonation.amountRange", { min: formatNumber(product.custom.minFn), max: formatNumber(product.custom.maxFn) }));
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
        // 결과 다시 확인 of a PENDING donation that failed: its held FN went back (not "차감되지 않았습니다").
        setFnReturned(res.reason === "RESULT_FAILED" && res.fnReturned);
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
          <strong className={styles.stateTitle}>{t("platformDonation.processingTitle")}</strong>
          <p className={styles.muted}>{t("platformDonation.processingNote")}</p>
          <button type="button" className={styles.primaryButton} disabled>
            {t("platformDonation.processing")}
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
          <strong className={styles.stateTitle}>{t("platformDonation.successTitle")}</strong>
          <p className={styles.muted}>{t("platformDonation.successText", { name: success.creatorName })}</p>
          <dl className={styles.receipt}>
            <div>
              <dt>{t("platformDonation.recipient")}</dt>
              <dd>{success.creatorName}</dd>
            </div>
            <div>
              <dt>{t("platformDonation.product")}</dt>
              <dd>{success.productLabel}</dd>
            </div>
            <div>
              <dt>{t("platformDonation.usedFn")}</dt>
              <dd>{fn(success.fnAmount)}</dd>
            </div>
            <div>
              <dt>{t("platformDonation.remainingFn")}</dt>
              <dd>{fn(success.balance)}</dd>
            </div>
            <div>
              <dt>{t("platformDonation.platformTxId", { platform: p.name })}</dt>
              <dd>{success.externalTransactionId ?? "-"}</dd>
            </div>
          </dl>
          <div className={styles.actions}>
            <Link href="/donation/history" className={styles.secondaryButton}>
              {t("platformDonation.viewHistory")}
            </Link>
            <button type="button" className={styles.primaryButton} onClick={reset}>
              {t("platformDonation.donateAgain")}
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (step === "error" && errorKind) {
    const info = platformErrorCopy(errorKind, p.name, fnReturned, t);
    return (
      <div className={styles.content}>
        <PlatformHeader platform={detail.platform} subtitle={t("platformDonation.errorSubtitle")} balance={detail.balance} />
        <div className={styles.stateCard} role="alert">
          <span className={styles.errorMark} aria-hidden="true">
            {info.pending ? "…" : "!"}
          </span>
          <strong className={styles.stateTitle}>{info.title}</strong>
          <p className={styles.muted}>{info.text}</p>
          {info.fnLine && <p className={styles.notCharged}>{info.fnLine}</p>}
          {errorKind === "PENDING" && pendingTxId && <p className={styles.muted}>{t("platformDonation.pendingHeld", { id: pendingTxId })}</p>}
          <div className={styles.actions}>
            <Link href="/donation/history" className={styles.secondaryButton}>
              {t("platformDonation.history")}
            </Link>
            {info.searchAgain ? (
              <Link href={`/donation/${p.slug}`} className={styles.primaryButton}>
                {t("platformDonation.searchWho", { who: t(words.whos) })}
              </Link>
            ) : (
              <button type="button" className={styles.primaryButton} onClick={retry} disabled={pending}>
                {info.pending ? t("platformDonation.recheck") : t("page.retry")}
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
        subtitle={step === "product" ? t("platformDonation.productSubtitle", { who: t(words.who) }) : t("platformDonation.messageSubtitle")}
        balance={quote?.balance ?? detail.balance}
      />

      {step === "product" ? (
        <>
          <section className={styles.creatorCard} aria-label={t("platformDonation.whoInfo", { who: t(words.label) })}>
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
            <p className={styles.muted}>{t("platformDonation.watching", { count: formatNumber(creator.viewers) })}</p>
          )}

          <section className={styles.section} aria-labelledby="pd-products">
            <h2 id="pd-products" className={styles.sectionTitle}>
              {t("platformDonation.products")}
            </h2>
            <ul className={styles.products}>
              {products.map((x) => (
                <li key={x.id}>
                  <button type="button" className={styles.product} aria-pressed={productId === x.id} onClick={() => setProductId(x.id)}>
                    <span className={styles.productIcon} aria-hidden="true">
                      {x.icon}
                    </span>
                    <span className={styles.productLabel}>{x.label}</span>
                    <span className={styles.productPrice}>{x.priceFn !== null ? fn(x.priceFn) : t("platformDonation.enterAmount")}</span>
                    {productId === x.id && <span className={styles.selected}>{t("platformDonation.selected")}</span>}
                  </button>
                </li>
              ))}
            </ul>
            {product?.custom && (
              <label className={styles.customField}>
                <span className={styles.fieldLabel}>{t("platformDonation.customAmount")}</span>
                <span className={styles.customInput}>
                  <input
                    inputMode="numeric"
                    value={custom}
                    placeholder={t("platformDonation.minAmount", { min: formatNumber(product.custom.minFn) })}
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
              {displayPrice ? t("platformDonation.donateAmount", { amount: formatNumber(displayPrice) }) : t("platformDonation.donate")}
            </button>
          </div>
        </>
      ) : (
        quote && (
          <>
            <section className={styles.creatorCard} aria-label={t("platformDonation.recipient")}>
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
                  {t("platformDonation.message")}
                </label>
                <span className={styles.textareaWrap}>
                  <textarea
                    id="pd-message"
                    className={styles.textarea}
                    value={message}
                    maxLength={MESSAGE_MAX}
                    placeholder={t("platformDonation.messagePlaceholder")}
                    onChange={(e) => setMessage(e.target.value)}
                  />
                  <span className={styles.counter}>
                    {message.length} / {MESSAGE_MAX}
                  </span>
                </span>
                {!quote.sufficient && (
                  <p className={styles.alert} role="alert">
                    <span>{t("platformDonation.lowBalance")}</span>
                    <ChargeTrigger className={styles.alertLink}>{t("platformDonation.chargeFn")}</ChargeTrigger>
                  </p>
                )}
              </div>
              <section className={styles.payment} aria-labelledby="pd-payment">
                <h2 id="pd-payment" className={styles.paymentTitle}>
                  {t("platformDonation.payment")}
                </h2>
                <dl className={styles.receipt}>
                  <div>
                    <dt>{t("platformDonation.currentFn")}</dt>
                    <dd>{fn(quote.balance)}</dd>
                  </div>
                  <div>
                    <dt>{t("platformDonation.usedFn")}</dt>
                    <dd>{fn(quote.priceFn)}</dd>
                  </div>
                  <div>
                    <dt>{t("platformDonation.afterFn")}</dt>
                    <dd>{quote.sufficient ? fn(quote.afterFn) : "-"}</dd>
                  </div>
                </dl>
              </section>
            </div>

            {/* After a charge the quote is read again (ChargeModal onClose); when that fails, this step keeps the last one. */}
            {formError && (
              <p className={styles.error} role="alert">
                {formError}
              </p>
            )}
            <div className={styles.actionsRight}>
              <button type="button" className={styles.secondaryButton} onClick={() => setStep("product")}>
                {t("platformDonation.back")}
              </button>
              <button type="button" className={styles.primaryButton} onClick={openConfirm} disabled={pending}>
                {t("platformDonation.donate")}
              </button>
            </div>
          </>
        )
      )}

      {/* 817:9411 · 817:8761 */}
      <Modal
        open={confirmOpen}
        onClose={() => setConfirmOpen(false)}
        title={t("platformDonation.title", { platform: p.name })}
        footer={
          <>
            <button type="button" className={`${styles.secondaryButton} ${styles.grow}`} onClick={() => setConfirmOpen(false)}>
              {t("platformDonation.cancel")}
            </button>
            <button type="button" className={`${styles.primaryButton} ${styles.grow}`} onClick={submit}>
              {t("platformDonation.donate")}
            </button>
          </>
        }
      >
        {quote && (
          <>
            <dl className={styles.receipt}>
              <div>
                <dt>{t(words.label)}</dt>
                <dd>{creator.nickname}</dd>
              </div>
              <div>
                <dt>{t("platformDonation.product")}</dt>
                <dd>{quote.productLabel}</dd>
              </div>
              <div>
                <dt>{t("platformDonation.payAmount")}</dt>
                <dd>{fn(quote.priceFn)}</dd>
              </div>
              <div>
                <dt>{t("platformDonation.currentFnShort")}</dt>
                <dd>{fn(quote.balance)}</dd>
              </div>
              <div>
                <dt>{t("platformDonation.afterFn")}</dt>
                <dd>{fn(quote.afterFn)}</dd>
              </div>
            </dl>
            <p className={styles.notice}>{t("platformDonation.confirmNotice", { platform: p.name })}</p>
          </>
        )}
      </Modal>

      {/* 817:7699 */}
      <Modal
        open={insufficient !== null}
        onClose={() => setInsufficient(null)}
        title={t("platformDonation.insufficient")}
        width={440}
        footer={
          <>
            <button type="button" className={`${styles.secondaryButton} ${styles.grow}`} onClick={() => setInsufficient(null)}>
              {t("platformDonation.cancel")}
            </button>
            <button
              type="button"
              className={`${styles.primaryButton} ${styles.grow}`}
              onClick={() => {
                setInsufficient(null);
                setCharging(true);
              }}
            >
              {t("platformDonation.chargeFn")}
            </button>
          </>
        }
      >
        {insufficient && (
          <dl className={styles.receipt}>
            <div>
              <dt>{t("platformDonation.currentBalance")}</dt>
              <dd>{fn(insufficient.balance)}</dd>
            </div>
            <div>
              <dt>{t("platformDonation.required")}</dt>
              <dd>{fn(insufficient.required)}</dd>
            </div>
            <div className={styles.shortRow}>
              <dt>{t("platformDonation.shortfall")}</dt>
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
        title={t("platformDonation.sessionTitle")}
        description={t("platformDonation.sessionText")}
        width={420}
        footer={
          <Link href={`/login?next=/donation/${p.slug}/${creator.id}`} className={`${styles.primaryButton} ${styles.grow}`}>
            {t("platformDonation.relogin")}
          </Link>
        }
      />
    </div>
  );
}
