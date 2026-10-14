import Link from "next/link";
import type { ReactNode } from "react";
import { logout } from "@/services/auth/logout";
import { HelperBrand } from "./HelperShell";
import { HELPER_TITLE } from "./helperNav";
import styles from "./helper.module.css";

const FEATURES = [
  { emoji: "🔔", title: "후원 알림 · 위젯", text: "후원 알림, 목표, 랭킹, 시계, 채팅창을 세 가지 테마로 꾸며 OBS에 띄워요." },
  { emoji: "🎛️", title: "라이브 방송 리모컨", text: "방송 중에 알림 대기열 · 볼륨 · 테스트 후원 · 투표 · 룰렛을 작은 창에서 제어해요." },
  { emoji: "👥", title: "크루 방송", text: "점수판, 배틀, 강탈, 시나리오까지 크루 방송에 필요한 화면을 한 번에 운영해요." }
];

/** Plain top bar for the account pages the helper domain shares with the site (sign-in, sign-up, 채널 만들기, terms). */
export function HelperFrame({ children }: { children: ReactNode }) {
  return (
    <div data-theme="dark" className={styles.scope}>
      <header className={styles.frameBar}>
        <HelperBrand />
        <Link href="/" className={styles.frameLink}>
          도우미 홈
        </Link>
      </header>
      {children}
    </div>
  );
}

/** Signed out on the helper domain — code-first (no Figma frame). */
export function HelperLanding({ next }: { next: string }) {
  const login = next === "/" ? "/login" : `/login?next=${encodeURIComponent(next)}`;
  return (
    <div data-theme="dark" className={styles.scope}>
      <main className={styles.landing}>
        <HelperBrand />
        <div>
          <h1 className={styles.landingTitle}>방송 화면 위젯과 리모컨을 한곳에서</h1>
          <p className={styles.landingText}>
            {HELPER_TITLE}는 OBS에 띄우는 후원 알림 · 채팅창 · 방송 도구와 라이브 방송 리모컨을 모은 크리에이터 전용 페이지예요. 썸네이션 계정으로 로그인해
            시작하세요.
          </p>
        </div>
        <div className={styles.landingActions}>
          <Link href={login} className={styles.primary}>
            로그인
          </Link>
          <Link href="/signup" className={styles.secondary}>
            회원가입
          </Link>
        </div>
        <ul className={styles.featureGrid}>
          {FEATURES.map((f) => (
            <li key={f.title} className={styles.feature}>
              <span className={styles.featureEmoji} aria-hidden="true">
                {f.emoji}
              </span>
              <strong>{f.title}</strong>
              <span>{f.text}</span>
            </li>
          ))}
        </ul>
      </main>
    </div>
  );
}

/** Signed in without a channel: the Creator role comes from 채널 만들기 (approval TBD, as on the site). */
export function HelperNeedsChannel({ nickname }: { nickname: string }) {
  return (
    <HelperFrame>
      <main className={styles.landing}>
        <div>
          <h1 className={styles.landingTitle}>크리에이터 채널이 필요해요</h1>
          <p className={styles.landingText}>
            {nickname}님, {HELPER_TITLE}는 채널을 만든 크리에이터만 쓸 수 있어요. 채널을 만들면 바로 방송 화면 위젯과 리모컨을 쓸 수 있어요.
          </p>
        </div>
        <div className={styles.landingActions}>
          <Link href="/channel/new" className={styles.primary}>
            내 채널 만들기
          </Link>
          <form action={logout}>
            <button type="submit" className={styles.secondary}>
              다른 계정으로 로그인
            </button>
          </form>
        </div>
      </main>
    </HelperFrame>
  );
}
