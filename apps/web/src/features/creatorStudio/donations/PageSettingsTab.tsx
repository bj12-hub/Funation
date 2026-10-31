"use client";

import { useCallback, useId, useRef, useState, type ReactNode } from "react";
import { Toast } from "@/components/ui/Toast";
import { Toggle } from "@/components/ui/Toggle";
import { useI18n } from "@/lib/i18n/I18nProvider";
import type { MessageKey } from "@/lib/i18n/translate";
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
  DEFAULT_REPLACEMENT_MESSAGE,
  ONE_LINE_MESSAGE_MAX,
  PAGE_OPTIONS,
  REPLACEMENT_MESSAGE_MAX,
  type DonationPageSettings,
  type ManagementSaveResult,
  type PageOptionKey
} from "@/services/creator/donationManagementTypes";
import { slugCheckView, type SlugCheckView } from "./slugCheck";
import styles from "./donations.module.css";

type Translate = ReturnType<typeof useI18n>["t"];
const messageOf = (r: ManagementSaveResult, t: Translate) => (r.status === "INVALID" ? r.message : r.status === "UNAUTHORIZED" ? t("studioDonations.loginRequired") : null);

/** 후원 페이지 옵션 (`PAGE_OPTIONS` in the services) as message keys. */
const OPTION_KEY: Record<PageOptionKey, { label: MessageKey; help: MessageKey; on: MessageKey; off: MessageKey }> = {
  rankPublic: { label: "studioDonations.optRankPublic", help: "studioDonations.optRankPublicHelp", on: "studioDonations.optPublic", off: "studioDonations.optPrivate" },
  historyPublic: { label: "studioDonations.optHistoryPublic", help: "studioDonations.optHistoryPublicHelp", on: "studioDonations.optPublic", off: "studioDonations.optPrivate" },
  nicknameChangeable: { label: "studioDonations.optNickname", help: "studioDonations.optNicknameHelp", on: "studioDonations.optChangeable", off: "studioDonations.optLocked" },
  customSoundPublic: { label: "studioDonations.optCustomSound", help: "studioDonations.optCustomSoundHelp", on: "studioDonations.optPublic", off: "studioDonations.optPrivate" }
};

/** 중복확인 lines written by `slugCheckView`; the server's own messages show as written. */
const SLUG_TEXT_KEY: Record<string, MessageKey> = {
  "사용할 수 있는 주소입니다.": "studioDonations.slugAvailable",
  "현재 사용 중인 주소입니다.": "studioDonations.slugSame",
  "이미 사용 중인 주소입니다.": "studioDonations.slugTaken",
  "로그인이 필요합니다.": "studioDonations.loginRequired"
};

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
  const { t } = useI18n();
  const [toast, setToast] = useState<string | null>(null);
  const clearToast = useCallback(() => setToast(null), []);
  const notify = (r: ManagementSaveResult, ok = t("studioDonations.saved")) => setToast(messageOf(r, t) ?? ok);

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
  const { t } = useI18n();
  const [slug, setSlug] = useState(initial.slug);
  // The address in the field right now, for answers that arrive after it was edited.
  const slugRef = useRef(initial.slug);
  const [saved, setSaved] = useState(initial.slug);
  const [check, setCheck] = useState<SlugCheckView | null>(null);
  const [busy, setBusy] = useState(false);
  const busyRef = useRef(false);

  const run = async (fn: () => Promise<void>) => {
    if (busyRef.current) return;
    busyRef.current = true;
    setBusy(true);
    try {
      await fn();
    } catch {
      setCheck({ tone: "error", text: t("studioDonations.retryLater") });
    } finally {
      busyRef.current = false;
      setBusy(false);
    }
  };

  return (
    <Card title={t("studioDonations.linkCard")}>
      <Line label={t("studioDonations.pageUrl")}>
        <div className={styles.inline}>
          <span className={styles.urlInput}>
            <span className={styles.urlPrefix}>{initial.donateUrlBase}</span>
            <input
              aria-label={t("studioDonations.pageAddress")}
              value={slug}
              maxLength={30}
              spellCheck={false}
              onChange={(e) => {
                slugRef.current = e.target.value.toLowerCase();
                setSlug(slugRef.current);
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
                setToast(t("studioDonations.copied"));
              } catch {
                setToast(t("studioDonations.copyFailed"));
              }
            }}
          >
            {t("studioDonations.copy")}
          </button>
          <button
            type="button"
            className={styles.solidBlue}
            disabled={busy}
            onClick={() =>
              run(async () => {
                const checked = slug;
                setCheck(slugCheckView(checked, slugRef.current, await checkDonationSlug(checked)));
              })
            }
          >
            {t("studioDonations.checkSlug")}
          </button>
        </div>
        {check && (
          <div className={styles.inline}>
            <p className={check.tone === "ok" ? styles.ok : styles.error} role={check.tone === "ok" ? "status" : "alert"}>
              {SLUG_TEXT_KEY[check.text] ? t(SLUG_TEXT_KEY[check.text]) : check.text}
            </p>
            {check.available && (
              <button
                type="button"
                className={styles.solidPurple}
                disabled={busy}
                onClick={() =>
                  run(async () => {
                    const r = await changeDonationSlug(slug);
                    notify(r, t("studioDonations.slugChanged"));
                    if (r.status === "SAVED") {
                      setSaved(slug);
                      setCheck(null);
                    }
                  })
                }
              >
                {t("studioDonations.useSlug")}
              </button>
            )}
          </div>
        )}
        <p className={styles.helper}>{t("studioDonations.slugHelp")}</p>
      </Line>
    </Card>
  );
}

