"use client";

import { formatNumber } from "@/lib/format";
import { useI18n } from "@/lib/i18n/I18nProvider";
import type { MessageKey } from "@/lib/i18n/translate";
import { saveTeamPrize } from "@/services/crew/crewPrizeBoard";
import {
  BATTLE_TEAM_NAME_MAX,
  MULTI_TEAM_COLORS,
  MULTI_TEAM_KEYS,
  MULTI_TEAMS_MAX,
  MULTI_TEAMS_MIN,
  PRIZE_BASES,
  PRIZE_TITLE_MAX,
  TEAM_MEMBERS_PER_LINE_MAX,
  TEAM_PRIZE_MEMBER_VIEWS,
  TEAM_PRIZE_RANKS_MAX,
  TEAM_PRIZE_SOURCES,
  TEAM_PRIZE_TITLE_DEFAULT,
  type BroadcastResult,
  type CrewMember,
  type TeamPrizeLive,
  type TeamPrizeMembers,
  type TeamPrizeMissing,
  type TeamPrizeSettings
} from "@/services/crew/crewTypes";
import { BoardAddress, BoardDisplayField, BoardVisibleToggle, PRIZE_BASIS_KEY, PrizeLinesField, PrizeWindowBar, lastPrizeLine, useSettingsDraft } from "./PrizeBoardPanel";
import styles from "./crew.module.css";
import battle from "./battle.module.css";
import prize from "./prize.module.css";

/** What the preview says when the source gives no teams. */
export const TEAM_PRIZE_MISSING: Record<TeamPrizeMissing, MessageKey> = {
  NO_TEAMS: "crewOpsBoards.missingNoTeams",
  NOT_TEAM_MODE: "crewOpsBoards.missingNotTeamMode",
  NO_BATTLE: "crewOpsBoards.missingNoBattle"
};

const SOURCE_NOTE: Record<TeamPrizeSettings["source"], MessageKey> = {
  CUSTOM: "crewOpsBoards.sourceNoteCustom",
  BROADCAST_TEAMS: "crewOpsBoards.sourceNoteBroadcast",
  BATTLE: "crewOpsBoards.sourceNoteBattle"
};
/** 팀 구성 · 팀원 표시 labels as message keys (the constants in crewTypes stay as written). */
const SOURCE_KEY: Record<TeamPrizeSettings["source"], MessageKey> = {
  CUSTOM: "crewOpsBoards.sourceCustom",
  BROADCAST_TEAMS: "crewOpsBoards.sourceBroadcast",
  BATTLE: "crewOpsBoards.sourceBattle"
};
const MEMBER_VIEW_KEY: Record<TeamPrizeMembers, MessageKey> = { SCORE: "crewOpsBoards.memberViewScore", NONE: "crewOpsBoards.memberViewNone" };

/**
 * 팀 순위표 — code-first (no Figma frame; StreamDonate 팀 랭킹(상품) · 시간 내 팀 랭킹(상품) 참고), inside
 * `/creator/crew/broadcast`. Teams set here, the broadcast's A팀 · B팀 or the latest 다수 팀 배틀; team score = its members'
 * scores. Like 상품 순위표: saved with 설정 저장, OBS에 표시 and its own 구간 while live, preview = the server's ranking.
 */
