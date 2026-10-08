import Link from "next/link";
import type { ComponentType, SVGProps } from "react";
import { FacebookIcon, InstagramIcon, TwitterIcon, YoutubeIcon } from "@/components/icons";
import { getT } from "@/lib/i18n/server";
import type { MessageKey } from "@/lib/i18n/translate";
import styles from "./GlobalFooter.module.css";

/**
 * Global footer.
 * Figma: 727:3183 (ssumnation-videos-page / footer)
 */

type FooterLink = { label: MessageKey; href?: string };

// Items without `href` have no screen yet and render as plain text.
const COLUMNS: { title: MessageKey; links: FooterLink[] }[] = [
  {
    title: "footer.company",
    links: [{ label: "footer.service" }, { label: "footer.careers" }, { label: "footer.partnership" }, { label: "footer.press" }]
  },
  {
    title: "footer.guide",
    links: [
      { label: "footer.terms", href: "/terms/service" },
      { label: "footer.privacy", href: "/terms/privacy" },
      { label: "footer.youth", href: "/terms/youth" },
      { label: "footer.operation", href: "/terms/operation" }
    ]
  },
  {
    title: "footer.help",
    links: [
      { label: "footer.faq", href: "/support?tab=faq" },
      { label: "footer.inquiry", href: "/support?tab=inquiry" },
      { label: "footer.ads", href: "/support?tab=inquiry" },
      { label: "footer.report", href: "/support?tab=inquiry" }
    ]
  }
];

// TODO: Figma placeholder values — replace with the confirmed business registration details (TBD).
// Legal entity lines stay in Korean in every locale until the registered English wording exists.
const COMPANY_LINES = [
  "(주)썸네이션 엔터테인먼트 | 대표이사: 홍길동 | 서울특별시 강남구 테헤란로 123 펀타워 15층",
  "사업자등록번호: 120-81-12345 | 통신판매업신고: 제 2026-서울강남-9999호 | 고객센터: 1588-9999"
];

// TODO: official channel URLs are TBD; icons render without links until then.
const SOCIALS: { label: string; Icon: ComponentType<SVGProps<SVGSVGElement>> }[] = [
  { label: "Instagram", Icon: InstagramIcon },
  { label: "YouTube", Icon: YoutubeIcon },
  { label: "Facebook", Icon: FacebookIcon },
  { label: "X (Twitter)", Icon: TwitterIcon }
];

export async function GlobalFooter() {
  const t = await getT();
  return (
    <footer className={styles.footer}>
      <div className={styles.inner}>
        <div className={styles.top}>
          <div className={styles.brand}>
            <span className={styles.logo}>Ssumnation</span>
            <p className={styles.about}>{t("footer.about")}</p>
          </div>
          <nav className={styles.columns} aria-label={t("footer.menu")}>
            {COLUMNS.map((column) => (
              <div key={column.title} className={styles.column}>
                <h2 className={styles.columnTitle}>{t(column.title)}</h2>
                <ul className={styles.links}>
                  {column.links.map((link) => (
                    <li key={link.label}>
                      {link.href ? (
                        <Link href={link.href} className={styles.link}>
                          {t(link.label)}
                        </Link>
                      ) : (
                        <span className={styles.linkText}>{t(link.label)}</span>
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
            <p className={styles.copyright}>Copyright © 2026 Ssumnation Inc. All rights reserved.</p>
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
