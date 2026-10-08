"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useRef, useState, type FormEvent } from "react";
import { AuthCard } from "@/components/auth/AuthCard";
import { CircleXIcon, EyeIcon, EyeOffIcon, MessageCircleIcon } from "@/components/icons";
import { TextField } from "@/components/ui/TextField";
import { login } from "@/services/auth/login";
import { LoginLocked } from "./LoginLocked";
import styles from "./LoginForm.module.css";

/**
 * Login screen.
 * Figma: DEFAULT 13:7 · UNKNOWN ID 718:123 · WRONG PASSWORD 718:168 · LOCKED 718:213 (718:335 is its own route: /login/password-change)
 */

type FormState = "DEFAULT" | "PROCESSING" | "UNKNOWN_ID" | "WRONG_PASSWORD" | "LOCKED" | "SUSPENDED" | "ERROR";

const MESSAGES = {
  UNKNOWN_ID: "등록되지 않은 아이디입니다",
  WRONG_PASSWORD: "비밀번호가 일치하지 않습니다. 다시 입력해 주세요",
  // Code-first (no Figma frame): the account is suspended by an operator (appeal flow TBD).
  SUSPENDED: "운영 정책에 따라 이용이 정지된 계정입니다. 고객센터로 문의해 주세요",
  ERROR: "일시적인 오류가 발생했습니다. 잠시 후 다시 시도해 주세요"
} as const;

/** `next`: where to go after signing in (already validated as a same-site path). */
export function LoginForm({ next = "/" }: { next?: string }) {
  const router = useRouter();
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [keepSignedIn, setKeepSignedIn] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [state, setState] = useState<FormState>("DEFAULT");
  const identifierRef = useRef<HTMLInputElement>(null);
  const passwordRef = useRef<HTMLInputElement>(null);

  if (state === "LOCKED") return <LoginLocked />;

  const processing = state === "PROCESSING";

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (processing) return;
    if (!identifier.trim()) return identifierRef.current?.focus();
    if (!password) return passwordRef.current?.focus();

    setState("PROCESSING");
    try {
      const result = await login({ identifier: identifier.trim(), password, keepSignedIn, next });
      // A server-side redirect (password change prompt) resolves without a result.
      if (!result) return;
      if (result.status === "SUCCESS") {
        // The session cookie was set by the server action; refresh so layouts read it.
        router.replace(next);
        router.refresh();
        return;
      }
      setState(result.status);
      if (result.status === "WRONG_PASSWORD") {
        // Figma 718:168 keeps the entered password; select it so the user can retype.
        passwordRef.current?.select();
      }
    } catch {
      setState("ERROR");
    }
  }

  return (
    <AuthCard title="로그인">
      <form className={styles.form} onSubmit={handleSubmit} noValidate>
        <div className={styles.inputs}>
          <TextField
            ref={identifierRef}
            name="identifier"
            autoComplete="username"
            placeholder="이메일 또는 아이디"
            aria-label="이메일 또는 아이디"
            value={identifier}
            onChange={(e) => {
              setIdentifier(e.target.value);
              if (state === "UNKNOWN_ID") setState("DEFAULT");
            }}
            error={state === "UNKNOWN_ID" ? MESSAGES.UNKNOWN_ID : null}
          />
          <TextField
            ref={passwordRef}
            name="password"
            type={showPassword ? "text" : "password"}
            autoComplete="current-password"
            placeholder="비밀번호"
            aria-label="비밀번호"
            value={password}
            onChange={(e) => {
              setPassword(e.target.value);
              if (state === "WRONG_PASSWORD") setState("DEFAULT");
            }}
            error={state === "WRONG_PASSWORD" ? MESSAGES.WRONG_PASSWORD : null}
            trailing={
              <button
                type="button"
                className={styles.iconButton}
                onClick={() => setShowPassword((v) => !v)}
                aria-label={showPassword ? "비밀번호 숨기기" : "비밀번호 보기"}
                aria-pressed={showPassword}
              >
                {showPassword ? <EyeOffIcon /> : <EyeIcon />}
              </button>
            }
          />
        </div>

        <div className={styles.options}>
          <label className={styles.checkbox}>
            <input type="checkbox" checked={keepSignedIn} onChange={(e) => setKeepSignedIn(e.target.checked)} />
            <span className={styles.checkboxBox} aria-hidden="true" />
            자동 로그인
          </label>
          <Link href="/password-reset" className={styles.textLink}>
            비밀번호 찾기
          </Link>
        </div>

        {(state === "ERROR" || state === "SUSPENDED") && (
          <p className={styles.formError} role="alert">
            {MESSAGES[state]}
          </p>
        )}

        <button type="submit" className={styles.primaryButton} disabled={processing} aria-busy={processing}>
          {processing ? "로그인 중…" : state === "WRONG_PASSWORD" ? "다시 로그인" : "로그인"}
        </button>
      </form>

      <div className={styles.divider}>
        <span className={styles.dividerLine} />
        <span>또는</span>
        <span className={styles.dividerLine} />
      </div>

      {/* TODO: connect OAuth once providers are configured (Figma social-login-page 13:142) */}
      <div className={styles.social}>
        <button type="button" className={`${styles.socialButton} ${styles.google}`}>
          <CircleXIcon />
          Google 계정으로 로그인
        </button>
        <button type="button" className={`${styles.socialButton} ${styles.kakao}`}>
          <MessageCircleIcon />
          카카오로 로그인
        </button>
      </div>

      <p className={styles.bottom}>
        <span>아직 회원이 아니신가요?</span>
        <Link href="/signup" className={styles.signupLink}>
          회원가입
        </Link>
      </p>
    </AuthCard>
  );
}
