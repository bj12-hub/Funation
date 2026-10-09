"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOutOperator } from "@/lib/actions";
import { SITE_URL } from "@/lib/siteUrl";
import styles from "./admin.module.css";
import shell from "./shell.module.css";

/**
 * 관리자 콘솔 chrome — Figma "Ssumnation Admin" Sidebar (3:29) · Topbar (3:63) · SideNav Item (2:44).
 * Groups follow docs/figma/screen-inventory.md "Admin": 회원 · 크리에이터 · 후원 · 결제 · 정산 · 플랫폼 · 시스템.
 * Items without `href` are 준비 중.
 */
type Item = { label: string; href?: string };
type Group = { title: string | null; items: Item[] };

export const ADMIN_GROUPS: Group[] = [
  {
    title: null,
    items: [
      { label: "대시보드", href: "/" },
      { label: "감사 로그", href: "/audit" }
    ]
  },
  {
    title: "회원",
    items: [
      { label: "회원 관리", href: "/members" },
      { label: "크리에이터 관리", href: "/creators" }
    ]
  },
  {
    title: "거래",
    items: [
      { label: "후원 운영", href: "/donations" },
      { label: "확인 중 후원", href: "/donations/pending" },
      { label: "결제 · 환불", href: "/payments" },
      { label: "정산 심사", href: "/settlements" }
    ]
  },
  {
    title: "운영",
    items: [
      { label: "신고 처리", href: "/reports" },
      { label: "콘텐츠 관리", href: "/content" },
      { label: "이벤트", href: "/events" },
      { label: "플랫폼 연동", href: "/platforms" },
      { label: "시스템", href: "/system" }
    ]
  }
];

const PATHS = ADMIN_GROUPS.flatMap((g) => g.items.map((i) => i.href)).filter((h): h is string => !!h);

/** Most specific matching item; `/` matches only itself. */
export function adminActiveHref(pathname: string) {
  return PATHS.filter((h) => (h === "/" ? pathname === h : pathname === h || pathname.startsWith(`${h}/`))).sort((a, b) => b.length - a.length)[0] ?? null;
}

/** "그룹 / 메뉴" plus the detail segment (e.g. 회원 / 회원 관리 / m-1042). */
export function adminBreadcrumb(pathname: string) {
  const href = adminActiveHref(pathname);
  const group = ADMIN_GROUPS.find((g) => g.items.some((i) => i.href === href));
  const item = group?.items.find((i) => i.href === href);
  if (!group || !item || !href) return "관리자 콘솔";
  const parts = [group.title, item.label].filter((p): p is string => !!p);
  const rest = href === "/" ? "" : pathname.slice(href.length).replace(/^\/+/, "");
  if (rest) parts.push(decodeURIComponent(rest.split("/")[0]));
  return parts.join(" / ");
}

export function AdminTopbar({ operator, mock }: { operator: string; mock: boolean }) {
  const crumb = adminBreadcrumb(usePathname() ?? "/");
  return (
    <header className={shell.topbar}>
      <p className={shell.crumb}>{crumb}</p>
      <div className={shell.topRight}>
        {mock && (
          <span className={styles.chipWarn} title="mock 데이터 · 서버를 다시 시작하면 초기화돼요">
            MOCK
          </span>
        )}
        <a href={SITE_URL} className={shell.topLink} target="_blank" rel="noreferrer">
          사이트 열기 ↗
        </a>
        <span className={shell.avatar} aria-hidden="true">
          {operator.slice(0, 1)}
        </span>
        <span className={shell.operator}>{operator}</span>
        <form action={signOutOperator}>
          <button type="submit" className={shell.signOut}>
            로그아웃
          </button>
        </form>
      </div>
    </header>
  );
}

export function AdminSideNav() {
  const active = adminActiveHref(usePathname() ?? "/");
  return (
    <aside className={shell.sidebar}>
      <Link href="/" className={shell.brand} aria-label="Ssumnation 관리자 콘솔 대시보드">
        <span className={shell.brandMark} aria-hidden="true">
          S
        </span>
        <span className={shell.brandName}>
          Ssumnation
          <span className={shell.brandSub}>Admin Console</span>
        </span>
      </Link>
      <nav aria-label="관리자 메뉴">
        {ADMIN_GROUPS.map((g, i) => (
          <div key={g.title ?? `g${i}`} className={shell.sideGroup}>
            {g.title && <p className={shell.sideGroupTitle}>{g.title}</p>}
            <ul>
              {g.items.map((item) => {
                const content = (
                  <>
                    <span className={shell.sideDot} aria-hidden="true" />
                    {item.label}
                  </>
                );
                const on = item.href === active;
                return (
                  <li key={item.label}>
                    {item.href ? (
                      <Link href={item.href} className={`${shell.sideItem} ${on ? shell.sideItemActive : ""}`} aria-current={on ? "page" : undefined}>
                        {content}
                      </Link>
                    ) : (
                      <span className={`${shell.sideItem} ${shell.sideItemOff}`} aria-disabled="true" title="준비 중인 기능입니다">
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
    </aside>
  );
}
