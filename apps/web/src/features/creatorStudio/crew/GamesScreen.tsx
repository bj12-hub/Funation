"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import { useServerClock } from "@/hooks/useServerClock";
import type { OverlayTarget } from "@/services/creator/alertTypes";
import type { BroadcastResult, GamesView } from "@/services/crew/crewTypes";
import { OverlayOffNotice } from "../remote/OverlayOffNotice";
import { CrewTabs } from "./CrewTabs";
import { DiceGamePanel } from "./DiceGamePanel";
import { JupjupPanel } from "./JupjupPanel";
import { MedleyPanel } from "./MedleyPanel";
import { SigBingoPanel } from "./SigBingoPanel";
import { GridDrawPanel } from "./GridDrawPanel";
import { SigHunterPanel } from "./SigHunterPanel";
import { SigDosanPanel } from "./SigDosanPanel";
import { AlphabetPanel } from "./AlphabetPanel";
import { GoStopPanel } from "./GoStopPanel";
import { RandomSigPanel } from "./RandomSigPanel";
import { RelayPanel } from "./RelayPanel";
import { SpinMachinePanel } from "./SpinMachinePanel";
import { TwoWheelPanel } from "./TwoWheelPanel";
import styles from "./crew.module.css";
import games from "./games.module.css";

/**
 * 점수 게임 — code-first (no Figma frame; StreamDonate 점수 게임 참고, P2). Route `/creator/crew/games`. Games whose results
 * are crew points (display scores — FN never moves): 스핀머신 · 주사위 게임 · 투휠 게임 · 랜덤시그 · 기여도 릴레이 · 줍줍 · 시그니처 메들리 · 시그 빙고 · 복불복 뽑기판 · 시그니처 헌터 · 시그니처 두산 · 알파벳 모으기 · 고스톱. Settings work any time; runs need a live
 * broadcast (started on 방송 운영). Refreshes from the server every few seconds while live (자동 runs from donations).
 */
export function GamesScreen({ view, switches }: { view: GamesView; switches: Record<OverlayTarget, boolean> }) {
  const router = useRouter();
  const [message, setMessage] = useState<{ tone: "error" | "ok"; text: string } | null>(null);
  const [pending, startTransition] = useTransition();
  const liveId = view.live?.id ?? null;
  const now = useServerClock(view.live?.serverNow ?? null);

  useEffect(() => {
    if (!liveId) return;
    const poll = setInterval(() => router.refresh(), 3000);
    return () => clearInterval(poll);
  }, [liveId, router]);

  const run = (action: () => Promise<BroadcastResult>, ok?: string) => {
    setMessage(null);
    startTransition(async () => {
      const res = await action();
      if (res.status === "SAVED") {
        if (ok) setMessage({ tone: "ok", text: ok });
        router.refresh();
      } else if (res.status === "UNAUTHORIZED") router.push("/login?role=creator&next=/creator/crew/games");
      else setMessage({ tone: "error", text: res.message });
    });
  };

  return (
    <div className={styles.content}>
      <header className={styles.header}>
        <h1 className={styles.title}>크루 관리</h1>
        <p className={styles.subtitle}>
          방송 중 후원으로 돌아가는 점수 게임이에요. 결과는 서버가 정하고, OBS에서 결과가 나온 뒤 점수판에 들어가요. 표시 점수일 뿐 FN은 움직이지 않아요.
        </p>
      </header>
      <OverlayOffNotice targets={["crew"]} switches={switches} />
      <CrewTabs active="games" />

      {message && (
        <p className={message.tone === "error" ? styles.error : styles.ok} role={message.tone === "error" ? "alert" : "status"}>
          {message.text}
        </p>
      )}
      {!view.live && <p className={styles.note}>진행 중인 방송이 없어요. 설정은 지금 저장할 수 있고, 게임은 방송 운영에서 방송을 시작하면 돌아가요.</p>}
      <nav className={games.jump} aria-label="게임 바로가기">
        <a href="#game-spin">🎰 스핀머신</a>
        <a href="#game-dice">🎲 주사위 게임</a>
        <a href="#game-twowheel">🎡 투휠 게임</a>
        <a href="#game-randomsig">🔀 랜덤시그</a>
        <a href="#game-relay">🔗 기여도 릴레이</a>
        <a href="#game-jupjup">🎁 줍줍</a>
        <a href="#game-medley">🎶 시그니처 메들리</a>
        <a href="#game-sigbingo">🎯 시그 빙고</a>
        <a href="#game-griddraw">🎟️ 복불복 뽑기판</a>
        <a href="#game-sighunter">🏹 시그니처 헌터</a>
        <a href="#game-sigdosan">🚀 시그니처 두산</a>
        <a href="#game-alphabet">🔤 알파벳 모으기</a>
        <a href="#game-gostop">🎴 고스톱</a>
      </nav>

      <SpinMachinePanel settings={view.spinSettings} signatures={view.signatures} members={view.members} live={view.live} now={now} overlayPath={view.overlayPath} pending={pending} run={run} />
      <DiceGamePanel settings={view.diceSettings} signatures={view.signatures} members={view.members} live={view.live} now={now} overlayPath={view.overlayPath} pending={pending} run={run} />
      <TwoWheelPanel settings={view.twoWheelSettings} signatures={view.signatures} members={view.members} live={view.live} now={now} overlayPath={view.overlayPath} pending={pending} run={run} />
      <RandomSigPanel settings={view.randomSigSettings} signatures={view.signatures} live={view.live} now={now} overlayPath={view.overlayPath} pending={pending} run={run} />
      <RelayPanel settings={view.relaySettings} signatures={view.signatures} members={view.members} live={view.live} now={now} overlayPath={view.overlayPath} pending={pending} run={run} />
      <JupjupPanel settings={view.jupjupSettings} signatures={view.signatures} members={view.members} live={view.live} now={now} overlayPath={view.overlayPath} pending={pending} run={run} />
      <MedleyPanel settings={view.medleySettings} randomSig={view.randomSigSettings} signatures={view.signatures} live={view.live} now={now} overlayPath={view.overlayPath} pending={pending} run={run} />
      <SigBingoPanel settings={view.sigBingoSettings} signatures={view.signatures} members={view.members} live={view.live} now={now} overlayPath={view.overlayPath} pending={pending} run={run} />
      <GridDrawPanel settings={view.gridDrawSettings} signatures={view.signatures} members={view.members} live={view.live} now={now} overlayPath={view.overlayPath} pending={pending} run={run} />
      <SigHunterPanel settings={view.sigHunterSettings} signatures={view.signatures} members={view.members} live={view.live} now={now} overlayPath={view.overlayPath} pending={pending} run={run} />
      <SigDosanPanel settings={view.sigDosanSettings} signatures={view.signatures} members={view.members} live={view.live} now={now} overlayPath={view.overlayPath} pending={pending} run={run} />
      <AlphabetPanel settings={view.alphabetSettings} signatures={view.signatures} members={view.members} live={view.live} now={now} overlayPath={view.overlayPath} pending={pending} run={run} />
      <GoStopPanel settings={view.gostopSettings} signatures={view.signatures} members={view.members} live={view.live} now={now} overlayPath={view.overlayPath} pending={pending} run={run} />
    </div>
  );
}
