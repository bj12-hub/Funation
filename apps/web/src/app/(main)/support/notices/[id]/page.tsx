import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { NOTICE_CATEGORY_KEY } from "@/features/support/labels";
import styles from "@/features/support/supportTabs.module.css";
import { getT } from "@/lib/i18n/server";
import { getNotice } from "@/services/support/notices";

// Code-first (no Figma frame): 공지사항 detail — funnation 고객센터 notice page structure.
export const dynamic = "force-dynamic";

type Params = Promise<{ id: string }>;

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const notice = await getNotice((await params).id);
  const t = await getT();
  return { title: notice ? t("support.metaNotice", { title: notice.title }) : t("support.metaNotices") };
}

export default async function Page({ params }: { params: Params }) {
  const notice = await getNotice((await params).id);
  if (!notice) notFound();
  const t = await getT();
  return (
    <article className={styles.detail}>
      <Link href="/support" className={styles.back}>
        {t("support.backToNotices")}
      </Link>
      <span className={styles.tags}>
        <span className={styles.tag}>{t(NOTICE_CATEGORY_KEY[notice.category])}</span>
        {notice.important && <span className={`${styles.tag} ${styles.tagImportant}`}>{t("support.important")}</span>}
      </span>
      <h1 className={styles.noticeTitle}>{notice.title}</h1>
      <span className={styles.noticeMeta}>{notice.date.replace(/-/g, ". ")}.</span>
      <div className={styles.detailBody}>
        {/* By position: an operator may write the same paragraph twice, and text keys would collide. */}
        {notice.body.map((p, i) => (
          <p key={i}>{p}</p>
        ))}
      </div>
    </article>
  );
}
