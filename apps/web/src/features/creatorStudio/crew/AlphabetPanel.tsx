"use client";

import { resetAlphabet, saveAlphabet } from "@/services/crew/crewGames";
import {
  ALPHABET_MISS_MAX,
  ALPHABET_PRIZES_MAX,
  ALPHABET_PRIZE_LABEL_MAX,
  ALPHABET_PRIZE_POINTS_MAX,
  ALPHABET_PRIZE_WEIGHT_MAX,
  ALPHABET_THEMES,
  ALPHABET_TITLE_DEFAULT,
  ALPHABET_WORD_MAX,
  type AlphabetSettings,
  type CrewMember,
  type GamesView
} from "@/services/crew/crewTypes";
import { AutoFields, FormActions, ManualPlay, OverlayAddress, RunList, TitleField, useSettingsDraft, type LiveGames, type RunAction } from "./GameParts";
import styles from "./crew.module.css";
import games from "./games.module.css";
import prize from "./prize.module.css";

/** The editor keeps numbers as typed. */
type EditPrize = { id: string; label: string; points: string; weight: string };
type Draft = Omit<AlphabetSettings, "missPercent" | "prizes"> & { missPercent: string; prizes: EditPrize[] };

const toDraft = (s: AlphabetSettings): Draft => ({
  ...s,
  missPercent: String(s.missPercent),
  prizes: s.prizes.map((p) => ({ id: p.id, label: p.label, points: String(p.points), weight: String(p.weight) }))
});
const fromDraft = (d: Draft) => ({
  ...d,
  word: d.word.trim().toUpperCase(),
  missPercent: Number(d.missPercent),
  prizes: d.prizes.map((p) => ({ id: p.id, label: p.label.trim(), points: Number(p.points || 0), weight: Number(p.weight) }))
});
const newId = () => `new-${crypto.randomUUID().slice(0, 8)}`;
const percent = (n: number) => `${Math.round(n * 10) / 10}%`;

/**
 * 알파벳 모으기 — code-first (no Figma frame; StreamDonate 알파벳 모으기 참고), inside `/creator/crew/games`. The word, 꽝
 * 비율, 상품 (문구 · 점수 · 가중치), 단어판 테마, 자동 on 시그니처 후원 (제외 시그); while live a 수동 spin for a member,
 * each member's word board (비우기) and the runs.
 */