export function TeamPrizePanel({
  settings,
  live,
  members,
  overlayPath,
  pending,
  run
}: {
  settings: TeamPrizeSettings;
  live: { broadcastId: string; board: TeamPrizeLive } | null;
  members: CrewMember[];
  overlayPath: string;
  pending: boolean;
  run: (action: () => Promise<BroadcastResult>, ok?: string) => void;
}) {
  const { t } = useI18n();
  const { draft, setDraft, edit, dirty } = useSettingsDraft(settings);
  const board = live?.board;

  // 직접 구성: start from two empty teams; a member is in one team at most.
  const teams = draft.teams.length >= MULTI_TEAMS_MIN ? draft.teams : Array.from({ length: MULTI_TEAMS_MIN }, (_, i) => draft.teams[i] ?? { name: "", memberIds: [] });
  const teamOf = (id: string) => teams.findIndex((team) => team.memberIds.includes(id));
  const assignable = members.filter((m) => m.active || teamOf(m.id) >= 0);
  const setCount = (n: number) => edit({ teams: Array.from({ length: n }, (_, i) => teams[i] ?? { name: "", memberIds: [] }) });
  const setName = (i: number, name: string) => edit({ teams: teams.map((team, j) => (j === i ? { ...team, name } : team)) });
  const assign = (id: string, to: number) => edit({ teams: teams.map((team, j) => ({ ...team, memberIds: j === to ? [...team.memberIds.filter((x) => x !== id), id] : team.memberIds.filter((x) => x !== id) })) });

  // As many lines as the source has teams (a 다수 팀 배틀's count is known once it shows on the preview).
  const teamCount = { CUSTOM: teams.length, BROADCAST_TEAMS: 2, BATTLE: board?.settings.source === "BATTLE" && board.rows.length ? board.rows.length : TEAM_PRIZE_RANKS_MAX }[draft.source];
  const lines = Math.min(TEAM_PRIZE_RANKS_MAX, Math.max(1, teamCount, lastPrizeLine(draft.prizes) + 1));

  const save = () => {
    // Members removed from the crew since drop out; under another source, teams left empty are not kept.
    const known = new Set(members.map((m) => m.id));
    const cleaned = teams.map((team) => ({ name: team.name, memberIds: team.memberIds.filter((id) => known.has(id)) }));
    const kept = draft.source === "CUSTOM" ? cleaned : cleaned.filter((team) => team.memberIds.length);
    run(() => saveTeamPrize({ ...draft, teams: kept }), t("crewOpsBoards.teamSaved"));
  };

  return (
    <section className={styles.card} aria-labelledby="bc-teamprize">
      <div className={styles.cardHead}>
        <h2 id="bc-teamprize" className={styles.cardTitle}>
          {t("crewOpsBoards.teamTitle")}
        </h2>
        {live && <BoardVisibleToggle broadcastId={live.broadcastId} board="TEAM" visible={!!board?.visible} label={t("crewOpsBoards.teamTitle")} pending={pending} run={run} />}
      </div>
      <p className={styles.note}>{t("crewOpsBoards.teamNote")}</p>

      <form
        className={prize.form}
        onSubmit={(e) => {
          e.preventDefault();
          save();
        }}
      >
        <div className={prize.field}>
          <span className={styles.muted}>{t("crewOpsBoards.titleLabel")}</span>
          <input
            className={styles.input}
            aria-label={t("crewOpsBoards.teamTitleAria")}
            placeholder={TEAM_PRIZE_TITLE_DEFAULT}
            maxLength={PRIZE_TITLE_MAX}
            value={draft.title}
            onChange={(e) => edit({ title: e.target.value })}
          />
        </div>
        <div className={prize.field} role="group" aria-label={t("crewOpsBoards.teamBasisAria")}>
          <span className={styles.muted}>{t("crewOpsBoards.basisLabel")}</span>
          <span className={styles.segment}>
            {PRIZE_BASES.map((b) => (
              <button key={b.key} type="button" aria-pressed={draft.basis === b.key} onClick={() => edit({ basis: b.key })}>
                {t(PRIZE_BASIS_KEY[b.key])}
              </button>
            ))}
          </span>
        </div>
        <div className={prize.field} role="group" aria-label={t("crewOpsBoards.teamSource")}>
          <span className={styles.muted}>{t("crewOpsBoards.teamSource")}</span>
          <span className={styles.segment}>
            {TEAM_PRIZE_SOURCES.map((s) => (
              <button key={s.key} type="button" aria-pressed={draft.source === s.key} onClick={() => edit({ source: s.key })}>
                {t(SOURCE_KEY[s.key])}
              </button>
            ))}
          </span>
          {draft.source === "CUSTOM" && (
            <>
              <label className={styles.addRow}>
                <span className={styles.muted}>{t("crewOpsBattle.teamCount")}</span>
                <select className={styles.select} aria-label={t("crewOpsBattle.teamCount")} value={teams.length} onChange={(e) => setCount(Number(e.target.value))}>
                  {Array.from({ length: MULTI_TEAMS_MAX - MULTI_TEAMS_MIN + 1 }, (_, i) => i + MULTI_TEAMS_MIN).map((n) => (
                    <option key={n} value={n}>
                      {t("crewOpsBattle.teamsN", { n })}
                    </option>
                  ))}
                </select>
              </label>
              <div className={battle.teamNames}>
                {teams.map((team, i) => (
                  <input
                    key={i}
                    className={styles.input}
                    style={{ borderLeftColor: MULTI_TEAM_COLORS[i] }}
                    aria-label={t("crewOpsBattle.teamNameAria", { n: i + 1 })}
                    placeholder={`${MULTI_TEAM_KEYS[i]}팀`}
                    maxLength={BATTLE_TEAM_NAME_MAX}
                    value={team.name}
                    onChange={(e) => setName(i, e.target.value)}
                  />
                ))}
              </div>
              {assignable.length === 0 ? (
                <span className={styles.note}>{t("crewOpsBoards.noActiveMembers")}</span>
              ) : (
                <ul className={styles.teamPick}>
                  {assignable.map((m) => (
                    <li key={m.id}>
                      <span className={styles.dot} style={{ background: m.color }} aria-hidden="true" />
                      <span className={styles.teamName}>{m.name}</span>
                      <select className={styles.select} aria-label={t("crewOpsBroadcast.memberTeamAria", { name: m.name })} value={teamOf(m.id) >= 0 ? teamOf(m.id) : ""} onChange={(e) => assign(m.id, e.target.value === "" ? -1 : Number(e.target.value))}>
                        <option value="">{t("crewOpsBroadcast.noTeam")}</option>
                        {teams.map((team, i) => (
                          <option key={i} value={i}>
                            {team.name.trim() || `${MULTI_TEAM_KEYS[i]}팀`}
                          </option>
                        ))}
                      </select>
                    </li>
                  ))}
                </ul>
              )}
            </>
          )}
          <span className={styles.note}>{t(SOURCE_NOTE[draft.source])}</span>
        </div>
        <div className={prize.field} role="group" aria-label={t("crewOpsBoards.memberView")}>
          <span className={styles.muted}>{t("crewOpsBoards.memberView")}</span>
          <span className={styles.segment}>
            {TEAM_PRIZE_MEMBER_VIEWS.map((v) => (
              <button key={v.key} type="button" aria-pressed={draft.members === v.key} onClick={() => edit({ members: v.key })}>
                {t(MEMBER_VIEW_KEY[v.key])}
              </button>
            ))}
          </span>
          {draft.members === "SCORE" && (
            <span className={prize.inline}>
              <span className={styles.muted}>{t("crewOpsBoards.perLineBefore")}</span>
              <input
                className={styles.inputSmall}
                type="number"
                min={0}
                max={TEAM_MEMBERS_PER_LINE_MAX}
                aria-label={t("crewOpsBoards.perLineAria")}
                style={{ width: 80, flex: "none" }}
                value={draft.membersPerLine}
                onChange={(e) => edit({ membersPerLine: Math.max(0, Math.min(TEAM_MEMBERS_PER_LINE_MAX, Math.trunc(Number(e.target.value) || 0))) })}
              />
              <span className={styles.muted}>{t("crewOpsBoards.perLineAfter")}</span>
            </span>
          )}
        </div>
        <BoardDisplayField draft={draft} edit={edit} />

        <PrizeLinesField
          prizes={draft.prizes}
          lines={lines}
          note={t("crewOpsBoards.teamLinesNote")}
          onChange={(prizes) => edit({ prizes })}
        />

        <div className={styles.actions}>
          <button type="button" className={styles.ghost} disabled={pending || !dirty} onClick={() => setDraft(settings)}>
            {t("crewOps.revert")}
          </button>
          <button type="submit" className={styles.primary} disabled={pending || !dirty}>
            {t("crewOps.saveSettings")}
          </button>
        </div>
      </form>

      {!live ? (
        <p className={styles.note}>{t("crewOpsBoards.prizeIdle")}</p>
      ) : (
        <>
          {settings.basis === "WINDOW" && <PrizeWindowBar broadcastId={live.broadcastId} board="TEAM" span={board?.window ?? null} pending={pending} run={run} />}
          {dirty && <p className={styles.note}>{t("crewOpsBoards.unsavedPreview")}</p>}
          {board && board.rows.length > 0 ? (
            <ol className={prize.preview} aria-label={t("crewOpsBoards.teamPreviewAria")}>
              {board.rows.map((r) => (
                <li key={r.key}>
                  <span className={styles.rankNo}>{r.rank}</span>
                  <span className={styles.boardName}>
                    <span className={styles.dot} style={{ background: r.color }} aria-hidden="true" />
                    {r.name}
                  </span>
                  <span className={prize.previewPrize} style={r.prize?.color ? { color: r.prize.color } : undefined}>
                    {r.prize?.text ?? ""}
                  </span>
                  <strong>{formatNumber(r.score)}</strong>
                  {board.settings.members === "SCORE" && (
                    <span className={prize.previewMembers}>{r.members.length ? r.members.map((m) => `${m.name} ${formatNumber(m.score)}`).join(" · ") : t("crewOpsBoards.noTeamMembers")}</span>
                  )}
                </li>
              ))}
            </ol>
          ) : (
            <p className={styles.empty}>{board?.missing ? t(TEAM_PRIZE_MISSING[board.missing]) : t("crewOpsBoards.noTeams")}</p>
          )}
          {board && board.settings.showTotal && board.rows.length > 0 && <p className={styles.muted}>{t("crewOpsBoards.totalPoints", { n: formatNumber(board.total) })}</p>}
        </>
      )}

      <BoardAddress overlayPath={overlayPath} query="?teamprize" label={t("crewOpsBoards.teamTitle")} />
    </section>
  );
}
