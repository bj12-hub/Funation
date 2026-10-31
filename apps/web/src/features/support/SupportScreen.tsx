import Link from "next/link";
import type { ReactNode } from "react";
import { ChevronDownIcon, MailIcon, MessageSquareIcon, PhoneIcon, SearchMediumIcon } from "@/components/icons";
import { formatKst, formatNumber } from "@/lib/format";
import { getT } from "@/lib/i18n/server";
import {
  FAQ_CATEGORIES,
  SUPPORT_TABS,
  type FaqCategory,
  type FaqItem,
  type Inquiry,
  type Notice,
  type SupportTab
} from "@/services/support/supportTypes";
import { InquiryForm } from "./InquiryForm";
import { FAQ_CATEGORY_KEY, INQUIRY_STATUS_KEY, NOTICE_CATEGORY_KEY, SUPPORT_TAB_KEY } from "./labels";
import local from "./supportTabs.module.css";
import styles from "./support.module.css";

// TODO: Figma placeholder contact details — replace with the confirmed support channels (TBD).
// Rendered as text (not mailto/tel links) until they are confirmed.
// Titles and the phone hours follow the viewer's language; the address, number and handle are not translated.
const contacts = (t: T): { title: string; value: string; icon: ReactNode }[] => [
  { title: t("support.email"), value: "support@ssumnation.co.kr", icon: <MailIcon /> },
  { title: t("support.phone"), value: `1588-9999 (${t("support.phoneHours")})`, icon: <PhoneIcon /> },
  { title: t("support.kakao"), value: "@썸네이션", icon: <MessageSquareIcon /> }
];

type T = Awaited<ReturnType<typeof getT>>;

