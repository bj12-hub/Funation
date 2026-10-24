"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";
import { useServerClock } from "@/hooks/useServerClock";
import { formatKstTime } from "@/lib/format";
import type { OverlayTarget } from "@/services/creator/alertTypes";
import type { PlaySource } from "@/services/play/playTypes";
import { addRumble, closeRumble, openRumble, removeRumble, saveRumble, startRumble } from "@/services/play/rumble";
import {
  RUMBLE_BATTLE_MAX_SEC,
  RUMBLE_BATTLE_MIN_SEC,
  RUMBLE_FILL_MAX,
  RUMBLE_KEYWORD_MAX,
  RUMBLE_NAME_MAX,
  RUMBLE_PLAYERS_MAX,
  RUMBLE_PLAYERS_MIN,
  RUMBLE_TITLE_DEFAULT,
  RUMBLE_TITLE_MAX,
  rumbleBots,
  rumbleStandings,
  type RumbleResult,
  type RumbleSettings,
  type RumbleView
} from "@/services/play/rumbleTypes";
import { PLATFORM_LABEL } from "@/types/platform";
import { shownOverlayAddress } from "../crew/overlayAddress";
import styles from "../crew/crew.module.css";
import prize from "../crew/prize.module.css";
import { OverlayOffNotice } from "../remote/OverlayOffNotice";
import { CopyButton } from "../settings/SettingsCards";
import { PlayTabs } from "./PlayTabs";
import play from "./play.module.css";

/** The form keeps numbers as typed. */
type Draft = Omit<RumbleSettings, "maxPlayers" | "fillTo" | "battleSec"> & { maxPlayers: string; fillTo: string; battleSec: string };
const toDraft = (s: RumbleSettings): Draft => ({ ...s, maxPlayers: String(s.maxPlayers), fillTo: String(s.fillTo), battleSec: String(s.battleSec) });
const fromDraft = (d: Draft): RumbleSettings => ({ ...d, title: d.title.trim(), keyword: d.keyword.trim(), maxPlayers: Number(d.maxPlayers), fillTo: Number(d.fillTo), battleSec: Number(d.battleSec) });
const sourceLabel = (s: PlaySource) => (s === "INVITE" ? "초대" : s === "MANUAL" ? "직접" : PLATFORM_LABEL[s]);

/**
 * 시청자 참여 게임 › 로얄 럼블 — code-first (no Figma frame; StreamDonate 로얄 럼블 참고, P2). Route
 * `/creator/widgets/play/rumble`: settings (명령어 · 최대 인원 · 봇 채우기 · 배틀 시간 · 링 축소 · 서든데스), the round (참가 모집 →
 * 배틀 → 결과: chat entries come in on the 3-second refresh, 직접 추가 · 빼기; the 순위 shows once the battle is over),
 * 회차별 결과 and the OBS address. Free: no FN or points.
 */
