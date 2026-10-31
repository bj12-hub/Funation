"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import { useServerClock } from "@/hooks/useServerClock";
import { useI18n } from "@/lib/i18n/I18nProvider";
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
import { JackpotPanel } from "./JackpotPanel";
import { TerritoryPanel } from "./TerritoryPanel";
import { SudopolyPanel } from "./SudopolyPanel";
import { RandomSigPanel } from "./RandomSigPanel";
import { RelayPanel } from "./RelayPanel";
import { SpinMachinePanel } from "./SpinMachinePanel";
import { TwoWheelPanel } from "./TwoWheelPanel";
import styles from "./crew.module.css";
import games from "./games.module.css";

/**
 * 점수 게임 — code-first (no Figma frame; StreamDonate 점수 게임 참고, P2). Route `/creator/crew/games`. Games whose results
 * are crew points (display scores — FN never moves): 스핀머신 · 주사위 게임 · 투휠 게임 · 랜덤시그 · 기여도 릴레이 · 줍줍 · 시그니처 메들리 · 시그 빙고 · 복불복 뽑기판 · 시그니처 헌터 · 시그니처 두산 · 알파벳 모으기 · 고스톱 · 땅따먹기 · 스도폴리. Settings work any time; runs need a live
 * broadcast (started on 방송 운영). Refreshes from the server every few seconds while live (자동 runs from donations).
 */
export function GamesScreen({ view, switches }: { view: GamesView; switches: Record<OverlayTarget, boolean> }) {
  const router = useRouter();
  const { t } = useI18n();
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
        <h1 className={styles.title}>{t("crewGame.title")}</h1>
        <p className={styles.subtitle}>{t("crewGame.subtitle")}</p>
      </header>
      <OverlayOffNotice targets={["crew"]} switches={switches} />
      <CrewTabs active="games" />

      {message && (
        <p className={message.tone === "error" ? styles.error : styles.ok} role={message.tone === "error" ? "alert" : "status"}>
          {message.text}
        </p>
      )}
      {!view.live && <p className={styles.note}>{t("crewGame.noLive")}</p>}
      <nav className={games.jump} aria-label={t("crewGame.jumpAria")}>
        <a href="#game-spin">🎰 {t("crewGame.nameSpin")}</a>
        <a href="#game-dice">🎲 {t("crewGame.nameDice")}</a>
        <a href="#game-twowheel">🎡 {t("crewGame.nameTwoWheel")}</a>
        <a href="#game-randomsig">🔀 {t("crewGame.nameRandomSig")}</a>
        <a href="#game-relay">🔗 {t("crewGame.nameRelay")}</a>
        <a href="#game-jupjup">🎁 {t("crewGame.nameJupjup")}</a>
        <a href="#game-medley">🎶 {t("crewGame.nameMedley")}</a>
        <a href="#game-sigbingo">🎯 {t("crewGame.nameSigBingo")}</a>
        <a href="#game-griddraw">🎟️ {t("crewGame.nameGridDraw")}</a>
        <a href="#game-sighunter">🏹 {t("crewGame.nameSigHunter")}</a>
        <a href="#game-sigdosan">🚀 {t("crewGame.nameSigDosan")}</a>
        <a href="#game-alphabet">🔤 {t("crewGame.nameAlphabet")}</a>
        <a href="#game-gostop">🎴 {t("crewGame.nameGoStop")}</a>
        <a href="#game-territory">🗺️ {t("crewGame.nameTerritory")}</a>
        <a href="#game-sudopoly">🎲 {t("crewGame.nameSudopoly")}</a>
        <a href="#game-jackpot">🧧 {t("crewGame.nameJackpot")}</a>
      </nav>

      <SpinMachinePanel settings={view.spinSettings} signatures={view.signatures} members={view.members} live={view.live} now={now} overlayPath={view.overlayPath} pending={pending} run={run} />
      <DiceGamePanel settings={view.diceSettings} projects={view.projects} signatures={view.signatures} members={view.members} live={view.live} now={now} overlayPath={view.overlayPath} pending={pending} run={run} />
      <TwoWheelPanel settings={view.twoWheelSettings} signatures={view.signatures} members={view.members} live={view.live} now={now} overlayPath={view.overlayPath} pending={pending} run={run} />
      <RandomSigPanel settings={view.randomSigSettings} presets={view.randomSigPresets} signatures={view.signatures} live={view.live} now={now} overlayPath={view.overlayPath} pending={pending} run={run} />
      <RelayPanel settings={view.relaySettings} presets={view.relayPresets} signatures={view.signatures} members={view.members} live={view.live} now={now} overlayPath={view.overlayPath} pending={pending} run={run} />
      <JupjupPanel settings={view.jupjupSettings} signatures={view.signatures} members={view.members} live={view.live} now={now} overlayPath={view.overlayPath} pending={pending} run={run} />
      <MedleyPanel settings={view.medleySettings} randomSig={view.randomSigSettings} signatures={view.signatures} live={view.live} now={now} overlayPath={view.overlayPath} pending={pending} run={run} />
      <SigBingoPanel settings={view.sigBingoSettings} signatures={view.signatures} members={view.members} live={view.live} now={now} overlayPath={view.overlayPath} pending={pending} run={run} />
      <GridDrawPanel settings={view.gridDrawSettings} signatures={view.signatures} members={view.members} live={view.live} now={now} overlayPath={view.overlayPath} pending={pending} run={run} />
      <SigHunterPanel settings={view.sigHunterSettings} signatures={view.signatures} members={view.members} live={view.live} now={now} overlayPath={view.overlayPath} pending={pending} run={run} />
      <SigDosanPanel settings={view.sigDosanSettings} signatures={view.signatures} members={view.members} live={view.live} now={now} overlayPath={view.overlayPath} pending={pending} run={run} />
      <AlphabetPanel settings={view.alphabetSettings} signatures={view.signatures} members={view.members} live={view.live} now={now} overlayPath={view.overlayPath} pending={pending} run={run} />
      <GoStopPanel settings={view.gostopSettings} signatures={view.signatures} members={view.members} live={view.live} now={now} overlayPath={view.overlayPath} pending={pending} run={run} />
      <TerritoryPanel settings={view.territorySettings} signatures={view.signatures} members={view.members} live={view.live} now={now} overlayPath={view.overlayPath} pending={pending} run={run} />
      <SudopolyPanel settings={view.sudopolySettings} signatures={view.signatures} members={view.members} live={view.live} now={now} overlayPath={view.overlayPath} pending={pending} run={run} />
      <JackpotPanel settings={view.jackpotSettings} signatures={view.signatures} live={view.live} now={now} overlayPath={view.overlayPath} pending={pending} run={run} />
    </div>
  );
}
