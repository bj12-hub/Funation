"use client";

import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { formatKst } from "@/lib/format";
import { useI18n } from "@/lib/i18n/I18nProvider";
import { connectBroadcastChannel } from "@/services/broadcast/unifiedChat";
import { syncFlexTvDonations } from "@/services/creator/donationImport";
import { FLEXTV_SYNC_ERROR, syncCountsLine, syncMessage, type FlexTvImportState } from "@/services/creator/donationImportTypes";
import styles from "./donations.module.css";
import local from "./importTab.module.css";

const at = (iso: string) => formatKst(iso, { dateStyle: "medium", timeStyle: "short" });

/**
 * FlexTV 후원 내역 가져오기 — code-first (no Figma frame). Uses the FlexTV account linked for 통합 채팅 · 후원 연동 (the
 * same link; "FlexTV 계정 연동" here is that mock connect, no real OAuth), then imports the channel's received-donation
 * history after the last position. States: 지원 안 함 · 연동 안 됨 · 연동됨 (마지막 가져온 시각 · 결과) · 가져오는 중 · 실패
 * (다시 시도). The services' sync and error messages show as written; the unlink note stays Korean (retention, TBD).
 */
export function FlexTvImportCard({ state }: { state: FlexTvImportState }) {
  const { t } = useI18n();
  const router = useRouter();
  const [handle, setHandle] = useState("");
  const [busy, setBusy] = useState<null | "link" | "sync">(null);
  const [note, setNote] = useState<{ ok: boolean; text: string } | null>(null);
  const [retry, setRetry] = useState(false);
  const lock = useRef(false);

  const guard = async (kind: "link" | "sync", call: () => Promise<void>) => {
    if (lock.current) return;
    lock.current = true;
    setBusy(kind);
    try {
      await call();
    } finally {
      lock.current = false;
      setBusy(null);
    }
  };

  const link = () =>
    guard("link", async () => {
      setNote(null);
      try {
        const r = await connectBroadcastChannel({ platform: "FLEXTV", handle });
        if (r.status === "OK") {
          setNote({ ok: true, text: t("studioDonationsImport.flexLinked") });
          router.refresh();
        } else setNote({ ok: false, text: r.status === "UNAUTHORIZED" ? t("studioDonationsImport.loginRequired") : r.message });
      } catch {
        setNote({ ok: false, text: t("studioDonationsImport.linkFailed") });
      }
    });

  const sync = () =>
    guard("sync", async () => {
      setNote(null);
      try {
        const r = await syncFlexTvDonations();
        setNote(syncMessage(r));
        setRetry(r.status === "FAILED" && r.code !== "UNSUPPORTED");
        router.refresh();
      } catch {
        setNote({ ok: false, text: FLEXTV_SYNC_ERROR.UNAVAILABLE });
        setRetry(true);
      }
    });

  const last = state.lastResult;

  return (
    <section className={styles.card} aria-labelledby="import-flextv">
      <div className={local.cardHead}>
        <div className={local.cardHeadTitle}>
          <h2 className={styles.cardTitle} id="import-flextv">
            {t("studioDonationsImport.flexTitle")}
          </h2>
          {state.supported && state.unverified && (
            <span className={local.verifyBadge} title={t("studioDonationsImport.apiUnverifiedTitle")}>
              {t("studioDonationsImport.apiUnverified")}
            </span>
          )}
        </div>
      </div>
      <p className={styles.desc}>{t("studioDonationsImport.flexDesc")}</p>

      {!state.supported ? (
        <>
          <p className={local.meta}>{FLEXTV_SYNC_ERROR.UNSUPPORTED}</p>
          <div className={local.actions}>
            <button type="button" className={styles.solidPurple} disabled>
              {t("studioDonationsImport.flexImport")}
            </button>
          </div>
        </>
      ) : !state.linked ? (
        <>
          <p className={local.meta}>{t("studioDonationsImport.notLinked")}</p>
          <form
            className={local.linkLine}
            onSubmit={(e) => {
              e.preventDefault();
              link();
            }}
          >
            <input
              className={local.handleInput}
              value={handle}
              onChange={(e) => setHandle(e.target.value)}
              placeholder={t("studioDonationsImport.channelId")}
              aria-label={t("studioDonationsImport.channelId")}
              maxLength={41}
              disabled={busy !== null}
            />
            <button type="submit" className={styles.solidPurple} disabled={busy !== null || handle.trim().length < 2}>
              {busy === "link" ? t("studioDonationsImport.linking") : t("studioDonationsImport.linkAccount")}
            </button>
          </form>
        </>
      ) : (
        <>
          <div className={local.linkLine}>
            <span>
              {t("studioDonationsImport.linkedAccount")} <strong>@{state.linked.handle.replace(/^@/, "")}</strong> · {state.linked.title}
            </span>
          </div>
          <p className={local.meta}>
            {state.lastSyncAt ? t("studioDonationsImport.lastSync", { at: at(state.lastSyncAt) }) : t("studioDonationsImport.neverSynced")}
            {last && ` · ${syncCountsLine(last)}`}
            {last?.hasMore && t("studioDonationsImport.hasMore")}
          </p>
          {state.lastError && !note && (
            <p className={styles.error} role="status">
              {t("studioDonationsImport.lastError", { error: FLEXTV_SYNC_ERROR[state.lastError] })}
            </p>
          )}
          <div className={local.actions}>
            <button type="button" className={styles.solidPurple} onClick={sync} disabled={busy !== null}>
              {busy === "sync" ? t("studioDonationsImport.importing") : retry ? t("studioDonationsImport.retry") : t("studioDonationsImport.flexImport")}
            </button>
          </div>
        </>
      )}

      {note && (
        <p className={note.ok ? styles.ok : styles.error} role={note.ok ? "status" : "alert"}>
          {note.text}
        </p>
      )}
      <p className={local.limits}>연동을 해제해도 가져온 내역은 남아요 (기본값 · TBD). 지우려면 아래 가져온 기록에서 되돌리기를 눌러 주세요.</p>
    </section>
  );
}
