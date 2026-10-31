"use client";

import { useRef, useState, type DragEvent } from "react";
import { formatKstTime, formatNumber } from "@/lib/format";
import {
  assignFeedEntry,
  cancelFeedEntry,
  playHeldEntry,
  resolveDuplicate,
  setAssignMode,
  setEntryContribution,
  setMemberKeywords,
  setNameKeywords,
  setPauseUnassigned,
  simulateDonation,
  startOneshot,
  stopOneshot
} from "@/services/crew/crewFeed";
import {
  EXCEL_UNITS,
  FEED_ORIGINS,
  KEYWORDS_PER_MEMBER,
  NAME_KEYWORD_MIN,
  feedOrigin,
  feedUnplayed,
  type BroadcastResult,
  type Contribution,
  type CrewMember,
  type DonorMerge,
  type ExcelSettings,
  type ExcelUnit,
  type FeedAlert,
  type FeedEntryView,
  type FeedListEntry,
  type FeedOrigin,
  type FeedStatus,
  type FeedView
} from "@/services/crew/crewTypes";
import { unitLabel } from "@/types/donationUnit";
import { PLATFORM_LABEL } from "@/types/platform";
import { DonorPanel } from "./DonorPanel";
import { ExcelPanel, ExcelSummary } from "./ExcelPanel";
import styles from "./crew.module.css";
import feed from "./feed.module.css";

const STATUS: Record<FeedStatus, string> = { ASSIGNED: "반영", PENDING: "확인 대기", UNMATCHED: "미지정", POT: "한방 모으는 중", CANCELLED: "취소" };
const FILTERS = [
  { key: "ALL", label: "전체" },
  { key: "TODO", label: "미지정·대기" },
  { key: "UNPLAYED", label: "미재생" },
  { key: "DUPLICATE", label: "중복 의심" },
  { key: "ASSIGNED", label: "반영" },
  { key: "CANCELLED", label: "취소 건" }
] as const;
type Filter = (typeof FILTERS)[number]["key"];
/** Where the entry's alert is, while it has not finished (ENDED shows nothing). */
const ALERT: Record<Exclude<FeedAlert, "ENDED">, string> = { HELD: "알림 멈춤", QUEUED: "알림 대기", SHOWING: "알림 중" };
const time = (iso: string) => formatKstTime(iso, { hour: "2-digit", minute: "2-digit", second: "2-digit" });
/** Entries carry a unit code; the label is what shows (5,000 원 · 100 별풍선). */
const amountText = (amount: number, unit: ExcelUnit) => `${formatNumber(amount)} ${unitLabel(unit)}`;
/** What a dragged 후원 row carries (its entry id). */
const DRAG_TYPE = "application/x-ssumnation-feed-entry";
type Run = (action: () => Promise<BroadcastResult>, ok?: string) => void;

/**
 * 후원 리스트 — code-first (no Figma frame), inside `/creator/crew/broadcast` while live.
 * Keywords per member, 반영 방식 (자동 / 확인 후), 자동엑셀 (원화 환산 · 배수 · 수기 기여도), 시뮬 후원,
 * 한방, 플랫폼 · BJ별 정리 and the entry list where the operator assigns (select, or drag a row onto a member —
 * StreamDonate 참고, 2026-10-25), confirms, cancels or settles a 중복 의심. All scoring happens on the server.
 * Each row shows where its alert is in the queue (미재생 filter), and 미지정 일시정지 holds a 미지정 donation's alert until
 * it is assigned (2026-10-25).
 */
