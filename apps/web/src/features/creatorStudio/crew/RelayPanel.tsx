"use client";

import { formatKstTime, formatNumber } from "@/lib/format";
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
  const nameOf = (id: string | null) => (id ? (members.find((m) => m.id === id)?.name ?? "삭제된 멤버") : "트리거 BJ 없음");

  return (
    <section id="game-relay" className={styles.card} aria-labelledby="game-relay-title">
      <h2 id="game-relay-title" className={styles.cardTitle}>
        🔗 기여도 릴레이
      </h2>
      <p className={styles.note}>
        트리거 BJ가 받은 시그니처 후원 금액으로 배수가 정해지고, 다른 멤버가 받는 다음 시그니처 후원에 한 번 적용돼요(×3이면 그 후원 점수의 2배만큼 더해져요). 트리거 BJ가 다시 받으면
        배수가 새로 정해져요.
      </p>

      <form
        className={prize.form}
        onSubmit={(e) => {
          e.preventDefault();
          run(() => saveRelay(current()), "기여도 릴레이 설정을 저장했어요.");
        }}
      >
        <TitleField name="기여도 릴레이" placeholder={RELAY_TITLE_DEFAULT} value={draft.title} onChange={(title) => edit({ title })} />
        <PresetField
          game="기여도 릴레이"
          presets={presets}
          max={RELAY_PRESETS_MAX}
          nameMax={RELAY_PRESET_NAME_MAX}
          summary={(p) => `${nameOf(p.settings.memberId)} · 구간 ${p.settings.tiers.length}개${p.settings.excluded.length > 0 ? ` · 제외 ${p.settings.excluded.length}개` : ""}`}
          note="지금 칸에 있는 트리거 BJ · 금액 구간 · 제외 시그를 이름 붙여 저장해요(같은 이름이면 덮어써요). 켜짐 · 제목 · 대기 화면은 프리셋에 들어가지 않아요."
          dirty={dirty}
          pending={pending}
          onLoad={(p) => edit({ memberId: liveMember(p.settings.memberId), tiers: toEditTiers(p.settings.tiers), excluded: p.settings.excluded.filter((id) => known.has(id)) })}
          onDelete={(p) => run(() => deleteRelayPreset({ id: p.id }), `'${p.name}' 프리셋을 지웠어요.`)}
          onSave={(name) => run(() => saveRelayPreset({ name, settings: current() }), `'${name}' 프리셋을 저장했어요.`)}
        />
        <div className={prize.field}>
          <span className={styles.muted}>트리거 BJ</span>
          <select className={styles.select} aria-label="트리거 BJ" value={draft.memberId ?? ""} onChange={(e) => edit({ memberId: e.target.value || null })}>
            <option value="">— BJ 선택 —</option>
            {active.map((m) => (
              <option key={m.id} value={m.id}>
                {m.name}
              </option>
            ))}
          </select>
        </div>

        <AmountTiersField
          name="릴레이"
          tiers={draft.tiers}
          onChange={(tiers) => edit({ tiers })}
          example={RELAY_EXAMPLE_TIERS}
          note="위에서부터 맞는 첫 구간의 배수가 적용돼요. 어느 구간에도 안 맞으면 효과가 없어요(1배). 예시는 StreamDonate 기본값(원 단위)이라 채널 시그니처 가격에 맞게 바꿔 주세요."
        />

        <AutoFields
          name="기여도 릴레이"
          verb="돌리기"
          copy={{
            auto: "기여도 릴레이 켜기",
            excluded: "릴레이에서 뺄 시그니처 (누르면 제외)",
            note: "후원자가 멤버를 고른 시그니처 후원(금액 일치 · 금액범위 · 랜덤시그 포함)만 이어져요. 제외한 시그니처는 배수를 정하지도, 받지도 않아요."
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
          {dirty && <p className={styles.note}>저장하지 않은 설정이 있어요. 릴레이는 저장한 설정으로 이어져요.</p>}
          <div className={prize.window} role="status">
            <span className={styles.muted}>
              {relay.pending
                ? `대기 배수 ×${relay.pending.multiplier} — ${relay.triggerName ?? "트리거 BJ"}의 ${formatNumber(relay.pending.amount)} FN 시그에서 (${formatKstTime(relay.pending.at, { hour: "2-digit", minute: "2-digit" })})`
                : `대기 중인 배수가 없어요. ${relay.triggerName ?? "트리거 BJ"}의 시그니처 후원을 기다리는 중이에요.`}
            </span>
            {relay.pending && (
              <button type="button" className={styles.ghost} disabled={pending} onClick={() => run(() => clearRelay({ broadcastId: live.id }), "대기 배수를 비웠어요.")}>
                대기 비우기
              </button>
            )}
          </div>
          <RunList name="기여도 릴레이" runs={relay.runs} now={now} />
        </>
      )}

      <OverlayAddress overlayPath={overlayPath} param="relay" label="기여도 릴레이" />
    </section>
  );
}
