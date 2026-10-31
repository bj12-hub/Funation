"use client";

import { useRef, useState } from "react";
import { formatNumber } from "@/lib/format";
import { useI18n } from "@/lib/i18n/I18nProvider";
import type { MessageKey } from "@/lib/i18n/translate";
import { addJupjup, removeJupjup, saveJupjup } from "@/services/crew/crewGames";
import { JUPJUP_MODES, JUPJUP_TITLE_DEFAULT, type CrewMember, type GamesView, type JupjupMode, type JupjupSettings } from "@/services/crew/crewTypes";
import {
  AmountTiersField,
  AutoFields,
  FormActions,
  OverlayAddress,
  RunList,
  TitleField,
  fromEditTiers,
  toEditTiers,
  useSettingsDraft,
  type EditAmountTier,
  type LiveGames,
  type RunAction
} from "./GameParts";
import styles from "./crew.module.css";
import games from "./games.module.css";
import prize from "./prize.module.css";

type Draft = Omit<JupjupSettings, "tiers"> & { tiers: EditAmountTier[] };

const toDraft = (s: JupjupSettings): Draft => ({ ...s, tiers: toEditTiers(s.tiers) });
const fromDraft = (d: Draft) => ({ ...d, tiers: fromEditTiers(d.tiers) });
/** `JUPJUP_MODES` as message keys. */
const MODE_KEY: Record<JupjupMode, { label: MessageKey; note: MessageKey }> = {
  ADD: { label: "crewGameJupjup.modeAdd", note: "crewGameJupjup.modeAddNote" },
  MULTIPLY: { label: "crewGameJupjup.modeMultiply", note: "crewGameJupjup.modeMultiplyNote" },
  SPIN: { label: "crewGameJupjup.modeSpin", note: "crewGameJupjup.modeSpinNote" }
};

/**
 * 줍줍 — code-first (no Figma frame; StreamDonate 줍줍 참고), inside `/creator/crew/games`. 지정 BJ, 모드 (더하기 · 배수 · 스핀머신
 * 연계) and 금액 구간; while live the stack (수동 추가 · 한 건 삭제 · 스택 비우기) and the runs. There is no 수동 run.
 */
