"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useRef, useState, useTransition } from "react";
import { Button } from "@/components/ui/Button";
import { formatNumber, kstIsoString } from "@/lib/format";
import { useI18n } from "@/lib/i18n/I18nProvider";
import { RETENTION_DEFAULTS_LABEL, RETENTION_RULES } from "@/services/account/retentionPolicy";
import { withdrawAccount } from "@/services/account/withdrawal";
import { WITHDRAWAL_GRACE_DAYS, type WithdrawalInfo } from "@/services/account/withdrawalTypes";
import styles from "./withdraw.module.css";

/** "2026.12.02": the Korean day the 탈퇴 takes effect. */
const koreanDay = (iso: string) => kstIsoString(iso).slice(0, 10).replace(/-/g, ".");

/**
 * 회원 탈퇴 — code-first (no Figma frame), route `/mypage/withdraw` (2026-10-04 결정: 남은 FN 소멸 동의 후 바로 탈퇴;
 * 2026-10-05: 크리에이터 정산 대기 수익도 소멸 동의, 탈퇴 직전 비밀번호 재입력, 탈퇴 후 바로 재가입 가능).
 * 정산 대기 수익 is 정산 가능 + 심사 대기 requests only: approved settlements are still paid after the 탈퇴 (2026-10-08 결정).
 * Shows what withdrawal does, asks for a forfeit consent per amount (남은 FN · 정산 대기 수익, when there is one),
 * the final consent and the password, then ends the account on the server. Withdrawal waits while an FN 충전 환불
 * request is being handled (2026-10-06 결정), a 퀘스트 후원 is in progress — sent by the member, or sent to the
 * creator's channel (2026-10-08 결정) — or a 플랫폼 후원 is waiting for its result (PENDING, 2026-10-09 결정), or an FN 충전
 * is in progress (provider call or 처리중) or an 출석 보상 is on its way (2026-10-10 결정); a card says why and links to
 * where it is resolved, and the 탈퇴하기 button stays disabled. The server waits a moment for a charge or reward on its
 * way before it answers, and a refusal refreshes the screen, so both show the state after it. Consents are for the
 * amounts shown: when a refresh brings other amounts, the member agrees again.
 * "탈퇴 후에도 보관하는 정보" lists what is kept and for how long from the shared retention list
 * (services/account/retentionPolicy.ts — 기본값, 법무 검토 전); posts are never deleted, so the effects say so.
 * 2026-11-01 사용자 결정 (FLEXTV 조건 기본안) — 회원탈퇴 유예: the button sends a 탈퇴 신청. The member is signed out at
 * once, the 탈퇴 takes effect WITHDRAWAL_GRACE_DAYS (30) days later and signing in before then can cancel it, so the
 * effects open with that, the forfeits say "탈퇴가 적용되면", and the done view (SUCCESS) shows the date it takes effect.
 */
