"use client";

import { useRef } from "react";
import { formatNumber } from "@/lib/format";
import { playMedley, saveMedley } from "@/services/crew/crewGames";
import {
  MEDLEY_SIGNATURES_MAX,
  MEDLEY_TITLE_DEFAULT,
  MEDLEY_TRIGGER_PRESETS,
  type GamesView,
  type MedleySettings,
  type RandomSigSettings
} from "@/services/crew/crewTypes";
import { AutoFields, FormActions, OverlayAddress, RunList, TitleField, useSettingsDraft, type LiveGames, type RunAction } from "./GameParts";
import styles from "./crew.module.css";
import games from "./games.module.css";
import prize from "./prize.module.css";

/** The editor keeps the 발동 금액 as typed ("" = none). */
type Draft = Omit<MedleySettings, "trigger"> & { trigger: string };
const toDraft = (s: MedleySettings): Draft => ({ ...s, trigger: s.trigger === null ? "" : String(s.trigger) });
const fromDraft = (d: Draft) => ({ ...d, trigger: d.trigger.trim() === "" ? null : Number(d.trigger) });

/**
 * 시그니처 메들리 — code-first (no Figma frame; StreamDonate 메들리 참고), inside `/creator/crew/games`. 발동 금액 and 등록
 * 시그니처: a 일반 후원 of exactly that amount plays one of them as its alert; while live each one also rolls on OBS, and
 * the operator can roll one by hand (no alert, no points).
 */
