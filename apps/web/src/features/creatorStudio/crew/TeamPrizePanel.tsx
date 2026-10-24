"use client";

import { formatNumber } from "@/lib/format";
import { saveTeamPrize } from "@/services/crew/crewPrizeBoard";
import {
  BATTLE_TEAM_NAME_MAX,
  MULTI_TEAM_COLORS,
  MULTI_TEAM_KEYS,
  MULTI_TEAMS_MAX,
  MULTI_TEAMS_MIN,
  PRIZE_BASES,
  PRIZE_TITLE_MAX,
  TEAM_PRIZE_MEMBER_VIEWS,
  TEAM_PRIZE_RANKS_MAX,
  TEAM_PRIZE_SOURCES,
  TEAM_PRIZE_TITLE_DEFAULT,
  type BroadcastResult,
  type CrewMember,
  type TeamPrizeLive,
  type TeamPrizeMissing,
  type TeamPrizeSettings
} from "@/services/crew/crewTypes";
import { BoardAddress, BoardDisplayField, BoardVisibleToggle, PrizeLinesField, PrizeWindowBar, lastPrizeLine, useSettingsDraft } from "./PrizeBoardPanel";
import styles from "./crew.module.css";
import battle from "./battle.module.css";
import prize from "./prize.module.css";

/** What the preview says when the source gives no teams. */
export const TEAM_PRIZE_MISSING: Record<TeamPrizeMissing, string> = {
  NO_TEAMS: "직접 구성한 팀이 없어요. 팀을 2개 이상 만들어 저장해 주세요.",
  NOT_TEAM_MODE: "팀 모드 방송이 아니에요. 방송을 팀 모드로 시작하면 A팀 · B팀으로 순위를 매겨요.",
  NO_BATTLE: "이 방송에 다수 팀 배틀이 아직 없어요. 다수 팀 배틀을 시작하면 그 팀으로 순위를 매겨요."
};