type Props = {
  tab: SupportTab;
  notices: Notice[];
  faqs: FaqItem[];
  query?: string;
  category?: FaqCategory;
  /** `null` = signed out. */
  inquiries: Inquiry[] | null;
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
 */
export async function SupportScreen({ tab, notices, faqs, query, category, inquiries }: Props) {
  const t = await getT();
  return (
    <div className={styles.page}>
      <header className={styles.hero}>
        <h1 className={styles.title}>{t("support.title")}</h1>
        <p className={styles.subtitle}>{t("support.subtitle")}</p>
        {/* Plain GET form: works without JavaScript and with IME input. Searches the FAQ. */}
        <form role="search" action="/support" className={styles.search}>
          <input type="hidden" name="tab" value="faq" />
          <SearchMediumIcon />
          <input type="search" name="q" className={styles.searchInput} placeholder={t("support.searchPlaceholder")} aria-label={t("support.searchFaq")} defaultValue={query ?? ""} maxLength={50} />
        </form>
      </header>

      <nav className={local.tabs} aria-label={t("support.title")}>
        {SUPPORT_TABS.map((s) => (
          <Link key={s.key} href={s.key === "notices" ? "/support" : `/support?tab=${s.key}`} className={local.tab} aria-current={tab === s.key ? "page" : undefined}>
            {s.key === "notices" ? "🔔" : s.key === "faq" ? "❓" : "💬"} {t(SUPPORT_TAB_KEY[s.key])}
          </Link>
        ))}
      </nav>

      {tab === "notices" && <NoticeList notices={notices} t={t} />}
      {tab === "faq" && <FaqPanel faqs={faqs} query={query} category={category} t={t} />}
      {tab === "inquiry" && <InquiryPanel inquiries={inquiries} t={t} />}
    </div>
  );
}

function NoticeList({ notices, t }: { notices: Notice[]; t: T }) {
  if (notices.length === 0) return <p className={local.empty}>{t("support.noNotices")}</p>;
  return (
    <ul className={local.notices} aria-label={t("support.tabNotices")}>
      {notices.map((n) => (
        <li key={n.id}>
          <Link href={`/support/notices/${n.id}`} className={local.notice}>
            <span className={local.tags}>
              <span className={local.tag}>{t(NOTICE_CATEGORY_KEY[n.category])}</span>
              {n.important && <span className={`${local.tag} ${local.tagImportant}`}>{t("support.important")}</span>}
            </span>
            <strong className={local.noticeTitle}>{n.title}</strong>
            <span className={local.noticeSummary}>{n.summary}</span>
            <span className={local.noticeMeta}>
              {n.date.replace(/-/g, ". ")}. · {t("support.views", { count: formatNumber(n.views) })}
            </span>
          </Link>
        </li>
      ))}
    </ul>
  );
}

function FaqPanel({ faqs, query, category, t }: { faqs: FaqItem[]; query?: string; category?: FaqCategory; t: T }) {
  return (
    <section className={styles.section} aria-labelledby="support-faq">
      <h2 id="support-faq" className={local.srOnly}>
        {t("support.tabFaq")}
      </h2>
      <nav className={local.chips} aria-label={t("support.faqCategories")}>
        <Link href={faqHref(undefined, query)} className={local.chip} aria-current={!category ? "page" : undefined}>
          {t("support.all")}
        </Link>
        {FAQ_CATEGORIES.map((c) => (
          <Link key={c.key} href={faqHref(c.key, query)} className={local.chip} aria-current={category === c.key ? "page" : undefined}>
            {t(FAQ_CATEGORY_KEY[c.key])}
          </Link>
        ))}
      </nav>
      {query && <p className={local.note}>{t("support.results", { query, count: faqs.length })}</p>}
      {faqs.length === 0 ? (
        <div className={styles.empty}>
          <p>{t("support.noResults")}</p>
          <Link href="/support?tab=faq" className={styles.emptyLink}>
            {t("support.allQuestions")}
          </Link>
        </div>
      ) : (
        <ul className={styles.faqList}>
          {faqs.map((faq) => (
            <li key={faq.id}>
              <details className={styles.faq}>
                <summary className={styles.faqQuestion}>
                  <span>
                    <span className={local.faqCategory}>{t(FAQ_CATEGORY_KEY[faq.category])}</span>
                    {faq.question}
                  </span>
                  <ChevronDownIcon className={styles.faqChevron} />
                </summary>
                <div className={styles.faqAnswer}>
                  <p>{faq.answer ?? t("support.answerPending")}</p>
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

function InquiryPanel({ inquiries, t }: { inquiries: Inquiry[] | null; t: T }) {
  return (
    <>
      <ul className={styles.contacts} aria-label={t("support.contacts")}>
        {contacts(t).map((c) => (
          <li key={c.title} className={styles.contact}>
            <span className={styles.contactIcon}>{c.icon}</span>
            <strong className={styles.contactTitle}>{c.title}</strong>
            <span className={styles.contactValue}>{c.value}</span>
          </li>
        ))}
      </ul>
      {inquiries === null ? (
        <div className={local.empty}>
          <p>{t("support.loginRequired")}</p>
          <Link href="/login?next=/support%3Ftab%3Dinquiry" className={styles.emptyLink}>
            {t("common.login")}
          </Link>
        </div>
      ) : (
        <>
          <InquiryForm />
          <section className={styles.section} aria-labelledby="my-inquiries">
            <h2 id="my-inquiries" className={styles.sectionTitle}>
              {t("support.myInquiries")}
            </h2>
            {inquiries.length === 0 ? (
              <p className={local.empty}>{t("support.noInquiries")}</p>
            ) : (
              <ul className={local.notices}>
                {inquiries.map((q) => (
                  <li key={q.id}>
                    <details className={local.notice}>
                      <summary className={local.inquirySummary}>
                        <span className={local.tags}>
                          <span className={local.tag}>{t(FAQ_CATEGORY_KEY[q.category])}</span>
                          <span className={`${local.tag} ${q.status === "ANSWERED" ? local.tagDone : ""}`}>{t(INQUIRY_STATUS_KEY[q.status])}</span>
                        </span>
                        <strong className={local.noticeTitle}>{q.title}</strong>
                        <span className={local.noticeMeta}>{formatKst(q.createdAt)}</span>
                      </summary>
                      <p className={local.inquiryBody}>{q.body}</p>
                      <p className={local.noticeSummary}>{q.answer ?? t("support.awaitingAnswer")}</p>
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
