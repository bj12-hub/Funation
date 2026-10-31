import Link from "next/link";
import type { ReactNode } from "react";
import { ChevronDownIcon, MailIcon, MessageSquareIcon, PhoneIcon, SearchMediumIcon } from "@/components/icons";
import { FLEXTV_SITE, FLEXTV_WEB_URL } from "@/lib/flextv/mode";
import { formatKst, formatNumber } from "@/lib/format";
import {
  FAQ_CATEGORIES,
  INQUIRY_STATUS_LABEL,
  NOTICE_CATEGORY_LABEL,
  SUPPORT_TABS,
  faqCategoryLabel,
  type FaqCategory,
  type FaqItem,
  type Inquiry,
  type Notice,
  type SupportTab
} from "@/services/support/supportTypes";
import { FlextvInquiryForm } from "./FlextvInquiryForm";
import { InquiryForm } from "./InquiryForm";
import local from "./supportTabs.module.css";
import styles from "./support.module.css";

// TODO: Figma placeholder contact details — replace with the confirmed support channels (TBD).
// Rendered as text (not mailto/tel links) until they are confirmed.
const CONTACTS: { title: string; value: string; icon: ReactNode }[] = [
  { title: "이메일", value: "support@ssumnation.co.kr", icon: <MailIcon /> },
  { title: "전화", value: "1588-9999 (평일 09:00-18:00)", icon: <PhoneIcon /> },
  { title: "카카오톡 상담", value: "@썸네이션", icon: <MessageSquareIcon /> }
];

type Props = {
  tab: SupportTab;
  notices: Notice[];
  faqs: FaqItem[];
  query?: string;
  category?: FaqCategory;
  /** `null` = signed out. */
  inquiries: Inquiry[] | null;
  /** With FLEXTV (phase 9): FLEXTV's 1:1 문의 유형; null when FLEXTV did not answer (its own form is linked instead). */
  inquiryCategories?: { value: string; label: string }[] | null;
};

const faqHref = (category?: FaqCategory, q?: string) => {
  const p = new URLSearchParams({ tab: "faq" });
  if (category) p.set("category", category);
  if (q) p.set("q", q);
  return `/support?${p}`;
};

/**
 * Customer support — tabs follow funnation 고객센터 (공지사항 · 자주 묻는 질문 · 1:1 문의).
 * Figma 고객센터 4:7 (hero, search, FAQ accordion, 문의 방법) visuals are kept. Route `/support`.
 * With FLEXTV (phase 7) FLEXTV's notices, questions and 1:1 문의: no categories or view counts. A 문의 is written with
 * FLEXTV's 유형 (phase 9).
 */
export function SupportScreen({ tab, notices, faqs, query, category, inquiries, inquiryCategories = null }: Props) {
  return (
    <div className={styles.page}>
      <header className={styles.hero}>
        <h1 className={styles.title}>고객센터</h1>
        <p className={styles.subtitle}>궁금한 점이나 도움이 필요한 사항을 안내해 드립니다.</p>
        {/* Plain GET form: works without JavaScript and with IME input. Searches the FAQ. */}
        <form role="search" action="/support" className={styles.search}>
          <input type="hidden" name="tab" value="faq" />
          <SearchMediumIcon />
          <input type="search" name="q" className={styles.searchInput} placeholder="궁금한 내용을 검색해보세요" aria-label="자주 묻는 질문 검색" defaultValue={query ?? ""} maxLength={50} />
        </form>
      </header>

      <nav className={local.tabs} aria-label="고객센터">
        {SUPPORT_TABS.map((t) => (
          <Link key={t.key} href={t.key === "notices" ? "/support" : `/support?tab=${t.key}`} className={local.tab} aria-current={tab === t.key ? "page" : undefined}>
            {t.key === "notices" ? "🔔" : t.key === "faq" ? "❓" : "💬"} {t.label}
          </Link>
        ))}
      </nav>

      {tab === "notices" && <NoticeList notices={notices} />}
      {tab === "faq" && <FaqPanel faqs={faqs} query={query} category={category} />}
      {tab === "inquiry" && <InquiryPanel inquiries={inquiries} categories={inquiryCategories} />}
    </div>
  );
}

function NoticeList({ notices }: { notices: Notice[] }) {
  if (notices.length === 0) return <p className={local.empty}>등록된 공지사항이 없습니다.</p>;
  return (
    <ul className={local.notices} aria-label="공지사항">
      {notices.map((n) => (
        <li key={n.id}>
          <Link href={`/support/notices/${n.id}`} className={local.notice}>
            <span className={local.tags}>
              <span className={local.tag}>{NOTICE_CATEGORY_LABEL[n.category]}</span>
              {n.important && <span className={`${local.tag} ${local.tagImportant}`}>중요</span>}
            </span>
            <strong className={local.noticeTitle}>{n.title}</strong>
            <span className={local.noticeSummary}>{n.summary}</span>
            <span className={local.noticeMeta}>
              {n.date.replace(/-/g, ". ")}.{!FLEXTV_SITE && ` · 조회 ${formatNumber(n.views)}`}
            </span>
          </Link>
        </li>
      ))}
    </ul>
  );
}