const SOURCE_NOTE: Record<TeamPrizeSettings["source"], string> = {
  CUSTOM: "팀마다 멤버를 한 명 이상 넣어 주세요. 한 멤버는 한 팀에만 들어가요.",
  BROADCAST_TEAMS: "팀 모드로 시작한 방송의 A팀 · B팀으로 순위를 매겨요.",
  BATTLE: "진행 중인 다수 팀 배틀의 팀(없으면 마지막 다수 팀 배틀)으로 순위를 매겨요. 점수는 배틀 점수가 아니라 이 순위표의 집계 기준대로예요."
};

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
  const { draft, setDraft, edit, dirty } = useSettingsDraft(settings);
  const board = live?.board;

  // 직접 구성: start from two empty teams; a member is in one team at most.
  const teams = draft.teams.length >= MULTI_TEAMS_MIN ? draft.teams : Array.from({ length: MULTI_TEAMS_MIN }, (_, i) => draft.teams[i] ?? { name: "", memberIds: [] });
  const teamOf = (id: string) => teams.findIndex((t) => t.memberIds.includes(id));
  const assignable = members.filter((m) => m.active || teamOf(m.id) >= 0);
  const setCount = (n: number) => edit({ teams: Array.from({ length: n }, (_, i) => teams[i] ?? { name: "", memberIds: [] }) });
  const setName = (i: number, name: string) => edit({ teams: teams.map((t, j) => (j === i ? { ...t, name } : t)) });
  const assign = (id: string, to: number) => edit({ teams: teams.map((t, j) => ({ ...t, memberIds: j === to ? [...t.memberIds.filter((x) => x !== id), id] : t.memberIds.filter((x) => x !== id) })) });

  // As many lines as the source has teams (a 다수 팀 배틀's count is known once it shows on the preview).
  const teamCount = { CUSTOM: teams.length, BROADCAST_TEAMS: 2, BATTLE: board?.settings.source === "BATTLE" && board.rows.length ? board.rows.length : TEAM_PRIZE_RANKS_MAX }[draft.source];
  const lines = Math.min(TEAM_PRIZE_RANKS_MAX, Math.max(1, teamCount, lastPrizeLine(draft.prizes) + 1));

  const save = () => {
    // Members removed from the crew since drop out; under another source, teams left empty are not kept.
    const known = new Set(members.map((m) => m.id));
    const cleaned = teams.map((t) => ({ name: t.name, memberIds: t.memberIds.filter((id) => known.has(id)) }));
    const kept = draft.source === "CUSTOM" ? cleaned : cleaned.filter((t) => t.memberIds.length);
    run(() => saveTeamPrize({ ...draft, teams: kept }), "팀 순위표 설정을 저장했어요.");
  };

  return (
    <section className={styles.card} aria-labelledby="bc-teamprize">
      <div className={styles.cardHead}>
        <h2 id="bc-teamprize" className={styles.cardTitle}>
          팀 순위표
        </h2>
        {live && <BoardVisibleToggle broadcastId={live.broadcastId} board="TEAM" visible={!!board?.visible} label="팀 순위표" pending={pending} run={run} />}
      </div>
      <p className={styles.note}>
        팀 점수(팀원 점수의 합)로 순위를 매기고 등수마다 상품 · 벌칙을 적어 OBS에 띄워요. 팀은 직접 만들거나, 방송의 A팀 · B팀 또는 다수 팀 배틀의 팀을 그대로 써요. 상품은 화면
        문구일 뿐 지급되지 않아요.
      </p>

      <form
        className={prize.form}
        onSubmit={(e) => {
          e.preventDefault();
          save();
        }}
      >
        <div className={prize.field}>
          <span className={styles.muted}>제목</span>
          <input
            className={styles.input}
            aria-label="팀 순위표 제목"
            placeholder={TEAM_PRIZE_TITLE_DEFAULT}
            maxLength={PRIZE_TITLE_MAX}
            value={draft.title}
            onChange={(e) => edit({ title: e.target.value })}
          />
        </div>
        <div className={prize.field} role="group" aria-label="팀 순위표 집계 기준">
          <span className={styles.muted}>집계 기준</span>
          <span className={styles.segment}>
            {PRIZE_BASES.map((b) => (
              <button key={b.key} type="button" aria-pressed={draft.basis === b.key} onClick={() => edit({ basis: b.key })}>
                {b.label}
              </button>
            ))}
          </span>
        </div>
        <div className={prize.field} role="group" aria-label="팀 구성">
          <span className={styles.muted}>팀 구성</span>
          <span className={styles.segment}>
            {TEAM_PRIZE_SOURCES.map((s) => (
              <button key={s.key} type="button" aria-pressed={draft.source === s.key} onClick={() => edit({ source: s.key })}>
                {s.label}
              </button>
            ))}
          </span>
          {draft.source === "CUSTOM" && (
            <>
              <label className={styles.addRow}>
                <span className={styles.muted}>팀 수</span>
                <select className={styles.select} aria-label="팀 수" value={teams.length} onChange={(e) => setCount(Number(e.target.value))}>
                  {Array.from({ length: MULTI_TEAMS_MAX - MULTI_TEAMS_MIN + 1 }, (_, i) => i + MULTI_TEAMS_MIN).map((n) => (
                    <option key={n} value={n}>
                      {n}팀
                    </option>
                  ))}
                </select>
              </label>
              <div className={battle.teamNames}>
                {teams.map((t, i) => (
                  <input
                    key={i}
                    className={styles.input}
                    style={{ borderLeftColor: MULTI_TEAM_COLORS[i] }}
                    aria-label={`${i + 1}번 팀 이름`}
                    placeholder={`${MULTI_TEAM_KEYS[i]}팀`}
                    maxLength={BATTLE_TEAM_NAME_MAX}
                    value={t.name}
                    onChange={(e) => setName(i, e.target.value)}
                  />
                ))}
              </div>
              {assignable.length === 0 ? (
                <span className={styles.note}>활동 중인 멤버가 없어요.</span>
              ) : (
                <ul className={styles.teamPick}>
                  {assignable.map((m) => (
                    <li key={m.id}>
                      <span className={styles.dot} style={{ background: m.color }} aria-hidden="true" />
                      <span className={styles.teamName}>{m.name}</span>
                      <select className={styles.select} aria-label={`${m.name} 팀`} value={teamOf(m.id) >= 0 ? teamOf(m.id) : ""} onChange={(e) => assign(m.id, e.target.value === "" ? -1 : Number(e.target.value))}>
                        <option value="">없음</option>
                        {teams.map((t, i) => (
                          <option key={i} value={i}>
                            {t.name.trim() || `${MULTI_TEAM_KEYS[i]}팀`}
                          </option>
                        ))}
                      </select>
                    </li>
                  ))}
                </ul>
              )}
            </>
          )}
          <span className={styles.note}>{SOURCE_NOTE[draft.source]}</span>
        </div>
        <div className={prize.field} role="group" aria-label="팀원 표시">
          <span className={styles.muted}>팀원 표시</span>
          <span className={styles.segment}>
            {TEAM_PRIZE_MEMBER_VIEWS.map((v) => (
              <button key={v.key} type="button" aria-pressed={draft.members === v.key} onClick={() => edit({ members: v.key })}>
                {v.label}
              </button>
            ))}
          </span>
        </div>
        <BoardDisplayField draft={draft} edit={edit} />

        <PrizeLinesField
          prizes={draft.prizes}
          lines={lines}
          note="칸 수는 순위에 들어가는 팀 수예요. 글자색을 고르지 않으면 오버레이 테마의 글자색으로 보여요."
          onChange={(prizes) => edit({ prizes })}
        />

        <div className={styles.actions}>
          <button type="button" className={styles.ghost} disabled={pending || !dirty} onClick={() => setDraft(settings)}>
            되돌리기
          </button>
          <button type="submit" className={styles.primary} disabled={pending || !dirty}>
            설정 저장
          </button>
        </div>
      </form>

      {!live ? (
        <p className={styles.note}>방송을 시작하면 실시간 미리보기와 OBS 표시 · 구간 시작 버튼이 나와요.</p>
      ) : (
        <>
          {settings.basis === "WINDOW" && <PrizeWindowBar broadcastId={live.broadcastId} board="TEAM" span={board?.window ?? null} pending={pending} run={run} />}
          {dirty && <p className={styles.note}>저장하지 않은 설정이 있어요. 미리보기와 OBS는 저장한 설정으로 보여요.</p>}
          {board && board.rows.length > 0 ? (
            <ol className={prize.preview} aria-label="팀 순위표 미리보기">
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
                    <span className={prize.previewMembers}>{r.members.length ? r.members.map((m) => `${m.name} ${formatNumber(m.score)}`).join(" · ") : "팀원 없음"}</span>
                  )}
                </li>
              ))}
            </ol>
          ) : (
            <p className={styles.empty}>{board?.missing ? TEAM_PRIZE_MISSING[board.missing] : "순위에 넣을 팀이 없어요."}</p>
          )}
          {board && board.settings.showTotal && board.rows.length > 0 && <p className={styles.muted}>합계 {formatNumber(board.total)}점</p>}
        </>
      )}

      <BoardAddress overlayPath={overlayPath} query="?teamprize" label="팀 순위표" />
    </section>
  );
}
