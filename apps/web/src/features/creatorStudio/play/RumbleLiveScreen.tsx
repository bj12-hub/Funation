"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, useTransition, type CSSProperties } from "react";
import { useServerClock } from "@/hooks/useServerClock";
import { formatKstTime } from "@/lib/format";
import type { OverlayTarget } from "@/services/creator/alertTypes";
import { closeLiveRound, kickLivePlayer, openLive, saveLive, startLiveBattle } from "@/services/play/rumbleLive";
import {
  LIVE_BATTLE_MAX_SEC,
  LIVE_BATTLE_MIN_SEC,
  LIVE_PLAYERS_MAX,
  LIVE_PLAYERS_MIN,
  LIVE_TITLE_DEFAULT,
  LIVE_TITLE_MAX,
  type LiveResult,
  type LiveSettings,
  type LiveView
} from "@/services/play/rumbleLiveTypes";
import { shownOverlayAddress } from "../crew/overlayAddress";
import styles from "../crew/crew.module.css";
import prize from "../crew/prize.module.css";
import { OverlayOffNotice } from "../remote/OverlayOffNotice";
import { CopyButton } from "../settings/SettingsCards";
import { LIVE_COLORS } from "./playOverlayClock";
import { PlayTabs } from "./PlayTabs";
import play from "./play.module.css";

/** The form keeps numbers as typed. */
type Draft = Omit<LiveSettings, "maxPlayers" | "battleSec"> & { maxPlayers: string; battleSec: string };
const toDraft = (s: LiveSettings): Draft => ({ ...s, maxPlayers: String(s.maxPlayers), battleSec: String(s.battleSec) });
const fromDraft = (d: Draft): LiveSettings => ({ ...d, title: d.title.trim(), maxPlayers: Number(d.maxPlayers), battleSec: Number(d.battleSec) });

/**
 * 시청자 참여 게임 › 로얄 럼블 (조작형) — code-first (no Figma frame; StreamDonate 참고, P2). Route `/creator/widgets/play/live`.
 * Settings (제목 · 최대 인원 · 배틀 시간 · 링 축소), the round (참가 모집: the link to share + who joined (빼기) → 배틀 시작 →
 * 배틀 중 → 결과 순위), 회차별 결과 and the OBS address. Free: no FN or points.
 */
