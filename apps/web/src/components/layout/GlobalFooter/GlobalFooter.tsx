import Link from "next/link";
import type { ComponentType, SVGProps } from "react";
import { FacebookIcon, InstagramIcon, TwitterIcon, YoutubeIcon } from "@/components/icons";
import styles from "./GlobalFooter.module.css";

/**
 * Global footer.
 * Figma: 727:3183 (funation-videos-page / footer)
 */

type FooterLink = { label: string; href?: string };

// Items without `href` have no screen yet and render as plain text.
const COLUMNS: { title: string; links: FooterLink[] }[] = [
  {
    title: "회사소개",
    links: [{ label: "서비스 소개" }, { label: "인재채용" }, { label: "제휴 제안" }, { label: "보도자료" }]
  },
  {
    title: "이용안내",
    links: [
      { label: "이용약관", href: "/terms/service" },
      { label: "개인정보처리방침", href: "/terms/privacy" },
      { label: "청소년보호정책", href: "/terms/youth" },
      { label: "운영정책", href: "/terms/operation" }
    ]
  },
  {
    title: "고객지원",
    links: [
      { label: "자주 묻는 질문", href: "/support" },
      { label: "1:1 문의하기", href: "/support" },
      { label: "광고 문의", href: "/support" },
      { label: "신고센터", href: "/support" }
    ]
  }
];

// TODO: Figma placeholder values — replace with the confirmed business registration details (TBD).
const COMPANY_LINES = [
  "(주)Funation 엔터테인먼트 | 대표이사: 홍길동 | 서울특별시 강남구 테헤란로 123 펀타워 15층",
  "사업자등록번호: 120-81-12345 | 통신판매업신고: 제 2026-서울강남-9999호 | 고객센터: 1588-9999"
];

// TODO: official channel URLs are TBD; icons render without links until then.
const SOCIALS: { label: string; Icon: ComponentType<SVGProps<SVGSVGElement>> }[] = [
  { label: "Instagram", Icon: InstagramIcon },
  { label: "YouTube", Icon: YoutubeIcon },
  { label: "Facebook", Icon: FacebookIcon },
  { label: "X (Twitter)", Icon: TwitterIcon }
];

export function GlobalFooter() {
  return (
    <footer className={styles.footer}>
      <div className={styles.inner}>
        <div className={styles.top}>
          <div className={styles.brand}>
            <span className={styles.logo}>Funation</span>
            <p className={styles.about}>
              Funation은 트렌디하고 재미있는 대한민국 모든 예능, 스포츠, 게임 비디오 콘텐츠를 실시간으로 가장 빠르게 모아 즐기는
              K-비디오 통합 엔터테인먼트 플랫폼입니다.
            </p>
          </div>
          <nav className={styles.columns} aria-label="푸터 메뉴">
            {COLUMNS.map((column) => (
              <div key={column.title} className={styles.column}>
                <h2 className={styles.columnTitle}>{column.title}</h2>
                <ul className={styles.links}>
                  {column.links.map((link) => (
                    <li key={link.label}>
                      {link.href ? (
                        <Link href={link.href} className={styles.link}>
                          {link.label}
                        </Link>
                      ) : (
                        <span className={styles.linkText}>{link.label}</span>
                      )}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </nav>
        </div>

        <hr className={styles.divider} />

        <div className={styles.bottom}>
          <div className={styles.company}>
            {COMPANY_LINES.map((line) => (
              <p key={line}>{line}</p>
            ))}
            <p className={styles.copyright}>Copyright © 2026 Funation Inc. All rights reserved.</p>
          </div>
          <ul className={styles.socials}>
            {SOCIALS.map(({ label, Icon }) => (
              <li key={label} className={styles.social}>
                <Icon role="img" aria-label={label} aria-hidden={undefined} />
              </li>
            ))}
          </ul>
        </div>
      </div>
    </footer>
  );
}
