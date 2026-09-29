"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Modal } from "@/components/ui/Modal";
import { deleteMessages, markMessageRead, moveMessages, sendMessage } from "@/services/messages/messages";
import { MAILBOXES, MESSAGE_BODY_MAX, SEND_LIMIT_PER_HOUR, type MailboxView, type MessageResult, type Recipient } from "@/services/messages/messageTypes";
import styles from "./messages.module.css";

const when = (iso: string) => new Date(iso).toLocaleString("ko-KR", { month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" });

/** 쪽지 — code-first (no Figma frame). Route `/messages` (`?box=` `?q=` `?page=` `?to=` opens compose). */
export function MessagesScreen({ view, recipients, composeTo }: { view: MailboxView; recipients: Recipient[]; composeTo: string | null }) {
  const router = useRouter();
  const [selected, setSelected] = useState<string[]>([]);
  const [openId, setOpenId] = useState<string | null>(null);
  const [compose, setCompose] = useState(composeTo !== null);
  const [to, setTo] = useState(composeTo ?? "");
  const [body, setBody] = useState("");
  const [message, setMessage] = useState<{ tone: "error" | "ok"; text: string } | null>(null);
  const [pending, startTransition] = useTransition();
  const received = view.box !== "sent";

  const href = (patch: Record<string, string>) => {
    const p = new URLSearchParams({ box: view.box, q: view.q, page: String(view.page), ...patch });
    for (const [k, v] of [...p.entries()]) if (!v || (k === "page" && v === "1") || (k === "box" && v === "inbox")) p.delete(k);
    const s = p.toString();
    return `/messages${s ? `?${s}` : ""}`;
  };

  const run = (action: () => Promise<MessageResult>, ok: string, after?: () => void) => {
    setMessage(null);
    startTransition(async () => {
      const res = await action();
      if (res.status === "SAVED") {
        setMessage({ tone: "ok", text: ok });
        setSelected([]);
        after?.();
        router.refresh();
      } else if (res.status === "UNAUTHORIZED") router.push("/login?next=/messages");
      else if (res.status === "LIMITED") setMessage({ tone: "error", text: `한 시간에 ${SEND_LIMIT_PER_HOUR}통까지 보낼 수 있어요. 잠시 후 다시 시도해 주세요.` });
      else setMessage({ tone: "error", text: res.message });
    });
  };

  const toggle = (id: string) => setSelected((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]));

  return (
    <div className={styles.content}>
      <header className={styles.header}>
        <div>
          <h1 className={styles.title}>쪽지</h1>
          <p className={styles.subtitle}>크리에이터와 주고받은 쪽지를 확인하고 답장할 수 있어요.</p>
        </div>
        <button type="button" className={styles.primary} onClick={() => setCompose(true)}>
          쪽지 보내기
        </button>
      </header>

      <nav className={styles.tabs} aria-label="쪽지함">
        {MAILBOXES.map((b) => (
          <Link key={b.key} href={href({ box: b.key, page: "1", q: "" })} className={styles.tab} aria-current={view.box === b.key ? "page" : undefined}>
            {b.label} <span className={styles.count}>{b.key === "inbox" && view.unread ? `${view.unread} 새 쪽지` : view.counts[b.key]}</span>
          </Link>
        ))}
      </nav>

      <div className={styles.toolbar}>
        <form action="/messages" className={styles.search} role="search">
          <input type="hidden" name="box" value={view.box} />
          <input name="q" defaultValue={view.q} placeholder="내용 또는 이름 검색" aria-label="쪽지 검색" maxLength={40} className={styles.input} />
          <button type="submit" className={styles.ghost}>
            검색
          </button>
        </form>
        {received && (
          <div className={styles.bulk} aria-label="선택한 쪽지">
            {view.box !== "archive" && (
              <button type="button" className={styles.ghost} disabled={!selected.length || pending} onClick={() => run(() => moveMessages({ ids: selected, to: "archive" }), "보관함으로 옮겼어요.")}>
                보관
              </button>
            )}
            {view.box !== "inbox" && (
              <button type="button" className={styles.ghost} disabled={!selected.length || pending} onClick={() => run(() => moveMessages({ ids: selected, to: "inbox" }), "받은 쪽지함으로 옮겼어요.")}>
                받은 쪽지함으로
              </button>
            )}
            {view.box !== "spam" && (
              <button type="button" className={styles.ghost} disabled={!selected.length || pending} onClick={() => run(() => moveMessages({ ids: selected, to: "spam" }), "스팸으로 신고했어요.")}>
                스팸신고
              </button>
            )}
            <button type="button" className={styles.danger} disabled={!selected.length || pending} onClick={() => run(() => deleteMessages(selected), "삭제했어요.")}>
              삭제
            </button>
          </div>
        )}
        {!received && (
          <button type="button" className={styles.danger} disabled={!selected.length || pending} onClick={() => run(() => deleteMessages(selected), "삭제했어요.")}>
            삭제
          </button>
        )}
      </div>

      {message && (
        <p className={message.tone === "error" ? styles.error : styles.ok} role={message.tone === "error" ? "alert" : "status"}>
          {message.text}
        </p>
      )}

      {view.items.length === 0 ? (
        <p className={styles.empty}>{MAILBOXES.find((b) => b.key === view.box)!.label}이 비어 있어요.</p>
      ) : (
        <ul className={styles.list}>
          {view.items.map((m) => (
            <li key={m.id} className={styles.item} data-unread={(!m.read && m.direction === "IN") || undefined}>
              <input type="checkbox" checked={selected.includes(m.id)} onChange={() => toggle(m.id)} aria-label={`${m.peerName} 쪽지 선택`} />
              <button
                type="button"
                className={styles.itemMain}
                aria-expanded={openId === m.id}
                onClick={() => {
                  setOpenId(openId === m.id ? null : m.id);
                  if (!m.read) startTransition(async () => {
                    await markMessageRead(m.id);
                    router.refresh();
                  });
                }}
              >
                <span className={styles.peer}>
                  {m.direction === "IN" ? "보낸 사람" : "받는 사람"} · <strong>{m.peerName}</strong>
                </span>
                <span className={openId === m.id ? styles.bodyOpen : styles.body}>{m.body}</span>
              </button>
              <span className={styles.when}>{when(m.sentAt)}</span>
              {openId === m.id && m.direction === "IN" && (
                <button
                  type="button"
                  className={styles.ghost}
                  onClick={() => {
                    setTo(m.peerId);
                    setCompose(true);
                  }}
                >
                  답장
                </button>
              )}
            </li>
          ))}
        </ul>
      )}

      {view.totalPages > 1 && (
        <nav className={styles.pagination} aria-label="페이지">
          {Array.from({ length: view.totalPages }, (_, i) => i + 1).map((n) => (
            <Link key={n} href={href({ page: String(n) })} className={styles.page} aria-current={n === view.page ? "page" : undefined}>
              {n}
            </Link>
          ))}
        </nav>
      )}

      <Modal
        open={compose}
        onClose={() => setCompose(false)}
        title="쪽지 보내기"
        footer={
          <>
            <button type="button" className={styles.ghostWide} onClick={() => setCompose(false)}>
              취소
            </button>
            <button
              type="button"
              className={styles.primaryWide}
              disabled={pending || !to || !body.trim()}
              onClick={() =>
                run(() => sendMessage({ to, body }), "쪽지를 보냈어요.", () => {
                  setCompose(false);
                  setBody("");
                })
              }
            >
              보내기
            </button>
          </>
        }
      >
        <label className={styles.field}>
          <span>받는 사람</span>
          <select className={styles.input} value={to} onChange={(e) => setTo(e.target.value)}>
            <option value="">선택해 주세요</option>
            {recipients.map((r) => (
              <option key={r.id} value={r.id}>
                {r.name}
              </option>
            ))}
          </select>
        </label>
        <label className={styles.field}>
          <span>내용</span>
          <textarea className={styles.textarea} value={body} maxLength={MESSAGE_BODY_MAX} onChange={(e) => setBody(e.target.value)} />
          <span className={styles.hint}>
            {body.length} / {MESSAGE_BODY_MAX}
          </span>
        </label>
      </Modal>
    </div>
  );
}
