"use client";

import { useEffect, useState, type CSSProperties } from "react";
import { OverlayThemeRoot, ov } from "@/features/overlayTheme/OverlayThemeRoot";
import type { ResolvedTheme } from "@/services/creator/overlayThemeTypes";
import { LIVE_OBS_POLL_MS, type LiveState } from "@/services/play/rumbleLiveTypes";
import { LIVE_COLORS } from "./playOverlayClock";
import local from "./rumbleLiveOverlay.module.css";

const SHOWN_NAMES = 16;

/**
 * 로얄 럼블 (조작형) overlay (`/overlay/play/[key]?rumblelive`): the server pushes the battle on every tick
 * (`/api/play/rumble-live/[key]/stream`, 2026-11-01); where the stream cannot open, it reads `/api/play/rumble-live/[key]`
 * about ten times a second instead. 모집 중: who joined (the link itself is shared in chat, never shown here); then the arena — the ring
 * and the storm outside, every fighter where the server has it (name, HP bar; a flash when attacking), the latest
 * knockouts and the time left — and the winner with the top three. Nothing without a round (or with 리모컨 OFF).
 */
export function RumbleLiveOverlay({ overlayKey, initial, theme }: { overlayKey: string; initial: LiveState; theme: ResolvedTheme }) {
  const [state, setState] = useState(initial);
  const [skew, setSkew] = useState(() => Date.parse(initial.serverNow) - Date.now());

  useEffect(() => {
    // OBS keys out transparent pixels, so both <html> and <body> drop the page background.
    const root = document.documentElement;
    const prev = [root.style.background, document.body.style.background];
    root.style.background = "transparent";
    document.body.style.background = "transparent";
    return () => {
      [root.style.background, document.body.style.background] = prev;
    };
  }, []);
  useEffect(() => {
    let alive = true;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const show = (next: LiveState) => {
      // 기능별 새로고침 from 리모컨.
      if (next.reloadSeq !== initial.reloadSeq) return window.location.reload();
      setState(next);
      setSkew(Date.parse(next.serverNow) - Date.now());
    };
    const poll = async () => {
      try {
        const res = await fetch(`/api/play/rumble-live/${encodeURIComponent(overlayKey)}`, { cache: "no-store" });
        if (res.ok && alive) show((await res.json()) as LiveState);
      } catch {
        // The next read tries again.
      }
      if (alive) timer = setTimeout(poll, LIVE_OBS_POLL_MS);
    };
    // The stream first; reading again and again only when it cannot open (it never sent anything) or the browser has none.
    let streamed = false;
    const source = typeof EventSource === "undefined" ? null : new EventSource(`/api/play/rumble-live/${encodeURIComponent(overlayKey)}/stream`);
    if (!source) timer = setTimeout(poll, LIVE_OBS_POLL_MS);
    source?.addEventListener("message", (e) => {
      streamed = true;
      if (alive) show(JSON.parse((e as MessageEvent<string>).data) as LiveState);
    });
    source?.addEventListener("gone", () => source.close());
    source?.addEventListener("error", () => {
      // A stream that worked reconnects by itself; one that never opened is left for polling.
      if (streamed || source.readyState !== EventSource.CLOSED || !alive || timer) return;
      timer = setTimeout(poll, LIVE_OBS_POLL_MS);
    });
    return () => {
      alive = false;
      source?.close();
      clearTimeout(timer);
    };
  }, [overlayKey, initial.reloadSeq]);

  if (!state.on || state.phase === "NONE") return null;
  const color = (c: number) => LIVE_COLORS[c % LIVE_COLORS.length];
  const countdown = state.startAt ? Math.max(0, Math.ceil((Date.parse(state.startAt) - (Date.now() + skew)) / 1000)) : 0;
  const left = Math.max(0, Math.ceil(state.battleSec - state.t));
  const alive = state.fighters.filter((f) => f.alive).length;
  return (
    <OverlayThemeRoot theme={theme} className={local.pad}>
      <div className={`${ov.card} ${local.card}`}>
        <h1 className={`${ov.label} ${local.title}`}>
          {state.title}
          <span className={`${ov.chip} ${local.chip}`}>
            {state.no}회차{state.phase === "FIGHTING" && ` · ${left}초`}
          </span>
        </h1>
        {state.phase === "OPEN" ? (
          <>
            <p className={local.join}>방송 링크로 참가해서 직접 조종하세요!</p>
            <p className={ov.muted}>
              참가 {state.fighters.length} / {state.maxPlayers}명
            </p>
            <ul className={local.names}>
              {state.fighters.slice(0, SHOWN_NAMES).map((f) => (
                <li key={f.id} className={ov.chip} style={{ "--c": color(f.color) } as CSSProperties}>
                  {f.name}
                </li>
              ))}
            </ul>
          </>
        ) : (
          <>
            <p className={`${ov.muted} ${local.alive}`}>
              생존 <strong className={ov.display}>{alive}</strong> / {state.fighters.length}
            </p>
            <div className={local.arena}>
              <div className={local.ring} data-sudden={state.ring < 0.6 || undefined} style={{ "--r": state.ring } as CSSProperties} />
              {state.fighters.map((f) => (
                <span
                  key={f.id}
                  className={local.fighter}
                  data-out={!f.alive || undefined}
                  data-attack={f.attacking || undefined}
                  data-win={(state.phase === "DONE" && state.standings?.[0].id === f.id) || undefined}
                  style={{ "--x": (f.x + 1) / 2, "--y": (f.y + 1) / 2, "--c": color(f.color), "--hp": f.hp / 100 } as CSSProperties}
                >
                  <i className={local.name}>{f.name}</i>
                  <b className={local.hp} aria-hidden />
                </span>
              ))}
              {state.phase === "COUNTDOWN" && <strong className={`${ov.display} ${local.countdown}`}>{countdown || "GO"}</strong>}
            </div>
            {state.phase === "DONE" && state.standings ? (
              <div className={local.result} role="status">
                <span className={ov.muted}>🏆 우승</span>
                <strong className={ov.display}>{state.standings[0].name}</strong>
                <ol className={local.top}>
                  {state.standings.slice(0, 3).map((s) => (
                    <li key={s.id}>
                      {s.rank}등 {s.name} <span className={ov.muted}>처치 {s.kills}</span>
                    </li>
                  ))}
                </ol>
              </div>
            ) : (
              <ol className={local.feed} aria-label="탈락">
                {state.feed.map((line, i) => (
                  <li key={`${line}-${i}`}>{line}</li>
                ))}
                {state.feed.length === 0 && state.phase === "FIGHTING" && <li className={ov.muted}>싸우는 중…</li>}
              </ol>
            )}
          </>
        )}
      </div>
    </OverlayThemeRoot>
  );
}