export function AlphabetPanel({
  settings,
  signatures,
  members,
  live,
  now,
  overlayPath,
  pending,
  run
}: {
  settings: AlphabetSettings;
  signatures: GamesView["signatures"];
  members: CrewMember[];
  live: LiveGames | null;
  now: number | null;
  overlayPath: string;
  pending: boolean;
  run: RunAction;
}) {
  const { draft, edit, dirty, reset } = useSettingsDraft(settings, toDraft, fromDraft);
  const setPrize = (i: number, patch: Partial<EditPrize>) => edit({ prizes: draft.prizes.map((x, j) => (j === i ? { ...x, ...patch } : x)) });
  const known = new Set(signatures.map((s) => s.id));
  const word = draft.word.trim().toUpperCase();
  const letters = /^[A-Z]+$/.test(word) ? [...new Set(word)] : [];
  const miss = Number(draft.missPercent);
  const missOk = Number.isInteger(miss) && miss >= 0 && miss <= ALPHABET_MISS_MAX;
  const totalWeight = draft.prizes.reduce((s, p) => s + (Number.isInteger(Number(p.weight)) && Number(p.weight) > 0 ? Number(p.weight) : 0), 0);
  const alphabet = live?.alphabet;

  return (
    <section id="game-alphabet" className={styles.card} aria-labelledby="game-alphabet-title">
      <h2 id="game-alphabet-title" className={styles.cardTitle}>
        🔤 알파벳 모으기
      </h2>
      <p className={styles.note}>
        멤버에게 시그니처 후원이 들어오면 가로 릴이 돌아 단어의 글자나 꽝이 나와요. 멤버마다 글자를 모아 단어를 완성하면 상품을 추첨해요(가중치). 완성한 멤버는 다음 글자부터 다시 모아요.
      </p>

      <form
        className={prize.form}
        onSubmit={(e) => {
          e.preventDefault();
          const next = fromDraft(draft);
          run(() => saveAlphabet({ ...next, excluded: next.excluded.filter((id) => known.has(id)) }), "알파벳 모으기 설정을 저장했어요.");
        }}
      >
        <TitleField name="알파벳 모으기" placeholder={ALPHABET_TITLE_DEFAULT} value={draft.title} onChange={(title) => edit({ title })} />
        <div className={prize.field}>
          <span className={styles.muted}>단어 (영문 알파벳 2 ~ {ALPHABET_WORD_MAX}자)</span>
          <span className={games.unit}>
            <input
              className={styles.inputSmall}
              aria-label="알파벳 모으기 단어"
              placeholder="예: LUCKY"
              maxLength={ALPHABET_WORD_MAX}
              autoCapitalize="characters"
              value={draft.word}
              onChange={(e) => edit({ word: e.target.value.toUpperCase() })}
            />
            <span className={styles.muted}>꽝</span>
            <input
              className={styles.inputSmall}
              type="number"
              inputMode="numeric"
              aria-label="꽝 비율"
              min={0}
              max={ALPHABET_MISS_MAX}
              value={draft.missPercent}
              onChange={(e) => edit({ missPercent: e.target.value })}
            />
            <span className={styles.muted}>%</span>
          </span>
          <span className={styles.note}>
            {letters.length && missOk
              ? `릴: ${letters.map((c) => `${c} ${percent((100 - miss) / letters.length)}`).join(" · ")} · 꽝 ${percent(miss)} — 단어에 같은 글자가 여러 번 있으면 그만큼 모아야 해요.`
              : "단어를 정하면 릴에 들어갈 글자와 확률이 보여요."}
          </span>
        </div>

        <div className={prize.field}>
          <span className={styles.muted}>
            완성 상품 ({draft.prizes.length}/{ALPHABET_PRIZES_MAX}) — 단어를 완성하면 하나를 추첨해요
          </span>
          {draft.prizes.length > 0 && (
            <ul className={games.tiers}>
              {draft.prizes.map((p, i) => {
                const w = Number(p.weight);
                return (
                  <li key={p.id}>
                    <span className={games.tierRow}>
                      <input
                        className={styles.inputSmall}
                        aria-label={`상품 ${i + 1} 문구`}
                        placeholder="문구 (예: 애교 3종)"
                        maxLength={ALPHABET_PRIZE_LABEL_MAX}
                        value={p.label}
                        onChange={(e) => setPrize(i, { label: e.target.value })}
                      />
                      <input
                        className={`${styles.inputSmall} ${games.short}`}
                        type="number"
                        inputMode="numeric"
                        aria-label={`상품 ${i + 1} 점수`}
                        min={0}
                        max={ALPHABET_PRIZE_POINTS_MAX}
                        placeholder="0"
                        value={p.points}
                        onChange={(e) => setPrize(i, { points: e.target.value })}
                      />
                      <span className={styles.muted}>점 · 가중치</span>
                      <input
                        className={`${styles.inputSmall} ${games.short}`}
                        type="number"
                        inputMode="numeric"
                        aria-label={`상품 ${i + 1} 가중치`}
                        min={1}
                        max={ALPHABET_PRIZE_WEIGHT_MAX}
                        value={p.weight}
                        onChange={(e) => setPrize(i, { weight: e.target.value })}
                      />
                      <span className={styles.muted}>{w > 0 && totalWeight ? percent((w / totalWeight) * 100) : "-"}</span>
                      <button type="button" className={styles.ghost} onClick={() => edit({ prizes: draft.prizes.filter((_, j) => j !== i) })}>
                        삭제
                      </button>
                    </span>
                  </li>
                );
              })}
            </ul>
          )}
          <span className={prize.inline}>
            <button
              type="button"
              className={styles.ghost}
              disabled={draft.prizes.length >= ALPHABET_PRIZES_MAX}
              onClick={() => edit({ prizes: [...draft.prizes, { id: newId(), label: "", points: "0", weight: "1" }] })}
            >
              + 상품 추가
            </button>
          </span>
          <span className={styles.note}>점수는 완성한 멤버의 점수로 OBS 결과 뒤 반영돼요(0이면 문구만). 상품이 없으면 &quot;단어 완성!&quot;만 나와요.</span>
        </div>

        <div className={prize.field} role="group" aria-label="단어판 테마">
          <span className={styles.muted}>단어판 테마 (OBS)</span>
          <span className={styles.segment}>
            {ALPHABET_THEMES.map((t) => (
              <button key={t.key} type="button" aria-pressed={draft.theme === t.key} onClick={() => edit({ theme: t.key })}>
                {t.label}
              </button>
            ))}
          </span>
        </div>
        <AutoFields
          name="알파벳 모으기"
          verb="돌리기"
          copy={{
            auto: "멤버에게 시그니처 후원이 들어오면 자동으로 돌리기",
            excluded: "자동으로 돌리지 않을 시그니처 (누르면 제외)",
            note: "후원자가 멤버를 고른 시그니처 후원(금액 일치 · 금액범위 · 랜덤시그 포함)마다 한 번 돌려요. 멤버를 고르지 않은 후원은 수동으로 돌려 주세요."
          }}
          auto={draft.auto}
          excluded={draft.excluded}
          showIdle={draft.showIdle}
          signatures={signatures}
          onChange={edit}
        />
        <p className={styles.note}>단어를 바꾸면 모든 멤버가 처음부터 다시 모아요.</p>
        <FormActions pending={pending} dirty={dirty} onReset={reset} />
      </form>

      {live && alphabet && (
        <>
          {dirty && <p className={styles.note}>저장하지 않은 설정이 있어요. 릴은 저장한 단어로 돌아가요.</p>}
          <ManualPlay game="ALPHABET" name="알파벳 모으기" verb="돌리기" withSource={false} live={live} members={members} disabled={!settings.word} pending={pending} run={run} />
          {!settings.word && <p className={styles.note}>단어를 저장하면 돌릴 수 있어요.</p>}
          {settings.word && (
            <>
              <ul className={games.alphaBoards} aria-label="알파벳 모으기 단어판">
                {alphabet.boards.map((x) => (
                  <li key={x.memberId}>
                    <span className={styles.boardName}>
                      {x.color && <span className={styles.dot} style={{ background: x.color }} aria-hidden="true" />}
                      {x.name}
                    </span>
                    <span className={games.alphaWord} aria-label={`${x.name} ${x.slots.map((c) => (c.revealAt ? c.letter : "_")).join("")}`}>
                      {x.slots.map((c, i) => (
                        <span key={i} data-on={c.revealAt ? "" : undefined}>
                          {c.letter}
                        </span>
                      ))}
                    </span>
                    <span className={styles.muted}>완성 {x.done}회</span>
                    <button
                      type="button"
                      className={styles.ghost}
                      disabled={pending || !x.slots.some((c) => c.revealAt)}
                      onClick={() => run(() => resetAlphabet({ broadcastId: live.id, memberId: x.memberId }), `${x.name}의 단어판을 비웠어요.`)}
                    >
                      비우기
                    </button>
                  </li>
                ))}
              </ul>
              <span className={prize.inline}>
                <button type="button" className={styles.ghost} disabled={pending} onClick={() => run(() => resetAlphabet({ broadcastId: live.id, memberId: null }), "모든 단어판을 비웠어요.")}>
                  모두 비우기 (완성 횟수 포함)
                </button>
              </span>
            </>
          )}
          <RunList name="알파벳 모으기" runs={alphabet.runs} now={now} />
        </>
      )}

      <OverlayAddress overlayPath={overlayPath} param="alphabet" label="알파벳 모으기" />
    </section>
  );
}
