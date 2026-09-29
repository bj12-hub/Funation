"use client";

import { useCallback, useState } from "react";
import { Toast } from "@/components/ui/Toast";
import { Toggle } from "@/components/ui/Toggle";
import { addFilterWord, removeFilterWord, setFilterStrength, setSpamBlock } from "@/services/creator/donationManagement";
import { FILTER_STRENGTHS, FILTER_WORD_MAX, type FilterSettings, type FilterStrength, type ManagementSaveResult } from "@/services/creator/donationManagementTypes";
import styles from "./donations.module.css";

const messageOf = (r: ManagementSaveResult) => (r.status === "INVALID" ? r.message : r.status === "UNAUTHORIZED" ? "로그인이 필요합니다." : null);
const FAILED: ManagementSaveResult = { status: "INVALID", message: "저장하지 못했습니다. 잠시 후 다시 시도해 주세요." };

/** 필터링 — Figma 539:466. Choices save as they change (the design has no save button). */
export function FilterSettingsPanel({ initial }: { initial: FilterSettings }) {
  const [strength, setStrength] = useState(initial.strength);
  const [spam, setSpam] = useState(initial.blockSpam);
  const [words, setWords] = useState(initial.words);
  const [word, setWord] = useState("");
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const clearToast = useCallback(() => setToast(null), []);
  const notify = (r: ManagementSaveResult, ok = "저장했습니다.") => setToast(messageOf(r) ?? ok);

  const changeStrength = async (next: FilterStrength) => {
    const prev = strength;
    setStrength(next);
    const r = await setFilterStrength(next).catch(() => FAILED);
    if (r.status !== "SAVED") setStrength(prev);
    notify(r);
  };

  const add = async () => {
    const w = word.trim();
    if (!w || busy) return;
    setBusy(true);
    try {
      const r = await addFilterWord(w).catch(() => FAILED);
      notify(r, "단어를 등록했습니다.");
      if (r.status === "SAVED") {
        setWords((list) => [...list, w]);
        setWord("");
      }
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <section className={styles.card} aria-labelledby="filter-title">
        <h2 id="filter-title" className={styles.cardTitle}>
          비속어 및 불건전 메시지 자동 차단
        </h2>
        <p className={styles.desc}>방송 통계와 시청자 채팅 창에서 부적절하거나 유해한 도네이션 내용을 사전에 차단하고 필터링합니다.</p>
        <div className={`${styles.line} ${styles.lineWide}`}>
          <span className={styles.lineLabel}>비속어 필터 강도</span>
          <div role="radiogroup" aria-label="비속어 필터 강도" className={styles.radios}>
            {FILTER_STRENGTHS.map((s) => (
              <label key={s.key} className={`${styles.radio} ${strength === s.key ? styles.radioOn : ""}`}>
                <input type="radio" name="filter-strength" checked={strength === s.key} onChange={() => changeStrength(s.key)} />
                {s.label}
              </label>
            ))}
          </div>
        </div>
        <div className={`${styles.line} ${styles.lineWide}`}>
          <span className={styles.lineLabel}>특수 문자/도배 차단</span>
          <div className={styles.lineControl}>
            <Toggle
              label="특수 문자/도배 차단"
              checked={spam}
              onChange={async (v) => {
                setSpam(v);
                const r = await setSpamBlock(v).catch(() => FAILED);
                if (r.status !== "SAVED") setSpam(!v);
                notify(r);
              }}
            />
          </div>
        </div>
        <div className={`${styles.line} ${styles.lineWide}`}>
          <span className={styles.lineLabel}>커스텀 블랙리스트 단어</span>
          <div className={styles.inline}>
            <input
              aria-label="필터링할 추가 단어"
              className={styles.input}
              maxLength={FILTER_WORD_MAX}
              placeholder="필터링할 추가 단어 입력"
              value={word}
              onChange={(e) => setWord(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.nativeEvent.isComposing) {
                  e.preventDefault();
                  void add();
                }
              }}
            />
            <button type="button" className={styles.solidPurple} onClick={add} disabled={busy || !word.trim()}>
              등록
            </button>
          </div>
        </div>
      </section>

      <section className={styles.card} aria-labelledby="filter-words">
        <h2 id="filter-words" className={styles.cardTitleSmall}>
          현재 적용 중인 단어 필터 ({words.length})
        </h2>
        {words.length === 0 ? (
          <p className={styles.helper}>등록된 단어가 없습니다.</p>
        ) : (
          <ul className={styles.chips}>
            {words.map((w) => (
              <li key={w}>
                {w}
                <button
                  type="button"
                  aria-label={`${w} 삭제`}
                  onClick={async () => {
                    const r = await removeFilterWord(w).catch(() => FAILED);
                    if (r.status === "SAVED") setWords((list) => list.filter((x) => x !== w));
                    notify(r, "단어를 삭제했습니다.");
                  }}
                >
                  ✖
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>
      <Toast message={toast} onDone={clearToast} />
    </>
  );
}
