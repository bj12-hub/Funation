"use client";

import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { formatKst } from "@/lib/format";
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
 * (다시 시도).
 */
export function FlexTvImportCard({ state }: { state: FlexTvImportState }) {
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
          setNote({ ok: true, text: "FlexTV 계정을 연동했어요. 이제 내역을 가져올 수 있어요." });
          router.refresh();
        } else setNote({ ok: false, text: r.status === "UNAUTHORIZED" ? "로그인이 필요합니다." : r.message });
      } catch {
        setNote({ ok: false, text: "연동하지 못했어요. 잠시 후 다시 시도해 주세요." });
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
            FlexTV 후원 내역 가져오기
          </h2>
          {state.supported && state.unverified && (
            <span className={local.verifyBadge} title="실제 FlexTV API로 확인하기 전이에요 (TBD)">
              API 확인 중
            </span>
          )}
        </div>
      </div>
      <p className={styles.desc}>연동한 FlexTV 계정으로 받은 후원 내역을 가져와요. 다시 누르면 지난번 이후에 새로 받은 내역만 가져와요.</p>

      {!state.supported ? (
        <>
          <p className={local.meta}>{FLEXTV_SYNC_ERROR.UNSUPPORTED}</p>
          <div className={local.actions}>
            <button type="button" className={styles.solidPurple} disabled>
              FlexTV 내역 가져오기
            </button>
          </div>
        </>
      ) : !state.linked ? (
        <>
          <p className={local.meta}>FlexTV 계정이 연동되어 있지 않아요. 통합 채팅 · 후원 연동과 같은 연결을 써요.</p>
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
              placeholder="FlexTV 채널 아이디"
              aria-label="FlexTV 채널 아이디"
              maxLength={41}
              disabled={busy !== null}
            />
            <button type="submit" className={styles.solidPurple} disabled={busy !== null || handle.trim().length < 2}>
              {busy === "link" ? "연동하는 중…" : "FlexTV 계정 연동"}
            </button>
          </form>
        </>
      ) : (
        <>
          <div className={local.linkLine}>
            <span>
              연동한 계정: <strong>@{state.linked.handle.replace(/^@/, "")}</strong> · {state.linked.title}
            </span>
          </div>
          <p className={local.meta}>
            {state.lastSyncAt ? `마지막으로 가져온 시각: ${at(state.lastSyncAt)}` : "아직 가져온 적 없어요."}
            {last && ` · ${syncCountsLine(last)}`}
            {last?.hasMore && " · 남은 내역이 있어요"}
          </p>
          {state.lastError && !note && (
            <p className={styles.error} role="status">
              지난번에 다 가져오지 못했어요: {FLEXTV_SYNC_ERROR[state.lastError]}
            </p>
          )}
          <div className={local.actions}>
            <button type="button" className={styles.solidPurple} onClick={sync} disabled={busy !== null}>
              {busy === "sync" ? "가져오는 중…" : retry ? "다시 시도" : "FlexTV 내역 가져오기"}
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
