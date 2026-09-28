import Link from "next/link";
import type { ReactNode } from "react";
import {
  BookOpenIcon,
  ChevronDownIcon,
  HelpCircleIcon,
  MailIcon,
  MessageCircleLargeIcon,
  MessageSquareIcon,
  PhoneIcon,
  SearchMediumIcon
} from "@/components/icons";
import type { FaqItem } from "@/services/support/faq";
import styles from "./support.module.css";

const UNAVAILABLE = { "aria-disabled": true, title: "준비 중인 기능입니다" } as const;

// TODO: Figma placeholder contact details — replace with the confirmed support channels (TBD).
// Rendered as text (not mailto/tel links) until they are confirmed.
const CONTACTS: { title: string; value: string; icon: ReactNode }[] = [
  { title: "이메일", value: "support@funation.co.kr", icon: <MailIcon /> },
  { title: "전화", value: "1588-9999 (평일 09:00-18:00)", icon: <PhoneIcon /> },
  { title: "카카오톡 상담", value: "@Funation", icon: <MessageSquareIcon /> }
];

/**
 * Customer support.
 * Figma: 고객센터 4:7 (route `/support`, all roles incl. guests)
 */
export function SupportScreen({ faqs, query }: { faqs: FaqItem[]; query?: string }) {
  return (
    <div className={styles.page}>
      <header className={styles.hero}>
        <h1 className={styles.title}>고객센터</h1>
        <p className={styles.subtitle}>무엇을 도와드릴까요? Funation 이용에 관한 모든 궁금증을 해결해 드립니다.</p>
        {/* Plain GET form: works without JavaScript and with IME input. */}
        <form role="search" action="/support#faq" className={styles.search}>
          <SearchMediumIcon />
          <input
            type="search"
            name="q"
            className={styles.searchInput}
            placeholder="궁금한 내용을 검색해보세요"
            aria-label="궁금한 내용을 검색해보세요"
            defaultValue={query ?? ""}
            maxLength={50}
          />
        </form>
      </header>

      <section className={styles.section} aria-labelledby="support-services">
        <h2 id="support-services" className={styles.sectionTitle}>
          서비스 안내
        </h2>
        <div className={styles.services}>
          <ServiceCard icon={<MessageCircleLargeIcon />} title="1:1 문의하기" description="전문 상담원이 1:1로 신속하게 답변해 드립니다. 평균 응답 시간: 30분">
            {/* TODO: 1:1 inquiry form is not designed yet. */}
            <button type="button" className={styles.cta} {...UNAVAILABLE}>
              문의하기
            </button>
          </ServiceCard>
          <ServiceCard icon={<HelpCircleIcon />} title="자주 묻는 질문" description="이용자들이 가장 많이 묻는 질문과 답변을 확인해 보세요.">
            <a href="#faq" className={styles.cta}>
              바로가기
            </a>
          </ServiceCard>
          <ServiceCard icon={<BookOpenIcon />} title="간편 이용 가이드" description="Funation의 주요 기능과 사용법을 쉽게 알아보세요.">
            {/* TODO: usage guide is not designed yet. */}
            <button type="button" className={styles.cta} {...UNAVAILABLE}>
              가이드 보기
            </button>
          </ServiceCard>
        </div>
      </section>

      <section id="faq" className={styles.section} aria-labelledby="support-faq">
        <h2 id="support-faq" className={styles.sectionTitle}>
          {query ? `‘${query}’ 검색 결과` : "자주 묻는 질문 TOP 5"}
        </h2>
        {faqs.length === 0 ? (
          <div className={styles.empty}>
            <p>검색 결과가 없습니다. 다른 단어로 검색해 보세요.</p>
            <Link href="/support" className={styles.emptyLink}>
              전체 질문 보기
            </Link>
          </div>
        ) : (
          <ul className={styles.faqList}>
            {faqs.map((faq) => (
              <li key={faq.id}>
                <details className={styles.faq}>
                  <summary className={styles.faqQuestion}>
                    <span>{faq.question}</span>
                    <ChevronDownIcon className={styles.faqChevron} />
                  </summary>
                  <div className={styles.faqAnswer}>
                    <p>{faq.answer ?? "답변을 준비하고 있습니다. 급한 문의는 아래 문의 방법을 이용해 주세요."}</p>
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

      <section className={styles.section} aria-labelledby="support-contact">
        <h2 id="support-contact" className={styles.sectionTitle}>
          문의 방법
        </h2>
        <ul className={styles.contacts}>
          {CONTACTS.map((c) => (
            <li key={c.title} className={styles.contact}>
              <span className={styles.contactIcon}>{c.icon}</span>
              <strong className={styles.contactTitle}>{c.title}</strong>
              <span className={styles.contactValue}>{c.value}</span>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}

function ServiceCard({ icon, title, description, children }: { icon: ReactNode; title: string; description: string; children: ReactNode }) {
  return (
    <article className={styles.service}>
      <span className={styles.serviceIcon}>{icon}</span>
      <div className={styles.serviceText}>
        <h3 className={styles.serviceTitle}>{title}</h3>
        <p className={styles.serviceDescription}>{description}</p>
      </div>
      {children}
    </article>
  );
}