export function JupjupPanel({
  settings,
  signatures,
  members,
  live,
  now,
  overlayPath,
  pending,
  run
}: {
  settings: JupjupSettings;
  signatures: GamesView["signatures"];
  members: CrewMember[];
  live: LiveGames | null;
  now: number | null;
  overlayPath: string;
  pending: boolean;
  run: RunAction;
}) {
  const { t } = useI18n();
  const name = t("crewGame.nameJupjup");
  const { draft, edit, dirty, reset } = useSettingsDraft(settings, toDraft, fromDraft);
  const known = new Set(signatures.map((s) => s.id));
  const active = members.filter((m) => m.active);
  const owners = active.filter((m) => settings.memberIds.includes(m.id));
  const jupjup = live?.jupjup;

  // 수동 추가: a 지정 BJ (saved) and an active signature; one request id per intended add.
  const [ownerId, setOwnerId] = useState("");
  const [signatureId, setSignatureId] = useState("");
  const addId = useRef<string | null>(null);
  const owner = owners.some((m) => m.id === ownerId) ? ownerId : (owners[0]?.id ?? "");
  const sigs = signatures.filter((s) => s.active);
  const add = () => {
    if (!live || !owner || !signatureId) return;
    addId.current ??= crypto.randomUUID();
    const requestId = addId.current;
    run(async () => {
      const res = await addJupjup({ broadcastId: live.id, requestId, memberId: owner, signatureId });
      if (res.status === "SAVED") addId.current = null;
      return res;
    }, t("crewGameJupjup.added"));
  };

  return (
    <section id="game-jupjup" className={styles.card} aria-labelledby="game-jupjup-title">
      <h2 id="game-jupjup-title" className={styles.cardTitle}>
        🎁 {name}
      </h2>
      <p className={styles.note}>{t("crewGameJupjup.intro")}</p>

      <form
        className={prize.form}
        onSubmit={(e) => {
          e.preventDefault();
          const next = fromDraft(draft);
          // A member removed since may still be a 지정 BJ: drop it instead of failing the save.
          const memberIds = next.memberIds.filter((id) => active.some((m) => m.id === id));
          run(() => saveJupjup({ ...next, memberIds, excluded: next.excluded.filter((id) => known.has(id)) }), t("crewGame.saved", { name }));
        }}
      >
        <TitleField name={name} placeholder={JUPJUP_TITLE_DEFAULT} value={draft.title} onChange={(title) => edit({ title })} />
        <div className={prize.field} role="group" aria-label={t("crewGameJupjup.owners")}>
          <span className={styles.muted}>{t("crewGameJupjup.ownersLabel")}</span>
          <span className={prize.chips}>
            {active.length === 0 && <span className={styles.note}>{t("crewGame.noMembers")}</span>}
            {active.map((m) => (
              <button
                key={m.id}
                type="button"
                className={games.pick}
                aria-pressed={draft.memberIds.includes(m.id)}
                onClick={() => edit({ memberIds: draft.memberIds.includes(m.id) ? draft.memberIds.filter((x) => x !== m.id) : [...draft.memberIds, m.id] })}
              >
                <span className={styles.dot} style={{ background: m.color }} aria-hidden="true" />
                {m.name}
              </button>
            ))}
          </span>
        </div>
        <div className={prize.field} role="group" aria-label={t("crewGameJupjup.modeAria")}>
          <span className={styles.muted}>{t("crewGameJupjup.mode")}</span>
          <span className={games.rules}>
            {JUPJUP_MODES.map((m) => (
              <button key={m.key} type="button" className={games.rule} aria-pressed={draft.mode === m.key} onClick={() => edit({ mode: m.key })}>
                <strong>{t(MODE_KEY[m.key].label)}</strong>
                <span>{t(MODE_KEY[m.key].note)}</span>
              </button>
            ))}
          </span>
        </div>
        {draft.mode === "MULTIPLY" && <AmountTiersField name={name} tiers={draft.tiers} onChange={(tiers) => edit({ tiers })} note={t("crewGameJupjup.tiersNote")} />}
        <AutoFields
          name={name}
          verb={t("crewGame.spin")}
          copy={{
            auto: t("crewGameJupjup.autoCopy"),
            excluded: t("crewGameJupjup.excludedCopy"),
            note: t("crewGameJupjup.noteCopy")
          }}
          auto={draft.auto}
          excluded={draft.excluded}
          showIdle={draft.showIdle}
          signatures={signatures}
          onChange={edit}
        />
        <FormActions pending={pending} dirty={dirty} onReset={reset} />
      </form>

      {live && jupjup && (
        <>
          {dirty && <p className={styles.note}>{t("crewGameJupjup.unsaved")}</p>}
          <div className={prize.window}>
            <span className={styles.muted}>{t("crewGameJupjup.stackCount", { n: formatNumber(jupjup.stackCount) })}</span>
            {jupjup.stackCount > 0 && (
              <button
                type="button"
                className={styles.ghost}
                disabled={pending}
                onClick={() => run(() => removeJupjup({ broadcastId: live.id, itemId: null }), t("crewGameJupjup.stackCleared"))}
              >
                {t("crewGameJupjup.clearStack")}
              </button>
            )}
          </div>
          {jupjup.stack.length === 0 ? (
            <p className={styles.empty}>{t("crewGameJupjup.emptyStack")}</p>
          ) : (
            <ol className={games.stack} aria-label={t("crewGameJupjup.stackAria")}>
              {jupjup.stack.map((x) => (
                <li key={x.id}>
                  <span className={styles.boardName}>
                    {x.memberColor && <span className={styles.dot} style={{ background: x.memberColor }} aria-hidden="true" />}
                    {x.memberName}
                  </span>
                  <span>
                    {x.signatureName} · <strong>{formatNumber(x.amount)} FN</strong>
                    {x.manual && <span className={styles.muted}> · {t("crewGame.manual")}</span>}
                  </span>
                  <button type="button" className={styles.ghost} disabled={pending} onClick={() => run(() => removeJupjup({ broadcastId: live.id, itemId: x.id }))}>
                    {t("crewGame.delete")}
                  </button>
                </li>
              ))}
            </ol>
          )}
          <div className={games.manual} role="group" aria-label={t("crewGameJupjup.manualAddAria")}>
            <select className={styles.select} aria-label={t("crewGameJupjup.manualOwnerAria")} value={owner} onChange={(e) => setOwnerId(e.target.value)}>
              {owners.length === 0 && <option value="">{t("crewGameJupjup.noOwners")}</option>}
              {owners.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name}
                </option>
              ))}
            </select>
            <select className={styles.select} aria-label={t("crewGameJupjup.manualSigAria")} value={signatureId} onChange={(e) => setSignatureId(e.target.value)}>
              <option value="">{t("crewGame.pickSignature")}</option>
              {sigs.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name} ({formatNumber(s.price)} FN)
                </option>
              ))}
            </select>
            <button type="button" className={styles.ghost} disabled={pending || !owner || !signatureId} onClick={add}>
              {t("crewGameJupjup.manualAdd")}
            </button>
          </div>
          <RunList name={name} runs={jupjup.runs} now={now} />
        </>
      )}

      <OverlayAddress overlayPath={overlayPath} param="jupjup" label={name} />
    </section>
  );
}