function FaqPanel({ faqs, query, category }: { faqs: FaqItem[]; query?: string; category?: FaqCategory }) {
  return (
    <section className={styles.section} aria-labelledby="support-faq">
      <h2 id="support-faq" className={local.srOnly}>
        자주 묻는 질문
      </h2>
      {!FLEXTV_SITE && (
        <nav className={local.chips} aria-label="질문 분류">
          <Link href={faqHref(undefined, query)} className={local.chip} aria-current={!category ? "page" : undefined}>
            전체
          </Link>
          {FAQ_CATEGORIES.map((c) => (
            <Link key={c.key} href={faqHref(c.key, query)} className={local.chip} aria-current={category === c.key ? "page" : undefined}>
              {c.label}
            </Link>
          ))}
        </nav>
      )}
      {query && <p className={local.note}>‘{query}’ 검색 결과 {faqs.length}건</p>}
      {faqs.length === 0 ? (
        <div className={styles.empty}>
          <p>검색 결과가 없습니다. 다른 단어로 검색하거나 1:1 문의를 이용해 주세요.</p>
          <Link href="/support?tab=faq" className={styles.emptyLink}>
            전체 질문 보기
          </Link>
        </div>
      ) : (
        <ul className={styles.faqList}>
          {faqs.map((faq) => (
            <li key={faq.id}>
              <details className={styles.faq}>
                <summary className={styles.faqQuestion}>
                  <span>
                    {!FLEXTV_SITE && <span className={local.faqCategory}>{faqCategoryLabel(faq.category)}</span>}
                    {faq.question}
                  </span>
                  <ChevronDownIcon className={styles.faqChevron} />
                </summary>
                <div className={styles.faqAnswer}>
                  {/* By position: FLEXTV's answers come as lines (lib/flextv/support.ts). */}
                  {(faq.answer ?? "답변을 준비하고 있습니다. 급한 문의는 1:1 문의를 이용해 주세요.").split("\n").map((line, i) => (
                    <p key={i}>{line}</p>
                  ))}
                  {faq.link && (
                    <Link href={faq.link.href} className={styles.faqLink}>
                      {faq.link.label} →
                    </Link>
                  )}
                </div>
              </details>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function InquiryPanel({ inquiries, categories }: { inquiries: Inquiry[] | null; categories: Props["inquiryCategories"] }) {
  return (
    <>
      <ul className={styles.contacts} aria-label="상담 채널">
        {CONTACTS.map((c) => (
          <li key={c.title} className={styles.contact}>
            <span className={styles.contactIcon}>{c.icon}</span>
            <strong className={styles.contactTitle}>{c.title}</strong>
            <span className={styles.contactValue}>{c.value}</span>
          </li>
        ))}
      </ul>
      {inquiries === null ? (
        <div className={local.empty}>
          <p>1:1 문의는 로그인 후 이용할 수 있어요.</p>
          <Link href="/login?next=/support%3Ftab%3Dinquiry" className={styles.emptyLink}>
            로그인
          </Link>
        </div>
      ) : (
        <>
          {FLEXTV_SITE && categories ? (
            <FlextvInquiryForm categories={categories} />
          ) : FLEXTV_SITE ? (
            <div className={local.empty}>
              <p>지금은 문의 유형을 불러오지 못했어요. FLEXTV에서 문의해 주세요. 답변은 이 아래 내 문의 내역에서도 볼 수 있어요.</p>
              <a href={`${FLEXTV_WEB_URL}/cs/inquiry`} target="_blank" rel="noopener noreferrer" className={styles.emptyLink}>
                FLEXTV에서 문의하기
              </a>
            </div>
          ) : (
            <InquiryForm />
          )}
          <section className={styles.section} aria-labelledby="my-inquiries">
            <h2 id="my-inquiries" className={styles.sectionTitle}>
              내 문의 내역
            </h2>
            {inquiries.length === 0 ? (
              <p className={local.empty}>문의 내역이 없습니다. 궁금한 점이 있으시면 문의해 주세요.</p>
            ) : (
              <ul className={local.notices}>
                {inquiries.map((q) => (
                  <li key={q.id}>
                    <details className={local.notice}>
                      <summary className={local.inquirySummary}>
                        <span className={local.tags}>
                          {!FLEXTV_SITE && <span className={local.tag}>{faqCategoryLabel(q.category)}</span>}
                          <span className={`${local.tag} ${q.status === "ANSWERED" ? local.tagDone : ""}`}>{INQUIRY_STATUS_LABEL[q.status]}</span>
                        </span>
                        <strong className={local.noticeTitle}>{q.title}</strong>
                        <span className={local.noticeMeta}>{formatKst(q.createdAt)}</span>
                      </summary>
                      <p className={local.inquiryBody}>{q.body}</p>
                      <p className={local.noticeSummary}>{q.answer ?? "답변을 기다리고 있어요."}</p>
                    </details>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </>
      )}
    </>
  );
}
