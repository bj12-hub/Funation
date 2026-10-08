"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Modal } from "@/components/ui/Modal";
import { linkLoginProvider, unlinkLoginProvider } from "@/services/account/linkingActions";
import type { LoginProvider } from "@/services/account/myAccount";
import { formatLinkedAt } from "./format";
import styles from "./linking.module.css";

/**
 * Social login link management.
 * Figma: not linked 743:2156 (Naver) · linked 743:2203 (Google) / 743:2250 (Kakao).
 * The other combinations reuse these two layouts.
 */

const META: Record<LoginProvider, { name: string; glyph: string; account: string }> = {
  NAVER: { name: "네이버", glyph: "N", account: "네이버 계정" },
  GOOGLE: { name: "Google", glyph: "G", account: "Google 계정" },
  KAKAO: { name: "카카오", glyph: "K", account: "카카오 계정" }
};

type Props = {
  provider: LoginProvider;
  link: { identifier: string; linkedAt: string } | null;
  triggerClassName: string;
};

export function ProviderLinkEditor({ provider, link, triggerClassName }: Props) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(false);
  const meta = META[provider];

  async function run(action: typeof linkLoginProvider) {
    setBusy(true);
    setError(false);
    try {
      const result = await action(provider);
      if (result.status === "UNAUTHORIZED") return router.push("/login?next=/mypage");
      if (result.status === "INVALID") return setError(true);
      setOpen(false);
      router.refresh();
    } catch {
      setError(true);
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <button type="button" className={triggerClassName} onClick={() => setOpen(true)}>
        {link ? "관리" : "연결하기"}
      </button>
      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title={`${meta.name} 연결 관리`}
        description={
          link
            ? `연결된 ${meta.name} 계정 정보를 확인하고 관리합니다.`
            : `${meta.name} 계정과 연결해 간편 로그인과 서비스 연동을 사용할 수 있어요.`
        }
        footer={
          <>
            <button type="button" className={styles.secondary} onClick={() => setOpen(false)}>
              취소
            </button>
            {link ? (
              <button type="button" className={styles.danger} onClick={() => run(unlinkLoginProvider)} disabled={busy} aria-busy={busy || undefined}>
                연결 해제
              </button>
            ) : (
              <button type="button" className={styles.primary} onClick={() => run(linkLoginProvider)} disabled={busy} aria-busy={busy || undefined}>
                {meta.name}로 연결하기
              </button>
            )}
          </>
        }
      >
        <div className={styles.content}>
          {link ? (
            <>
              <div className={`${styles.card} ${styles.cardSelected}`}>
                <span className={styles.glyph} aria-hidden="true">
                  {meta.glyph}
                </span>
                <span className={styles.cardText}>
                  <span className={styles.cardTitle}>{meta.account}</span>
                  <span className={styles.cardSub}>{link.identifier}</span>
                </span>
                <span className={`${styles.radio} ${styles.radioOn}`} aria-hidden="true" />
              </div>
              <p className={styles.statusBox}>
                <span className={styles.statusOk}>● 정상 연결됨</span>
                <span>{formatLinkedAt(link.linkedAt)} 연결</span>
              </p>
              <p className={styles.dangerNote}>연결 해제 후에는 해당 계정으로 간편 로그인할 수 없습니다.</p>
            </>
          ) : (
            <>
              <div className={`${styles.card} ${styles.cardStatus}`}>
                <span className={styles.glyph} aria-hidden="true">
                  {meta.glyph}
                </span>
                <span className={styles.cardText}>
                  <span className={styles.cardTitle}>{meta.account} 연결</span>
                  <span className={styles.cardSub}>현재 연결된 {meta.account}이 없어요. 연결하면 다음 정보를 사용할 수 있어요.</span>
                </span>
              </div>
              <div className={styles.infoList}>
                <span className={styles.infoListTitle}>연결 시 제공 정보</span>
                <ul className={styles.bullets}>
                  <li>{meta.name} 이메일 주소</li>
                  <li>프로필 이름</li>
                  <li>프로필 사진</li>
                </ul>
              </div>
              <p className={`${styles.dangerNote} ${styles.dangerNoteLarge}`}>
                연결 후에는 {meta.account}으로 Ssumnation에 간편 로그인이 가능해져요. 연결을 취소하면 해당 계정으로 로그인할 수 없게 됩니다.
              </p>
            </>
          )}
          {error && (
            <p className={styles.fieldError} role="alert">
              일시적인 오류가 발생했습니다. 잠시 후 다시 시도해 주세요
            </p>
          )}
        </div>
      </Modal>
    </>
  );
}
