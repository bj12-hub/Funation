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
 * 회원 탈퇴 — code-first (no Figma frame), route `/mypage/withdraw` (2026-10-04 결정: 남은 FN 소멸 동의 후 바로 탈퇴).
 * Shows what withdrawal does, asks for the FN forfeit consent (when there is a balance) and the final
 * consent, then ends the account on the server. A creator with earnings waiting for settlement is
 * blocked (their handling is TBD) and pointed to 정산 · 고객센터.
 */
export function WithdrawScreen({ info }: { info: WithdrawalInfo }) {
  const router = useRouter();
  const [forfeit, setForfeit] = useState(false);
  const [confirmed, setConfirmed] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [pending, startTransition] = useTransition();
  // One id per intended withdrawal: a double click or a retry after a lost response reuses it.
  const requestId = useRef<string | null>(null);
  const hasFn = info.fnBalance > 0;
  const ready = confirmed && (!hasFn || forfeit);

  const submit = () => {
    if (!ready || pending) return;
    setError(null);
    requestId.current ??= crypto.randomUUID();
    const id = requestId.current;
    startTransition(async () => {
      try {
        const r = await withdrawAccount({ requestId: id, confirmed, forfeitAgreed: forfeit, fnBalance: info.fnBalance });
        if (r.status === "WITHDRAWN") {
          setDone(true);
          return;
        }
        requestId.current = null;
        if (r.status === "UNAUTHORIZED") router.push("/login?next=/mypage/withdraw");
        else {
          if (r.status === "INVALID") setError(r.message);
          // The balance or the settlement state changed: show the server's numbers again.
          setForfeit(false);
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
          <p className={styles.subtitle}>그동안 썸네이션을 이용해 주셔서 감사합니다.</p>
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

      <section className={styles.card} aria-labelledby="withdraw-effects">
        <h2 className={styles.cardTitle} id="withdraw-effects">
          탈퇴하면 이렇게 돼요
        </h2>
        <ul className={styles.effects}>
          {hasFn && <li>남은 FN {formatNumber(info.fnBalance)} FN이 소멸돼요.</li>}
          <li>네이버 · Google · 카카오 로그인 연결과 방송 플랫폼 연결이 모두 해제돼요.</li>
          <li>탈퇴한 계정으로는 다시 로그인할 수 없어요.</li>
          {info.creator && <li>크리에이터 스튜디오와 채널도 더 이상 이용할 수 없어요.</li>}
        </ul>
      </section>

      {info.blocked ? (
        <section className={styles.blocked} role="alert" aria-labelledby="withdraw-blocked">
          <h2 className={styles.cardTitle} id="withdraw-blocked">
            지금은 탈퇴할 수 없어요
          </h2>
          <p>
            정산을 기다리는 수익 <strong>{formatNumber(info.unsettledFn)} FN</strong>이 있어요. 크리에이터 수익이 남아 있으면 탈퇴를 진행할 수 없어요.
          </p>
          <div className={styles.links}>
            <Link href="/creator/settlement">정산 화면으로</Link>
            <Link href="/support?tab=inquiry">고객센터 1:1 문의</Link>
          </div>
        </section>
      ) : (
        <section className={styles.card} aria-labelledby="withdraw-consent">
          <h2 className={styles.cardTitle} id="withdraw-consent">
            동의
          </h2>
          {hasFn && (
            <label className={styles.check}>
              <input type="checkbox" checked={forfeit} disabled={pending} onChange={(e) => setForfeit(e.target.checked)} />
              <span>
                <b>(필수)</b> 남은 FN {formatNumber(info.fnBalance)} FN이 소멸되는 것에 동의합니다.
              </span>
            </label>
          )}
          <label className={styles.check}>
            <input type="checkbox" checked={confirmed} disabled={pending} onChange={(e) => setConfirmed(e.target.checked)} />
            <span>
              <b>(필수)</b> 위 내용을 모두 확인했고, 회원 탈퇴에 동의합니다.
            </span>
          </label>
          {error && (
            <p className={styles.error} role="alert">
              {error}
            </p>
          )}
        </section>
      )}

      <div className={styles.actions}>
        <Button href="/mypage" variant="secondary">
          {info.blocked ? "돌아가기" : "취소"}
        </Button>
        {!info.blocked && (
          <button type="button" className={styles.danger} disabled={!ready || pending} aria-busy={pending} onClick={submit}>
            {pending ? "탈퇴 처리 중…" : "탈퇴하기"}
          </button>
        )}
      </div>
    </div>
  );
}