export function BroadcastFeed({
  broadcastId,
  members,
  view,
  merges,
  pending,
  run
}: {
  broadcastId: string;
  members: CrewMember[];
  view: FeedView;
  /** 후원자 이름 병합 groups (the channel's, kept across broadcasts). */
  merges: DonorMerge[];
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

  const [dragging, setDragging] = useState<string | null>(null);

  // 중복 의심: the marked entries and the earlier ones they look like.
  const suspects = view.entries.filter((e) => e.duplicateOf);
  const inPair = new Set(suspects.flatMap((e) => [e.id, e.duplicateOf!.id]));
  // 출처 필터: the sources this list has, with their counts (on top of the status filter).
  const [origin, setOrigin] = useState<FeedOrigin | "ALL">("ALL");
  const origins = FEED_ORIGINS.map((o) => ({ ...o, count: view.entries.filter((e) => feedOrigin(e) === o.key).length })).filter((o) => o.count > 0);
  const entries = view.entries.filter(
    (e) =>
      (origin === "ALL" || feedOrigin(e) === origin) &&
      (filter === "ALL"
        ? true
        : filter === "TODO"
          ? e.status === "UNMATCHED" || e.status === "PENDING"
          : filter === "UNPLAYED"
            ? feedUnplayed(e)
            : filter === "DUPLICATE"
              ? inPair.has(e.id)
              : e.status === filter)
  );
  const todo = view.entries.filter((e) => e.status === "UNMATCHED" || e.status === "PENDING").length;
  const held = view.entries.filter((e) => e.alert === "HELD").length;

  /** A row dropped on a member (or 미지정, null): the same as picking it in the row's select. */
  const dropOn = (entryId: string, memberId: string | null) => {
    setDragging(null);
    const e = view.entries.find((x) => x.id === entryId);
    if (!e || e.status === "POT") return;
    if (memberId === null ? e.status === "UNMATCHED" : e.status === "ASSIGNED" && e.memberId === memberId) return;
    run(() => assignFeedEntry({ broadcastId, entryId, memberId }), memberId ? `${e.donor} 후원을 ${nameOf.get(memberId)?.name ?? ""}에게 배정했어요.` : `${e.donor} 후원을 미지정으로 돌렸어요.`);
  };

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
          {suspects.length > 0 && <span className={feed.badge}>중복 의심 {suspects.length}</span>}
          {held > 0 && <span className={feed.badge}>알림 멈춤 {held}</span>}
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
      <div className={feed.pauseRow}>
        <label className={styles.checkRow}>
          <input
            type="checkbox"
            checked={view.pauseUnassigned}
            disabled={pending}
            onChange={(ev) =>
              run(
                () => setPauseUnassigned({ broadcastId, on: ev.target.checked }),
                ev.target.checked ? "미지정 일시정지를 켰어요. 미지정 후원의 알림은 배정할 때까지 멈춰요." : "미지정 일시정지를 껐어요. 멈춘 알림이 차례로 나가요."
              )
            }
          />
          미지정 일시정지
        </label>
        <span className={styles.muted}>켜면 미지정 · 확인 대기 후원의 알림이 배정하거나 취소할 때까지 대기열에서 멈춰요. 뒤 알림도 함께 기다려요.</span>
      </div>

      <ExcelPanel settings={view.excel} pending={pending} run={run} />
      <ExcelSummary rows={view.summary} />
      <DonorPanel donors={view.donors} merges={merges} pending={pending} run={run} />

      <details className={feed.panel}>
        <summary>
          멤버 키워드 (멤버당 {KEYWORDS_PER_MEMBER}개){view.nameKeywords && " · 이름 자동 인식"}
        </summary>
        <label className={`${styles.checkRow} ${feed.nameKeywords}`}>
          <input
            type="checkbox"
            checked={view.nameKeywords}
            disabled={pending}
            onChange={(e) =>
              run(
                () => setNameKeywords({ on: e.target.checked }),
                e.target.checked ? "멤버 이름도 키워드로 인식해요. 다음 후원부터 적용돼요." : "멤버 이름 인식을 껐어요. 키워드만 봐요."
              )
            }
          />
          멤버 이름도 키워드로 인식 ({NAME_KEYWORD_MIN}글자 이상 이름)
        </label>
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

      <div className={`${styles.tabs} ${feed.filters}`} role="group" aria-label="후원 리스트 필터">
        {FILTERS.map((f) => (
          <button key={f.key} type="button" className={styles.tab} aria-current={filter === f.key ? "page" : undefined} onClick={() => setFilter(f.key)}>
            {f.label}
          </button>
        ))}
      </div>
      {origins.length > 1 && (
        <div className={feed.origins} role="group" aria-label="후원 리스트 출처">
          <span className={styles.muted}>출처</span>
          {[{ key: "ALL" as const, label: "전체", count: view.entries.length }, ...origins].map((o) => (
            <button key={o.key} type="button" className={feed.origin} aria-pressed={origin === o.key} onClick={() => setOrigin(o.key)}>
              {o.label} {o.count}
            </button>
          ))}
        </div>
      )}

      {view.entries.length > 0 && <DropBar active={active} dragging={dragging !== null} pending={pending} onDrop={dropOn} />}

      {entries.length === 0 ? (
        <p className={styles.empty}>
          {!view.entries.length
            ? "방송 중 들어온 후원이 여기에 쌓여요. 시뮬 후원으로 연습해 보세요."
            : filter === "DUPLICATE"
              ? "중복 의심 후원이 없어요."
              : filter === "UNPLAYED"
                ? "알림이 아직 나가지 않은 후원이 없어요."
                : "조건에 맞는 후원이 없어요."}
        </p>
      ) : (
        <ul className={styles.list}>
          {entries.map((e) => (
            <EntryRow
              key={e.id}
              entry={e}
              excel={view.excel}
              active={active}
              nameOf={nameOf}
              pending={pending}
              broadcastId={broadcastId}
              run={run}
              onDrag={(on) => setDragging(on ? e.id : null)}
            />
          ))}
        </ul>
      )}
    </section>
  );
}

/**
 * 끌어다 놓기 배정 (StreamDonate 참고): drop a 후원 row on a member, or on 미지정 to take it back. Pointer only — each row's
 * select does the same with a keyboard or on a touch screen (where the bar is hidden).
 */
