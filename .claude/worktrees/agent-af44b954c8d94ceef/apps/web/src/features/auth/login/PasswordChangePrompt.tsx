"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { AuthCard } from "@/components/auth/AuthCard";
import { ShieldCheckIcon } from "@/components/icons";
import styles from "./LoginForm.module.css";

/**
 * Figma: 비밀번호 변경 권유 718:335 — shown right after a successful login when the server flags an
 * old password. The member is already signed in; "다음에 변경" continues to `next`.
 * TBD: whether "later" should be remembered (snooze) is a backend policy.
 */
export function PasswordChangePrompt({ next }: { next: string }) {
  const router = useRouter();
  return (
    <AuthCard title="비밀번호를 변경해 주세요" description="비밀번호를 설정한 지 6개월 이상 지났습니다.">
      <div className={styles.recommend}>
        <span className={styles.recommendIcon} aria-hidden="true">
          <ShieldCheckIcon />
        </span>
        <p>안전한 계정 보호를 위해 비밀번호를 변경해주세요</p>
      </div>
      <div className={styles.buttons}>
        <Link href="/password-reset" className={styles.primaryButton}>
          비밀번호 재설정
        </Link>
        <button
          type="button"
          className={styles.laterButton}
          onClick={() => {
            router.replace(next);
            router.refresh();
          }}
        >
          다음에 변경
        </button>
      </div>
      <p className={styles.help}>비밀번호 변경 후 다시 로그인이 진행됩니다.</p>
    </AuthCard>
  );
}
