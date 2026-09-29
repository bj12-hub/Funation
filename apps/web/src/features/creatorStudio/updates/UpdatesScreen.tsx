"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { markUpdatesRead } from "@/services/creator/updates";
import { UPDATE_KIND_LABEL, type UpdateItemKind, type UpdatesView } from "@/services/creator/updatesTypes";
import styles from "../crew/crew.module.css";
import local from "./updates.module.css";

const KINDS: UpdateItemKind[] = ["NEW", "IMPROVED", "FIX"];
const date = (d: string) => d.replace(/-/g, ".");

/**
 * 업데이트 소식 — code-first (no Figma frame). Route `/creator/updates`. Posts with 신규 · 개선 ·
 * 버그 수정 counts; unread posts keep their NEW mark for this visit and are marked read on the server.
 */
export function UpdatesScreen({ view }: { view: UpdatesView }) {
  const [open, setOpen] = useState<string | null>(view.posts[0]?.id ?? null);
  useEffect(() => {
    if (view.unreadCount) void markUpdatesRead().catch(() => undefined);
  }, [view.unreadCount]);

  return (
    <div className={styles.content}>
      <header className={styles.header}>
        <h1 className={styles.title}>업데이트 소식</h1>
        <p className={styles.subtitle}>썸네이션의 새로운 기능과 개선 사항을 확인하세요.</p>
      </header>
      {view.posts.length === 0 ? (
        <p className={styles.empty}>아직 소식이 없어요.</p>
      ) : (
        <ul className={local.posts}>
          {view.posts.map((p) => {
            const expanded = open === p.id;
            return (
              <li key={p.id} className={styles.card}>
                <button type="button" className={local.head} aria-expanded={expanded} aria-controls={`${p.id}-body`} onClick={() => setOpen(expanded ? null : p.id)}>
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
                          {UPDATE_KIND_LABEL[k]} {n}
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
                        <section key={k} aria-label={UPDATE_KIND_LABEL[k]}>
                          <h3 className={local.kind} data-kind={k}>
                            {UPDATE_KIND_LABEL[k]}
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
