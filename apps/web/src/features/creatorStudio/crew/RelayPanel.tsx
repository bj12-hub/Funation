"use client";

import { formatKstTime, formatNumber } from "@/lib/format";
import { useI18n } from "@/lib/i18n/I18nProvider";
import { clearRelay, deleteRelayPreset, saveRelay, saveRelayPreset } from "@/services/crew/crewGames";
import {
  RELAY_EXAMPLE_TIERS,
  RELAY_PRESETS_MAX,
  RELAY_PRESET_NAME_MAX,
  RELAY_TITLE_DEFAULT,
  type CrewMember,
  type GamesView,
  type RelayPreset,
  type RelaySettings
} from "@/services/crew/crewTypes";
import {
  AmountTiersField,
  AutoFields,
  FormActions,
  OverlayAddress,
  PresetField,
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
import prize from "./prize.module.css";

type Draft = Omit<RelaySettings, "tiers"> & { tiers: EditAmountTier[] };

const toDraft = (s: RelaySettings): Draft => ({ ...s, tiers: toEditTiers(s.tiers) });
const fromDraft = (d: Draft) => ({ ...d, tiers: fromEditTiers(d.tiers) });

/**
 * 기여도 릴레이 — code-first (no Figma frame; StreamDonate 기여도 릴레이 참고), inside `/creator/crew/games`. 트리거 BJ and
 * 금액 구간 (first match wins); a 시그니처 후원 the 트리거 BJ receives sets the 배수, the next one another member receives
 * takes it. While live: the waiting 배수 (대기 비우기) and the runs. There is no 수동 run. 설정 프리셋 (2026-10-28) as on 랜덤시그.
 */
export function RelayPanel({
  settings,
  presets,
  signatures,
  members,
  live,
  now,
  overlayPath,
  pending,
  run
}: {
  settings: RelaySettings;
  presets: RelayPreset[];
  signatures: GamesView["signatures"];
  members: CrewMember[];
  live: LiveGames | null;
  now: number | null;
  overlayPath: string;
  pending: boolean;
  run: RunAction;
}) {
  const { t } = useI18n();
  const name = t("crewGame.nameRelay");
  const { draft, edit, dirty, reset } = useSettingsDraft(settings, toDraft, fromDraft);
  const known = new Set(signatures.map((s) => s.id));
  const active = members.filter((m) => m.active);
  const relay = live?.relay;
  // A member removed (or on 휴식) since may still be the 트리거 BJ: drop it instead of failing the save.
  const liveMember = (id: string | null) => (id && active.some((m) => m.id === id) ? id : null);
  const current = () => {
    const next = fromDraft(draft);
    return { ...next, memberId: liveMember(next.memberId), excluded: next.excluded.filter((id) => known.has(id)) };
  };
  const nameOf = (id: string | null) => (id ? (members.find((m) => m.id === id)?.name ?? t("crewGameRelay.deletedMember")) : t("crewGameRelay.noTrigger"));

  return (
    <section id="game-relay" className={styles.card} aria-labelledby="game-relay-title">
      <h2 id="game-relay-title" className={styles.cardTitle}>
        🔗 {name}
      </h2>
      <p className={styles.note}>{t("crewGameRelay.intro")}</p>

      <form
        className={prize.form}
        onSubmit={(e) => {
          e.preventDefault();
          run(() => saveRelay(current()), t("crewGame.saved", { name }));
        }}
      >
        <TitleField name={name} placeholder={RELAY_TITLE_DEFAULT} value={draft.title} onChange={(title) => edit({ title })} />
        <PresetField
          game={name}
          presets={presets}
          max={RELAY_PRESETS_MAX}
          nameMax={RELAY_PRESET_NAME_MAX}
          summary={(p) =>
            `${nameOf(p.settings.memberId)} · ${t("crewGame.tierCount", { n: p.settings.tiers.length })}${p.settings.excluded.length > 0 ? ` · ${t("crewGame.excludedCount", { n: p.settings.excluded.length })}` : ""}`
          }
          note={t("crewGameRelay.presetNote")}
          dirty={dirty}
          pending={pending}
          onLoad={(p) => edit({ memberId: liveMember(p.settings.memberId), tiers: toEditTiers(p.settings.tiers), excluded: p.settings.excluded.filter((id) => known.has(id)) })}
          onDelete={(p) => run(() => deleteRelayPreset({ id: p.id }), t("crewGame.presetDeleted", { name: p.name }))}
          onSave={(presetName) => run(() => saveRelayPreset({ name: presetName, settings: current() }), t("crewGame.presetSaved", { name: presetName }))}
        />
        <div className={prize.field}>
          <span className={styles.muted}>{t("crewGameRelay.triggerBj")}</span>
          <select className={styles.select} aria-label={t("crewGameRelay.triggerBj")} value={draft.memberId ?? ""} onChange={(e) => edit({ memberId: e.target.value || null })}>
            <option value="">{t("crewGame.pickBj")}</option>
            {active.map((m) => (
              <option key={m.id} value={m.id}>
                {m.name}
              </option>
            ))}
          </select>
        </div>

        <AmountTiersField
          name={t("crewGameRelay.tiersName")}
          tiers={draft.tiers}
          onChange={(tiers) => edit({ tiers })}
          example={RELAY_EXAMPLE_TIERS}
          note={t("crewGameRelay.tiersNote")}
        />

        <AutoFields
          name={name}
          verb={t("crewGame.spin")}
          copy={{
            auto: t("crewGameRelay.autoCopy"),
            excluded: t("crewGameRelay.excludedCopy"),
            note: t("crewGameRelay.noteCopy")
          }}
          auto={draft.auto}
          excluded={draft.excluded}
          showIdle={draft.showIdle}
          signatures={signatures}
          onChange={edit}
        />
        <FormActions pending={pending} dirty={dirty} onReset={reset} />
      </form>

      {live && relay && (
        <>
          {dirty && <p className={styles.note}>{t("crewGameRelay.unsaved")}</p>}
          <div className={prize.window} role="status">
            <span className={styles.muted}>
              {relay.pending
                ? t("crewGameRelay.pendingMultiplier", {
                    multiplier: relay.pending.multiplier,
                    name: relay.triggerName ?? t("crewGameRelay.triggerBj"),
                    amount: formatNumber(relay.pending.amount),
                    time: formatKstTime(relay.pending.at, { hour: "2-digit", minute: "2-digit" })
                  })
                : t("crewGameRelay.noPending", { name: relay.triggerName ?? t("crewGameRelay.triggerBj") })}
            </span>
            {relay.pending && (
              <button type="button" className={styles.ghost} disabled={pending} onClick={() => run(() => clearRelay({ broadcastId: live.id }), t("crewGameRelay.cleared"))}>
                {t("crewGameRelay.clear")}
              </button>
            )}
          </div>
          <RunList name={name} runs={relay.runs} now={now} />
        </>
      )}

      <OverlayAddress overlayPath={overlayPath} param="relay" label={name} />
    </section>
  );
}
