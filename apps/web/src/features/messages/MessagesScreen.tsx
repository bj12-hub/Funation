"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useRef, useState, useTransition } from "react";
import { Modal } from "@/components/ui/Modal";
import { formatKst } from "@/lib/format";
import { useI18n } from "@/lib/i18n/I18nProvider";
import type { MessageKey } from "@/lib/i18n/translate";
import { deleteMessages, markMessageRead, moveMessages, sendMessage } from "@/services/messages/messages";
import {
  MAILBOXES,
  MESSAGE_BODY_MAX,
  MESSAGE_PAGE_SIZE,
  MESSAGE_PAGE_SIZES,
  SEND_LIMIT_PER_HOUR,
  type Mailbox,
  type MailboxView,
  type MessageResult,
  type Recipient
} from "@/services/messages/messageTypes";
import { ModerationActions } from "../moderation/ModerationActions";
import styles from "./messages.module.css";

const when = (iso: string) => formatKst(iso, { month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" });

/** Mailbox names and what an empty one says, in the viewer's language (2026-11-01; Korean as MAILBOXES · mailboxEmptyText). */
const BOX_KEY: Record<Mailbox, { label: MessageKey; empty: MessageKey }> = {
  inbox: { label: "messages.inbox", empty: "messages.emptyInbox" },
  sent: { label: "messages.sent", empty: "messages.emptySent" },
  archive: { label: "messages.archive", empty: "messages.emptyArchive" },
  spam: { label: "messages.spam", empty: "messages.emptySpam" }
};

/** 쪽지 — code-first (no Figma frame). Route `/messages` (`?box=` `?q=` `?page=` `?size=` `?to=` opens compose). */
export function MessagesScreen({ view, recipients, composeTo }: { view: MailboxView; recipients: Recipient[]; composeTo: string | null }) {
  const { t } = useI18n();
  const router = useRouter();
  const [selected, setSelected] = useState<string[]>([]);
  const [openId, setOpenId] = useState<string | null>(null);
  const [compose, setCompose] = useState(composeTo !== null);
  const [to, setTo] = useState(composeTo ?? "");
  const [body, setBody] = useState("");
  const [message, setMessage] = useState<{ tone: "error" | "ok"; text: string } | null>(null);
  const [pending, startTransition] = useTransition();
  // 쪽지 보내기: the same recipient and text after a failed or lost submit keeps its request id (sent once); a change gets a new one.
  const sendId = useRef<{ id: string; text: string } | null>(null);
  const received = view.box !== "sent";

  const href = (patch: Record<string, string>) => {
    const p = new URLSearchParams({ box: view.box, q: view.q, page: String(view.page), size: String(view.size), ...patch });
    for (const [k, v] of [...p.entries()])
      if (!v || (k === "page" && v === "1") || (k === "box" && v === "inbox") || (k === "size" && v === String(MESSAGE_PAGE_SIZE))) p.delete(k);
    const s = p.toString();
    return `/messages${s ? `?${s}` : ""}`;
  };

  const run = (action: () => Promise<MessageResult>, ok: string, after?: () => void) => {
    setMessage(null);
    startTransition(async () => {
      try {
        const res = await action();
        if (res.status === "SAVED") {
          setMessage({ tone: "ok", text: ok });
          setSelected([]);
          after?.();
          router.refresh();
        } else if (res.status === "UNAUTHORIZED") router.push("/login?next=/messages");
        else if (res.status === "LIMITED") setMessage({ tone: "error", text: t("messages.limited", { limit: SEND_LIMIT_PER_HOUR }) });
        else setMessage({ tone: "error", text: res.message });
      } catch {
        // The request failed (network / server): the selection and the draft stay for another try.
        setMessage({ tone: "error", text: t("page.errorDescription") });
      }
    });
  };

  const openCompose = () => {
    setMessage(null);
    setCompose(true);
  };
  const toggle = (id: string) => setSelected((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]));

  return (
    <div className={styles.content}>
      <header className={styles.header}>
        <div>
          <h1 className={styles.title}>{t("messages.title")}</h1>
          <p className={styles.subtitle}>{t("messages.subtitle")}</p>
        </div>
        <button type="button" className={styles.primary} onClick={openCompose}>
          {t("messages.compose")}
        </button>
      </header>

      <nav className={styles.tabs} aria-label={t("messages.boxes")}>
        {MAILBOXES.map((b) => (
          <Link key={b.key} href={href({ box: b.key, page: "1", q: "" })} className={styles.tab} aria-current={view.box === b.key ? "page" : undefined}>
            {t(BOX_KEY[b.key].label)} <span className={styles.count}>{b.key === "inbox" && view.unread ? t("messages.newCount", { count: view.unread }) : view.counts[b.key]}</span>
          </Link>
        ))}
      </nav>

      <div className={styles.toolbar}>
        <form action="/messages" className={styles.search} role="search">
          <input type="hidden" name="box" value={view.box} />
          {view.size !== MESSAGE_PAGE_SIZE && <input type="hidden" name="size" value={view.size} />}
          <input name="q" defaultValue={view.q} placeholder={t("messages.searchPlaceholder")} aria-label={t("messages.searchAria")} maxLength={40} className={styles.input} />
          <button type="submit" className={styles.ghost}>
            {t("common.search")}
          </button>
        </form>
        {received && (
          <div className={styles.bulk} aria-label={t("messages.selected")}>
            {view.box !== "archive" && (
              <button type="button" className={styles.ghost} disabled={!selected.length || pending} onClick={() => run(() => moveMessages({ ids: selected, to: "archive" }), t("messages.archived"))}>
                {t("messages.archiveAction")}
              </button>
            )}
            {view.box !== "inbox" && (
              <button type="button" className={styles.ghost} disabled={!selected.length || pending} onClick={() => run(() => moveMessages({ ids: selected, to: "inbox" }), t("messages.movedToInbox"))}>
                {t("messages.toInbox")}
              </button>
            )}
            {view.box !== "spam" && (
              <button type="button" className={styles.ghost} disabled={!selected.length || pending} onClick={() => run(() => moveMessages({ ids: selected, to: "spam" }), t("messages.reportedSpam"))}>
                {t("messages.reportSpam")}
              </button>
            )}
            <button type="button" className={styles.danger} disabled={!selected.length || pending} onClick={() => run(() => deleteMessages(selected), t("messages.deleted"))}>
              {t("messages.delete")}
            </button>
          </div>
        )}
        {!received && (
          <button type="button" className={styles.danger} disabled={!selected.length || pending} onClick={() => run(() => deleteMessages(selected), t("messages.deleted"))}>
            {t("messages.delete")}
          </button>
        )}
      </div>

      {message && !compose && (
        <p className={message.tone === "error" ? styles.error : styles.ok} role={message.tone === "error" ? "alert" : "status"}>
          {message.text}
        </p>
      )}

      {view.items.length === 0 ? (
        <p className={styles.empty}>{view.q ? t("messages.noResults") : t(BOX_KEY[view.box].empty)}</p>
      ) : (
        <ul className={styles.list}>
          {view.items.map((m) => (
            <li key={m.id} className={styles.item} data-unread={(!m.read && m.direction === "IN") || undefined}>
              <input type="checkbox" checked={selected.includes(m.id)} onChange={() => toggle(m.id)} aria-label={t("messages.select", { name: m.peerName })} />
              <button
                type="button"
                className={styles.itemMain}
                aria-expanded={openId === m.id}
                onClick={() => {
                  setOpenId(openId === m.id ? null : m.id);
                  if (!m.read)
                    startTransition(async () => {
                      try {
                        await markMessageRead(m.id);
                        router.refresh();
                      } catch {
                        // The message stays open; it is marked read on a later try.
                        setMessage({ tone: "error", text: t("page.errorDescription") });
                      }
                    });
                }}
              >
                <span className={styles.peer}>
                  {m.direction === "IN" ? t("messages.from") : t("messages.to")} · <strong>{m.peerName}</strong>
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
                    openCompose();
                  }}
                >
                  {t("messages.reply")}
                </button>
              )}
              {openId === m.id && m.direction === "IN" && <ModerationActions target={{ type: "MESSAGE", id: m.id }} signedIn />}
            </li>
          ))}
        </ul>
      )}

      {view.total > MESSAGE_PAGE_SIZES[0] && (
        <div className={styles.listFooter}>
          <nav className={styles.sizes} aria-label={t("messages.perPage")}>
            {MESSAGE_PAGE_SIZES.map((n) => (
              <Link key={n} href={href({ size: String(n), page: "1" })} className={styles.size} aria-current={n === view.size ? "true" : undefined}>
                {t("messages.sizeN", { n })}
              </Link>
            ))}
          </nav>
          {view.totalPages > 1 && (
            <nav className={styles.pagination} aria-label={t("messages.pages")}>
              {Array.from({ length: view.totalPages }, (_, i) => i + 1).map((n) => (
                <Link key={n} href={href({ page: String(n) })} className={styles.page} aria-current={n === view.page ? "page" : undefined}>
                  {n}
                </Link>
              ))}
            </nav>
          )}
        </div>
      )}

      <Modal
        open={compose}
        onClose={() => setCompose(false)}
        title={t("messages.compose")}
        footer={
          <>
            <button type="button" className={styles.ghostWide} onClick={() => setCompose(false)}>
              {t("messages.cancel")}
            </button>
            <button
              type="button"
              className={styles.primaryWide}
              disabled={pending || !to || !body.trim()}
              onClick={() => {
                const text = `${to}\n${body.trim()}`;
                if (sendId.current?.text !== text) sendId.current = { id: crypto.randomUUID(), text };
                const id = sendId.current.id;
                run(() => sendMessage({ to, body, requestId: id }), t("messages.sentOk"), () => {
                  setCompose(false);
                  setBody("");
                  sendId.current = null;
                });
              }}
            >
              {t("messages.send")}
            </button>
          </>
        }
      >
        <label className={styles.field}>
          <span>{t("messages.to")}</span>
          <select className={styles.input} value={to} onChange={(e) => setTo(e.target.value)}>
            <option value="">{t("messages.chooseRecipient")}</option>
            {recipients.map((r) => (
              <option key={r.id} value={r.id}>
                {r.name}
              </option>
            ))}
          </select>
        </label>
        <label className={styles.field}>
          <span>{t("messages.body")}</span>
          <textarea className={styles.textarea} value={body} maxLength={MESSAGE_BODY_MAX} onChange={(e) => setBody(e.target.value)} />
          <span className={styles.hint}>
            {body.length} / {MESSAGE_BODY_MAX}
          </span>
        </label>
        {/* The page behind the open dialog is inert, so a failed send says so here. */}
        {message?.tone === "error" && (
          <p className={styles.error} role="alert">
            {message.text}
          </p>
        )}
      </Modal>
    </div>
  );
}
