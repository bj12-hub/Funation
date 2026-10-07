import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import styles from "@/features/support/supportTabs.module.css";
import { getNotice } from "@/services/support/notices";
import { NOTICE_CATEGORY_LABEL } from "@/services/support/supportTypes";

// Code-first (no Figma frame): 공지사항 detail — funnation 고객센터 notice page structure.
export const dynamic = "force-dynamic";

type Params = Promise<{ id: string }>;

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const notice = await getNotice((await params).id);
  return { title: notice ? `${notice.title} | 공지사항 | Somnation` : "공지사항 | Somnation" };
}

export default async function Page({ params }: { params: Params }) {
  const notice = await getNotice((await params).id);
  if (!notice) notFound();
  return (
    <article className={styles.detail}>
      <Link href="/support" className={styles.back}>
        ← 공지사항 목록
      </Link>
      <span className={styles.tags}>
        <span className={styles.tag}>{NOTICE_CATEGORY_LABEL[notice.category]}</span>
        {notice.important && <span className={`${styles.tag} ${styles.tagImportant}`}>중요</span>}
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
