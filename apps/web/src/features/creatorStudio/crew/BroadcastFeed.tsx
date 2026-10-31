"use client";

import { useRef, useState, type DragEvent } from "react";
import { formatKstTime, formatNumber } from "@/lib/format";
import { useI18n } from "@/lib/i18n/I18nProvider";
import type { MessageKey } from "@/lib/i18n/translate";
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

const STATUS: Record<FeedStatus, MessageKey> = {
  ASSIGNED: "crewOpsFeed.statusAssigned",
  PENDING: "crewOpsFeed.statusPending",
  UNMATCHED: "crewOpsFeed.statusUnmatched",
  POT: "crewOpsFeed.statusPot",
  CANCELLED: "crewOpsFeed.statusCancelled"
};
const FILTERS = [
  { key: "ALL", label: "crewOps.all" },
  { key: "TODO", label: "crewOpsFeed.filterTodo" },
  { key: "UNPLAYED", label: "crewOpsFeed.filterUnplayed" },
  { key: "DUPLICATE", label: "crewOpsFeed.filterDuplicate" },
  { key: "ASSIGNED", label: "crewOpsFeed.statusAssigned" },
  { key: "CANCELLED", label: "crewOpsFeed.filterCancelled" }
] as const satisfies readonly { key: string; label: MessageKey }[];
/** 출처 labels that read differently per language; platform names show as written (PLATFORM_LABEL). */
const ORIGIN_KEY: Partial<Record<FeedOrigin, MessageKey>> = {
  SSUMNATION: "crewOpsFeed.originSsumnation",
  BANK: "crewOpsFeed.originBank",
  SIM: "crewOpsFeed.originSim"
};
type Filter = (typeof FILTERS)[number]["key"];
/** Where the entry's alert is, while it has not finished (ENDED shows nothing). */
const ALERT: Record<Exclude<FeedAlert, "ENDED">, MessageKey> = { HELD: "crewOpsFeed.alertHeld", QUEUED: "crewOpsFeed.alertQueued", SHOWING: "crewOpsFeed.alertShowing" };
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
  const { t } = useI18n();
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
    run(() => assignFeedEntry({ broadcastId, entryId, memberId }), memberId ? t("crewOpsFeed.assignedTo", { donor: e.donor, member: nameOf.get(memberId)?.name ?? "" }) : t("crewOpsFeed.unassigned", { donor: e.donor }));
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
          {t("crewOpsFeed.title")} {todo > 0 && <span className={feed.badge}>{t("crewOpsFeed.badgeTodo", { count: todo })}</span>}
          {suspects.length > 0 && <span className={feed.badge}>{t("crewOpsFeed.badgeDuplicate", { count: suspects.length })}</span>}
          {held > 0 && <span className={feed.badge}>{t("crewOpsFeed.badgeHeld", { count: held })}</span>}
        </h2>
        <span className={styles.segment} role="group" aria-label={t("crewOpsFeed.assignModeAria")}>
          {(["AUTO", "CONFIRM"] as const).map((m) => (
            <button key={m} type="button" aria-pressed={view.assignMode === m} disabled={pending} onClick={() => run(() => setAssignMode({ broadcastId, mode: m }))}>
              {m === "AUTO" ? t("crewOpsFeed.modeAuto") : t("crewOpsFeed.modeConfirm")}
            </button>
          ))}
        </span>
      </div>
      <p className={styles.note}>{t("crewOpsFeed.intro")}</p>
      <div className={feed.pauseRow}>
        <label className={styles.checkRow}>
          <input
            type="checkbox"
            checked={view.pauseUnassigned}
            disabled={pending}
            onChange={(ev) =>
              run(
                () => setPauseUnassigned({ broadcastId, on: ev.target.checked }),
                ev.target.checked ? t("crewOpsFeed.pauseOn") : t("crewOpsFeed.pauseOff")
              )
            }
          />
          {t("crewOpsFeed.pauseLabel")}
        </label>
        <span className={styles.muted}>{t("crewOpsFeed.pauseNote")}</span>
      </div>

      <ExcelPanel settings={view.excel} pending={pending} run={run} />
      <ExcelSummary rows={view.summary} />
      <DonorPanel donors={view.donors} merges={merges} pending={pending} run={run} />

      <details className={feed.panel}>
        <summary>
          {t("crewOpsFeed.keywordsTitle", { n: KEYWORDS_PER_MEMBER })}
          {view.nameKeywords && t("crewOpsFeed.nameAuto")}
        </summary>
        <label className={`${styles.checkRow} ${feed.nameKeywords}`}>
          <input
            type="checkbox"
            checked={view.nameKeywords}
            disabled={pending}
            onChange={(e) =>
              run(
                () => setNameKeywords({ on: e.target.checked }),
                e.target.checked ? t("crewOpsFeed.nameKeywordsOn") : t("crewOpsFeed.nameKeywordsOff")
              )
            }
          />
          {t("crewOpsFeed.nameKeywordsLabel", { n: NAME_KEYWORD_MIN })}
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
                aria-label={t("crewOpsFeed.keywordsAria", { name: m.name })}
                placeholder={t("crewOpsFeed.keywordsPlaceholder")}
                defaultValue={(view.keywords[m.id] ?? []).join(", ")}
                onBlur={(e) => {
                  const next = e.target.value.split(/[,\n]/).map((k) => k.trim()).filter(Boolean);
                  if (next.join(",") !== (view.keywords[m.id] ?? []).join(",")) run(() => setMemberKeywords({ memberId: m.id, keywords: next }), t("crewOpsFeed.keywordsSaved"));
                }}
                onKeyDown={(e) => e.key === "Enter" && (e.target as HTMLInputElement).blur()}
              />
            </li>
          ))}
        </ul>
      </details>

      <div className={feed.split}>
        <div className={feed.panelBox}>
          <strong>{t("crewOpsFeed.simTitle")}</strong>
          <p className={styles.note}>{t("crewOpsFeed.simNote")}</p>
          <div className={styles.addRow}>
            <input className={styles.inputSmall} inputMode="decimal" aria-label={t("crewOpsFeed.simAmountAria")} value={simAmount} onChange={(e) => setSimAmount(e.target.value.replace(/[^\d.]/g, "").slice(0, 11))} />
            <select className={`${styles.select} ${feed.grow}`} aria-label={t("crewOpsFeed.simUnitAria")} value={simUnit} onChange={(e) => setSimUnit(e.target.value as ExcelUnit)}>
              {EXCEL_UNITS.map((u) => (
                <option key={u.key} value={u.key}>
                  {u.platform ? `${PLATFORM_LABEL[u.platform]} · ${u.label}` : t("crewOpsFeed.simUnitSsumnation", { unit: u.label })}
                </option>
              ))}
            </select>
          </div>
          <input className={styles.input} aria-label={t("crewOpsFeed.simDonorAria")} placeholder={t("crewOpsFeed.simDonorPlaceholder")} value={simDonor} onChange={(e) => setSimDonor(e.target.value)} maxLength={60} />
          <div className={styles.addRow}>
            <input className={styles.input} aria-label={t("crewOpsFeed.simMessageAria")} placeholder={t("crewOpsFeed.simMessagePlaceholder")} value={simMessage} onChange={(e) => setSimMessage(e.target.value)} maxLength={60} />
            <button type="button" className={styles.primary} disabled={pending || !Number(simAmount)} onClick={simulate}>
              {t("crewOpsFeed.send")}
            </button>
          </div>
        </div>

        <div className={feed.panelBox} data-live={view.oneshot ? "" : undefined}>
          <strong>{t("crewOpsFeed.oneshotTitle")}</strong>
          {view.oneshot ? (
            <>
              <p className={styles.muted}>
                {t("crewOpsFeed.potCollecting", { count: view.oneshot.count })} <strong className={feed.pot}>{t("crewOpsFeed.points", { n: formatNumber(view.oneshot.potPoints) })}</strong>
              </p>
              <div className={styles.addRow}>
                <select className={styles.select} aria-label={t("crewOpsFeed.oneshotTargetAria")} value={target} onChange={(e) => setTarget(e.target.value)}>
                  <option value="">{t("crewOpsFeed.oneshotTargetPick")}</option>
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
                  onClick={() => run(() => stopOneshot({ broadcastId, memberId: target }), t("crewOpsFeed.oneshotGiven", { name: nameOf.get(target)?.name ?? "" }))}
                >
                  {t("crewOpsFeed.oneshotStop")}
                </button>
                <button type="button" className={styles.ghost} disabled={pending} onClick={() => run(() => stopOneshot({ broadcastId, memberId: null }), t("crewOpsFeed.oneshotCancelled"))}>
                  {t("crewOps.cancel")}
                </button>
              </div>
            </>
          ) : (
            <>
              <p className={styles.note}>{t("crewOpsFeed.oneshotNote")}</p>
              <div className={styles.actions}>
                <button type="button" className={styles.ghost} disabled={pending} onClick={() => run(() => startOneshot({ broadcastId }), t("crewOpsFeed.oneshotStarted"))}>
                  {t("crewOpsFeed.oneshotStart")}
                </button>
              </div>
            </>
          )}
        </div>
      </div>

      <div className={`${styles.tabs} ${feed.filters}`} role="group" aria-label={t("crewOpsFeed.filtersAria")}>
        {FILTERS.map((f) => (
          <button key={f.key} type="button" className={styles.tab} aria-current={filter === f.key ? "page" : undefined} onClick={() => setFilter(f.key)}>
            {t(f.label)}
          </button>
        ))}
      </div>
      {origins.length > 1 && (
        <div className={feed.origins} role="group" aria-label={t("crewOpsFeed.originsAria")}>
          <span className={styles.muted}>{t("crewOpsFeed.originLabel")}</span>
          {[{ key: "ALL" as const, label: t("crewOps.all"), count: view.entries.length }, ...origins.map((o) => ({ ...o, label: ORIGIN_KEY[o.key] ? t(ORIGIN_KEY[o.key]!) : o.label }))].map((o) => (
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
            ? t("crewOpsFeed.emptyAll")
            : filter === "DUPLICATE"
              ? t("crewOpsFeed.emptyDuplicate")
              : filter === "UNPLAYED"
                ? t("crewOpsFeed.emptyUnplayed")
                : t("crewOpsFeed.emptyFiltered")}
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
  const { t } = useI18n();
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
      <span className={styles.muted}>{t("crewOpsFeed.dropHint")}</span>
      <ul className={feed.dropTargets} aria-hidden="true">
        {active.map((m) => (
          <li key={m.id} {...target(m.id, m.id)}>
            <span className={styles.dot} style={{ background: m.color }} />
            {m.name}
          </li>
        ))}
        <li data-unassign="" {...target("", null)}>
          {t("crewOpsFeed.statusUnmatched")}
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
  const { t } = useI18n();
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
        title={draggable ? t("crewOpsFeed.dragTitle") : undefined}
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
          {e.source === "SIM" && <span className={styles.chipOff}>{t("crewOpsFeed.originSim")}</span>}
          {e.source === "BANK" && <span className={styles.chipOff}>{t("crewOpsFeed.originBank")}</span>}
          {e.oneshot && <span className={styles.chip}>{t("crewOpsFeed.chipOneshot")}</span>}
          {e.status === "CANCELLED" && e.duplicate === "DUPLICATE" && <span className={styles.chipOff}>{t("crewOpsFeed.chipDuplicate")}</span>}
          {e.alert && e.alert !== "ENDED" && (
            <span className={feed.alertTag} data-alert={e.alert}>
              {t(ALERT[e.alert])}
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
        {t(STATUS[e.status])}
        {e.status === "PENDING" && suggested && ` → ${suggested.name}`}
      </span>
      {e.status !== "POT" && (
        <span className={styles.rowActions}>
          {e.status === "PENDING" && e.suggestedMemberId && (
            <button type="button" className={styles.primary} disabled={pending} onClick={() => run(() => assignFeedEntry({ broadcastId, entryId: e.id, memberId: e.suggestedMemberId }))}>
              {t("crewOpsFeed.confirm")}
            </button>
          )}
          <select
            className={styles.select}
            aria-label={t("crewOpsFeed.assignAria", { donor: e.donor })}
            value={e.status === "ASSIGNED" ? (e.memberId ?? "") : ""}
            disabled={pending}
            onChange={(ev) => run(() => assignFeedEntry({ broadcastId, entryId: e.id, memberId: ev.target.value || null }))}
          >
            <option value="">{e.status === "ASSIGNED" ? t("crewOpsFeed.unassignOption") : t("crewOpsFeed.pickMember")}</option>
            {active.map((m) => (
              <option key={m.id} value={m.id}>
                {m.name}
              </option>
            ))}
          </select>
          {e.status !== "CANCELLED" && (
            <button type="button" className={styles.ghost} disabled={pending} onClick={() => run(() => cancelFeedEntry({ broadcastId, entryId: e.id }))}>
              {t("crewOps.cancel")}
            </button>
          )}
        </span>
      )}
      {e.duplicateOf && (
        <div className={feed.duplicate}>
          <span>{t("crewOpsFeed.duplicateLine", { time: time(e.duplicateOf.at) })}</span>
          <span className={feed.duplicateActions}>
            {e.status !== "POT" && (
              <button
                type="button"
                className={styles.ghost}
                disabled={pending}
                onClick={() => run(() => resolveDuplicate({ broadcastId, entryId: e.id, verdict: "DUPLICATE" }), t("crewOpsFeed.duplicateCancelled"))}
              >
                {t("crewOpsFeed.duplicateCancel")}
              </button>
            )}
            <button type="button" className={styles.ghost} disabled={pending} onClick={() => run(() => resolveDuplicate({ broadcastId, entryId: e.id, verdict: "KEPT" }), t("crewOpsFeed.notDuplicateDone"))}>
              {t("crewOpsFeed.notDuplicate")}
            </button>
          </span>
        </div>
      )}
      {e.alert === "HELD" && (
        <div className={feed.held}>
          <span>{t("crewOpsFeed.heldLine")}</span>
          <button type="button" className={styles.ghost} disabled={pending} onClick={() => run(() => playHeldEntry({ broadcastId, entryId: e.id }), t("crewOpsFeed.playHeldDone"))}>
            {t("crewOpsFeed.playHeld")}
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
  const { t } = useI18n();
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
        <strong>{t("crewOpsFeed.points", { n: formatNumber(e.points) })}</strong>
        <span className={styles.muted}>
          {missing ? (excel.unit === "KRW" ? t("crewOpsFeed.contribNoRate") : t("crewOpsFeed.contribKrwOnly")) : mode === "POINTS" ? t("crewOpsFeed.contribManual") : `${baseText} × ${e.multiplier}`}
        </span>
      </span>
      {e.status !== "CANCELLED" && (
        <span className={feed.contributionEdit}>
          <select
            className={styles.select}
            aria-label={t("crewOpsFeed.contribModeAria", { donor: e.donor })}
            value={mode}
            disabled={pending}
            onChange={(ev) => {
              const next = ev.target.value as Mode;
              if (next === "AUTO") send(null);
              else send(next === "POINTS" ? { kind: "POINTS", value: e.points } : { kind: "MULTIPLIER", value: e.multiplier });
            }}
          >
            <option value="AUTO">{t("crewOpsFeed.modeRule")}</option>
            <option value="POINTS">{t("crewOpsFeed.modePoints")}</option>
            <option value="MULTIPLIER">{t("crewOpsFeed.modeMultiplier")}</option>
          </select>
          {mode !== "AUTO" && (
            <input
              key={`${mode}-${e.contribution?.value}`}
              className={styles.inputSmall}
              inputMode="decimal"
              aria-label={t(mode === "POINTS" ? "crewOpsFeed.contribPointsAria" : "crewOpsFeed.contribMultiplierAria", { donor: e.donor })}
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
