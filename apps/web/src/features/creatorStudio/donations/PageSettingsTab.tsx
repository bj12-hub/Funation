"use client";

import { useCallback, useId, useRef, useState, type ReactNode } from "react";
import { Toast } from "@/components/ui/Toast";
import { Toggle } from "@/components/ui/Toggle";
import {
  addBannedWord,
  changeDonationSlug,
  checkDonationSlug,
  removeBannedWord,
  saveOneLineMessage,
  saveReplacementMessage,
  setPageOption,
  setReplacementTarget
} from "@/services/creator/donationManagement";
import {
  BANNED_WORD_MAX,
  ONE_LINE_MESSAGE_MAX,
  PAGE_OPTIONS,
  REPLACEMENT_MESSAGE_MAX,
  type DonationPageSettings,
  type ManagementSaveResult,
  type PageOptionKey
} from "@/services/creator/donationManagementTypes";
import styles from "./donations.module.css";

const messageOf = (r: ManagementSaveResult) => (r.status === "INVALID" ? r.message : r.status === "UNAUTHORIZED" ? "로그인이 필요합니다." : null);

function Card({ title, children, description }: { title: string; children: ReactNode; description?: string }) {
  const id = useId();
  return (
    <section className={styles.card} aria-labelledby={id}>
      <h2 id={id} className={styles.cardTitle}>
        {title}
      </h2>
      {description && <p className={styles.helper}>{description}</p>}
      {children}
    </section>
  );
}

function Line({ label, children, help, wide = false }: { label: string; children: ReactNode; help?: string; wide?: boolean }) {
  return (
    <div className={`${styles.line} ${wide ? styles.lineWide : ""}`}>
      <span className={styles.lineLabel}>
        {label}
        {help && (
          <span className={styles.help} title={help} role="img" aria-label={help}>
            ?
          </span>
        )}
      </span>
      <div className={styles.lineControl}>{children}</div>
    </div>
  );
}

/**
 * 후원 페이지 설정 — Figma 539:7. The design has no save button: choices save as they change and
 * text fields get their own 저장 button once edited.
 */
export function PageSettingsTab({ initial }: { initial: DonationPageSettings }) {
  const [toast, setToast] = useState<string | null>(null);
  const clearToast = useCallback(() => setToast(null), []);
  const notify = (r: ManagementSaveResult, ok = "저장했습니다.") => setToast(messageOf(r) ?? ok);

  return (
    <div className={styles.stack}>
      <SlugCard initial={initial} notify={notify} setToast={setToast} />
      <OneLineCard initial={initial.oneLineMessage} notify={notify} />
      <OptionsCard initial={initial.options} notify={notify} />
      <ReplacementCard initial={initial.replacement} notify={notify} />
      <Toast message={toast} onDone={clearToast} />
    </div>
  );
}

type Notify = (r: ManagementSaveResult, ok?: string) => void;