export function RumbleLiveScreen({ view, switches }: { view: LiveView; switches: Record<OverlayTarget, boolean> }) {
  const router = useRouter();
  const [message, setMessage] = useState<{ tone: "error" | "ok"; text: string } | null>(null);
  const [pending, startTransition] = useTransition();
  const now = useServerClock(view.serverNow);
  const [origin, setOrigin] = useState("");
  useEffect(() => setOrigin(window.location.origin), []);
  const { settings, round } = view;

  const [draft, setDraft] = useState(() => toDraft(settings));
  const synced = useRef(JSON.stringify(settings));
  useEffect(() => {
    const next = JSON.stringify(settings);
    if (next !== synced.current) {
      synced.current = next;
      setDraft(toDraft(settings));
    }
  }, [settings]);
  const edit = (patch: Partial<Draft>) => setDraft((d) => ({ ...d, ...patch }));
  const dirty = JSON.stringify(fromDraft(draft)) !== synced.current;

  // Joins and the battle move on their own while a round is on.
  const active = round && round.phase !== "DONE";
  useEffect(() => {
    if (!active) return;
    const poll = setInterval(() => router.refresh(), round?.phase === "OPEN" ? 3000 : 1000);
    return () => clearInterval(poll);
  }, [active, round?.phase, router]);

  const openId = useRef<string | null>(null);
  const startId = useRef<string | null>(null);
  const run = (action: () => Promise<LiveResult>, ok?: string, after?: () => void) => {
    setMessage(null);
    startTransition(async () => {
      const res = await action();
      if (res.status === "SAVED") {
        after?.();
        if (ok) setMessage({ tone: "ok", text: ok });
        router.refresh();
      } else if (res.status === "UNAUTHORIZED") router.push("/login?role=creator&next=/creator/widgets/play/live");
      else setMessage({ tone: "error", text: res.message });
    });
  };
  const open = () => {
    openId.current ??= crypto.randomUUID();
    const requestId = openId.current;
    run(() => openLive({ requestId }), "참가 모집을 시작했어요. 링크를 채팅에 올려 주세요.", () => (openId.current = null));
  };
  const start = () => {
    if (!round) return;
    startId.current ??= crypto.randomUUID();
    const requestId = startId.current;
    run(() => startLiveBattle({ roundId: round.id, requestId }), "배틀을 시작했어요. 3초 뒤 조종할 수 있어요.", () => (startId.current = null));
  };

  const left = round?.startAt && now !== null ? Math.max(0, Math.ceil((Date.parse(round.startAt) + round.battleSec * 1000 - now) / 1000)) : 0;
  const link = round ? `${origin}${round.invitePath}` : "";
  const color = (c: number) => LIVE_COLORS[c % LIVE_COLORS.length];

  return (
    <div className={styles.content}>
      <header className={styles.header}>
        <h1 className={styles.title}>시청자 참여 게임</h1>
        <p className={styles.subtitle}>후원 없이 채팅이나 초대 링크로 참여하는 무료 게임이에요. 점수 · FN은 움직이지 않아요.</p>
      </header>
      <OverlayOffNotice targets={["play"]} switches={switches} />
      <PlayTabs active="live" />

      {message && (
        <p className={message.tone === "error" ? styles.error : styles.ok} role={message.tone === "error" ? "alert" : "status"}>
          {message.text}
        </p>
      )}

      <section className={styles.card} aria-labelledby="live-title">
        <h2 id="live-title" className={styles.cardTitle}>
          🕹️ 로얄 럼블 (조작형)
        </h2>
        <p className={styles.note}>
          참가자가 링크에서 자기 캐릭터를 직접 조종해(조이스틱 · 키보드, 공격 버튼) 원형 링에서 싸워요. 마지막까지 남은 사람이 우승, 시간이 끝나면 체력이 많은 사람이 우승해요. 링 밖에
          있으면 체력이 줄어요.
        </p>
        <form
          className={prize.form}
          onSubmit={(e) => {
            e.preventDefault();
            run(() => saveLive(fromDraft(draft)), "로얄 럼블 (조작형) 설정을 저장했어요.");
          }}
        >
          <div className={prize.field}>
            <span className={styles.muted}>제목</span>
            <input className={styles.input} aria-label="조작형 럼블 제목" placeholder={LIVE_TITLE_DEFAULT} maxLength={LIVE_TITLE_MAX} value={draft.title} onChange={(e) => edit({ title: e.target.value })} />
          </div>
          <div className={play.row}>
            <label className={play.unit}>
              <span className={styles.muted}>최대 인원</span>
              <input
                className={styles.inputSmall}
                type="number"
                inputMode="numeric"
                aria-label="최대 인원"
                min={LIVE_PLAYERS_MIN}
                max={LIVE_PLAYERS_MAX}
                value={draft.maxPlayers}
                onChange={(e) => edit({ maxPlayers: e.target.value })}
              />
              <span className={styles.muted}>
                명 ({LIVE_PLAYERS_MIN} ~ {LIVE_PLAYERS_MAX})
              </span>
            </label>
            <label className={play.unit}>
              <span className={styles.muted}>배틀</span>
              <input
                className={styles.inputSmall}
                type="number"
                inputMode="numeric"
                aria-label="배틀 시간"
                min={LIVE_BATTLE_MIN_SEC}
                max={LIVE_BATTLE_MAX_SEC}
                value={draft.battleSec}
                onChange={(e) => edit({ battleSec: e.target.value })}
              />
              <span className={styles.muted}>
                초 ({LIVE_BATTLE_MIN_SEC} ~ {LIVE_BATTLE_MAX_SEC})
              </span>
            </label>
          </div>
          <label className={styles.checkRow}>
            <input type="checkbox" checked={draft.ringShrink} onChange={(e) => edit({ ringShrink: e.target.checked })} />
            링 축소 (배틀 1/4 · 1/2 지점에서 줄어들어요 · 마지막 1/5은 항상 서든데스)
          </label>
          <p className={styles.note}>설정은 다음 참가 모집부터 적용돼요.</p>
          <div className={styles.actions}>
            <button type="button" className={styles.ghost} disabled={pending || !dirty} onClick={() => setDraft(toDraft(settings))}>
              되돌리기
            </button>
            <button type="submit" className={styles.primary} disabled={pending || !dirty}>
              설정 저장
            </button>
          </div>
        </form>
      </section>

      <section className={styles.card} aria-labelledby="live-round-title">
        <h2 id="live-round-title" className={styles.cardTitle}>
          진행
        </h2>
        {!round && (
          <div className={prize.window}>
            <span className={styles.muted}>진행 중인 판이 없어요. 참가 모집을 시작하면 참가 링크가 생겨요.</span>
            <button type="button" className={styles.primary} disabled={pending} onClick={open}>
              참가 모집 시작
            </button>
          </div>
        )}
        {round && (
          <>
            <div className={prize.window}>
              <span className={styles.muted}>
                {round.no}회차 ·{" "}
                {round.phase === "OPEN" ? "참가 모집 중" : round.phase === "COUNTDOWN" ? "곧 시작" : round.phase === "FIGHTING" ? `배틀 중 · 생존 ${round.alive} · ${left}초 남음` : "결과"} ·{" "}
                {round.players.length}/{round.maxPlayers}명
              </span>
              {round.phase === "OPEN" && (
                <button type="button" className={styles.primary} disabled={pending || round.players.length < LIVE_PLAYERS_MIN} onClick={start}>
                  배틀 시작
                </button>
              )}
              {round.phase === "DONE" && (
                <button type="button" className={styles.primary} disabled={pending} onClick={open}>
                  다음 판 모집
                </button>
              )}
              {(round.phase === "OPEN" || round.phase === "DONE") && (
                <button type="button" className={styles.ghost} disabled={pending} onClick={() => run(() => closeLiveRound({ roundId: round.id }), round.phase === "OPEN" ? "참가 모집을 취소했어요." : "판을 닫았어요.")}>
                  {round.phase === "OPEN" ? "모집 취소" : "판 닫기"}
                </button>
              )}
            </div>
            {round.phase !== "DONE" && (
              <>
                <div className={styles.addRow}>
                  <input className={styles.input} value={link} readOnly aria-label="참가 링크" onFocus={(e) => e.target.select()} />
                  <CopyButton value={link} label="복사" className={styles.ghost} />
                </div>
                <p className={styles.note}>
                  이 링크를 채팅에 올리면 시청자가 이름을 넣고 참가해요. 참가한 사람은 같은 링크에서 조종해요. {LIVE_PLAYERS_MIN}명 이상이면 시작할 수 있어요.
                </p>
              </>
            )}
            {round.phase === "DONE" && round.standings ? (
              <ol className={play.results} aria-label="순위">
                {round.standings.map((s) => (
                  <li key={s.id} data-win={s.rank === 1 || undefined}>
                    <span className={styles.muted}>{s.rank}등</span>
                    <span className={play.who}>
                      <strong style={{ color: color(s.color) } as CSSProperties}>{s.name}</strong>
                      <span className={styles.muted}>
                        처치 {s.kills} · {s.outBy ? `${s.outBy === "링 밖" ? "링 밖 탈락" : `${s.outBy}에게 탈락`}` : `체력 ${s.hp}`}
                      </span>
                    </span>
                    {s.rank === 1 && <span className={play.badge}>우승</span>}
                  </li>
                ))}
              </ol>
            ) : round.players.length > 0 ? (
              <ul className={play.entrants} aria-label="참가자">
                {round.players.map((p) => (
                  <li key={p.id} style={{ borderColor: color(p.color) } as CSSProperties}>
                    {p.name}
                    {round.phase === "OPEN" && (
                      <button type="button" aria-label={`${p.name} 빼기`} disabled={pending} onClick={() => run(() => kickLivePlayer({ roundId: round.id, playerId: p.id }))}>
                        ✕
                      </button>
                    )}
                  </li>
                ))}
              </ul>
            ) : (
              <p className={styles.empty}>아직 참가자가 없어요.</p>
            )}
          </>
        )}
      </section>

      <section className={styles.card} aria-labelledby="live-history-title">
        <h2 id="live-history-title" className={styles.cardTitle}>
          회차별 결과
        </h2>
        {view.history.length === 0 ? (
          <p className={styles.empty}>아직 끝난 판이 없어요.</p>
        ) : (
          <ol className={play.history}>
            {view.history.map((h) => (
              <li key={h.no}>
                <span className={styles.muted}>{h.no}회차</span>
                <span className={styles.muted}>{formatKstTime(h.at, { hour: "2-digit", minute: "2-digit" })}</span>
                <span>{h.players}명</span>
                <strong>
                  🏆 {h.winner} <span className={styles.muted}>처치 {h.kills}</span>
                </strong>
              </li>
            ))}
          </ol>
        )}
      </section>

      <section className={styles.card} aria-labelledby="live-obs-title">
        <h2 id="live-obs-title" className={styles.cardTitle}>
          OBS 주소
        </h2>
        <p className={styles.note}>OBS 브라우저 소스로 추가하면 모집 화면 → 실시간 배틀 → 우승자가 나와요. 권장 크기 520 × 760. 참가 링크는 방송 화면에 나오지 않아요.</p>
        <div className={styles.addRow}>
          <input className={styles.input} value={shownOverlayAddress(origin, view.overlayPath, "?rumblelive")} readOnly aria-label="조작형 럼블 오버레이 주소" onFocus={(e) => e.target.select()} />
          <CopyButton value={`${origin}${view.overlayPath}?rumblelive`} label="복사" className={styles.ghost} />
        </div>
      </section>
    </div>
  );
}