function DropBar({ active, dragging, pending, onDrop }: { active: CrewMember[]; dragging: boolean; pending: boolean; onDrop: (entryId: string, memberId: string | null) => void }) {
  const [over, setOver] = useState<string | null>(null);
  const target = (key: string, memberId: string | null) => ({
    "data-over": over === key ? "" : undefined,
    onDragOver: (ev: DragEvent) => {
      if (pending || !ev.dataTransfer.types.includes(DRAG_TYPE)) return;
      ev.preventDefault();
      ev.dataTransfer.dropEffect = "move";
      setOver(key);
    },
    onDragLeave: () => setOver((o) => (o === key ? null : o)),
    onDrop: (ev: DragEvent) => {
      ev.preventDefault();
      setOver(null);
      const id = ev.dataTransfer.getData(DRAG_TYPE);
      if (id) onDrop(id, memberId);
    }
  });
  return (
    <div className={feed.dropBar} data-dragging={dragging ? "" : undefined}>
      <span className={styles.muted}>후원을 끌어다 멤버에 놓으면 배정돼요.</span>
      <ul className={feed.dropTargets} aria-hidden="true">
        {active.map((m) => (
          <li key={m.id} {...target(m.id, m.id)}>
            <span className={styles.dot} style={{ background: m.color }} />
            {m.name}
          </li>
        ))}
        <li data-unassign="" {...target("", null)}>
          미지정
        </li>
      </ul>
    </div>
  );
}

function EntryRow({
  entry: e,
  excel,
  active,
  nameOf,
  pending,
  broadcastId,
  run,
  onDrag
}: {
  entry: FeedListEntry;
  excel: ExcelSettings;
  active: CrewMember[];
  nameOf: Map<string, CrewMember>;
  pending: boolean;
  broadcastId: string;
  run: Run;
  onDrag: (dragging: boolean) => void;
}) {
  const suggested = e.suggestedMemberId ? nameOf.get(e.suggestedMemberId) : null;
  // The donor side of the row drags it (the inputs on the right stay selectable); a 한방 entry waits for its STOP.
  const draggable = e.status !== "POT" && !pending;
  return (
    <li
      className={`${styles.row} ${feed.entry}`}
      data-inactive={e.status === "CANCELLED" ? "" : undefined}
      data-duplicate={e.duplicateOf ? "" : undefined}
      data-held={e.alert === "HELD" ? "" : undefined}
    >
      <div
        className={`${styles.rowMain} ${feed.dragSource}`}
        draggable={draggable}
        data-draggable={draggable ? "" : undefined}
        title={draggable ? "끌어서 멤버에 놓으면 배정돼요" : undefined}
        onDragStart={(ev) => {
          ev.dataTransfer.setData(DRAG_TYPE, e.id);
          ev.dataTransfer.effectAllowed = "move";
          const row = ev.currentTarget.closest("li");
          if (row) ev.dataTransfer.setDragImage(row, 24, 20);
          onDrag(true);
        }}
        onDragEnd={() => onDrag(false)}
      >
        <span className={styles.rowTitle}>
          {draggable && (
            <span className={feed.handle} aria-hidden="true">
              ⠿
            </span>
          )}
          {e.mergedDonor ?? e.donor}
          {e.mergedDonor && <span className={feed.alias}>({e.donor})</span>} · {amountText(e.amount, e.unit)}
          {e.platform && <span className={styles.chipOff}>{PLATFORM_LABEL[e.platform]}</span>}
          {e.source === "SIM" && <span className={styles.chipOff}>시뮬</span>}
          {e.source === "BANK" && <span className={styles.chipOff}>계좌</span>}
          {e.oneshot && <span className={styles.chip}>한방</span>}
          {e.status === "CANCELLED" && e.duplicate === "DUPLICATE" && <span className={styles.chipOff}>중복 취소</span>}
          {e.alert && e.alert !== "ENDED" && (
            <span className={feed.alertTag} data-alert={e.alert}>
              {ALERT[e.alert]}
            </span>
          )}
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
      {e.duplicateOf && (
        <div className={feed.duplicate}>
          <span>중복 의심 · {time(e.duplicateOf.at)}에 같은 후원자 · 같은 금액 후원이 있어요.</span>
          <span className={feed.duplicateActions}>
            {e.status !== "POT" && (
              <button
                type="button"
                className={styles.ghost}
                disabled={pending}
                onClick={() => run(() => resolveDuplicate({ broadcastId, entryId: e.id, verdict: "DUPLICATE" }), "중복으로 보고 취소했어요. 다시 배정하면 되살아나요.")}
              >
                중복 취소
              </button>
            )}
            <button type="button" className={styles.ghost} disabled={pending} onClick={() => run(() => resolveDuplicate({ broadcastId, entryId: e.id, verdict: "KEPT" }), "중복 아님으로 표시했어요.")}>
              중복 아님
            </button>
          </span>
        </div>
      )}
      {e.alert === "HELD" && (
        <div className={feed.held}>
          <span>미지정 일시정지 · 이 후원의 알림이 대기열에서 멈춰 있어요. 배정하거나 취소하면 이어서 나가요.</span>
          <button type="button" className={styles.ghost} disabled={pending} onClick={() => run(() => playHeldEntry({ broadcastId, entryId: e.id }), "배정 없이 알림을 내보내요.")}>
            배정 없이 재생
          </button>
        </div>
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