export function MedleyPanel({
  settings,
  randomSig,
  signatures,
  live,
  now,
  overlayPath,
  pending,
  run
}: {
  settings: MedleySettings;
  /** For the warning when 랜덤시그 uses the same 발동 금액. */
  randomSig: RandomSigSettings;
  signatures: GamesView["signatures"];
  live: LiveGames | null;
  now: number | null;
  overlayPath: string;
  pending: boolean;
  run: RunAction;
}) {
  const { draft, edit, dirty, reset } = useSettingsDraft(settings, toDraft, fromDraft);
  const playId = useRef<string | null>(null);
  const known = new Set(signatures.map((s) => s.id));
  const picked = draft.signatureIds;
  const amount = Number(draft.trigger);
  // What would keep the 발동 금액 from firing: a 금액 일치 signature, or 랜덤시그 using it.
  const takenBy = draft.trigger
    ? (signatures.find((s) => s.active && s.match === "AMOUNT" && amount >= (s.rangeMin ?? s.price) && amount <= s.price)?.name ??
      (randomSig.auto && randomSig.tiers.some((t) => t.trigger === amount) ? "랜덤시그 발동 구간" : null))
    : null;
  const toggle = (id: string) => edit({ signatureIds: picked.includes(id) ? picked.filter((x) => x !== id) : [...picked, id] });

  const roll = () => {
    if (!live) return;
    playId.current ??= crypto.randomUUID();
    const requestId = playId.current;
    run(async () => {
      const res = await playMedley({ broadcastId: live.id, requestId });
      if (res.status !== "PLAYED") return res;
      playId.current = null;
      return { status: "SAVED" };
    }, "메들리를 돌렸어요. OBS에서 뽑힌 시그니처가 나와요.");
  };

  return (
    <section id="game-medley" className={styles.card} aria-labelledby="game-medley-title">
      <h2 id="game-medley-title" className={styles.cardTitle}>
        🎶 시그니처 메들리
      </h2>
      <p className={styles.note}>
        발동 금액과 정확히 같은 일반 후원이 들어오면 등록한 시그니처 중 하나를 서버가 뽑아, 후원 알림이 그 시그니처로 나가요(시그 카운트에도 그 시그니처로 세요). 점수는 따로 더하지 않아요.
      </p>

      <form
        className={prize.form}
        onSubmit={(e) => {
          e.preventDefault();
          const next = fromDraft(draft);
          // A signature deleted since may still be registered: drop it instead of failing the save.
          run(() => saveMedley({ ...next, signatureIds: next.signatureIds.filter((id) => known.has(id)) }), "메들리 설정을 저장했어요.");
        }}
      >
        <TitleField name="메들리" placeholder={MEDLEY_TITLE_DEFAULT} value={draft.title} onChange={(title) => edit({ title })} />
        <div className={prize.field}>
          <span className={styles.muted}>발동 금액</span>
          <span className={games.unit}>
            <input
              className={styles.inputSmall}
              type="number"
              inputMode="numeric"
              aria-label="메들리 발동 금액"
              placeholder="발동 금액"
              value={draft.trigger}
              onChange={(e) => edit({ trigger: e.target.value })}
            />
            <span className={styles.muted}>FN</span>
            {MEDLEY_TRIGGER_PRESETS.map((p) => (
              <button key={p} type="button" className={games.pick} aria-pressed={amount === p} onClick={() => edit({ trigger: String(p) })}>
                {formatNumber(p)}
              </button>
            ))}
          </span>
          {takenBy && (
            <span className={styles.error} role="alert">
              이 금액은 &apos;{takenBy}&apos;에서 먼저 받아요. 다른 발동 금액을 정해 주세요.
            </span>
          )}
        </div>
        <div className={prize.field} role="group" aria-label="메들리 등록 시그니처">
          <span className={styles.muted}>
            등록 시그니처 ({picked.length}/{MEDLEY_SIGNATURES_MAX}) — 누르면 등록
          </span>
          <span className={prize.chips}>
            {signatures.length === 0 && <span className={styles.note}>만든 시그니처가 없어요.</span>}
            {signatures.map((s) => (
              <button key={s.id} type="button" className={games.pick} aria-pressed={picked.includes(s.id)} disabled={!picked.includes(s.id) && picked.length >= MEDLEY_SIGNATURES_MAX} onClick={() => toggle(s.id)}>
                {s.name}
                {!s.active && <span className={styles.muted}>숨김</span>}
              </button>
            ))}
          </span>
          <span className={prize.inline}>
            <button type="button" className={styles.ghost} onClick={() => edit({ signatureIds: signatures.filter((s) => s.active).slice(0, MEDLEY_SIGNATURES_MAX).map((s) => s.id) })}>
              사용 중 모두 등록
            </button>
            <button type="button" className={styles.ghost} disabled={!picked.length} onClick={() => edit({ signatureIds: [] })}>
              모두 해제
            </button>
          </span>
          <span className={styles.note}>숨긴 시그니처는 등록돼 있어도 뽑히지 않아요.</span>
        </div>
        <AutoFields
          name="메들리"
          verb="돌리기"
          copy={{ auto: "메들리 켜기 — 발동 금액과 같은 일반 후원을 등록한 시그니처 중 하나로 보내요", excluded: "", note: "" }}
          withExcluded={false}
          auto={draft.auto}
          excluded={[]}
          showIdle={draft.showIdle}
          signatures={signatures}
          onChange={edit}
        />
        <FormActions pending={pending} dirty={dirty} onReset={reset} />
      </form>

      {live && (
        <>
          {dirty && <p className={styles.note}>저장하지 않은 설정이 있어요. 메들리는 저장한 설정으로 뽑혀요.</p>}
          <div className={prize.window}>
            <span className={styles.muted}>크루 방송 중에는 메들리 후원마다 OBS에서 뽑기 연출이 나와요. 알림 없이 OBS에서만 한 번 돌릴 수도 있어요.</span>
            <button type="button" className={styles.ghost} disabled={pending || !settings.signatureIds.length} onClick={roll}>
              OBS에서 한 번 돌리기
            </button>
          </div>
          <RunList name="메들리" runs={live.medley.runs} now={now} />
        </>
      )}

      <OverlayAddress overlayPath={overlayPath} param="medley" label="메들리" />
    </section>
  );
}
