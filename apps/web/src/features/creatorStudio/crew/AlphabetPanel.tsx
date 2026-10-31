"use client";

import { useI18n } from "@/lib/i18n/I18nProvider";
import type { MessageKey } from "@/lib/i18n/translate";
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
  type AlphabetTheme,
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
/** `ALPHABET_THEMES` labels as message keys. */
const THEME_KEY: Record<AlphabetTheme, MessageKey> = {
  NEON: "crewGameAlphabet.themeNeon",
  GOLD: "crewGameAlphabet.themeGold",
  GOLD2: "crewGameAlphabet.themeGold2",
  ARCADE: "crewGameAlphabet.themeArcade"
};

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
  const { t } = useI18n();
  const name = t("crewGame.nameAlphabet");
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
        🔤 {name}
      </h2>
      <p className={styles.note}>{t("crewGameAlphabet.intro")}</p>

      <form
        className={prize.form}
        onSubmit={(e) => {
          e.preventDefault();
          const next = fromDraft(draft);
          run(() => saveAlphabet({ ...next, excluded: next.excluded.filter((id) => known.has(id)) }), t("crewGame.saved", { name }));
        }}
      >
        <TitleField name={name} placeholder={ALPHABET_TITLE_DEFAULT} value={draft.title} onChange={(title) => edit({ title })} />
        <div className={prize.field}>
          <span className={styles.muted}>{t("crewGameAlphabet.word", { max: ALPHABET_WORD_MAX })}</span>
          <span className={games.unit}>
            <input
              className={styles.inputSmall}
              aria-label={t("crewGameAlphabet.wordAria")}
              placeholder={t("crewGameAlphabet.wordPlaceholder")}
              maxLength={ALPHABET_WORD_MAX}
              autoCapitalize="characters"
              value={draft.word}
              onChange={(e) => edit({ word: e.target.value.toUpperCase() })}
            />
            <span className={styles.muted}>{t("crewGameAlphabet.miss")}</span>
            <input
              className={styles.inputSmall}
              type="number"
              inputMode="numeric"
              aria-label={t("crewGameAlphabet.missAria")}
              min={0}
              max={ALPHABET_MISS_MAX}
              value={draft.missPercent}
              onChange={(e) => edit({ missPercent: e.target.value })}
            />
            <span className={styles.muted}>%</span>
          </span>
          <span className={styles.note}>
            {letters.length && missOk
              ? t("crewGameAlphabet.reel", { letters: letters.map((c) => `${c} ${percent((100 - miss) / letters.length)}`).join(" · "), miss: percent(miss) })
              : t("crewGameAlphabet.reelEmpty")}
          </span>
        </div>

        <div className={prize.field}>
          <span className={styles.muted}>{t("crewGameAlphabet.prizes", { count: draft.prizes.length, max: ALPHABET_PRIZES_MAX })}</span>
          {draft.prizes.length > 0 && (
            <ul className={games.tiers}>
              {draft.prizes.map((p, i) => {
                const w = Number(p.weight);
                return (
                  <li key={p.id}>
                    <span className={games.tierRow}>
                      <input
                        className={styles.inputSmall}
                        aria-label={t("crewGameAlphabet.prizeTextAria", { n: i + 1 })}
                        placeholder={t("crewGameAlphabet.textPlaceholder")}
                        maxLength={ALPHABET_PRIZE_LABEL_MAX}
                        value={p.label}
                        onChange={(e) => setPrize(i, { label: e.target.value })}
                      />
                      <input
                        className={`${styles.inputSmall} ${games.short}`}
                        type="number"
                        inputMode="numeric"
                        aria-label={t("crewGameAlphabet.prizePointsAria", { n: i + 1 })}
                        min={0}
                        max={ALPHABET_PRIZE_POINTS_MAX}
                        placeholder="0"
                        value={p.points}
                        onChange={(e) => setPrize(i, { points: e.target.value })}
                      />
                      <span className={styles.muted}>{t("crewGameAlphabet.pointsWeight")}</span>
                      <input
                        className={`${styles.inputSmall} ${games.short}`}
                        type="number"
                        inputMode="numeric"
                        aria-label={t("crewGameAlphabet.prizeWeightAria", { n: i + 1 })}
                        min={1}
                        max={ALPHABET_PRIZE_WEIGHT_MAX}
                        value={p.weight}
                        onChange={(e) => setPrize(i, { weight: e.target.value })}
                      />
                      <span className={styles.muted}>{w > 0 && totalWeight ? percent((w / totalWeight) * 100) : "-"}</span>
                      <button type="button" className={styles.ghost} onClick={() => edit({ prizes: draft.prizes.filter((_, j) => j !== i) })}>
                        {t("crewGame.delete")}
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
              {t("crewGameAlphabet.addPrize")}
            </button>
          </span>
          <span className={styles.note}>{t("crewGameAlphabet.prizesNote")}</span>
        </div>

        <div className={prize.field} role="group" aria-label={t("crewGameAlphabet.themeAria")}>
          <span className={styles.muted}>{t("crewGameAlphabet.theme")}</span>
          <span className={styles.segment}>
            {ALPHABET_THEMES.map((x) => (
              <button key={x.key} type="button" aria-pressed={draft.theme === x.key} onClick={() => edit({ theme: x.key })}>
                {t(THEME_KEY[x.key])}
              </button>
            ))}
          </span>
        </div>
        <AutoFields
          name={name}
          verb={t("crewGame.spin")}
          copy={{
            auto: t("crewGameAlphabet.autoCopy"),
            excluded: t("crewGameAlphabet.excludedCopy"),
            note: t("crewGameAlphabet.noteCopy")
          }}
          auto={draft.auto}
          excluded={draft.excluded}
          showIdle={draft.showIdle}
          signatures={signatures}
          onChange={edit}
        />
        <p className={styles.note}>{t("crewGameAlphabet.wordNote")}</p>
        <FormActions pending={pending} dirty={dirty} onReset={reset} />
      </form>

      {live && alphabet && (
        <>
          {dirty && <p className={styles.note}>{t("crewGameAlphabet.unsaved")}</p>}
          <ManualPlay game="ALPHABET" name={name} verb={t("crewGame.spin")} withSource={false} live={live} members={members} disabled={!settings.word} pending={pending} run={run} />
          {!settings.word && <p className={styles.note}>{t("crewGameAlphabet.needWord")}</p>}
          {settings.word && (
            <>
              <ul className={games.alphaBoards} aria-label={t("crewGameAlphabet.boardsAria")}>
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
                    <span className={styles.muted}>{t("crewGameAlphabet.done", { n: x.done })}</span>
                    <button
                      type="button"
                      className={styles.ghost}
                      disabled={pending || !x.slots.some((c) => c.revealAt)}
                      onClick={() => run(() => resetAlphabet({ broadcastId: live.id, memberId: x.memberId }), t("crewGameAlphabet.boardCleared", { name: x.name }))}
                    >
                      {t("crewGameAlphabet.clear")}
                    </button>
                  </li>
                ))}
              </ul>
              <span className={prize.inline}>
                <button
                  type="button"
                  className={styles.ghost}
                  disabled={pending}
                  onClick={() => run(() => resetAlphabet({ broadcastId: live.id, memberId: null }), t("crewGameAlphabet.allCleared"))}
                >
                  {t("crewGameAlphabet.clearAll")}
                </button>
              </span>
            </>
          )}
          <RunList name={name} runs={alphabet.runs} now={now} />
        </>
      )}

      <OverlayAddress overlayPath={overlayPath} param="alphabet" label={name} />
    </section>
  );
}
