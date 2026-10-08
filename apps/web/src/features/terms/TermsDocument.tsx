import Link from "next/link";
import { clauseHeading, effectiveLine, TERMS_DOCS, TERMS_DRAFT, TERMS_SLUGS, type TermsBlock, type TermsSlug } from "./termsOutline";
import styles from "./terms.module.css";

/**
 * 약관·정책 문서 — code-first (Figma 722:3 has no terms text). Shows the 초안 bodies written on 2026-10-08 ("정책 부분은
 * 일반적으로 사용하는 로직으로 시작") with the draft banner; the 시행일 and version are draft placeholders until legal review.
 * Every body is plain text rendered as React text nodes (no HTML injection).
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
        <span className={styles.badge}>{TERMS_DRAFT.badge}</span>
        <h1 id="terms-title" className={styles.title}>
          {doc.title}
        </h1>
        <dl className={styles.meta}>
          <div>
            <dt>시행일</dt>
            <dd>{TERMS_DRAFT.effectiveDate}</dd>
          </div>
          <div>
            <dt>버전</dt>
            <dd>{TERMS_DRAFT.version}</dd>
          </div>
        </dl>
      </header>

      <p className={styles.banner} role="note">
        {TERMS_DRAFT.banner}
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
        {doc.clauses.map((clause, i) => (
          <section key={i} id={`clause-${i + 1}`} className={styles.clause} aria-labelledby={`clause-${i + 1}-title`}>
            <h2 id={`clause-${i + 1}-title`} className={styles.clauseTitle}>
              {clauseHeading(doc, i)}
            </h2>
            {clause.body.map((block, j) => (
              <ClauseBlock key={j} block={block} />
            ))}
          </section>
        ))}
        {doc.numbering === "ARTICLE" && (
          <section className={styles.clause} aria-labelledby="clause-addenda-title">
            <h2 id="clause-addenda-title" className={styles.clauseTitle}>
              부칙
            </h2>
            <p className={styles.clauseBody}>{effectiveLine("이 약관은")}</p>
          </section>
        )}
      </div>
    </article>
  );
}

function ClauseBlock({ block }: { block: TermsBlock }) {
  if (typeof block === "string") return <p className={styles.clauseBody}>{block}</p>;
  if ("ol" in block || "ul" in block) {
    const ordered = "ol" in block;
    const items = ordered ? block.ol : block.ul;
    const List = ordered ? "ol" : "ul";
    return (
      <List className={`${styles.clauseList} ${ordered ? styles.ordered : styles.bulleted}`}>
        {items.map((item, k) => (
          <li key={k}>{item}</li>
        ))}
      </List>
    );
  }
  const { head, rows } = block.table;
  return (
    <div className={styles.tableWrap}>
      <table className={styles.table}>
        <thead>
          <tr>
            {head.map((h) => (
              <th key={h} scope="col">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, r) => (
            <tr key={r}>
              {row.map((cell, c) => (
                <td key={c}>{cell}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
