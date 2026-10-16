import Link from "next/link";
import { AuthCard } from "@/components/auth/AuthCard";
import { CircleXLargeIcon } from "@/components/icons";
import styles from "./LoginForm.module.css";

/**
 * Figma: 로그인 제한 안내 718:213
 * `supportLink`: link 고객센터 (`/support`). Off on the 도우미 domain, which does not serve it: the line names the site's
 * 고객센터 in plain text instead (the site's domain is TBD, so no cross-host link).
 */
export function LoginLocked({ supportLink = true }: { supportLink?: boolean }) {
  return (
    <AuthCard
      title="로그인이 제한되었습니다"
      description="로그인에 5회 실패하여 계정 보호를 위해 로그인이 일시적으로 제한되었습니다."
    >
      <div className={styles.notice} role="alert">
        <CircleXLargeIcon />
        <p>
          안전한 로그인을 위해 비밀번호를 재설정해 주세요.
          <br />
          재설정이 완료되면 다시 로그인할 수 있습니다.
        </p>
      </div>
      <Link href="/password-reset" className={styles.primaryButton}>
        비밀번호 재설정으로 이동
      </Link>
      <p className={styles.help}>
        도움이 필요하신가요? {supportLink ? <Link href="/support">고객센터에 문의해 주세요</Link> : "썸네이션 사이트의 고객센터에 문의해 주세요"}
      </p>
    </AuthCard>
  );
}
