"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useRef, useState, type FormEvent } from "react";
import { AuthCard } from "@/components/auth/AuthCard";
import { CircleXIcon, EyeIcon, EyeOffIcon, MessageCircleIcon } from "@/components/icons";
import { TextField } from "@/components/ui/TextField";
import type { SocialProvider } from "@/lib/flextv/auth";
import { FLEXTV_AUTH, FLEXTV_WEB_URL } from "@/lib/flextv/mode";
import { useI18n } from "@/lib/i18n/I18nProvider";
import type { MessageKey } from "@/lib/i18n/translate";
import { login } from "@/services/auth/login";
import { LoginLocked } from "./LoginLocked";
import styles from "./LoginForm.module.css";

/**
 * Login screen.
 * Figma: DEFAULT 13:7 · UNKNOWN ID 718:123 · WRONG PASSWORD 718:168 · LOCKED 718:213 (718:335 is its own route: /login/password-change)
 * With the FLEXTV backend: the FLEXTV 아이디, 간편 로그인 through /auth/[provider], and FLEXTV's own 비밀번호 찾기
 * (it needs FLEXTV's 본인인증) — docs/development/flextv-backend.md.
 */

type FormState = "DEFAULT" | "PROCESSING" | "UNKNOWN_ID" | "WRONG_PASSWORD" | "LOCKED" | "TOO_MANY_ATTEMPTS" | "SUSPENDED" | "ERROR";

const MESSAGES = {
  UNKNOWN_ID: "auth.unknownId",
  WRONG_PASSWORD: "auth.wrongPassword",
  // Code-first (FLEXTV): FLEXTV refuses for 10 minutes after 20 wrong passwords within 10 minutes.
  TOO_MANY_ATTEMPTS: "auth.tooManyAttempts",
  // Code-first (no Figma frame): the account is suspended by an operator (appeal flow TBD).
  SUSPENDED: "auth.suspended",
  // The 도우미 domain has no 고객센터 of its own (and the site's domain is TBD): name the site's, without a link.
  SUSPENDED_HELPER: "auth.suspendedHelper",
  ERROR: "auth.tempError"
} as const satisfies Record<string, MessageKey>;

const SOCIAL_LABEL: Record<SocialProvider, MessageKey> = { kakao: "auth.kakao", naver: "auth.naver", google: "auth.google" };

/**
 * `next`: where to go after signing in (already validated as a same-site path). `supportLink`: 고객센터 (`/support`) is on
 * this host — false on the 도우미 domain, where the help lines name the site's 고객센터 in plain text.
 * `socialProviders`: the 간편 로그인 the server has set up (FLEXTV backend). `notice`: why a 간편 로그인 came back here.
 */
export function LoginForm({
  next = "/",
  supportLink = true,
  socialProviders = [],
  notice = null
}: {
  next?: string;
  supportLink?: boolean;
  socialProviders?: SocialProvider[];
  notice?: string | null;
}) {
  const router = useRouter();
  const { t } = useI18n();
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [keepSignedIn, setKeepSignedIn] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [state, setState] = useState<FormState>("DEFAULT");
  const identifierRef = useRef<HTMLInputElement>(null);
  const passwordRef = useRef<HTMLInputElement>(null);

  if (state === "LOCKED") return <LoginLocked supportLink={supportLink} />;

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
    <AuthCard title={t("auth.login")}>
      <form className={styles.form} onSubmit={handleSubmit} noValidate>
        <div className={styles.inputs}>
          <TextField
            ref={identifierRef}
            name="identifier"
            autoComplete="username"
            placeholder={FLEXTV_AUTH ? t("auth.loginIdLabel") : t("auth.identifier")}
            aria-label={FLEXTV_AUTH ? t("auth.loginIdLabel") : t("auth.identifier")}
            value={identifier}
            onChange={(e) => {
              setIdentifier(e.target.value);
              if (state === "UNKNOWN_ID") setState("DEFAULT");
            }}
            error={state === "UNKNOWN_ID" ? t(MESSAGES.UNKNOWN_ID) : null}
          />
          <TextField
            ref={passwordRef}
            name="password"
            type={showPassword ? "text" : "password"}
            autoComplete="current-password"
            placeholder={t("auth.password")}
            aria-label={t("auth.password")}
            value={password}
            onChange={(e) => {
              setPassword(e.target.value);
              if (state === "WRONG_PASSWORD") setState("DEFAULT");
            }}
            error={state === "WRONG_PASSWORD" ? t(MESSAGES.WRONG_PASSWORD) : null}
            trailing={
              <button
                type="button"
                className={styles.iconButton}
                onClick={() => setShowPassword((v) => !v)}
                aria-label={showPassword ? t("auth.hidePassword") : t("auth.showPassword")}
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
            {t("auth.keepSignedIn")}
          </label>
          {FLEXTV_AUTH ? (
            <a href={`${FLEXTV_WEB_URL}/member/find/findPw`} target="_blank" rel="noopener noreferrer" className={styles.textLink}>
              {t("auth.forgotPassword")}
            </a>
          ) : (
            <Link href="/password-reset" className={styles.textLink}>
              {t("auth.forgotPassword")}
            </Link>
          )}
        </div>

        {(state === "ERROR" || state === "SUSPENDED" || state === "TOO_MANY_ATTEMPTS") && (
          <p className={styles.formError} role="alert">
            {t(state === "SUSPENDED" && !supportLink ? MESSAGES.SUSPENDED_HELPER : MESSAGES[state])}
          </p>
        )}
        {state === "DEFAULT" && notice && (
          <p className={styles.formError} role="alert">
            {notice}
          </p>
        )}

        <button type="submit" className={styles.primaryButton} disabled={processing} aria-busy={processing}>
          {processing ? t("auth.loggingIn") : state === "WRONG_PASSWORD" ? t("auth.loginAgain") : t("auth.login")}
        </button>
      </form>

      {(!FLEXTV_AUTH || socialProviders.length > 0) && (
        <div className={styles.divider}>
          <span className={styles.dividerLine} />
          <span>{t("auth.or")}</span>
          <span className={styles.dividerLine} />
        </div>
      )}

      {/* Figma social-login-page 13:142. Mock: not connected. FLEXTV: through FLEXTV's own apps (lib/flextv/social.ts). */}
      {FLEXTV_AUTH ? (
        socialProviders.length > 0 && (
          <div className={styles.social}>
            {socialProviders.map((provider) => (
              <a key={provider} href={`/auth/${provider}?next=${encodeURIComponent(next)}`} className={`${styles.socialButton} ${styles[provider]}`}>
                {provider === "google" ? <CircleXIcon /> : provider === "kakao" ? <MessageCircleIcon /> : <span aria-hidden="true">N</span>}
                {t(SOCIAL_LABEL[provider])}
              </a>
            ))}
          </div>
        )
      ) : (
        <div className={styles.social}>
          <button type="button" className={`${styles.socialButton} ${styles.google}`}>
            <CircleXIcon />
            {t("auth.google")}
          </button>
          <button type="button" className={`${styles.socialButton} ${styles.kakao}`}>
            <MessageCircleIcon />
            {t("auth.kakao")}
          </button>
        </div>
      )}

      <p className={styles.bottom}>
        <span>{t("auth.notMember")}</span>
        <Link href="/signup" className={styles.signupLink}>
          {t("auth.signup")}
        </Link>
      </p>
    </AuthCard>
  );
}
