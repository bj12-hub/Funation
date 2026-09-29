"use client";

import { useRef, useState } from "react";
import { formatNumber } from "@/lib/format";
import { assignFeedEntry, cancelFeedEntry, setAssignMode, setMemberKeywords, simulateDonation, startOneshot, stopOneshot } from "@/services/crew/crewFeed";
import { KEYWORDS_PER_MEMBER, type BroadcastResult, type CrewMember, type FeedEntry, type FeedStatus, type FeedView } from "@/services/crew/crewTypes";
import styles from "./crew.module.css";
import feed from "./feed.module.css";

const STATUS: Record<FeedStatus, string> = { ASSIGNED: "반영", PENDING: "확인 대기", UNMATCHED: "미지정", POT: "한방 모으는 중", CANCELLED: "취소" };
const FILTERS = [
  { key: "ALL", label: "전체" },
  { key: "TODO", label: "미지정·대기" },
  { key: "ASSIGNED", label: "반영" },
  { key: "CANCELLED", label: "취소 건" }
] as const;
type Filter = (typeof FILTERS)[number]["key"];
const time = (iso: string) => new Date(iso).toLocaleTimeString("ko-KR", { hour: "2-digit", minute: "2-digit", second: "2-digit" });

/**
 * 후원 리스트 — code-first (no Figma frame), inside `/creator/crew/broadcast` while live.
 * Keywords per member, 반영 방식 (자동 / 확인 후), 시뮬 후원, 한방, and the entry list where the
 * operator assigns, confirms or cancels. All scoring happens on the server.
 */
export function BroadcastFeed({
  broadcastId,
  members,
  view,
  pending,
  run
}: {
  broadcastId: string;
  members: CrewMember[];
  view: FeedView;
  pending: boolean;
  run: (action: () => Promise<BroadcastResult>, ok?: string) => void;
}) {
  const active = members.filter((m) => m.active);
  const nameOf = new Map(members.map((m) => [m.id, m]));
  const [filter, setFilter] = useState<Filter>("ALL");
  const [simAmount, setSimAmount] = useState("10000");
  const [simDonor, setSimDonor] = useState("");
  const [simMessage, setSimMessage] = useState("");
  const [target, setTarget] = useState("");
  const simId = useRef<string | null>(null);

  const entries = view.entries.filter((e) =>
    filter === "ALL" ? true : filter === "TODO" ? e.status === "UNMATCHED" || e.status === "PENDING" : e.status === filter
  );
  const todo = view.entries.filter((e) => e.status === "UNMATCHED" || e.status === "PENDING").length;

  const simulate = () => {
    simId.current ??= crypto.randomUUID();
    const requestId = simId.current;
    run(async () => {
      const res = await simulateDonation({ broadcastId, requestId, fnAmount: Math.floor(Number(simAmount) || 0), donor: simDonor, message: simMessage });
      if (res.status === "SAVED") {
        simId.current = null;
        setSimMessage("");
      }
      return res;
    });
  };

  return (
    <section className={styles.card} aria-labelledby="bc-feed">
      <div className={styles.cardHead}>
        <h2 id="bc-feed" className={styles.cardTitle}>
          후원 리스트 {todo > 0 && <span className={feed.badge}>처리 필요 {todo}</span>}
        </h2>
        <span className={styles.segment} role="group" aria-label="반영 방식">
          {(["AUTO", "CONFIRM"] as const).map((m) => (
            <button key={m} type="button" aria-pressed={view.assignMode === m} disabled={pending} onClick={() => run(() => setAssignMode({ broadcastId, mode: m }))}>
              {m === "AUTO" ? "자동 반영" : "확인 후 반영"}
            </button>
          ))}
        </span>
      </div>
      <p className={styles.note}>
        방송 중 멤버 지정 없이 들어온 후원이 여기에 쌓여요. 메시지에 멤버 키워드가 있으면 그 멤버에게 배정돼요. 키워드가 없거나 여러 멤버와 겹치면 미지정으로 남아요.
      </p>

      <details className={feed.panel}>
        <summary>멤버 키워드 (멤버당 {KEYWORDS_PER_MEMBER}개)</summary>
        <ul className={feed.keywords}>
          {active.map((m) => (
            <li key={m.id}>
              <span className={styles.teamName}>
                <span className={styles.dot} style={{ background: m.color }} aria-hidden="true" /> {m.name}
              </span>
              <input
                key={(view.keywords[m.id] ?? []).join(",")}
                className={styles.input}
                aria-label={`${m.name} 키워드`}
                placeholder="쉼표로 구분 (예: 하늘, sky)"
                defaultValue={(view.keywords[m.id] ?? []).join(", ")}
                onBlur={(e) => {
                  const next = e.target.value.split(/[,\n]/).map((k) => k.trim()).filter(Boolean);
                  if (next.join(",") !== (view.keywords[m.id] ?? []).join(",")) run(() => setMemberKeywords({ memberId: m.id, keywords: next }), "키워드를 저장했어요.");
                }}
                onKeyDown={(e) => e.key === "Enter" && (e.target as HTMLInputElement).blur()}
              />
            </li>
          ))}
        </ul>
      </details>

      <div className={feed.split}>
        <div className={feed.panelBox}>
          <strong>시뮬 후원</strong>
          <p className={styles.note}>연습용이에요. 점수판에만 반영되고 FN은 움직이지 않아요.</p>
          <div className={styles.addRow}>
            <input className={styles.inputSmall} inputMode="numeric" aria-label="시뮬 금액(FN)" value={simAmount} onChange={(e) => setSimAmount(e.target.value.replace(/\D/g, "").slice(0, 8))} />
            <input className={styles.input} aria-label="시뮬 후원자명" placeholder="후원자명" value={simDonor} onChange={(e) => setSimDonor(e.target.value)} maxLength={60} />
          </div>
          <div className={styles.addRow}>
            <input className={styles.input} aria-label="시뮬 메시지" placeholder="메시지 (키워드 포함 시 자동 배정)" value={simMessage} onChange={(e) => setSimMessage(e.target.value)} maxLength={60} />
            <button type="button" className={styles.primary} disabled={pending || !Number(simAmount)} onClick={simulate}>
              보내기
            </button>
          </div>
        </div>

        <div className={feed.panelBox} data-live={view.oneshot ? "" : undefined}>
          <strong>한방 후원</strong>
          {view.oneshot ? (
            <>
              <p className={styles.muted}>
                모으는 중 · {view.oneshot.count}건 <strong className={feed.pot}>{formatNumber(view.oneshot.potFn)} FN</strong>
              </p>
              <div className={styles.addRow}>
                <select className={styles.select} aria-label="몰아줄 멤버" value={target} onChange={(e) => setTarget(e.target.value)}>
                  <option value="">몰아줄 멤버 선택</option>
                  {active.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.name}
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  className={styles.primary}
                  disabled={pending || !target}
                  onClick={() => run(() => stopOneshot({ broadcastId, memberId: target }), `한방을 ${nameOf.get(target)?.name ?? ""}에게 몰아줬어요.`)}
                >
                  STOP · 몰아주기
                </button>
                <button type="button" className={styles.ghost} disabled={pending} onClick={() => run(() => stopOneshot({ broadcastId, memberId: null }), "한방을 취소했어요. 모은 후원은 다시 배정돼요.")}>
                  취소
                </button>
              </div>
            </>
          ) : (
            <>
              <p className={styles.note}>시작하면 그 구간의 후원이 점수판에 바로 들어가지 않고 따로 모여요. STOP 때 한 멤버에게 몰아줘요.</p>
              <div className={styles.actions}>
                <button type="button" className={styles.ghost} disabled={pending} onClick={() => run(() => startOneshot({ broadcastId }), "한방을 시작했어요.")}>
                  한방 시작
                </button>
              </div>
            </>
          )}
        </div>
      </div>

      <div className={styles.tabs} role="group" aria-label="후원 리스트 필터">
        {FILTERS.map((f) => (
          <button key={f.key} type="button" className={styles.tab} aria-current={filter === f.key ? "page" : undefined} onClick={() => setFilter(f.key)}>
            {f.label}
          </button>
        ))}
      </div>

      {entries.length === 0 ? (
        <p className={styles.empty}>{view.entries.length ? "조건에 맞는 후원이 없어요." : "방송 중 들어온 후원이 여기에 쌓여요. 시뮬 후원으로 연습해 보세요."}</p>
      ) : (
        <ul className={styles.list}>
          {entries.map((e) => (
            <EntryRow key={e.id} entry={e} active={active} nameOf={nameOf} pending={pending} broadcastId={broadcastId} run={run} />
          ))}
        </ul>
      )}
    </section>
  );
}

