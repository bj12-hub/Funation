"use client";

import { formatNumber } from "@/lib/format";
import { saveGauge, savePledges, setGaugeVisible } from "@/services/crew/crewGauge";
import {
  GAUGE_NUMBERS,
  GAUGE_TITLE_DEFAULT,
  PLEDGE_TEXT_MAX,
  PRIZE_PLACEMENTS,
  PRIZE_TITLE_MAX,
  type BroadcastResult,
  type CrewMember,
  type GaugeLive,
  type GaugeSettings,
  type MemberPledge
} from "@/services/crew/crewTypes";
import { BoardAddress, useSettingsDraft } from "./PrizeBoardPanel";
import styles from "./crew.module.css";
import gauge from "./gauge.module.css";
import prize from "./prize.module.css";

type Run = (action: () => Promise<BroadcastResult>, ok?: string) => void;
type PledgeRow = { id: string; text: string; goal: string };

/**
 * BJ 공약 · 출근 BJ 게이지 — code-first (no Figma frame; StreamDonate BJ 게이지 · BJ 공약 · 출근 참고, 2026-10-25), inside
 * `/creator/crew/broadcast`. Each member's 공약 and 목표 점수 (공약 저장; public on the 후원 페이지 and the 크루 tab), the
 * 게이지 settings (설정 저장) and, while live, OBS에 표시 and the gauge as OBS draws it (`?bjgauge`).
 */