function OneLineCard({ initial, notify }: { initial: string; notify: Notify }) {
  const { t } = useI18n();
  const [value, setValue] = useState(initial);
  const [saved, setSaved] = useState(initial);
  const [busy, setBusy] = useState(false);
  return (
    <Card title={t("studioDonations.pageCard")}>
      <Line label={t("studioDonations.oneLine")}>
        <textarea
          aria-label={t("studioDonations.oneLine")}
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
              {t("studioDonations.save")}
            </button>
          )}
        </div>
      </Line>
    </Card>
  );
}

function OptionsCard({ initial, notify }: { initial: Record<PageOptionKey, boolean>; notify: Notify }) {
  const { t } = useI18n();
  const [options, setOptions] = useState(initial);
  const [pending, setPending] = useState<PageOptionKey | null>(null);
  return (
    <Card title={t("studioDonations.optionsCard")}>
      {PAGE_OPTIONS.map((o) => (
        <Line key={o.key} label={t(OPTION_KEY[o.key].label)} help={t(OPTION_KEY[o.key].help)} wide>
          <div role="radiogroup" aria-label={t(OPTION_KEY[o.key].label)} className={styles.radios} aria-busy={pending === o.key}>
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
                      notify({ status: "INVALID", message: t("studioDonations.saveFailed") });
                    } finally {
                      setPending(null);
                    }
                  }}
                />
                {val ? t(OPTION_KEY[o.key].on) : t(OPTION_KEY[o.key].off)}
              </label>
            ))}
          </div>
        </Line>
      ))}
    </Card>
  );
}

function ReplacementCard({ initial, notify }: { initial: DonationPageSettings["replacement"]; notify: Notify }) {
  const { t } = useI18n();
  const [targets, setTargets] = useState({ nickname: initial.applyToNickname, text: initial.applyToText });
  const [words, setWords] = useState(initial.bannedWords);
  const [word, setWord] = useState("");
  const [message, setMessage] = useState(initial.message);
  const [savedMessage, setSavedMessage] = useState(initial.message);
  const [busy, setBusy] = useState(false);

  const toggle = async (target: "nickname" | "text", value: boolean) => {
    setTargets((x) => ({ ...x, [target]: value }));
    const r = await setReplacementTarget(target, value).catch(() => ({ status: "INVALID", message: t("studioDonations.saveFailed") }) as const);
    if (r.status !== "SAVED") setTargets((x) => ({ ...x, [target]: !value }));
    notify(r);
  };

  const add = async () => {
    const w = word.trim();
    if (!w || busy) return;
    setBusy(true);
    try {
      const r = await addBannedWord(w);
      notify(r, t("studioDonations.bannedAdded"));
      if (r.status === "SAVED") {
        setWords((list) => [...list, w]);
        setWord("");
      }
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card title={t("studioDonations.replaceCard")} description={t("studioDonations.replaceDesc")}>
      <Line label={t("studioDonations.nickname")}>
        <Toggle label={t("studioDonations.replaceNickname")} checked={targets.nickname} onChange={(v) => toggle("nickname", v)} />
      </Line>
      <Line label={t("studioDonations.textContent")}>
        <Toggle label={t("studioDonations.replaceText")} checked={targets.text} onChange={(v) => toggle("text", v)} />
      </Line>
      <Line label={t("studioDonations.bannedList")}>
        <div className={styles.inline}>
          <input
            aria-label={t("studioDonations.bannedAdd")}
            className={styles.input}
            maxLength={BANNED_WORD_MAX}
            placeholder={t("studioDonations.bannedPlaceholder")}
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
            {t("studioDonations.add")}
          </button>
        </div>
        {words.length > 0 && (
          <ul className={styles.chips}>
            {words.map((w) => (
              <li key={w}>
                {w}
                <button
                  type="button"
                  aria-label={t("studioDonations.removeWord", { word: w })}
                  onClick={async () => {
                    const r = await removeBannedWord(w);
                    if (r.status === "SAVED") setWords((list) => list.filter((x) => x !== w));
                    notify(r, t("studioDonations.bannedRemoved"));
                  }}
                >
                  ✖
                </button>
              </li>
            ))}
          </ul>
        )}
      </Line>
      <Line label={t("studioDonations.replaceMessage")}>
        <div className={styles.inline}>
          <input
            aria-label={t("studioDonations.replaceMessage")}
            className={styles.input}
            maxLength={REPLACEMENT_MESSAGE_MAX}
            placeholder={t("studioDonations.replacePlaceholder")}
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
              {t("studioDonations.save")}
            </button>
          )}
        </div>
        {/* Code-first copy (2026-10-06 결정 "기본 문구로 표시"). */}
        <p className={styles.helper}>{t("studioDonations.replaceHelp", { message: DEFAULT_REPLACEMENT_MESSAGE })}</p>
      </Line>
    </Card>
  );
}