function EntryRow({
  entry: e,
  active,
  nameOf,
  pending,
  broadcastId,
  run
}: {
  entry: FeedEntry;
  active: CrewMember[];
  nameOf: Map<string, CrewMember>;
  pending: boolean;
  broadcastId: string;
  run: (action: () => Promise<BroadcastResult>, ok?: string) => void;
}) {
  const suggested = e.suggestedMemberId ? nameOf.get(e.suggestedMemberId) : null;
  return (
    <li className={styles.row} data-inactive={e.status === "CANCELLED" ? "" : undefined}>
      <div className={styles.rowMain}>
        <span className={styles.rowTitle}>
          {e.donor} · {formatNumber(e.fnAmount)} FN
          {e.source === "SIM" && <span className={styles.chipOff}>시뮬</span>}
          {e.oneshot && <span className={styles.chip}>한방</span>}
        </span>
        <span className={styles.muted}>
          {time(e.at)}
          {e.message && ` · ${e.message}`}
        </span>
      </div>
      <span className={feed.status} data-status={e.status}>
        {STATUS[e.status]}
        {e.status === "PENDING" && suggested && ` → ${suggested.name}`}
      </span>
      {e.status !== "POT" && (
        <span className={styles.rowActions}>
          {e.status === "PENDING" && e.suggestedMemberId && (
            <button type="button" className={styles.primary} disabled={pending} onClick={() => run(() => assignFeedEntry({ broadcastId, entryId: e.id, memberId: e.suggestedMemberId }))}>
              확인
            </button>
          )}
          <select
            className={styles.select}
            aria-label={`${e.donor} 후원 멤버 배정`}
            value={e.status === "ASSIGNED" ? (e.memberId ?? "") : ""}
            disabled={pending}
            onChange={(ev) => run(() => assignFeedEntry({ broadcastId, entryId: e.id, memberId: ev.target.value || null }))}
          >
            <option value="">{e.status === "ASSIGNED" ? "배정 해제" : "멤버 선택"}</option>
            {active.map((m) => (
              <option key={m.id} value={m.id}>
                {m.name}
              </option>
            ))}
          </select>
          {e.status !== "CANCELLED" && (
            <button type="button" className={styles.ghost} disabled={pending} onClick={() => run(() => cancelFeedEntry({ broadcastId, entryId: e.id }))}>
              취소
            </button>
          )}
        </span>
      )}
    </li>
  );
}
