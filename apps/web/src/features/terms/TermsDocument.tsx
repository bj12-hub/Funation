import Link from "next/link";
import { clauseHeading, TERMS_DOCS, TERMS_SLUGS, type TermsSlug } from "./termsOutline";
import styles from "./terms.module.css";

/**
 * 약관·정책 문서 — code-first (Figma 722:3 has no terms text). Shows the clause outline only; every clause body,
 * the 시행일 and the version are TBD until legal review (2026-10-06 결정: "조항 목차만 자리표시로").
 */
export function TermsDocument({ slug }: { slug: TermsSlug }) {
  const doc = TERMS_DOCS[slug];

  return (
    <article className={styles.page} aria-labelledby="terms-title">
      <nav className={styles.docs} aria-label="약관·정책 문서">
        {TERMS_SLUGS.map((s) => (
          <Link key={s} href={`/terms/${s}`} className={styles.docLink} aria-current={s === slug ? "page" : undefined}>
            {TERMS_DOCS[s].title}
          </Link>
        ))}
      </nav>

      <header className={styles.head}>
        <span className={styles.badge}>법무 검토 중</span>
        <h1 id="terms-title" className={styles.title}>
          {doc.title}
        </h1>
        <dl className={styles.meta}>
          <div>
            <dt>시행일</dt>
            <dd>TBD</dd>
          </div>
          <div>
            <dt>버전</dt>
            <dd>TBD</dd>
          </div>
        </dl>
      </header>

      <p className={styles.notice} role="note">
        지금은 조항 목차만 공개하고 있어요. 각 조항의 내용은 법무 검토를 마친 뒤 게시돼요.
      </p>

      <nav className={styles.toc} aria-labelledby="terms-toc">
        <h2 id="terms-toc" className={styles.tocTitle}>
          목차
        </h2>
        <ol className={styles.tocList}>
          {doc.clauses.map((_, i) => (
            <li key={i}>
              <a href={`#clause-${i + 1}`} className={styles.tocLink}>
                {clauseHeading(doc, i)}
              </a>
            </li>
          ))}
        </ol>
      </nav>

      <div className={styles.clauses}>
        {doc.clauses.map((_, i) => (
          <section key={i} id={`clause-${i + 1}`} className={styles.clause} aria-labelledby={`clause-${i + 1}-title`}>
            <h2 id={`clause-${i + 1}-title`} className={styles.clauseTitle}>
              {clauseHeading(doc, i)}
            </h2>
            <p className={styles.clauseBody}>법무 검토 중 (TBD)</p>
          </section>
        ))}
        {doc.numbering === "ARTICLE" && (
          <section className={styles.clause} aria-labelledby="clause-addenda-title">
            <h2 id="clause-addenda-title" className={styles.clauseTitle}>
              부칙
            </h2>
            <p className={styles.clauseBody}>시행일 TBD</p>
          </section>
        )}
      </div>
    </article>
  );
}
