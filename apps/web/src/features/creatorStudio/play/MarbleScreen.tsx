"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";
import { useServerClock } from "@/hooks/useServerClock";
import { formatKstTime } from "@/lib/format";
import type { OverlayTarget } from "@/services/creator/alertTypes";
import { addMarble, closeMarble, openMarble, removeMarble, saveMarble, startMarble } from "@/services/play/marble";
import {
  MARBLE_KEYWORD_MAX,
  MARBLE_MAPS,
  MARBLE_MODES,
  MARBLE_NAME_MAX,
  MARBLE_PLAYERS_MAX,
  MARBLE_PLAYERS_MIN,
  MARBLE_RACE_MAX_SEC,
  MARBLE_RACE_MIN_SEC,
  MARBLE_TITLE_DEFAULT,
  MARBLE_TITLE_MAX,
  MARBLE_WIN_RULES,
  type MarbleResult,
  type MarbleSettings,
  type MarbleSource,
  type MarbleView
} from "@/services/play/marbleTypes";
import { PLATFORM_LABEL } from "@/types/platform";
import { shownOverlayAddress } from "../crew/overlayAddress";
import styles from "../crew/crew.module.css";
import prize from "../crew/prize.module.css";
import { OverlayOffNotice } from "../remote/OverlayOffNotice";
import { CopyButton } from "../settings/SettingsCards";
import { PlayTabs } from "./PlayTabs";
import play from "./play.module.css";

/** The form keeps numbers as typed. */
type Draft = Omit<MarbleSettings, "maxPlayers" | "winRank" | "raceSec"> & { maxPlayers: string; winRank: string; raceSec: string };
const toDraft = (s: MarbleSettings): Draft => ({ ...s, maxPlayers: String(s.maxPlayers), winRank: String(s.winRank), raceSec: String(s.raceSec) });
const fromDraft = (d: Draft): MarbleSettings => ({ ...d, title: d.title.trim(), keyword: d.keyword.trim(), maxPlayers: Number(d.maxPlayers), winRank: Number(d.winRank), raceSec: Number(d.raceSec) });
const sourceLabel = (s: MarbleSource) => (s === "INVITE" ? "초대" : s === "MANUAL" ? "직접" : PLATFORM_LABEL[s]);

/**
 * 시청자 참여 게임 — code-first (no Figma frame; StreamDonate 마블 룰렛 참고, P2). Route `/creator/widgets/play`. 마블 룰렛:
 * settings (참가 방식 · 명령어 · 최대 인원 · 맵 · 당첨 · 레이스 시간 · 스킬), the round (참가 모집 → 레이스 → 결과: chat and
 * 초대 링크 entries come in on the 3-second refresh, 직접 추가 · 빼기), 회차별 결과 and the OBS address. Free: no FN or points.
 */
