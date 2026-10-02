"use client";

import { useRef, useState } from "react";
import { formatNumber } from "@/lib/format";
import { assignFeedEntry, cancelFeedEntry, setAssignMode, setEntryContribution, setMemberKeywords, simulateDonation, startOneshot, stopOneshot } from "@/services/crew/crewFeed";
import {
  EXCEL_UNITS,
  KEYWORDS_PER_MEMBER,
  type BroadcastResult,
  type Contribution,
  type CrewMember,
  type ExcelSettings,
  type ExcelUnit,
  type FeedEntryView,
  type FeedStatus,
  type FeedView
} from "@/services/crew/crewTypes";
import { PLATFORM_LABEL } from "@/types/platform";
import { ExcelPanel, ExcelSummary } from "./ExcelPanel";
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
const unitLabel = (u: ExcelUnit) => EXCEL_UNITS.find((x) => x.key === u)!.label;
const amountText = (amount: number, unit: ExcelUnit) => `${formatNumber(amount)} ${unitLabel(unit)}`;

/**
 * 후원 리스트 — code-first (no Figma frame), inside `/creator/crew/broadcast` while live.
 * Keywords per member, 반영 방식 (자동 / 확인 후), 자동엑셀 (원화 환산 · 배수 · 수기 기여도), 시뮬 후원,
 * 한방, 플랫폼 · BJ별 정리 and the entry list where the operator assigns, confirms or cancels. All
 * scoring happens on the server.
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
  const [simUnit, setSimUnit] = useState<ExcelUnit>("FN");
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
      const res = await simulateDonation({ broadcastId, requestId, amount: Number(simAmount) || 0, unit: simUnit, donor: simDonor, message: simMessage });
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

      <ExcelPanel settings={view.excel} pending={pending} run={run} />
      <ExcelSummary rows={view.summary} />

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
          <p className={styles.note}>연습용이에요. 점수판에만 반영되고 FN이나 플랫폼 후원은 움직이지 않아요.</p>
          <div className={styles.addRow}>
            <input className={styles.inputSmall} inputMode="decimal" aria-label="시뮬 금액" value={simAmount} onChange={(e) => setSimAmount(e.target.value.replace(/[^\d.]/g, "").slice(0, 11))} />
            <select className={`${styles.select} ${feed.grow}`} aria-label="시뮬 단위" value={simUnit} onChange={(e) => setSimUnit(e.target.value as ExcelUnit)}>
              {EXCEL_UNITS.map((u) => (
                <option key={u.key} value={u.key}>
                  {u.platform ? `${PLATFORM_LABEL[u.platform]} · ${u.label}` : `썸네이션 · ${u.label}`}
                </option>
              ))}
            </select>
          </div>
          <input className={styles.input} aria-label="시뮬 후원자명" placeholder="후원자명" value={simDonor} onChange={(e) => setSimDonor(e.target.value)} maxLength={60} />
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
                모으는 중 · {view.oneshot.count}건 <strong className={feed.pot}>{formatNumber(view.oneshot.potPoints)}점</strong>
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
            <EntryRow key={e.id} entry={e} excel={view.excel} active={active} nameOf={nameOf} pending={pending} broadcastId={broadcastId} run={run} />
          ))}
        </ul>
      )}
    </section>
  );
}

function EntryRow({
  entry: e,
  excel,
  active,
  nameOf,
  pending,
  broadcastId,
  run
}: {
  entry: FeedEntryView;
  excel: ExcelSettings;
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
          {e.donor} · {amountText(e.amount, e.unit)}
          {e.platform && <span className={styles.chipOff}>{PLATFORM_LABEL[e.platform]}</span>}
          {e.source === "SIM" && <span className={styles.chipOff}>시뮬</span>}
          {e.oneshot && <span className={styles.chip}>한방</span>}
        </span>
        <span className={styles.muted}>
          {time(e.at)}
          {e.message && ` · ${e.message}`}
        </span>
      </div>
      <ContributionCell entry={e} excel={excel} pending={pending} broadcastId={broadcastId} run={run} />
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

type Mode = "AUTO" | Contribution["kind"];

/** 기여도: the server's points, with 수기 입력 as fixed points or ×배수 (sent on blur / Enter, no save step). */
function ContributionCell({
  entry: e,
  excel,
  pending,
  broadcastId,
  run
}: {
  entry: FeedEntryView;
  excel: ExcelSettings;
  pending: boolean;
  broadcastId: string;
  run: (action: () => Promise<BroadcastResult>, ok?: string) => void;
}) {
  const mode: Mode = e.contribution?.kind ?? "AUTO";
  const send = (contribution: Contribution | null) => run(() => setEntryContribution({ broadcastId, entryId: e.id, contribution }));
  const commit = (raw: string, kind: Contribution["kind"]) => {
    if (raw.trim() === "") return;
    const value = Number(raw.replace(/,/g, ""));
    if (e.contribution?.kind === kind && e.contribution.value === value) return;
    send({ kind, value });
  };
  const missing = e.base === null && e.contribution?.kind !== "POINTS";
  const baseText = e.base === null ? null : `${formatNumber(Math.round(e.base))}${excel.unit === "KRW" ? "원" : " FN"}`;
  return (
    <span className={feed.contribution}>
      <span className={feed.points}>
        <strong>{formatNumber(e.points)}점</strong>
        <span className={styles.muted}>
          {missing ? (excel.unit === "KRW" ? "환산값 미설정" : "원화 환산에서 반영") : mode === "POINTS" ? "수기 입력" : `${baseText} × ${e.multiplier}`}
        </span>
      </span>
      {e.status !== "CANCELLED" && (
        <span className={feed.contributionEdit}>
          <select
            className={styles.select}
            aria-label={`${e.donor} 기여도 방식`}
            value={mode}
            disabled={pending}
            onChange={(ev) => {
              const next = ev.target.value as Mode;
              if (next === "AUTO") send(null);
              else send(next === "POINTS" ? { kind: "POINTS", value: e.points } : { kind: "MULTIPLIER", value: e.multiplier });
            }}
          >
            <option value="AUTO">규칙</option>
            <option value="POINTS">점수</option>
            <option value="MULTIPLIER">배수</option>
          </select>
          {mode !== "AUTO" && (
            <input
              key={`${mode}-${e.contribution?.value}`}
              className={styles.inputSmall}
              inputMode="decimal"
              aria-label={`${e.donor} 기여도 ${mode === "POINTS" ? "점수" : "배수"}`}
              defaultValue={e.contribution?.value}
              onBlur={(ev) => commit(ev.target.value, mode)}
              onKeyDown={(ev) => ev.key === "Enter" && (ev.target as HTMLInputElement).blur()}
            />
          )}
        </span>
      )}
    </span>
  );
}
