"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOutAdmin } from "@/services/admin/admin";
import studio from "../creatorStudio/studio.module.css";
import styles from "./admin.module.css";

/**
 * 관리자 콘솔 chrome — code-first (no Figma frame). Groups follow docs/figma/screen-inventory.md "Admin":
 * 회원 · 크리에이터 · 후원 · 결제 · 정산 · 플랫폼 · 시스템. Items without `href` are 준비 중.
 */
type Item = { label: string; emoji: string; href?: string };
type Group = { title: string | null; items: Item[] };

export const ADMIN_GROUPS: Group[] = [
  {
    title: null,
    items: [
      { label: "대시보드", emoji: "📊", href: "/admin" },
      { label: "감사 로그", emoji: "🧾", href: "/admin/audit" }
    ]
  },
  {
    title: "회원",
    items: [
      { label: "회원 관리", emoji: "👤" },
      { label: "크리에이터 관리", emoji: "🎙️" }
    ]
  },
  {
    title: "거래",
    items: [
      { label: "후원 운영", emoji: "💝" },
      { label: "결제 · 환불", emoji: "💳" },
      { label: "정산 심사", emoji: "🧮" }
    ]
  },
  {
    title: "운영",
    items: [
      { label: "신고 처리", emoji: "🚨" },
      { label: "콘텐츠 관리", emoji: "📢" },
      { label: "플랫폼 연동", emoji: "🔌" },
      { label: "시스템", emoji: "⚙️" }
    ]
  }
];

const PATHS = ADMIN_GROUPS.flatMap((g) => g.items.map((i) => i.href)).filter((h): h is string => !!h);

/** Most specific matching item; `/admin` matches only itself. */
export function adminActiveHref(pathname: string) {
  return PATHS.filter((h) => (h === "/admin" ? pathname === h : pathname === h || pathname.startsWith(`${h}/`))).sort((a, b) => b.length - a.length)[0] ?? null;
}

export function AdminHeader({ operator }: { operator: string }) {
  return (
    <header className={styles.header}>
      <Link href="/admin" className={styles.logo}>
        <span className={styles.logoText}>Somnation</span>
        <span className={styles.badge}>관리자</span>
      </Link>
      <div className={styles.headerRight}>
        <Link href="/" className={styles.headerLink}>
          사이트로
        </Link>
        <span className={styles.operator}>🛡️ {operator}</span>
        <form action={signOutAdmin}>
          <button type="submit" className={styles.headerLink}>
            로그아웃
          </button>
        </form>
      </div>
    </header>
  );
}

export function AdminSideNav() {
  const active = adminActiveHref(usePathname() ?? "/admin");
  return (
    <nav className={studio.sidebar} aria-label="관리자 메뉴">
      {ADMIN_GROUPS.map((g, i) => (
        <div key={g.title ?? `g${i}`} className={studio.sideGroup}>
          {g.title && <p className={studio.sideGroupTitle}>{g.title}</p>}
          <ul>
            {g.items.map((item) => {
              const content = (
                <>
                  <span className={studio.sideEmoji} aria-hidden="true">
                    {item.emoji}
                  </span>
                  {item.label}
                </>
              );
              const on = item.href === active;
              return (
                <li key={item.label}>
                  {item.href ? (
                    <Link href={item.href} className={`${studio.sideItem} ${on ? studio.sideItemActive : ""}`} aria-current={on ? "page" : undefined}>
                      {content}
                    </Link>
                  ) : (
                    <span className={`${studio.sideItem} ${studio.sideItemOff}`} aria-disabled="true" title="준비 중인 기능입니다">
                      {content}
                    </span>
                  )}
                </li>
              );
            })}
          </ul>
        </div>
      ))}
    </nav>
  );
}