export function MarbleScreen({ view, switches }: { view: MarbleView; switches: Record<OverlayTarget, boolean> }) {
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

  // Entries and the race move on their own while a round is on.
  const active = round && round.status !== "DONE";
  useEffect(() => {
    if (!active) return;
    const poll = setInterval(() => router.refresh(), 3000);
    return () => clearInterval(poll);
  }, [active, router]);

  const openId = useRef<string | null>(null);
  const startId = useRef<string | null>(null);
  const [name, setName] = useState("");

  const run = (action: () => Promise<MarbleResult>, ok?: string, after?: () => void) => {
    setMessage(null);
    startTransition(async () => {
      const res = await action();
      if (res.status === "SAVED") {
        after?.();
        if (ok) setMessage({ tone: "ok", text: ok });
        router.refresh();
      } else if (res.status === "UNAUTHORIZED") router.push("/login?role=creator&next=/creator/widgets/play");
      else setMessage({ tone: "error", text: res.message });
    });
  };
  const open = () => {
    openId.current ??= crypto.randomUUID();
    const requestId = openId.current;
    run(() => openMarble({ requestId }), "참가 모집을 시작했어요.", () => (openId.current = null));
  };
  const start = () => {
    if (!round) return;
    startId.current ??= crypto.randomUUID();
    const requestId = startId.current;
    run(() => startMarble({ roundId: round.id, requestId }), "레이스를 시작했어요. OBS에서 3초 뒤 출발해요.", () => (startId.current = null));
  };

  const race = round?.race ?? null;
  const left = race && now !== null ? Math.max(0, Math.ceil((Date.parse(race.finishAt) - now) / 1000)) : 0;
  const name0 = (id: string) => round?.entrants.find((e) => e.id === id)?.name ?? "";

  return (
    <div className={styles.content}>
      <header className={styles.header}>
        <h1 className={styles.title}>시청자 참여 게임</h1>
        <p className={styles.subtitle}>후원 없이 채팅이나 초대 링크로 참여하는 무료 게임이에요. 점수 · FN은 움직이지 않아요.</p>
      </header>
      <OverlayOffNotice targets={["play"]} switches={switches} />
      <PlayTabs active="marble" />

      {message && (
        <p className={message.tone === "error" ? styles.error : styles.ok} role={message.tone === "error" ? "alert" : "status"}>
          {message.text}
        </p>
      )}

      <section className={styles.card} aria-labelledby="marble-title">
        <h2 id="marble-title" className={styles.cardTitle}>
          🔮 마블 룰렛
        </h2>
        <p className={styles.note}>
          참가자 구슬이 코스를 굴러 내려가요. 순서는 레이스를 시작할 때 서버가 정하고, OBS는 그 순서대로 구슬을 굴려요. 1등 · 꼴등 · N등 중 정한 순위가 당첨이에요.
        </p>
        <form
          className={prize.form}
          onSubmit={(e) => {
            e.preventDefault();
            run(() => saveMarble(fromDraft(draft)), "마블 룰렛 설정을 저장했어요.");
          }}
        >
          <div className={prize.field}>
            <span className={styles.muted}>제목</span>
            <input className={styles.input} aria-label="마블 룰렛 제목" placeholder={MARBLE_TITLE_DEFAULT} maxLength={MARBLE_TITLE_MAX} value={draft.title} onChange={(e) => edit({ title: e.target.value })} />
          </div>
          <div className={prize.field} role="group" aria-label="참가 방식">
            <span className={styles.muted}>참가 방식</span>
            <span className={prize.inline}>
              <span className={styles.segment}>
                {MARBLE_MODES.map((m) => (
                  <button key={m.key} type="button" aria-pressed={draft.mode === m.key} onClick={() => edit({ mode: m.key })}>
                    {m.label}
                  </button>
                ))}
              </span>
              {draft.mode === "CHAT" && (
                <span className={play.unit}>
                  <span className={styles.muted}>명령어</span>
                  <input className={styles.inputSmall} aria-label="참가 명령어" maxLength={MARBLE_KEYWORD_MAX} value={draft.keyword} onChange={(e) => edit({ keyword: e.target.value })} />
                </span>
              )}
            </span>
            <span className={styles.note}>
              {draft.mode === "CHAT" ? (
                <>
                  <Link href="/creator/chat">통합 채팅</Link>에 연결한 플랫폼(YouTube · 치지직 · SOOP · FlexTV) 채팅에서 명령어를 입력한 시청자가 한 번씩 참가해요.
                </>
              ) : (
                "참가 모집을 시작하면 초대 링크가 생겨요. 링크를 받은 사람만 이름을 넣고 참가해요(채팅 참가 없음)."
              )}
            </span>
          </div>
          <div className={prize.field} role="group" aria-label="맵">
            <span className={styles.muted}>맵</span>
            <span className={styles.segment}>
              {MARBLE_MAPS.map((m) => (
                <button key={m.key} type="button" aria-pressed={draft.map === m.key} onClick={() => edit({ map: m.key })}>
                  {m.label}
                </button>
              ))}
            </span>
          </div>
          <div className={prize.field} role="group" aria-label="당첨">
            <span className={styles.muted}>당첨</span>
            <span className={prize.inline}>
              <span className={styles.segment}>
                {MARBLE_WIN_RULES.map((r) => (
                  <button key={r.key} type="button" aria-pressed={draft.winRule === r.key} onClick={() => edit({ winRule: r.key })}>
                    {r.label}
                  </button>
                ))}
              </span>
              {draft.winRule === "RANK" && (
                <span className={play.unit}>
                  <input
                    className={styles.inputSmall}
                    type="number"
                    inputMode="numeric"
                    aria-label="당첨 순위"
                    min={1}
                    max={MARBLE_PLAYERS_MAX}
                    value={draft.winRank}
                    onChange={(e) => edit({ winRank: e.target.value })}
                  />
                  <span className={styles.muted}>등 (참가자보다 크면 꼴등)</span>
                </span>
              )}
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
                min={MARBLE_PLAYERS_MIN}
                max={MARBLE_PLAYERS_MAX}
                value={draft.maxPlayers}
                onChange={(e) => edit({ maxPlayers: e.target.value })}
              />
              <span className={styles.muted}>
                명 ({MARBLE_PLAYERS_MIN} ~ {MARBLE_PLAYERS_MAX})
              </span>
            </label>
            <label className={play.unit}>
              <span className={styles.muted}>레이스</span>
              <input
                className={styles.inputSmall}
                type="number"
                inputMode="numeric"
                aria-label="레이스 시간"
                min={MARBLE_RACE_MIN_SEC}
                max={MARBLE_RACE_MAX_SEC}
                value={draft.raceSec}
                onChange={(e) => edit({ raceSec: e.target.value })}
              />
              <span className={styles.muted}>초</span>
            </label>
          </div>
          <label className={styles.checkRow}>
            <input type="checkbox" checked={draft.skills} onChange={(e) => edit({ skills: e.target.checked })} />
            스킬 연출 (부스트 · 순간이동 · 역주행 · 멈춤 — 연출일 뿐 순위는 바뀌지 않아요)
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

      <section className={styles.card} aria-labelledby="marble-round-title">
        <h2 id="marble-round-title" className={styles.cardTitle}>
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
                {round.no}회차 · {round.status === "OPEN" ? "참가 모집 중" : round.status === "RACING" ? `레이스 중 · ${left}초 남음` : "결과"} · {round.entrants.length}/{round.maxPlayers}명 · 당첨{" "}
                {round.rule}
              </span>
              {round.status === "OPEN" && (
                <button type="button" className={styles.primary} disabled={pending || round.entrants.length < MARBLE_PLAYERS_MIN} onClick={start}>
                  레이스 시작
                </button>
              )}
              {round.status === "DONE" && (
                <button type="button" className={styles.primary} disabled={pending} onClick={open}>
                  다음 판 모집
                </button>
              )}
              {round.status !== "RACING" && (
                <button type="button" className={styles.ghost} disabled={pending} onClick={() => run(() => closeMarble({ roundId: round.id }), round.status === "OPEN" ? "참가 모집을 취소했어요." : "판을 닫았어요.")}>
                  {round.status === "OPEN" ? "모집 취소" : "판 닫기"}
                </button>
              )}
            </div>
            {round.status === "OPEN" && (
              <>
                {round.mode === "CHAT" ? (
                  <p className={styles.note}>
                    채팅에 <strong>{round.keyword}</strong>를 입력하면 참가해요. {MARBLE_PLAYERS_MIN}명 이상이면 시작할 수 있어요.
                  </p>
                ) : (
                  view.invitePath && (
                    <div className={styles.addRow}>
                      <input className={styles.input} value={`${origin}${view.invitePath}`} readOnly aria-label="초대 링크" onFocus={(e) => e.target.select()} />
                      <CopyButton value={`${origin}${view.invitePath}`} label="복사" className={styles.ghost} />
                    </div>
                  )
                )}
                <form
                  className={styles.addRow}
                  onSubmit={(e) => {
                    e.preventDefault();
                    run(() => addMarble({ roundId: round.id, name }), undefined, () => setName(""));
                  }}
                >
                  <input className={styles.input} aria-label="직접 추가할 이름" placeholder="이름 직접 추가" maxLength={MARBLE_NAME_MAX} value={name} onChange={(e) => setName(e.target.value)} />
                  <button type="submit" className={styles.ghost} disabled={pending || !name.trim()}>
                    추가
                  </button>
                </form>
              </>
            )}
            {round.status !== "DONE" ? (
              round.entrants.length > 0 ? (
                <ul className={play.entrants} aria-label="참가자">
                  {round.entrants.map((e) => (
                    <li key={e.id}>
                      {e.name}
                      <span className={styles.muted}>{sourceLabel(e.source)}</span>
                      {round.status === "OPEN" && (
                        <button type="button" aria-label={`${e.name} 빼기`} disabled={pending} onClick={() => run(() => removeMarble({ roundId: round.id, entrantId: e.id }))}>
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
              race && (
                <ol className={play.results} aria-label="결과">
                  {race.order.map((id, i) => (
                    <li key={id} data-win={id === race.winnerId || undefined}>
                      <span className={styles.muted}>{i + 1}등</span>
                      <strong>{name0(id)}</strong>
                      {id === race.winnerId && <span className={play.badge}>당첨</span>}
                    </li>
                  ))}
                </ol>
              )
            )}
          </>
        )}
      </section>

      <section className={styles.card} aria-labelledby="marble-history-title">
        <h2 id="marble-history-title" className={styles.cardTitle}>
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
                  {h.players}명 · {MARBLE_MAPS.find((m) => m.key === h.map)!.label} · {h.rule} 당첨
                </span>
                <strong>{h.winner}</strong>
              </li>
            ))}
          </ol>
        )}
      </section>

      <section className={styles.card} aria-labelledby="marble-obs-title">
        <h2 id="marble-obs-title" className={styles.cardTitle}>
          OBS 주소
        </h2>
        <p className={styles.note}>OBS 브라우저 소스로 추가하면 모집 화면 → 구슬 레이스 → 당첨 결과가 나와요. 권장 크기 480 × 720.</p>
        <div className={styles.addRow}>
          <input className={styles.input} value={shownOverlayAddress(origin, view.overlayPath, "?marble")} readOnly aria-label="마블 룰렛 오버레이 주소" onFocus={(e) => e.target.select()} />
          <CopyButton value={`${origin}${view.overlayPath}?marble`} label="복사" className={styles.ghost} />
        </div>
      </section>
    </div>
  );
}
