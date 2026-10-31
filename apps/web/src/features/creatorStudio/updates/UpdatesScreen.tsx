"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useI18n } from "@/lib/i18n/I18nProvider";
import type { MessageKey } from "@/lib/i18n/translate";
import { markUpdatesRead } from "@/services/creator/updates";
import type { UpdateItemKind, UpdatesView } from "@/services/creator/updatesTypes";
import styles from "../crew/crew.module.css";
import local from "./updates.module.css";

const KINDS: UpdateItemKind[] = ["NEW", "IMPROVED", "FIX"];
const date = (d: string) => d.replace(/-/g, ".");
/** UPDATE_KIND_LABEL in the viewer's language (2026-11-01). The posts themselves are content and stay as written. */
const KIND_KEYS: Record<UpdateItemKind, MessageKey> = { NEW: "studioUpdates.kindNew", IMPROVED: "studioUpdates.kindImproved", FIX: "studioUpdates.kindFix" };

/**
 * 업데이트 소식 — code-first (no Figma frame). Route `/creator/updates`. Posts with 신규 · 개선 ·
 * 버그 수정 counts; unread posts keep their NEW mark for this visit and are marked read on the server.
 */
export function UpdatesScreen({ view }: { view: UpdatesView }) {
  const { t } = useI18n();
  const [open, setOpen] = useState<string | null>(view.posts[0]?.id ?? null);
  useEffect(() => {
    if (view.unreadCount) void markUpdatesRead().catch(() => undefined);
  }, [view.unreadCount]);

  return (
    <div className={styles.content}>
      <header className={styles.header}>
        <h1 className={styles.title}>{t("studioUpdates.title")}</h1>
        <p className={styles.subtitle}>{t("studioUpdates.subtitle")}</p>
      </header>
      {view.posts.length === 0 ? (
        <p className={styles.empty}>{t("studioUpdates.empty")}</p>
      ) : (
        <ul className={local.posts}>
          {view.posts.map((p) => {
            const expanded = open === p.id;
            return (
              <li key={p.id} className={styles.card}>
                <button type="button" className={local.head} aria-expanded={expanded} aria-controls={expanded ? `${p.id}-body` : undefined} onClick={() => setOpen(expanded ? null : p.id)}>
                  <span className={local.titleRow}>
                    {p.unread && <span className={local.new}>NEW</span>}
                    <strong className={styles.cardTitle}>{p.title}</strong>
                  </span>
                  <span className={styles.muted}>{p.summary}</span>
                  <span className={local.meta}>
                    {KINDS.map((k) => {
                      const n = p.items.filter((i) => i.kind === k).length;
                      return n ? (
                        <span key={k} className={local.count} data-kind={k}>
                          {t(KIND_KEYS[k])} {n}
                        </span>
                      ) : null;
                    })}
                    <span className={styles.note}>{date(p.date)}</span>
                  </span>
                </button>
                {expanded && (
                  <div id={`${p.id}-body`} className={local.body}>
                    {KINDS.map((k) => {
                      const items = p.items.filter((i) => i.kind === k);
                      if (!items.length) return null;
                      return (
                        <section key={k} aria-label={t(KIND_KEYS[k])}>
                          <h3 className={local.kind} data-kind={k}>
                            {t(KIND_KEYS[k])}
                          </h3>
                          <ul>
                            {items.map((i) => (
                              <li key={i.text}>{i.href ? <Link href={i.href}>{i.text}</Link> : i.text}</li>
                            ))}
                          </ul>
                        </section>
                      );
                    })}
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
