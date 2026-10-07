"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { deleteFaq, deleteNotice, saveFaq, saveNotice } from "@/lib/actions";
import { FAQ_LIMITS, NOTICE_LIMITS, type ActionResult, FAQ_CATEGORIES, NOTICE_CATEGORY_LABEL, type FaqItem, type Notice, type NoticeCategory } from "@/types/adminApi";
import { SITE_URL } from "@/lib/siteUrl";
import styles from "../admin.module.css";

/**
 * `requestId`: one per opened new draft (null when editing), so a retry of that draft is created once and nothing else
 * (another draft, the other tab) ever reuses it.
 */
type NoticeDraft = { id: string | null; requestId: string | null; category: NoticeCategory; important: boolean; title: string; summary: string; body: string };
type FaqDraft = { id: string | null; requestId: string | null; category: FaqItem["category"]; question: string; answer: string; linkHref: string; linkLabel: string };

const faqLabel = (k: FaqItem["category"]) => FAQ_CATEGORIES.find((c) => c.key === k)?.label ?? k;

const ERROR_TEXT = {
  NOT_FOUND: "항목을 찾을 수 없어요.",
  UNAUTHORIZED: "관리자 로그인이 필요합니다.",
  UNAVAILABLE: "사이트에 연결할 수 없어요. 잠시 후 다시 시도해 주세요.",
  CONFLICT: "이 글은 이미 다른 내용으로 저장됐어요. 목록을 확인한 뒤 새로 작성해 주세요."
} as const;

