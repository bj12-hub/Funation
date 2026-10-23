"use client";

import { useRef, useState } from "react";
import { formatNumber } from "@/lib/format";
import { addJupjup, removeJupjup, saveJupjup } from "@/services/crew/crewGames";
import { JUPJUP_MODES, JUPJUP_TITLE_DEFAULT, type CrewMember, type GamesView, type JupjupSettings } from "@/services/crew/crewTypes";
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
    }, "스택에 추가했어요.");
  };

  return (
    <section id="game-jupjup" className={styles.card} aria-labelledby="game-jupjup-title">
      <h2 id="game-jupjup-title" className={styles.cardTitle}>
        🎁 줍줍
      </h2>
      <p className={styles.note}>
        지정 BJ가 받은 시그니처 후원이 스택에 쌓이고, 다른 멤버가 같은 금액의 시그니처 후원을 받으면 가장 오래된 것을 가져가 점수를 한 번 더 받아요. 지정 BJ끼리는 가져가지 못해요.
      </p>

      <form
        className={prize.form}
        onSubmit={(e) => {
          e.preventDefault();
          const next = fromDraft(draft);
          // A member removed since may still be a 지정 BJ: drop it instead of failing the save.
          const memberIds = next.memberIds.filter((id) => active.some((m) => m.id === id));
          run(() => saveJupjup({ ...next, memberIds, excluded: next.excluded.filter((id) => known.has(id)) }), "줍줍 설정을 저장했어요.");
        }}
      >
        <TitleField name="줍줍" placeholder={JUPJUP_TITLE_DEFAULT} value={draft.title} onChange={(title) => edit({ title })} />
        <div className={prize.field} role="group" aria-label="지정 BJ">
          <span className={styles.muted}>지정 BJ (누르면 지정)</span>
          <span className={prize.chips}>
            {active.length === 0 && <span className={styles.note}>활동 중인 멤버가 없어요.</span>}
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
        <div className={prize.field} role="group" aria-label="줍줍 모드">
          <span className={styles.muted}>모드</span>
          <span className={games.rules}>
            {JUPJUP_MODES.map((m) => (
              <button key={m.key} type="button" className={games.rule} aria-pressed={draft.mode === m.key} onClick={() => edit({ mode: m.key })}>
                <strong>{m.label}</strong>
                <span>{m.note}</span>
              </button>
            ))}
          </span>
        </div>
        {draft.mode === "MULTIPLY" && (
          <AmountTiersField
            name="줍줍"
            tiers={draft.tiers}
            onChange={(tiers) => edit({ tiers })}
            note="가져간 후원 금액이 맞는 첫 구간의 배수가 적용돼요. 맞는 구간이 없으면 1배(점수 없음)예요."
          />
        )}
        <AutoFields
          name="줍줍"
          verb="돌리기"
          copy={{
            auto: "줍줍 켜기",
            excluded: "줍줍에서 뺄 시그니처 (누르면 제외)",
            note: "후원자가 멤버를 고른 시그니처 후원(금액 일치 · 금액범위 · 랜덤시그 포함)만 쌓이고 가져가요. 같은 금액이 여러 개면 가장 오래된 것부터 가져가요."
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
          {dirty && <p className={styles.note}>저장하지 않은 설정이 있어요. 줍줍은 저장한 설정으로 쌓이고 가져가요.</p>}
          <div className={prize.window}>
            <span className={styles.muted}>대기 스택 {formatNumber(jupjup.stackCount)}건</span>
            {jupjup.stackCount > 0 && (
              <button type="button" className={styles.ghost} disabled={pending} onClick={() => run(() => removeJupjup({ broadcastId: live.id, itemId: null }), "스택을 비웠어요.")}>
                스택 비우기
              </button>
            )}
          </div>
          {jupjup.stack.length === 0 ? (
            <p className={styles.empty}>쌓인 시그니처가 없어요.</p>
          ) : (
            <ol className={games.stack} aria-label="줍줍 대기 스택">
              {jupjup.stack.map((x) => (
                <li key={x.id}>
                  <span className={styles.boardName}>
                    {x.memberColor && <span className={styles.dot} style={{ background: x.memberColor }} aria-hidden="true" />}
                    {x.memberName}
                  </span>
                  <span>
                    {x.signatureName} · <strong>{formatNumber(x.amount)} FN</strong>
                    {x.manual && <span className={styles.muted}> · 수동</span>}
                  </span>
                  <button type="button" className={styles.ghost} disabled={pending} onClick={() => run(() => removeJupjup({ broadcastId: live.id, itemId: x.id }))}>
                    삭제
                  </button>
                </li>
              ))}
            </ol>
          )}
          <div className={games.manual} role="group" aria-label="줍줍 수동 추가">
            <select className={styles.select} aria-label="줍줍 수동 추가 지정 BJ" value={owner} onChange={(e) => setOwnerId(e.target.value)}>
              {owners.length === 0 && <option value="">저장한 지정 BJ가 없어요</option>}
              {owners.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name}
                </option>
              ))}
            </select>
            <select className={styles.select} aria-label="줍줍 수동 추가 시그니처" value={signatureId} onChange={(e) => setSignatureId(e.target.value)}>
              <option value="">— 시그니처 선택 —</option>
              {sigs.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name} ({formatNumber(s.price)} FN)
                </option>
              ))}
            </select>
            <button type="button" className={styles.ghost} disabled={pending || !owner || !signatureId} onClick={add}>
              수동 추가
            </button>
          </div>
          <RunList name="줍줍" runs={jupjup.runs} now={now} />
        </>
      )}

      <OverlayAddress overlayPath={overlayPath} param="jupjup" label="줍줍" />
    </section>
  );
}
