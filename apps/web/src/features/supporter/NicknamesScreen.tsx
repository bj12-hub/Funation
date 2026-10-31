"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { formatNumber } from "@/lib/format";
import { useI18n } from "@/lib/i18n/I18nProvider";
import { addDonationNickname, removeDonationNickname, renameDonationNickname, setDefaultDonationNickname } from "@/services/supporter/identity";
import { MAX_NICKNAMES, type DonationNickname, type IdentitySaveResult } from "@/services/supporter/identityTypes";
import styles from "./supporter.module.css";

/**
 * 별명 관리 — code-first (no Figma frame). Route `/mypage/nicknames`. Stats come from the server. 별명 누적 후원 · 별명 후원
 * 횟수 are the 별명 totals, which leave 익명 donations out (2026-10-09 결정), so they can be below the wallet's or the
 * 누적 등급's totals — the labels say "별명" for that.
 */
export function NicknamesScreen({ nicknames }: { nicknames: DonationNickname[] }) {
  const { t } = useI18n();
  const router = useRouter();
  const [newName, setNewName] = useState("");
  const [editing, setEditing] = useState<{ id: string; name: string } | null>(null);
  const [message, setMessage] = useState<{ tone: "error" | "ok"; text: string } | null>(null);
  const [pending, startTransition] = useTransition();
  const totalFn = nicknames.reduce((s, n) => s + n.totalFn, 0);
  const totalCount = nicknames.reduce((s, n) => s + n.count, 0);

  const run = (action: () => Promise<IdentitySaveResult>, ok: string, after?: () => void) => {
    setMessage(null);
    startTransition(async () => {
      try {
        const res = await action();
        if (res.status === "SAVED") {
          setMessage({ tone: "ok", text: ok });
          after?.();
          router.refresh();
        } else if (res.status === "UNAUTHORIZED") router.push("/login?next=/mypage/nicknames");
        else setMessage({ tone: "error", text: res.message });
      } catch {
        // The typed name stays (`after` only runs on SAVED), so the member can try again.
        setMessage({ tone: "error", text: t("my.genericError") });
      }
    });
  };

  return (
    <div className={styles.content}>
      <nav className={styles.breadcrumb} aria-label={t("my.breadcrumb")}>
        <Link href="/mypage">{t("common.myPage")}</Link> <span aria-hidden="true">›</span> <span aria-current="page">{t("myNicknames.title")}</span>
      </nav>
      <header className={styles.header}>
        <h1 className={styles.title}>{t("myNicknames.title")}</h1>
        <p className={styles.subtitle}>{t("myNicknames.subtitle")}</p>
      </header>

      <dl className={styles.stats}>
        <div>
          <dt>{t("myNicknames.total")}</dt>
          <dd>{formatNumber(totalFn)} FN</dd>
        </div>
        <div>
          <dt>{t("myNicknames.count")}</dt>
          <dd>{t("myNicknames.times", { count: formatNumber(totalCount) })}</dd>
        </div>
        <div>
          <dt>{t("myNicknames.registered")}</dt>
          <dd>
            {nicknames.length} / {MAX_NICKNAMES}
          </dd>
        </div>
      </dl>

      <form
        className={styles.addRow}
        onSubmit={(e) => {
          e.preventDefault();
          run(() => addDonationNickname(newName), t("myNicknames.added"), () => setNewName(""));
        }}
      >
        <input
          className={styles.input}
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          placeholder={t("myNicknames.newPlaceholder")}
          maxLength={12}
          aria-label={t("myNicknames.newLabel")}
          disabled={nicknames.length >= MAX_NICKNAMES}
        />
        <button type="submit" className={styles.primary} disabled={pending || !newName.trim() || nicknames.length >= MAX_NICKNAMES}>
          {t("myNicknames.add")}
        </button>
      </form>
      {message && (
        <p className={message.tone === "error" ? styles.error : styles.ok} role={message.tone === "error" ? "alert" : "status"}>
          {message.text}
        </p>
      )}

      <ul className={styles.list}>
        {nicknames.map((n) => (
          <li key={n.id} className={styles.row}>
            <div className={styles.rowMain}>
              {editing?.id === n.id ? (
                <input
                  className={styles.input}
                  value={editing.name}
                  maxLength={12}
                  onChange={(e) => setEditing({ id: n.id, name: e.target.value })}
                  aria-label={t("myNicknames.renameLabel", { name: n.name })}
                  autoFocus
                />
              ) : (
                <strong className={styles.rowTitle}>
                  {n.name} {n.isDefault && <span className={styles.chip}>{t("myNicknames.main")}</span>}
                </strong>
              )}
              <span className={styles.muted}>
                {t("myNicknames.stats", { fn: formatNumber(n.totalFn), count: formatNumber(n.count) })}
              </span>
            </div>
            <div className={styles.rowActions}>
              {editing?.id === n.id ? (
                <>
                  <button type="button" className={styles.ghost} onClick={() => setEditing(null)}>
                    {t("my.cancel")}
                  </button>
                  <button type="button" className={styles.primary} disabled={pending} onClick={() => run(() => renameDonationNickname(n.id, editing.name), t("myNicknames.renamed"), () => setEditing(null))}>
                    {t("my.save")}
                  </button>
                </>
              ) : (
                <>
                  {!n.isDefault && (
                    <button type="button" className={styles.ghost} disabled={pending} onClick={() => run(() => setDefaultDonationNickname(n.id), t("myNicknames.mainChanged"))}>
                      {t("myNicknames.makeMain")}
                    </button>
                  )}
                  {n.id !== "nk-default" && (
                    <>
                      <button type="button" className={styles.ghost} onClick={() => setEditing({ id: n.id, name: n.name })}>
                        {t("myNicknames.rename")}
                      </button>
                      <button type="button" className={styles.danger} disabled={pending} onClick={() => run(() => removeDonationNickname(n.id), t("myNicknames.removed"))}>
                        {t("myNicknames.remove")}
                      </button>
                    </>
                  )}
                </>
              )}
            </div>
          </li>
        ))}
      </ul>
      <p className={styles.note}>{t("myNicknames.defaultNote")}</p>
      <p className={styles.note}>{t("myNicknames.anonymousNote")}</p>
    </div>
  );
}