export function RumbleScreen({ view, switches }: { view: RumbleView; switches: Record<OverlayTarget, boolean> }) {
  const router = useRouter();
  const [message, setMessage] = useState<{ tone: "error" | "ok"; text: string } | null>(null);
  const [pending, startTransition] = useTransition();
  const now = useServerClock(view.serverNow);
  const [origin, setOrigin] = useState("");
  useEffect(() => setOrigin(window.location.origin), []);
  const { settings, round } = view;

  // A newer saved value (another tab, a refresh) replaces the draft; edits stay until saved.
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

  // Entries and the battle move on their own while a round is on.
  const active = round && round.status !== "DONE";
  useEffect(() => {
    if (!active) return;
    const poll = setInterval(() => router.refresh(), 3000);
    return () => clearInterval(poll);
  }, [active, router]);

  const openId = useRef<string | null>(null);
  const startId = useRef<string | null>(null);
  const [name, setName] = useState("");

  const run = (action: () => Promise<RumbleResult>, ok?: string, after?: () => void) => {
    setMessage(null);
    startTransition(async () => {
      const res = await action();
      if (res.status === "SAVED") {
        after?.();
        if (ok) setMessage({ tone: "ok", text: ok });
        router.refresh();
      } else if (res.status === "UNAUTHORIZED") router.push("/login?role=creator&next=/creator/widgets/play/rumble");
      else setMessage({ tone: "error", text: res.message });
    });
  };
  const open = () => {
    openId.current ??= crypto.randomUUID();
    const requestId = openId.current;
    run(() => openRumble({ requestId }), "참가 모집을 시작했어요.", () => (openId.current = null));
  };
  const start = () => {
    if (!round) return;
    startId.current ??= crypto.randomUUID();
    const requestId = startId.current;
    run(() => startRumble({ roundId: round.id, requestId }), "배틀을 시작했어요. OBS에서 3초 뒤 시작해요.", () => (startId.current = null));
  };

  const battle = round?.battle ?? null;
  const left = battle && now !== null ? Math.max(0, Math.ceil((Date.parse(battle.endAt) - now) / 1000)) : 0;
  const bots = battle ? battle.fighters.filter((f) => f.bot).length : round ? rumbleBots(round.entrants.length, round.fillTo) : 0;
  const fighterName = (id: string | null) => battle?.fighters.find((f) => f.id === id)?.name ?? "";

  return (
    <div className={styles.content}>
      <header className={styles.header}>
        <h1 className={styles.title}>시청자 참여 게임</h1>
        <p className={styles.subtitle}>후원 없이 채팅이나 초대 링크로 참여하는 무료 게임이에요. 점수 · FN은 움직이지 않아요.</p>
      </header>
      <OverlayOffNotice targets={["play"]} switches={switches} />
      <PlayTabs active="rumble" />

      {message && (
        <p className={message.tone === "error" ? styles.error : styles.ok} role={message.tone === "error" ? "alert" : "status"}>
          {message.text}
        </p>
      )}

      <section className={styles.card} aria-labelledby="rumble-title">
        <h2 id="rumble-title" className={styles.cardTitle}>
          ⚔️ 로얄 럼블
        </h2>
        <p className={styles.note}>
          참가자가 원형 링에서 싸우고 마지막까지 남은 한 명이 우승해요. 누가 언제 누구에게 탈락하는지는 배틀을 시작할 때 서버가 정하고, OBS는 그대로 보여줘요. 봇은 빈자리를 채울 뿐 우승하지 않아요.
        </p>
        <form
          className={prize.form}
          onSubmit={(e) => {
            e.preventDefault();
            run(() => saveRumble(fromDraft(draft)), "로얄 럼블 설정을 저장했어요.");
          }}
        >
          <div className={prize.field}>
            <span className={styles.muted}>제목</span>
            <input className={styles.input} aria-label="로얄 럼블 제목" placeholder={RUMBLE_TITLE_DEFAULT} maxLength={RUMBLE_TITLE_MAX} value={draft.title} onChange={(e) => edit({ title: e.target.value })} />
          </div>
          <div className={prize.field}>
            <span className={styles.muted}>참가 명령어</span>
            <span className={play.unit}>
              <input className={styles.inputSmall} aria-label="참가 명령어" maxLength={RUMBLE_KEYWORD_MAX} value={draft.keyword} onChange={(e) => edit({ keyword: e.target.value })} />
            </span>
            <span className={styles.note}>
              <Link href="/creator/chat">통합 채팅</Link>에 연결한 플랫폼(YouTube · 치지직 · SOOP · FlexTV) 채팅에서 명령어를 입력한 시청자가 한 번씩 참가해요.
            </span>
          </div>
          <div className={play.row}>
            <label className={play.unit}>
              <span className={styles.muted}>최대 인원</span>
              <input
                className={styles.inputSmall}
                type="number"
                inputMode="numeric"
                aria-label="최대 인원"
                min={RUMBLE_PLAYERS_MIN}
                max={RUMBLE_PLAYERS_MAX}
                value={draft.maxPlayers}
                onChange={(e) => edit({ maxPlayers: e.target.value })}
              />
              <span className={styles.muted}>
                명 ({RUMBLE_PLAYERS_MIN} ~ {RUMBLE_PLAYERS_MAX})
              </span>
            </label>
            <label className={play.unit}>
              <span className={styles.muted}>배틀</span>
              <input
                className={styles.inputSmall}
                type="number"
                inputMode="numeric"
                aria-label="배틀 시간"
                min={RUMBLE_BATTLE_MIN_SEC}
                max={RUMBLE_BATTLE_MAX_SEC}
                value={draft.battleSec}
                onChange={(e) => edit({ battleSec: e.target.value })}
              />
              <span className={styles.muted}>
                초 ({RUMBLE_BATTLE_MIN_SEC} ~ {RUMBLE_BATTLE_MAX_SEC})
              </span>
            </label>
          </div>
          <label className={play.unit}>
            <span className={styles.muted}>봇 채우기</span>
            <input className={styles.inputSmall} type="number" inputMode="numeric" aria-label="봇 채우기" min={0} max={RUMBLE_FILL_MAX} value={draft.fillTo} onChange={(e) => edit({ fillTo: e.target.value })} />
            <span className={styles.muted}>명이 될 때까지 봇으로 채워요 (0 = 봇 없음)</span>
          </label>
          <label className={styles.checkRow}>
            <input type="checkbox" checked={draft.ringShrink} onChange={(e) => edit({ ringShrink: e.target.checked })} />
            링 축소 (배틀 1/4 · 1/2 지점에서 링이 줄어들어요)
          </label>
          <label className={styles.checkRow}>
            <input type="checkbox" checked={draft.suddenDeath} onChange={(e) => edit({ suddenDeath: e.target.checked })} />
            서든데스 (마지막 1/5은 링이 계속 줄어들며 남은 사람을 몰아붙여요)
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

      <section className={styles.card} aria-labelledby="rumble-round-title">
        <h2 id="rumble-round-title" className={styles.cardTitle}>
          진행
        </h2>
        {!round && (
          <div className={prize.window}>
            <span className={styles.muted}>진행 중인 판이 없어요. 참가 모집을 시작하면 OBS에 모집 화면이 떠요.</span>
            <button type="button" className={styles.primary} disabled={pending} onClick={open}>
              참가 모집 시작
            </button>
          </div>
        )}
        {round && (
          <>
            <div className={prize.window}>
              <span className={styles.muted}>
                {round.no}회차 · {round.status === "OPEN" ? "참가 모집 중" : round.status === "FIGHTING" ? `배틀 중 · ${left}초 남음` : "결과"} · {round.entrants.length}/{round.maxPlayers}명
                {bots > 0 && ` · 봇 ${bots}`}
              </span>
              {round.status === "OPEN" && (
                <button type="button" className={styles.primary} disabled={pending || round.entrants.length < RUMBLE_PLAYERS_MIN} onClick={start}>
                  배틀 시작
                </button>
              )}
              {round.status === "DONE" && (
                <button type="button" className={styles.primary} disabled={pending} onClick={open}>
                  다음 판 모집
                </button>
              )}
              {round.status !== "FIGHTING" && (
                <button type="button" className={styles.ghost} disabled={pending} onClick={() => run(() => closeRumble({ roundId: round.id }), round.status === "OPEN" ? "참가 모집을 취소했어요." : "판을 닫았어요.")}>
                  {round.status === "OPEN" ? "모집 취소" : "판 닫기"}
                </button>
              )}
            </div>
            {round.status === "OPEN" && (
              <>
                <p className={styles.note}>
                  채팅에 <strong>{round.keyword}</strong>를 입력하면 참가해요. {RUMBLE_PLAYERS_MIN}명 이상이면 시작할 수 있어요.
                </p>
                <form
                  className={styles.addRow}
                  onSubmit={(e) => {
                    e.preventDefault();
                    run(() => addRumble({ roundId: round.id, name }), undefined, () => setName(""));
                  }}
                >
                  <input className={styles.input} aria-label="직접 추가할 이름" placeholder="이름 직접 추가" maxLength={RUMBLE_NAME_MAX} value={name} onChange={(e) => setName(e.target.value)} />
                  <button type="submit" className={styles.ghost} disabled={pending || !name.trim()}>
                    추가
                  </button>
                </form>
              </>
            )}
            {round.status !== "DONE" || !battle ? (
              round.entrants.length > 0 ? (
                <ul className={play.entrants} aria-label="참가자">
                  {round.entrants.map((e) => (
                    <li key={e.id}>
                      {e.name}
                      <span className={styles.muted}>{sourceLabel(e.source)}</span>
                      {round.status === "OPEN" && (
                        <button type="button" aria-label={`${e.name} 빼기`} disabled={pending} onClick={() => run(() => removeRumble({ roundId: round.id, entrantId: e.id }))}>
                          ✕
                        </button>
                      )}
                    </li>
                  ))}
                </ul>
              ) : (
                <p className={styles.empty}>아직 참가자가 없어요.</p>
              )
            ) : (
              <ol className={play.results} aria-label="순위">
                {rumbleStandings(battle).map((s) => (
                  <li key={s.id} data-win={s.rank === 1 || undefined}>
                    <span className={styles.muted}>{s.rank}등</span>
                    <span className={play.who}>
                      <strong>{s.name}</strong>
                      <span className={styles.muted}>
                        처치 {s.kills}
                        {s.out && (s.out.killerId ? ` · ${fighterName(s.out.killerId)}에게 탈락` : " · 링 밖 탈락")}
                      </span>
                    </span>
                    {s.rank === 1 && <span className={play.badge}>우승</span>}
                  </li>
                ))}
              </ol>
            )}
          </>
        )}
      </section>

      <section className={styles.card} aria-labelledby="rumble-history-title">
        <h2 id="rumble-history-title" className={styles.cardTitle}>
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
                <span>
                  {h.players}명{h.bots > 0 && ` + 봇 ${h.bots}`}
                  {h.topKiller && ` · 최다 처치 ${h.topKiller.name} ${h.topKiller.kills}`}
                </span>
                <strong>
                  🏆 {h.winner} <span className={styles.muted}>처치 {h.kills}</span>
                </strong>
              </li>
            ))}
          </ol>
        )}
      </section>

      <section className={styles.card} aria-labelledby="rumble-obs-title">
        <h2 id="rumble-obs-title" className={styles.cardTitle}>
          OBS 주소
        </h2>
        <p className={styles.note}>OBS 브라우저 소스로 추가하면 모집 화면 → 링 배틀 → 우승자가 나와요. 권장 크기 480 × 720.</p>
        <div className={styles.addRow}>
          <input className={styles.input} value={shownOverlayAddress(origin, view.overlayPath, "?rumble")} readOnly aria-label="로얄 럼블 오버레이 주소" onFocus={(e) => e.target.select()} />
          <CopyButton value={`${origin}${view.overlayPath}?rumble`} label="복사" className={styles.ghost} />
        </div>
      </section>
    </div>
  );
}