export function WithdrawScreen({ info }: { info: WithdrawalInfo }) {
  const { t } = useI18n();
  const router = useRouter();
  const [forfeit, setForfeit] = useState(false);
  const [earningsForfeit, setEarningsForfeit] = useState(false);
  const [confirmed, setConfirmed] = useState(false);
  const [password, setPassword] = useState("");
  const [passwordError, setPasswordError] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // The 탈퇴 신청 went through: when it takes effect (ISO).
  const [effectiveAt, setEffectiveAt] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  // One id per intended withdrawal: a double click or a retry after a lost response reuses it.
  const requestId = useRef<string | null>(null);
  const passwordRef = useRef<HTMLInputElement>(null);
  const hasFn = info.fnBalance > 0;
  const hasEarnings = info.unsettledFn > 0;
  const hasRefunds = info.pendingRefunds > 0;
  const questsSent = info.pendingQuests.sent;
  const questsReceived = info.pendingQuests.received;
  const platformPending = info.pendingPlatformDonations;
  const chargesPending = info.pendingCharges;
  const rewardsPending = info.pendingAttendanceRewards;
  const blocked = hasRefunds || questsSent > 0 || questsReceived > 0 || platformPending > 0 || chargesPending > 0 || rewardsPending > 0;
  const ready = !blocked && confirmed && (!hasFn || forfeit) && (!hasEarnings || earningsForfeit) && password.length > 0;

  // The forfeit consents are for the amounts shown. A refresh that brings other amounts (a charge landed meanwhile, a
  // platform donation's FN came back) clears them, so the member agrees to the new amounts.
  const amounts = `${info.fnBalance}:${info.unsettledFn}`;
  const [consentedAmounts, setConsentedAmounts] = useState(amounts);
  if (consentedAmounts !== amounts) {
    setConsentedAmounts(amounts);
    setForfeit(false);
    setEarningsForfeit(false);
  }

  const submit = () => {
    if (!ready || pending) return;
    setError(null);
    setPasswordError(false);
    requestId.current ??= crypto.randomUUID();
    const id = requestId.current;
    startTransition(async () => {
      try {
        const r = await withdrawAccount({ requestId: id, confirmed, forfeitAgreed: forfeit, earningsForfeitAgreed: earningsForfeit, fnBalance: info.fnBalance, unsettledFn: info.unsettledFn, password });
        if (r.status === "REQUESTED") {
          setEffectiveAt(r.effectiveAt);
          return;
        }
        requestId.current = null;
        if (r.status === "UNAUTHORIZED") router.push("/login?next=/mypage/withdraw");
        else if (r.status === "WRONG_PASSWORD") {
          setPasswordError(true);
          passwordRef.current?.select();
        } else if (r.status === "LOCKED") {
          setError(t("my.passwordLocked"));
        } else if (r.status === "REFUND_PENDING") {
          setError(t("myWithdraw.refundPending", { count: r.count }));
          router.refresh();
        } else if (r.status === "QUEST_PENDING") {
          setError(
            r.sent > 0
              ? t("myWithdraw.questSentPending", { count: r.sent })
              : t("myWithdraw.questReceivedPending", { count: r.received })
          );
          router.refresh();
        } else if (r.status === "PLATFORM_PENDING") {
          setError(t("myWithdraw.platformPending", { count: r.count }));
          router.refresh();
        } else if (r.status === "CHARGE_PENDING") {
          setError(t("myWithdraw.chargePending", { count: r.count }));
          router.refresh();
        } else if (r.status === "ATTENDANCE_PENDING") {
          setError(t("myWithdraw.attendancePending", { count: r.count }));
          router.refresh();
        } else {
          setError(r.message);
          // An amount changed: show the server's numbers again and ask for the consents again.
          setForfeit(false);
          setEarningsForfeit(false);
          router.refresh();
        }
      } catch {
        setError(t("myWithdraw.failed"));
      }
    });
  };

  if (effectiveAt) {
    return (
      <div className={styles.content}>
        <section className={styles.done} role="status" aria-labelledby="withdraw-done">
          <h1 className={styles.title} id="withdraw-done">
            {t("myWithdraw.doneTitle")}
          </h1>
          <p className={styles.subtitle}>{t("myWithdraw.doneDesc", { date: koreanDay(effectiveAt) })}</p>
          {/* A full load, so the header drops the signed-in member. */}
          <Button type="button" onClick={() => window.location.assign("/")}>
            {t("myWithdraw.home")}
          </Button>
        </section>
      </div>
    );
  }

  return (
    <div className={styles.content}>
      <header className={styles.header}>
        <Link href="/mypage" className={styles.back}>
          ← {t("my.title")}
        </Link>
        <h1 className={styles.title}>{t("myWithdraw.title")}</h1>
        <p className={styles.subtitle}>{t("myWithdraw.intro", { name: info.nickname })}</p>
      </header>

      <section className={styles.card} aria-labelledby="withdraw-fn">
        <h2 className={styles.cardTitle} id="withdraw-fn">
          {t("myWithdraw.fnTitle")}
        </h2>
        <strong className={styles.balance}>{formatNumber(info.fnBalance)} FN</strong>
        <p className={styles.note}>{hasFn ? t("myWithdraw.fnForfeit") : t("myWithdraw.fnNone")}</p>
      </section>

      {hasRefunds && (
        <section className={styles.warnCard} aria-labelledby="withdraw-refunds">
          <h2 className={styles.cardTitle} id="withdraw-refunds">
            {t("myWithdraw.refundsTitle")}
          </h2>
          <strong className={styles.balance}>{t("myWithdraw.count", { count: formatNumber(info.pendingRefunds) })}</strong>
          <p className={styles.note}>{t("myWithdraw.refundsNote")}</p>
          <div className={styles.links}>
            <Link href="/wallet/charges">{t("myWithdraw.toCharges")}</Link>
          </div>
        </section>
      )}

      {questsSent > 0 && (
        <section className={styles.warnCard} aria-labelledby="withdraw-quests">
          <h2 className={styles.cardTitle} id="withdraw-quests">
            {t("myWithdraw.questsTitle")}
          </h2>
          <strong className={styles.balance}>{t("myWithdraw.count", { count: formatNumber(questsSent) })}</strong>
          <p className={styles.note}>{t("myWithdraw.questsNote")}</p>
          <div className={styles.links}>
            <Link href="/wallet/donations?type=quest">{t("myWithdraw.toQuests")}</Link>
          </div>
        </section>
      )}

      {questsReceived > 0 && (
        <section className={styles.warnCard} aria-labelledby="withdraw-channel-quests">
          <h2 className={styles.cardTitle} id="withdraw-channel-quests">
            {t("myWithdraw.channelQuestsTitle")}
          </h2>
          <strong className={styles.balance}>{t("myWithdraw.count", { count: formatNumber(questsReceived) })}</strong>
          <p className={styles.note}>{t("myWithdraw.channelQuestsNote")}</p>
          <div className={styles.links}>
            <Link href="/creator/donations?tab=list&kind=quest&status=IN_PROGRESS">{t("myWithdraw.toDonationList")}</Link>
          </div>
        </section>
      )}

      {platformPending > 0 && (
        <section className={styles.warnCard} aria-labelledby="withdraw-platform">
          <h2 className={styles.cardTitle} id="withdraw-platform">
            {t("myWithdraw.platformTitle")}
          </h2>
          <strong className={styles.balance}>{t("myWithdraw.count", { count: formatNumber(platformPending) })}</strong>
          <p className={styles.note}>{t("myWithdraw.platformNote")}</p>
          <div className={styles.links}>
            <Link href="/donation/history?period=all&status=PROCESSING">{t("myWithdraw.toDonations")}</Link>
          </div>
        </section>
      )}

      {chargesPending > 0 && (
        <section className={styles.warnCard} aria-labelledby="withdraw-charges">
          <h2 className={styles.cardTitle} id="withdraw-charges">
            {t("myWithdraw.chargesTitle")}
          </h2>
          <strong className={styles.balance}>{t("myWithdraw.count", { count: formatNumber(chargesPending) })}</strong>
          <p className={styles.note}>{t("myWithdraw.chargesNote")}</p>
          <div className={styles.links}>
            <Link href="/wallet/charges">{t("myWithdraw.toCharges")}</Link>
          </div>
        </section>
      )}

      {rewardsPending > 0 && (
        <section className={styles.warnCard} aria-labelledby="withdraw-rewards">
          <h2 className={styles.cardTitle} id="withdraw-rewards">
            {t("myWithdraw.rewardsTitle")}
          </h2>
          <strong className={styles.balance}>{t("myWithdraw.count", { count: formatNumber(rewardsPending) })}</strong>
          <p className={styles.note}>{t("myWithdraw.rewardsNote")}</p>
          <div className={styles.links}>
            <Link href="/attendance">{t("myWithdraw.toAttendance")}</Link>
          </div>
        </section>
      )}

      {hasEarnings && (
        <section className={styles.warnCard} aria-labelledby="withdraw-earnings">
          <h2 className={styles.cardTitle} id="withdraw-earnings">
            {t("myWithdraw.earningsTitle")}
          </h2>
          <strong className={styles.balance}>{formatNumber(info.unsettledFn)} FN</strong>
          <p className={styles.note}>{t("myWithdraw.earningsNote")}</p>
          <div className={styles.links}>
            <Link href="/creator/settlement">{t("myWithdraw.toSettlement")}</Link>
          </div>
        </section>
      )}

      <section className={styles.card} aria-labelledby="withdraw-effects">
        <h2 className={styles.cardTitle} id="withdraw-effects">
          {t("myWithdraw.effectsTitle")}
        </h2>
        <ul className={styles.effects}>
          <li>{t("myWithdraw.effectRequest", { days: WITHDRAWAL_GRACE_DAYS })}</li>
          {hasFn && <li>{t("myWithdraw.effectFn", { amount: formatNumber(info.fnBalance) })}</li>}
          {hasEarnings && <li>{t("myWithdraw.effectEarnings", { amount: formatNumber(info.unsettledFn) })}</li>}
          <li>{t("myWithdraw.effectLinks")}</li>
          <li>{t("myWithdraw.effectRelogin")}</li>
          {info.creator && (
            <li>{t("myWithdraw.effectCreator", { days: WITHDRAWAL_GRACE_DAYS })}</li>
          )}
          <li>{t("myWithdraw.effectPosts")}</li>
        </ul>
      </section>

      <section className={styles.card} aria-labelledby="withdraw-retention">
        <h2 className={styles.cardTitle} id="withdraw-retention">
          {t("myWithdraw.retentionTitle")}
        </h2>
        <p className={styles.note}>{t("myWithdraw.retentionNote", { label: RETENTION_DEFAULTS_LABEL })}</p>
        <ul className={styles.effects}>
          {RETENTION_RULES.map((r) => (
            <li key={r.category}>
              <strong className={styles.retentionLabel}>{r.label}</strong> · {r.period} · {r.basis}
              <span className={styles.retentionCovers}>{r.covers}</span>
            </li>
          ))}
        </ul>
        <p className={styles.note}>{t("myWithdraw.retentionOther")}</p>
      </section>

      <section className={styles.card} aria-labelledby="withdraw-consent">
        <h2 className={styles.cardTitle} id="withdraw-consent">
          {t("myWithdraw.consentTitle")}
        </h2>
        {hasFn && (
          <label className={styles.check}>
            <input type="checkbox" checked={forfeit} disabled={pending} onChange={(e) => setForfeit(e.target.checked)} />
            <span>
              <b>{t("myWithdraw.required")}</b> {t("myWithdraw.consentFn", { amount: formatNumber(info.fnBalance) })}
            </span>
          </label>
        )}
        {hasEarnings && (
          <label className={styles.check}>
            <input type="checkbox" checked={earningsForfeit} disabled={pending} onChange={(e) => setEarningsForfeit(e.target.checked)} />
            <span>
              <b>{t("myWithdraw.required")}</b> {t("myWithdraw.consentEarnings", { amount: formatNumber(info.unsettledFn) })}
            </span>
          </label>
        )}
        <label className={styles.check}>
          <input type="checkbox" checked={confirmed} disabled={pending} onChange={(e) => setConfirmed(e.target.checked)} />
          <span>
            <b>{t("myWithdraw.required")}</b> {t("myWithdraw.consentFinal")}
          </span>
        </label>
        <label className={styles.field}>
          <span>{t("myWithdraw.password")}</span>
          <input
            ref={passwordRef}
            type="password"
            autoComplete="current-password"
            value={password}
            disabled={pending}
            aria-invalid={passwordError || undefined}
            aria-describedby={passwordError ? "withdraw-password-error" : undefined}
            onChange={(e) => {
              setPassword(e.target.value);
              setPasswordError(false);
            }}
            placeholder={t("myWithdraw.passwordPlaceholder")}
          />
        </label>
        {passwordError && (
          <p className={styles.error} id="withdraw-password-error" role="alert">
            {t("myWithdraw.passwordWrong")}
          </p>
        )}
        {error && (
          <p className={styles.error} role="alert">
            {error}
          </p>
        )}
      </section>

      <div className={styles.actions}>
        <Button href="/mypage" variant="secondary">
          {t("my.cancel")}
        </Button>
        <button type="button" className={styles.danger} disabled={!ready || pending} aria-busy={pending} onClick={submit}>
          {pending ? t("myWithdraw.processing") : t("myWithdraw.submit")}
        </button>
      </div>
    </div>
  );
}
