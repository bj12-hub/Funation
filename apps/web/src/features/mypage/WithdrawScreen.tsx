"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useRef, useState, useTransition } from "react";
import { Button } from "@/components/ui/Button";
import { formatNumber } from "@/lib/format";
import { withdrawAccount } from "@/services/account/withdrawal";
import type { WithdrawalInfo } from "@/services/account/withdrawalTypes";
import styles from "./withdraw.module.css";

/**
 * 회원 탈퇴 — code-first (no Figma frame), route `/mypage/withdraw` (2026-10-04 결정: 남은 FN 소멸 동의 후 바로 탈퇴;
 * 2026-10-05: 크리에이터 정산 대기 수익도 소멸 동의, 탈퇴 직전 비밀번호 재입력, 탈퇴 후 바로 재가입 가능).
 * Shows what withdrawal does, asks for a forfeit consent per amount (남은 FN · 정산 대기 수익, when there is one),
 * the final consent and the password, then ends the account on the server. Withdrawal waits while an FN 충전 환불
 * request is being handled (2026-10-06 결정) or a 퀘스트 후원 is in progress — sent by the member, or sent to the
 * creator's channel (2026-10-08 결정); a card says why and links to where it is resolved.
 */
export function WithdrawScreen({ info }: { info: WithdrawalInfo }) {
  const router = useRouter();
  const [forfeit, setForfeit] = useState(false);
  const [earningsForfeit, setEarningsForfeit] = useState(false);
  const [confirmed, setConfirmed] = useState(false);
  const [password, setPassword] = useState("");
  const [passwordError, setPasswordError] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [pending, startTransition] = useTransition();
  // One id per intended withdrawal: a double click or a retry after a lost response reuses it.
  const requestId = useRef<string | null>(null);
  const passwordRef = useRef<HTMLInputElement>(null);
  const hasFn = info.fnBalance > 0;
  const hasEarnings = info.unsettledFn > 0;
  const hasRefunds = info.pendingRefunds > 0;
  const questsSent = info.pendingQuests.sent;
  const questsReceived = info.pendingQuests.received;
  const blocked = hasRefunds || questsSent > 0 || questsReceived > 0;
  const ready = !blocked && confirmed && (!hasFn || forfeit) && (!hasEarnings || earningsForfeit) && password.length > 0;

  const submit = () => {
    if (!ready || pending) return;
    setError(null);
    setPasswordError(false);
    requestId.current ??= crypto.randomUUID();
    const id = requestId.current;
    startTransition(async () => {
      try {
        const r = await withdrawAccount({ requestId: id, confirmed, forfeitAgreed: forfeit, earningsForfeitAgreed: earningsForfeit, fnBalance: info.fnBalance, unsettledFn: info.unsettledFn, password });
        if (r.status === "WITHDRAWN") {
          setDone(true);
          return;
        }
        requestId.current = null;
        if (r.status === "UNAUTHORIZED") router.push("/login?next=/mypage/withdraw");
        else if (r.status === "WRONG_PASSWORD") {
          setPasswordError(true);
          passwordRef.current?.select();
        } else if (r.status === "LOCKED") {
          setError("비밀번호를 5회 잘못 입력해 계정 보호를 위해 로그인이 제한되었습니다. 비밀번호를 재설정해 주세요.");
        } else if (r.status === "REFUND_PENDING") {
          setError(`처리 중인 충전 환불 요청이 ${r.count}건 있어요. 환불 처리가 끝난 뒤에 탈퇴할 수 있어요.`);
          router.refresh();
        } else if (r.status === "QUEST_PENDING") {
          setError(
            r.sent > 0
              ? `진행 중인 퀘스트 후원이 ${r.sent}건 있어요. 퀘스트 결과가 정해진 뒤에 탈퇴할 수 있어요.`
              : `내 채널에 진행 중인 퀘스트 후원이 ${r.received}건 있어요. 퀘스트 결과를 정하거나 취소한 뒤에 탈퇴할 수 있어요.`
          );
          router.refresh();
        } else {
          setError(r.message);
          // An amount changed: show the server's numbers again and ask for the consents again.
          setForfeit(false);
          setEarningsForfeit(false);
          router.refresh();
        }
      } catch {
        setError("탈퇴하지 못했어요. 잠시 후 다시 시도해 주세요.");
      }
    });
  };

  if (done) {
    return (
      <div className={styles.content}>
        <section className={styles.done} role="status" aria-labelledby="withdraw-done">
          <h1 className={styles.title} id="withdraw-done">
            탈퇴가 완료됐어요
          </h1>
          <p className={styles.subtitle}>그동안 썸네이션을 이용해 주셔서 감사합니다. 언제든 새 계정으로 다시 가입할 수 있어요.</p>
          {/* A full load, so the header drops the signed-in member. */}
          <Button type="button" onClick={() => window.location.assign("/")}>
            홈으로
          </Button>
        </section>
      </div>
    );
  }

  return (
    <div className={styles.content}>
      <header className={styles.header}>
        <Link href="/mypage" className={styles.back}>
          ← 내 정보
        </Link>
        <h1 className={styles.title}>회원 탈퇴</h1>
        <p className={styles.subtitle}>{info.nickname} 님, 탈퇴하기 전에 아래 내용을 꼭 확인해 주세요.</p>
      </header>

      <section className={styles.card} aria-labelledby="withdraw-fn">
        <h2 className={styles.cardTitle} id="withdraw-fn">
          남은 FN
        </h2>
        <strong className={styles.balance}>{formatNumber(info.fnBalance)} FN</strong>
        <p className={styles.note}>{hasFn ? "탈퇴하면 남은 FN은 모두 소멸되고, 탈퇴 후에는 되살릴 수 없어요." : "남은 FN이 없어요."}</p>
      </section>

      {hasRefunds && (
        <section className={styles.warnCard} aria-labelledby="withdraw-refunds">
          <h2 className={styles.cardTitle} id="withdraw-refunds">
            처리 중인 충전 환불
          </h2>
          <strong className={styles.balance}>{formatNumber(info.pendingRefunds)}건</strong>
          <p className={styles.note}>FN 충전 환불 요청을 운영팀이 확인하고 있어요. 환불 처리가 끝난 뒤에 탈퇴할 수 있어요.</p>
          <div className={styles.links}>
            <Link href="/wallet/charges">충전 내역으로</Link>
          </div>
        </section>
      )}

      {questsSent > 0 && (
        <section className={styles.warnCard} aria-labelledby="withdraw-quests">
          <h2 className={styles.cardTitle} id="withdraw-quests">
            진행 중인 퀘스트 후원
          </h2>
          <strong className={styles.balance}>{formatNumber(questsSent)}건</strong>
          <p className={styles.note}>
            보낸 퀘스트 후원의 FN이 결과를 기다리며 보관되어 있어요. 퀘스트 결과가 정해진 뒤에 탈퇴할 수 있어요. 퀘스트 후원 내역에서 결과를 직접 정할 수도 있어요.
          </p>
          <div className={styles.links}>
            <Link href="/wallet/donations?type=quest">퀘스트 후원 내역으로</Link>
          </div>
        </section>
      )}

      {questsReceived > 0 && (
        <section className={styles.warnCard} aria-labelledby="withdraw-channel-quests">
          <h2 className={styles.cardTitle} id="withdraw-channel-quests">
            내 채널의 진행 중인 퀘스트
          </h2>
          <strong className={styles.balance}>{formatNumber(questsReceived)}건</strong>
          <p className={styles.note}>
            시청자가 보낸 퀘스트 후원의 FN이 결과를 기다리며 보관되어 있어요. 후원 리스트에서 퀘스트 결과를 정하거나 취소한 뒤에 탈퇴할 수 있어요. 취소하면 시청자에게 전액 환불돼요.
          </p>
          <div className={styles.links}>
            <Link href="/creator/donations?tab=list&kind=quest&status=IN_PROGRESS">후원 리스트로</Link>
          </div>
        </section>
      )}

      {hasEarnings && (
        <section className={styles.warnCard} aria-labelledby="withdraw-earnings">
          <h2 className={styles.cardTitle} id="withdraw-earnings">
            정산 대기 수익
          </h2>
          <strong className={styles.balance}>{formatNumber(info.unsettledFn)} FN</strong>
          <p className={styles.note}>정산 가능 금액과 정산 신청 중인 금액이에요. 탈퇴하면 함께 소멸되고, 진행 중인 정산 신청도 취소돼요. 먼저 정산을 받고 싶다면 탈퇴 전에 정산을 마쳐 주세요.</p>
          <div className={styles.links}>
            <Link href="/creator/settlement">정산 화면으로</Link>
          </div>
        </section>
      )}

      <section className={styles.card} aria-labelledby="withdraw-effects">
        <h2 className={styles.cardTitle} id="withdraw-effects">
          탈퇴하면 이렇게 돼요
        </h2>
        <ul className={styles.effects}>
          {hasFn && <li>남은 FN {formatNumber(info.fnBalance)} FN이 소멸돼요.</li>}
          {hasEarnings && <li>정산 대기 수익 {formatNumber(info.unsettledFn)} FN이 소멸되고, 진행 중인 정산 신청은 취소돼요.</li>}
          <li>네이버 · Google · 카카오 로그인 연결과 방송 플랫폼 연결이 모두 해제돼요.</li>
          <li>탈퇴한 계정으로는 다시 로그인할 수 없어요. 새 계정으로는 바로 다시 가입할 수 있지만, 이전 FN과 기록은 돌아오지 않아요.</li>
          {info.creator && (
            <li>크리에이터 스튜디오와 채널도 더 이상 이용할 수 없어요. 등록한 정산 정보와 매니저 채팅 링크는 삭제되고, OBS 오버레이 · SMS 계좌후원 주소도 멈춰요.</li>
          )}
        </ul>
      </section>

      <section className={styles.card} aria-labelledby="withdraw-consent">
        <h2 className={styles.cardTitle} id="withdraw-consent">
          동의 및 본인 확인
        </h2>
        {hasFn && (
          <label className={styles.check}>
            <input type="checkbox" checked={forfeit} disabled={pending} onChange={(e) => setForfeit(e.target.checked)} />
            <span>
              <b>(필수)</b> 남은 FN {formatNumber(info.fnBalance)} FN이 소멸되는 것에 동의합니다.
            </span>
          </label>
        )}
        {hasEarnings && (
          <label className={styles.check}>
            <input type="checkbox" checked={earningsForfeit} disabled={pending} onChange={(e) => setEarningsForfeit(e.target.checked)} />
            <span>
              <b>(필수)</b> 정산 대기 수익 {formatNumber(info.unsettledFn)} FN이 소멸되고 정산 신청이 취소되는 것에 동의합니다.
            </span>
          </label>
        )}
        <label className={styles.check}>
          <input type="checkbox" checked={confirmed} disabled={pending} onChange={(e) => setConfirmed(e.target.checked)} />
          <span>
            <b>(필수)</b> 위 내용을 모두 확인했고, 회원 탈퇴에 동의합니다.
          </span>
        </label>
        <label className={styles.field}>
          <span>비밀번호 확인</span>
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
            placeholder="본인 확인을 위해 비밀번호를 입력해 주세요"
          />
        </label>
        {passwordError && (
          <p className={styles.error} id="withdraw-password-error" role="alert">
            비밀번호가 일치하지 않아요. 다시 입력해 주세요.
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
          취소
        </Button>
        <button type="button" className={styles.danger} disabled={!ready || pending} aria-busy={pending} onClick={submit}>
          {pending ? "탈퇴 처리 중…" : "탈퇴하기"}
        </button>
      </div>
    </div>
  );
}