export function GaugePanel({
  members,
  pledges,
  settings,
  live,
  overlayPath,
  pending,
  run
}: {
  members: CrewMember[];
  pledges: Record<string, MemberPledge>;
  settings: GaugeSettings;
  live: { broadcastId: string; board: GaugeLive } | null;
  overlayPath: string;
  pending: boolean;
  run: Run;
}) {
  const rowsOf = (): PledgeRow[] => members.map((m) => ({ id: m.id, text: pledges[m.id]?.text ?? "", goal: pledges[m.id]?.goal ? String(pledges[m.id].goal) : "" }));
  const pledgeDraft = useSettingsDraft(rowsOf());
  const setRow = (id: string, patch: Partial<PledgeRow>) => pledgeDraft.setDraft(pledgeDraft.draft.map((r) => (r.id === id ? { ...r, ...patch } : r)));
  const savePledgeRows = () =>
    run(
      () => savePledges({ pledges: Object.fromEntries(pledgeDraft.draft.map((r) => [r.id, { text: r.text, goal: Number(r.goal.replace(/,/g, "")) || 0 }])) }),
      "BJ 공약을 저장했어요."
    );
  const { draft, setDraft, edit, dirty } = useSettingsDraft(settings);
  const board = live?.board;

  return (
    <section className={styles.card} aria-labelledby="bc-gauge">
      <div className={styles.cardHead}>
        <h2 id="bc-gauge" className={styles.cardTitle}>
          BJ 공약 · 출근 BJ 게이지
        </h2>
        {live && (
          <label className={styles.checkRow}>
            <input
              type="checkbox"
              checked={!!board?.visible}
              disabled={pending}
              onChange={(e) => run(() => setGaugeVisible({ broadcastId: live.broadcastId, on: e.target.checked }), e.target.checked ? "OBS에 BJ 게이지를 띄웠어요." : "BJ 게이지를 내렸어요.")}
            />
            OBS에 표시
          </label>
        )}
      </div>
      <p className={styles.note}>
        멤버마다 공약과 목표 점수를 적으면 후원 페이지 · 크루 탭에 공약이 보이고, OBS 게이지가 이번 방송 점수로 목표까지 차올라요. 출근은 활동 중인 멤버예요. 공약은 화면 문구일 뿐 자동으로
        지켜지지 않아요.
      </p>

      <div className={prize.field}>
        <span className={styles.muted}>멤버별 공약 · 목표 점수</span>
        <ul className={gauge.pledges}>
          {pledgeDraft.draft.map((r) => {
            const m = members.find((x) => x.id === r.id)!;
            return (
              <li key={r.id}>
                <span className={styles.teamName}>
                  <span className={styles.dot} style={{ background: m.color }} aria-hidden="true" />
                  {m.name}
                  {!m.active && <span className={styles.chipOff}>휴식</span>}
                </span>
                <input
                  className={styles.input}
                  inputMode="numeric"
                  aria-label={`${m.name} 목표 점수`}
                  placeholder="목표 점수"
                  value={r.goal}
                  onChange={(e) => setRow(r.id, { goal: e.target.value.replace(/[^\d]/g, "").slice(0, 9) })}
                />
                <input className={styles.input} aria-label={`${m.name} 공약`} placeholder="공약 (예: 노래 한 곡)" maxLength={PLEDGE_TEXT_MAX} value={r.text} onChange={(e) => setRow(r.id, { text: e.target.value })} />
              </li>
            );
          })}
        </ul>
        <span className={styles.note}>목표 점수를 비우면 게이지 없이 공약만 보여요. 공약은 {PLEDGE_TEXT_MAX}자까지예요.</span>
        <div className={styles.actions}>
          <button type="button" className={styles.ghost} disabled={pending || !pledgeDraft.dirty} onClick={() => pledgeDraft.setDraft(rowsOf())}>
            되돌리기
          </button>
          <button type="button" className={styles.primary} disabled={pending || !pledgeDraft.dirty} onClick={savePledgeRows}>
            공약 저장
          </button>
        </div>
      </div>

      <form
        className={prize.form}
        onSubmit={(e) => {
          e.preventDefault();
          run(() => saveGauge(draft), "BJ 게이지 설정을 저장했어요.");
        }}
      >
        <div className={prize.field}>
          <span className={styles.muted}>게이지 제목</span>
          <input className={styles.input} aria-label="게이지 제목" placeholder={GAUGE_TITLE_DEFAULT} maxLength={PRIZE_TITLE_MAX} value={draft.title} onChange={(e) => edit({ title: e.target.value })} />
        </div>
        <div className={prize.field} role="group" aria-label="게이지 표시">
          <span className={styles.muted}>표시</span>
          <span className={prize.inline}>
            <label className={styles.checkRow}>
              <input type="checkbox" checked={draft.activeOnly} onChange={(e) => edit({ activeOnly: e.target.checked })} />
              출근 BJ만
            </label>
            <label className={styles.checkRow}>
              <input type="checkbox" checked={draft.showPledge} onChange={(e) => edit({ showPledge: e.target.checked })} />
              공약
            </label>
            <span className={styles.segment} role="group" aria-label="숫자 표시">
              {GAUGE_NUMBERS.map((n) => (
                <button key={n.key} type="button" aria-pressed={draft.numbers === n.key} onClick={() => edit({ numbers: n.key })}>
                  {n.label}
                </button>
              ))}
            </span>
            <span className={styles.segment} role="group" aria-label="게이지 배치">
              {PRIZE_PLACEMENTS.map((p) => (
                <button key={p.key} type="button" aria-pressed={draft.placement === p.key} onClick={() => edit({ placement: p.key })}>
                  {p.label}
                </button>
              ))}
            </span>
          </span>
        </div>
        <div className={styles.actions}>
          <button type="button" className={styles.ghost} disabled={pending || !dirty} onClick={() => setDraft(settings)}>
            되돌리기
          </button>
          <button type="submit" className={styles.primary} disabled={pending || !dirty}>
            설정 저장
          </button>
        </div>
      </form>

      {!board ? (
        <p className={styles.note}>방송을 시작하면 실시간 미리보기와 OBS 표시 버튼이 나와요.</p>
      ) : board.rows.length === 0 ? (
        <p className={styles.empty}>목표 점수를 적은 {board.settings.activeOnly ? "출근 " : ""}멤버가 없어요.</p>
      ) : (
        <ol className={gauge.preview} aria-label="BJ 게이지 미리보기">
          {board.rows.map((r) => (
            <li key={r.memberId}>
              <span className={styles.boardName}>
                <span className={styles.dot} style={{ background: r.color }} aria-hidden="true" />
                {r.name}
                {r.reached && <span className={styles.chip}>달성</span>}
              </span>
              <span className={gauge.track} aria-hidden="true">
                <span className={gauge.fill} style={{ width: `${r.percent}%`, background: r.color }} />
              </span>
              <span className={styles.muted}>
                {formatNumber(r.score)} / {formatNumber(r.goal)} · {r.percent}%
              </span>
              {r.pledge && <span className={gauge.pledge}>공약 · {r.pledge}</span>}
            </li>
          ))}
        </ol>
      )}

      <BoardAddress overlayPath={overlayPath} query="?bjgauge" label="BJ 게이지" />
    </section>
  );
}
