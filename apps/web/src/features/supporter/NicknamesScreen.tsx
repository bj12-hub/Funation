"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { GENERIC_ERROR } from "@/features/mypage/editors/shared";
import { formatNumber } from "@/lib/format";
import { addDonationNickname, removeDonationNickname, renameDonationNickname, setDefaultDonationNickname } from "@/services/supporter/identity";
import { MAX_NICKNAMES, type DonationNickname, type IdentitySaveResult } from "@/services/supporter/identityTypes";
import styles from "./supporter.module.css";

/**
 * 별명 관리 — code-first (no Figma frame). Route `/mypage/nicknames`. Stats come from the server. 별명 누적 후원 · 별명 후원
 * 횟수 are the 별명 totals, which leave 익명 donations out (2026-10-09 결정), so they can be below the wallet's or the
 * 누적 등급's totals — the labels say "별명" for that.
 */
export function NicknamesScreen({ nicknames }: { nicknames: DonationNickname[] }) {
  const router = useRouter();
  const [newName, setNewName] = useState("");
  const [editing, setEditing] = useState<{ id: string; name: string } | null>(null);
  const [message, setMessage] = useState<{ tone: "error" | "ok"; text: string } | null>(null);
  const [pending, startTransition] = useTransition();
  const totalFn = nicknames.reduce((s, n) => s + n.totalFn, 0);
  const totalCount = nicknames.reduce((s, n) => s + n.count, 0);

  const run = (action: () => Promise<IdentitySaveResult>, ok: string, after?: () => void) => {
    setMessage(null);
    startTransition(async () => {
      try {
        const res = await action();
        if (res.status === "SAVED") {
          setMessage({ tone: "ok", text: ok });
          after?.();
          router.refresh();
        } else if (res.status === "UNAUTHORIZED") router.push("/login?next=/mypage/nicknames");
        else setMessage({ tone: "error", text: res.message });
      } catch {
        // The typed name stays (`after` only runs on SAVED), so the member can try again.
        setMessage({ tone: "error", text: GENERIC_ERROR });
      }
    });
  };

  return (
    <div className={styles.content}>
      <nav className={styles.breadcrumb} aria-label="현재 위치">
        <Link href="/mypage">마이페이지</Link> <span aria-hidden="true">›</span> <span aria-current="page">별명 관리</span>
      </nav>
      <header className={styles.header}>
        <h1 className={styles.title}>별명 관리</h1>
        <p className={styles.subtitle}>후원할 때 보여 줄 별명을 관리하세요. 별명마다 누적 후원을 확인할 수 있어요.</p>
      </header>

      <dl className={styles.stats}>
        <div>
          <dt>별명 누적 후원</dt>
          <dd>{formatNumber(totalFn)} FN</dd>
        </div>
        <div>
          <dt>별명 후원 횟수</dt>
          <dd>{formatNumber(totalCount)}회</dd>
        </div>
        <div>
          <dt>등록한 별명</dt>
          <dd>
            {nicknames.length} / {MAX_NICKNAMES}
          </dd>
        </div>
      </dl>

      <form
        className={styles.addRow}
        onSubmit={(e) => {
          e.preventDefault();
          run(() => addDonationNickname(newName), "별명을 추가했어요.", () => setNewName(""));
        }}
      >
        <input
          className={styles.input}
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          placeholder="새 별명 (2~12자)"
          maxLength={12}
          aria-label="새 별명"
          disabled={nicknames.length >= MAX_NICKNAMES}
        />
        <button type="submit" className={styles.primary} disabled={pending || !newName.trim() || nicknames.length >= MAX_NICKNAMES}>
          추가
        </button>
      </form>
      {message && (
        <p className={message.tone === "error" ? styles.error : styles.ok} role={message.tone === "error" ? "alert" : "status"}>
          {message.text}
        </p>
      )}

      <ul className={styles.list}>
        {nicknames.map((n) => (
          <li key={n.id} className={styles.row}>
            <div className={styles.rowMain}>
              {editing?.id === n.id ? (
                <input
                  className={styles.input}
                  value={editing.name}
                  maxLength={12}
                  onChange={(e) => setEditing({ id: n.id, name: e.target.value })}
                  aria-label={`${n.name} 새 이름`}
                  autoFocus
                />
              ) : (
                <strong className={styles.rowTitle}>
                  {n.name} {n.isDefault && <span className={styles.chip}>대표</span>}
                </strong>
              )}
              <span className={styles.muted}>
                {formatNumber(n.totalFn)} FN · {formatNumber(n.count)}회 후원
              </span>
            </div>
            <div className={styles.rowActions}>
              {editing?.id === n.id ? (
                <>
                  <button type="button" className={styles.ghost} onClick={() => setEditing(null)}>
                    취소
                  </button>
                  <button type="button" className={styles.primary} disabled={pending} onClick={() => run(() => renameDonationNickname(n.id, editing.name), "별명을 바꿨어요.", () => setEditing(null))}>
                    저장
                  </button>
                </>
              ) : (
                <>
                  {!n.isDefault && (
                    <button type="button" className={styles.ghost} disabled={pending} onClick={() => run(() => setDefaultDonationNickname(n.id), "대표 별명을 바꿨어요.")}>
                      대표로
                    </button>
                  )}
                  {n.id !== "nk-default" && (
                    <>
                      <button type="button" className={styles.ghost} onClick={() => setEditing({ id: n.id, name: n.name })}>
                        이름 변경
                      </button>
                      <button type="button" className={styles.danger} disabled={pending} onClick={() => run(() => removeDonationNickname(n.id), "별명을 삭제했어요.")}>
                        삭제
                      </button>
                    </>
                  )}
                </>
              )}
            </div>
          </li>
        ))}
      </ul>
      <p className={styles.note}>기본 별명은 계정 닉네임과 같아요. 마이페이지에서 닉네임을 바꾸면 함께 바뀌어요. 삭제한 별명의 후원 기록은 기본 별명으로 합쳐져요.</p>
      <p className={styles.note}>프로필 숨기기(익명)로 보낸 후원은 어느 별명의 누적에도 들어가지 않아요. 누적 등급 · 활동 등급에는 들어가요.</p>
    </div>
  );
}
