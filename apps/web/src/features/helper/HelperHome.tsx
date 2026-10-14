import Link from "next/link";
import type { OverlayTarget } from "@/services/creator/alertTypes";
import { OverlayOffNotice } from "@/features/creatorStudio/remote/OverlayOffNotice";
import { HELPER_NAV, HELPER_REMOTE, HELPER_TITLE } from "./helperNav";
import styles from "./helper.module.css";

const STEPS = [
  { title: "위젯 꾸미기", text: "후원 알림 · 목표 · 랭킹 같은 위젯을 고르고 테마와 문구를 정해요.", href: "/widgets", link: "위젯 설정" },
  {
    title: "OBS에 넣기",
    text: "오버레이 주소를 복사해 OBS의 ‘브라우저’ 소스에 붙여 넣어요. 장면 파일을 받아 한 번에 넣을 수도 있어요.",
    href: "/overlays",
    link: "오버레이 주소"
  },
  { title: "리모컨으로 확인", text: "리모컨에서 테스트 후원을 보내 방송 화면에 잘 나오는지 확인하고, 방송 중에는 알림 대기열을 제어해요.", href: HELPER_REMOTE.href, link: HELPER_REMOTE.label }
];

/** 시작하기 — the helper home, code-first (no Figma frame). OBS connection steps and every helper feature. */
export function HelperHome({ nickname, switches }: { nickname: string; switches: Record<OverlayTarget, boolean> }) {
  return (
    <div className={styles.content}>
      <header className={styles.pageHeader}>
        <h1>{nickname}님의 방송 도우미</h1>
        <p>{HELPER_TITLE}에서 방송 화면(OBS)에 띄우는 위젯과 라이브 방송 리모컨을 모두 다룰 수 있어요. 오버레이 주소에는 연동 키가 들어 있으니 다른 사람과 공유하지 마세요.</p>
      </header>
      <OverlayOffNotice targets={Object.keys(switches) as OverlayTarget[]} switches={switches} />
      <section className={styles.section} aria-labelledby="helper-steps">
        <h2 id="helper-steps" className={styles.sectionTitle}>
          OBS 연결 순서
        </h2>
        <ol className={styles.steps}>
          {STEPS.map((s) => (
            <li key={s.title} className={styles.step}>
              <strong>{s.title}</strong>
              <p>{s.text}</p>
              <Link href={s.href} className={styles.stepLink}>
                {s.link} →
              </Link>
            </li>
          ))}
        </ol>
      </section>
      {HELPER_NAV.filter((g) => g.title).map((g) => (
        <section key={g.title} className={styles.section} aria-label={g.title ?? undefined}>
          <h2 className={styles.sectionTitle}>{g.title}</h2>
          <ul className={styles.cards}>
            {g.items.map((item) => (
              <li key={item.href}>
                <Link href={item.href} className={styles.card}>
                  <span className={styles.cardEmoji} aria-hidden="true">
                    {item.emoji}
                  </span>
                  <span className={styles.cardText}>
                    <strong>{item.label}</strong>
                    <span>{item.description}</span>
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}