/** 콘텐츠 관리 — code-first. Route `/content`. The 고객센터 shows changes immediately. */
export function ContentManager({ tab, notices, faqs }: { tab: "notices" | "faq"; notices: Notice[]; faqs: FaqItem[] }) {
  const router = useRouter();
  const [noticeDraft, setNoticeDraft] = useState<NoticeDraft | null>(null);
  const [faqDraft, setFaqDraft] = useState<FaqDraft | null>(null);
  const [msg, setMsg] = useState<{ tone: "ok" | "error"; text: string } | null>(null);
  const [pending, startTransition] = useTransition();

  const run = (action: () => Promise<ActionResult>, ok: string, after?: () => void) => {
    setMsg(null);
    startTransition(async () => {
      try {
        const res = await action();
        if (res.status === "OK") {
          setMsg({ tone: "ok", text: ok });
          after?.();
          router.refresh();
        } else setMsg({ tone: "error", text: res.status === "INVALID" ? res.message : ERROR_TEXT[res.status] });
      } catch {
        setMsg({ tone: "error", text: "저장하지 못했어요. 잠시 후 다시 시도해 주세요." });
      }
    });
  };

  return (
    <div className={styles.content}>
      <header className={styles.pageHead}>
        <h1 className={styles.title}>콘텐츠 관리</h1>
        <p className={styles.muted}>고객센터의 공지사항과 자주 묻는 질문을 관리해요. 저장하면 사이트에 바로 반영되고, 모든 변경은 감사 로그에 남아요. 새 공지는 회원에게 사이트 알림으로도 가요.</p>
      </header>
      <nav className={styles.tabs} aria-label="콘텐츠 종류">
        <Link href="/content" className={styles.tab} aria-current={tab === "notices" ? "page" : undefined}>
          공지사항 {notices.length}
        </Link>
        <Link href="/content?tab=faq" className={styles.tab} aria-current={tab === "faq" ? "page" : undefined}>
          자주 묻는 질문 {faqs.length}
        </Link>
      </nav>

      {tab === "notices" ? (
        <>
          {noticeDraft ? (
            <section className={styles.card} aria-labelledby="ct-notice-edit">
              <h2 id="ct-notice-edit" className={styles.cardTitle}>
                {noticeDraft.id ? "공지 수정" : "새 공지"}
              </h2>
              <div className={styles.filters}>
                <select className={styles.input} aria-label="분류" value={noticeDraft.category} onChange={(e) => setNoticeDraft({ ...noticeDraft, category: e.target.value as NoticeCategory })}>
                  {(Object.keys(NOTICE_CATEGORY_LABEL) as NoticeCategory[]).map((k) => (
                    <option key={k} value={k}>
                      {NOTICE_CATEGORY_LABEL[k]}
                    </option>
                  ))}
                </select>
                <label className={styles.check}>
                  <input type="checkbox" checked={noticeDraft.important} onChange={(e) => setNoticeDraft({ ...noticeDraft, important: e.target.checked })} />
                  중요 (맨 위 고정)
                </label>
              </div>
              <input className={styles.input} aria-label="제목" placeholder="제목" maxLength={NOTICE_LIMITS.title} value={noticeDraft.title} onChange={(e) => setNoticeDraft({ ...noticeDraft, title: e.target.value })} />
              <input className={styles.input} aria-label="요약" placeholder="목록에 보이는 요약" maxLength={NOTICE_LIMITS.summary} value={noticeDraft.summary} onChange={(e) => setNoticeDraft({ ...noticeDraft, summary: e.target.value })} />
              <textarea className={styles.textarea} rows={8} aria-label="본문" placeholder="본문 (빈 줄로 문단을 나눠요)" maxLength={NOTICE_LIMITS.body} value={noticeDraft.body} onChange={(e) => setNoticeDraft({ ...noticeDraft, body: e.target.value })} />
              <div className={styles.filters}>
                <button type="button" className={styles.button} disabled={pending} onClick={() => setNoticeDraft(null)}>
                  취소
                </button>
                <button
                  type="button"
                  className={styles.button}
                  disabled={pending}
                  onClick={() => run(() => saveNotice(noticeDraft), noticeDraft.id ? "공지를 수정했어요." : "공지를 등록했어요.", () => setNoticeDraft(null))}
                >
                  {pending ? "저장 중…" : "저장"}
                </button>
              </div>
            </section>
          ) : (
            <div>
              <button type="button" className={styles.button} onClick={() => setNoticeDraft({ id: null, requestId: crypto.randomUUID(), category: "GENERAL", important: false, title: "", summary: "", body: "" })}>
                + 새 공지
              </button>
            </div>
          )}
          <section className={styles.card}>
            {notices.length === 0 ? (
              <p className={styles.empty}>등록된 공지사항이 없어요.</p>
            ) : (
              <table className={styles.table}>
                <thead>
                  <tr>
                    <th scope="col">분류</th>
                    <th scope="col">제목</th>
                    <th scope="col">날짜</th>
                    <th scope="col">조회</th>
                    <th scope="col">관리</th>
                  </tr>
                </thead>
                <tbody>
                  {notices.map((n) => (
                    <tr key={n.id}>
                      <td>
                        {NOTICE_CATEGORY_LABEL[n.category]}
                        {n.important && <span className={styles.chipWarn}> 중요</span>}
                      </td>
                      <td>
                        <a href={`${SITE_URL}/support/notices/${n.id}`} className={styles.rowLink} target="_blank" rel="noreferrer">
                          {n.title}
                        </a>
                      </td>
                      <td>{n.date}</td>
                      <td>{n.views}</td>
                      <td className={styles.rowActions}>
                        <button type="button" className={styles.button} onClick={() => setNoticeDraft({ id: n.id, requestId: null, category: n.category, important: n.important, title: n.title, summary: n.summary, body: n.body.join("\n\n") })}>
                          수정
                        </button>
                        <button type="button" className={styles.danger} disabled={pending} onClick={() => window.confirm(`'${n.title}' 공지를 삭제할까요?`) && run(() => deleteNotice(n.id), "공지를 삭제했어요.")}>
                          삭제
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </section>
        </>
      ) : (
        <>
          {faqDraft ? (
            <section className={styles.card} aria-labelledby="ct-faq-edit">
              <h2 id="ct-faq-edit" className={styles.cardTitle}>
                {faqDraft.id ? "FAQ 수정" : "새 FAQ"}
              </h2>
              <select className={styles.input} aria-label="분류" value={faqDraft.category} onChange={(e) => setFaqDraft({ ...faqDraft, category: e.target.value as FaqItem["category"] })}>
                {FAQ_CATEGORIES.map((c) => (
                  <option key={c.key} value={c.key}>
                    {c.label}
                  </option>
                ))}
              </select>
              <input className={styles.input} aria-label="질문" placeholder="질문" maxLength={FAQ_LIMITS.question} value={faqDraft.question} onChange={(e) => setFaqDraft({ ...faqDraft, question: e.target.value })} />
              <textarea className={styles.textarea} rows={5} aria-label="답변" placeholder="답변 (비워 두면 '답변 준비 중'으로 보여요 — 정책 미정 항목)" maxLength={FAQ_LIMITS.answer} value={faqDraft.answer} onChange={(e) => setFaqDraft({ ...faqDraft, answer: e.target.value })} />
              <div className={styles.filters}>
                <input className={styles.input} aria-label="링크 주소" placeholder="링크 주소 (선택, /로 시작)" value={faqDraft.linkHref} onChange={(e) => setFaqDraft({ ...faqDraft, linkHref: e.target.value })} />
                <input className={styles.input} aria-label="링크 이름" placeholder="링크 이름" maxLength={FAQ_LIMITS.linkLabel} value={faqDraft.linkLabel} onChange={(e) => setFaqDraft({ ...faqDraft, linkLabel: e.target.value })} />
              </div>
              <div className={styles.filters}>
                <button type="button" className={styles.button} disabled={pending} onClick={() => setFaqDraft(null)}>
                  취소
                </button>
                <button
                  type="button"
                  className={styles.button}
                  disabled={pending}
                  onClick={() => run(() => saveFaq(faqDraft), faqDraft.id ? "FAQ를 수정했어요." : "FAQ를 등록했어요.", () => setFaqDraft(null))}
                >
                  {pending ? "저장 중…" : "저장"}
                </button>
              </div>
            </section>
          ) : (
            <div>
              <button type="button" className={styles.button} onClick={() => setFaqDraft({ id: null, requestId: crypto.randomUUID(), category: "GENERAL", question: "", answer: "", linkHref: "", linkLabel: "" })}>
                + 새 FAQ
              </button>
            </div>
          )}
          <section className={styles.card}>
            {faqs.length === 0 ? (
              <p className={styles.empty}>등록된 자주 묻는 질문이 없어요.</p>
            ) : (
              <table className={styles.table}>
                <thead>
                  <tr>
                    <th scope="col">분류</th>
                    <th scope="col">질문</th>
                    <th scope="col">답변</th>
                    <th scope="col">관리</th>
                  </tr>
                </thead>
                <tbody>
                  {faqs.map((f) => (
                    <tr key={f.id}>
                      <td>{faqLabel(f.category)}</td>
                      <td>{f.question}</td>
                      <td>{f.answer ? "작성됨" : <span className={styles.warn}>준비 중</span>}</td>
                      <td className={styles.rowActions}>
                        <button
                          type="button"
                          className={styles.button}
                          onClick={() => setFaqDraft({ id: f.id, requestId: null, category: f.category, question: f.question, answer: f.answer ?? "", linkHref: f.link?.href ?? "", linkLabel: f.link?.label ?? "" })}
                        >
                          수정
                        </button>
                        <button type="button" className={styles.danger} disabled={pending} onClick={() => window.confirm(`'${f.question}' FAQ를 삭제할까요?`) && run(() => deleteFaq(f.id), "FAQ를 삭제했어요.")}>
                          삭제
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </section>
        </>
      )}
      {msg && (
        <p className={msg.tone === "error" ? styles.error : styles.ok} role={msg.tone === "error" ? "alert" : "status"}>
          {msg.text}
        </p>
      )}
    </div>
  );
}