function SlugCard({ initial, notify, setToast }: { initial: DonationPageSettings; notify: Notify; setToast: (m: string) => void }) {
  const [slug, setSlug] = useState(initial.slug);
  const [saved, setSaved] = useState(initial.slug);
  const [check, setCheck] = useState<{ tone: "ok" | "error"; text: string; available?: boolean } | null>(null);
  const [busy, setBusy] = useState(false);
  const busyRef = useRef(false);

  const run = async (fn: () => Promise<void>) => {
    if (busyRef.current) return;
    busyRef.current = true;
    setBusy(true);
    try {
      await fn();
    } catch {
      setCheck({ tone: "error", text: "잠시 후 다시 시도해 주세요." });
    } finally {
      busyRef.current = false;
      setBusy(false);
    }
  };

  return (
    <Card title="후원 페이지 링크 설정">
      <Line label="후원 페이지 URL">
        <div className={styles.inline}>
          <span className={styles.urlInput}>
            <span className={styles.urlPrefix}>{initial.donateUrlBase}</span>
            <input
              aria-label="후원 페이지 주소"
              value={slug}
              maxLength={20}
              spellCheck={false}
              onChange={(e) => {
                setSlug(e.target.value.toLowerCase());
                setCheck(null);
              }}
            />
          </span>
          <button
            type="button"
            className={styles.outlineBlue}
            onClick={async () => {
              try {
                await navigator.clipboard.writeText(initial.donateUrlBase + saved);
                setToast("복사했습니다.");
              } catch {
                setToast("복사하지 못했습니다. 직접 선택해 복사해 주세요.");
              }
            }}
          >
            복사
          </button>
          <button
            type="button"
            className={styles.solidBlue}
            disabled={busy}
            onClick={() =>
              run(async () => {
                const r = await checkDonationSlug(slug);
                if (r.status === "AVAILABLE") setCheck({ tone: "ok", text: "사용할 수 있는 주소입니다.", available: true });
                else if (r.status === "SAME") setCheck({ tone: "ok", text: "현재 사용 중인 주소입니다." });
                else if (r.status === "TAKEN") setCheck({ tone: "error", text: "이미 사용 중인 주소입니다." });
                else setCheck({ tone: "error", text: r.status === "INVALID" ? r.message : "로그인이 필요합니다." });
              })
            }
          >
            중복확인
          </button>
        </div>
        {check && (
          <div className={styles.inline}>
            <p className={check.tone === "ok" ? styles.ok : styles.error} role={check.tone === "ok" ? "status" : "alert"}>
              {check.text}
            </p>
            {check.available && (
              <button
                type="button"
                className={styles.solidPurple}
                disabled={busy}
                onClick={() =>
                  run(async () => {
                    const r = await changeDonationSlug(slug);
                    notify(r, "후원 페이지 주소를 변경했습니다.");
                    if (r.status === "SAVED") {
                      setSaved(slug);
                      setCheck(null);
                    }
                  })
                }
              >
                이 주소로 변경
              </button>
            )}
          </div>
        )}
        <p className={styles.helper}>주소를 바꾸면 이전 주소로는 후원 페이지에 들어올 수 없어요.</p>
      </Line>
    </Card>
  );
}

function OneLineCard({ initial, notify }: { initial: string; notify: Notify }) {
  const [value, setValue] = useState(initial);
  const [saved, setSaved] = useState(initial);
  const [busy, setBusy] = useState(false);
  return (
    <Card title="후원 페이지 설정">
      <Line label="한 줄 메시지">
        <textarea
          aria-label="한 줄 메시지"
          className={styles.textarea}
          maxLength={ONE_LINE_MESSAGE_MAX}
          value={value}
          onChange={(e) => setValue(e.target.value)}
        />
        <div className={styles.lineFoot}>
          <span className={styles.counter}>
            {value.length}/{ONE_LINE_MESSAGE_MAX}
          </span>
          {value !== saved && (
            <button
              type="button"
              className={styles.solidPurple}
              disabled={busy}
              onClick={async () => {
                setBusy(true);
                try {
                  const r = await saveOneLineMessage(value);
                  notify(r);
                  if (r.status === "SAVED") setSaved(value.trim());
                } finally {
                  setBusy(false);
                }
              }}
            >
              저장
            </button>
          )}
        </div>
      </Line>
    </Card>
  );
}

function OptionsCard({ initial, notify }: { initial: Record<PageOptionKey, boolean>; notify: Notify }) {
  const [options, setOptions] = useState(initial);
  const [pending, setPending] = useState<PageOptionKey | null>(null);
  return (
    <Card title="후원 페이지 옵션">
      {PAGE_OPTIONS.map((o) => (
        <Line key={o.key} label={o.label} help={o.help} wide>
          <div role="radiogroup" aria-label={o.label} className={styles.radios} aria-busy={pending === o.key}>
            {([true, false] as const).map((val) => (
              <label key={String(val)} className={`${styles.radio} ${options[o.key] === val ? styles.radioOn : ""}`}>
                <input
                  type="radio"
                  name={o.key}
                  checked={options[o.key] === val}
                  disabled={pending !== null}
                  onChange={async () => {
                    const prev = options[o.key];
                    setOptions((x) => ({ ...x, [o.key]: val }));
                    setPending(o.key);
                    try {
                      const r = await setPageOption(o.key, val);
                      if (r.status !== "SAVED") setOptions((x) => ({ ...x, [o.key]: prev }));
                      notify(r);
                    } catch {
                      setOptions((x) => ({ ...x, [o.key]: prev }));
                      notify({ status: "INVALID", message: "저장하지 못했습니다." });
                    } finally {
                      setPending(null);
                    }
                  }}
                />
                {val ? o.on : o.off}
              </label>
            ))}
          </div>
        </Line>
      ))}
    </Card>
  );
}

function ReplacementCard({ initial, notify }: { initial: DonationPageSettings["replacement"]; notify: Notify }) {
  const [targets, setTargets] = useState({ nickname: initial.applyToNickname, text: initial.applyToText });
  const [words, setWords] = useState(initial.bannedWords);
  const [word, setWord] = useState("");
  const [message, setMessage] = useState(initial.message);
  const [savedMessage, setSavedMessage] = useState(initial.message);
  const [busy, setBusy] = useState(false);

  const toggle = async (target: "nickname" | "text", value: boolean) => {
    setTargets((t) => ({ ...t, [target]: value }));
    const r = await setReplacementTarget(target, value).catch(() => ({ status: "INVALID", message: "저장하지 못했습니다." }) as const);
    if (r.status !== "SAVED") setTargets((t) => ({ ...t, [target]: !value }));
    notify(r);
  };

  const add = async () => {
    const w = word.trim();
    if (!w || busy) return;
    setBusy(true);
    try {
      const r = await addBannedWord(w);
      notify(r, "금지어를 추가했습니다.");
      if (r.status === "SAVED") {
        setWords((list) => [...list, w]);
        setWord("");
      }
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card title="대체 메시지 표시 설정" description="도네이터가 등록한 금지어를 사용하여 후원할 경우, 사전에 등록된 대체메시지로 노출됩니다.">
      <Line label="닉네임">
        <Toggle label="닉네임에 대체 메시지 적용" checked={targets.nickname} onChange={(v) => toggle("nickname", v)} />
      </Line>
      <Line label="텍스트 내용">
        <Toggle label="텍스트 내용에 대체 메시지 적용" checked={targets.text} onChange={(v) => toggle("text", v)} />
      </Line>
      <Line label="금지어 목록">
        <div className={styles.inline}>
          <input
            aria-label="추가할 금지어"
            className={styles.input}
            maxLength={BANNED_WORD_MAX}
            placeholder="금지어 입력"
            value={word}
            onChange={(e) => setWord(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.nativeEvent.isComposing) {
                e.preventDefault();
                void add();
              }
            }}
          />
          <button type="button" className={styles.solidBlue} onClick={add} disabled={busy || !word.trim()}>
            추가
          </button>
        </div>
        {words.length > 0 && (
          <ul className={styles.chips}>
            {words.map((w) => (
              <li key={w}>
                {w}
                <button
                  type="button"
                  aria-label={`${w} 삭제`}
                  onClick={async () => {
                    const r = await removeBannedWord(w);
                    if (r.status === "SAVED") setWords((list) => list.filter((x) => x !== w));
                    notify(r, "금지어를 삭제했습니다.");
                  }}
                >
                  ✖
                </button>
              </li>
            ))}
          </ul>
        )}
      </Line>
      <Line label="대체 메시지">
        <div className={styles.inline}>
          <input
            aria-label="대체 메시지"
            className={styles.input}
            maxLength={REPLACEMENT_MESSAGE_MAX}
            placeholder="대체 메시지 입력"
            value={message}
            onChange={(e) => setMessage(e.target.value)}
          />
          {message !== savedMessage && (
            <button
              type="button"
              className={styles.solidPurple}
              disabled={busy}
              onClick={async () => {
                setBusy(true);
                try {
                  const r = await saveReplacementMessage(message);
                  notify(r);
                  if (r.status === "SAVED") setSavedMessage(message.trim());
                } finally {
                  setBusy(false);
                }
              }}
            >
              저장
            </button>
          )}
        </div>
      </Line>
    </Card>
  );
}
