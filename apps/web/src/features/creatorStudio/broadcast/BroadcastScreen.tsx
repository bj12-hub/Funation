"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useState, useTransition } from "react";
import { Modal } from "@/components/ui/Modal";
import { Toast } from "@/components/ui/Toast";
import { useI18n } from "@/lib/i18n/I18nProvider";
import type { MessageKey } from "@/lib/i18n/translate";
import { changeStreamEngine, revealStreamKey, startBroadcast, stopBroadcast, updateBroadcast } from "@/services/creator/broadcast";
import {
  BROADCAST_PASSWORD_MAX,
  BROADCAST_TAG_MAX,
  BROADCAST_TITLE_MAX,
  RESOLUTION_OPTIONS,
  type BroadcastEngine,
  type BroadcastInput,
  type BroadcastResolution,
  type BroadcastResult,
  type BroadcastView
} from "@/services/creator/broadcastTypes";
import { STREAM_POLICY } from "@/services/channel/streamerTypes";
import styles from "./broadcast.module.css";

const LOGIN = "/login?role=creator&next=/creator/broadcast";

/** The engine names of ENGINE_LABEL (services/creator/broadcastTypes), in the page's language. */
const ENGINE_LABEL_KEY: Record<BroadcastEngine, MessageKey> = { ncp_llh: "flextvBroadcast.engineLowLatency", ncp: "flextvBroadcast.engineStandard" };

/**
 * 방송 설정 (phase 5; code-first, no Figma frame — FLEXTV's own broadcast page is the reference). Route
 * `/creator/broadcast`. OBS sends to FLEXTV with the 서버 and 스트림 키 below; the broadcast starts once OBS is sending,
 * and ends with 방송 종료 (stopping OBS leaves it open, as on FLEXTV). Every value is checked again on the server.
 */
export function BroadcastScreen({ view }: { view: BroadcastView }) {
  const { t } = useI18n();
  const router = useRouter();
  const [toast, setToast] = useState<string | null>(null);
  const clear = useCallback(() => setToast(null), []);
  const [confirmStop, setConfirmStop] = useState(false);
  const [stopping, startStopping] = useTransition();

  const onResult = (result: BroadcastResult, ok: string): string | null => {
    if (result.status === "UNAUTHORIZED") {
      router.push(LOGIN);
      return null;
    }
    if (result.status === "STARTED" || result.status === "UPDATED" || result.status === "STOPPED") {
      setToast(ok);
      router.refresh();
      return null;
    }
    if (result.status === "UNKNOWN") {
      router.refresh();
      return t("flextvBroadcast.unknown");
    }
    return "message" in result ? result.message : null;
  };

  const [stopError, setStopError] = useState<string | null>(null);
  const stop = () =>
    startStopping(async () => {
      setStopError(onResult(await stopBroadcast(), t("flextvBroadcast.stopped")));
      setConfirmStop(false);
    });

  return (
    <div className={styles.content}>
      <h1 className={styles.pageTitle}>{t("flextvBroadcast.title")}</h1>

      {view.suspension && (
        <p className={styles.alert} role="alert">
          <strong>{t("flextvBroadcast.suspended")}</strong>{" "}
          {view.suspension.permanent
            ? t("flextvBroadcast.suspendedPermanent")
            : view.suspension.until
              ? t("flextvBroadcast.suspendedUntil", { date: view.suspension.until.slice(0, 10) })
              : ""}
          {view.suspension.reason ? ` · ${view.suspension.reason}` : ""} {t("flextvBroadcast.suspendedNote")}
        </p>
      )}

      <section className={styles.card} aria-labelledby="bc-status">
        <div className={styles.statusRow}>
          <div className={styles.statusText}>
            <h2 id="bc-status" className={styles.cardTitle}>
              {view.channelName}
            </h2>
            <span className={styles.badge} data-live={view.live || undefined}>
              {view.live ? t("flextvBroadcast.statusLive") : view.streaming ? t("flextvBroadcast.statusWaiting") : t("flextvBroadcast.statusOff")}
            </span>
          </div>
          <div className={styles.actions}>
            <Link href={view.watchPath} className={styles.secondaryButton}>
              {t("flextvBroadcast.watch")}
            </Link>
            {view.streaming && (
              <button type="button" className={styles.dangerButton} onClick={() => setConfirmStop(true)}>
                {t("flextvBroadcast.end")}
              </button>
            )}
          </div>
        </div>
        {view.streaming && !view.live && <p className={styles.help}>{t("flextvBroadcast.disconnected")}</p>}
        {stopError && (
          <p className={styles.error} role="alert">
            {stopError}
          </p>
        )}
      </section>

      <StreamKeysCard view={view} onToast={setToast} />
      <BroadcastForm key={`${view.streaming}`} view={view} onResult={onResult} />

      <Modal
        open={confirmStop}
        onClose={() => !stopping && setConfirmStop(false)}
        title={t("flextvBroadcast.endTitle")}
        description={t("flextvBroadcast.endDesc")}
        footer={
          <>
            <button type="button" className={styles.secondaryButton} disabled={stopping} onClick={() => setConfirmStop(false)}>
              {t("flextvBroadcast.cancel")}
            </button>
            <button type="button" className={styles.dangerButton} disabled={stopping} aria-busy={stopping || undefined} onClick={stop}>
              {stopping ? t("flextvBroadcast.ending") : t("flextvBroadcast.end")}
            </button>
          </>
        }
      />
      <Toast message={toast} tone="neutral" onDone={clear} />
    </div>
  );
}

/* ── OBS 송출 정보 ───────────────────────────────────────── */

function StreamKeysCard({ view, onToast }: { view: BroadcastView; onToast: (message: string) => void }) {
  const { t } = useI18n();
  const router = useRouter();
  const [shown, setShown] = useState<Record<string, string>>({});
  const [pending, startTransition] = useTransition();

  const keyOf = async (engine: string): Promise<string | null> => {
    if (shown[engine]) return shown[engine];
    const r = await revealStreamKey(engine);
    if (r.status === "UNAUTHORIZED") router.push(LOGIN);
    else if (r.status !== "OK") onToast(t("flextvBroadcast.keyFailed"));
    return r.status === "OK" ? r.streamKey : null;
  };
  const copy = async (text: string | null) => {
    if (!text) return;
    try {
      await navigator.clipboard.writeText(text);
      onToast(t("flextvBroadcast.copied"));
    } catch {
      onToast(t("flextvBroadcast.copyFailed"));
    }
  };
  const use = (engine: string) =>
    startTransition(async () => {
      const r = await changeStreamEngine(engine);
      if (r.status === "UNAUTHORIZED") return router.push(LOGIN);
      onToast(r.status === "SAVED" ? t("flextvBroadcast.engineChanged") : t("flextvBroadcast.engineFailed"));
      if (r.status === "SAVED") router.refresh();
    });

  return (
    <section className={styles.card} aria-labelledby="bc-keys">
      <h2 id="bc-keys" className={styles.cardTitle}>
        {t("flextvBroadcast.keysTitle")}
      </h2>
      <p className={styles.help}>{t("flextvBroadcast.keysHelp")}</p>
      {view.keys.length === 0 ? (
        <p className={styles.empty}>{t("flextvBroadcast.keysEmpty")}</p>
      ) : (
        <ul className={styles.keys}>
          {view.keys.map((k) => {
            const current = view.engine === k.engine;
            return (
              <li key={k.engine} className={styles.keyItem} data-current={current || undefined}>
                <div className={styles.keyHead}>
                  <strong>{t(ENGINE_LABEL_KEY[k.engine])}</strong>
                  {current ? (
                    <span className={styles.chipOn}>{t("flextvBroadcast.inUse")}</span>
                  ) : (
                    !view.streaming && (
                      <button type="button" className={styles.linkButton} disabled={pending} onClick={() => use(k.engine)}>
                        {t("flextvBroadcast.useEngine")}
                      </button>
                    )
                  )}
                </div>
                <div className={styles.fieldRow}>
                  <span className={styles.fieldLabel}>{t("flextvBroadcast.server")}</span>
                  <span className={styles.value}>{k.serverUrl}</span>
                  <button type="button" className={styles.secondaryButton} onClick={() => copy(k.serverUrl)}>
                    {t("flextvBroadcast.copy")}
                  </button>
                </div>
                <div className={styles.fieldRow}>
                  <span className={styles.fieldLabel}>{t("flextvBroadcast.streamKey")}</span>
                  <span className={styles.value}>{shown[k.engine] ?? "••••••••••••••••"}</span>
                  <button
                    type="button"
                    className={styles.secondaryButton}
                    onClick={async () => {
                      if (shown[k.engine]) return setShown((s) => Object.fromEntries(Object.entries(s).filter(([engine]) => engine !== k.engine)));
                      const key = await keyOf(k.engine);
                      if (key) setShown((s) => ({ ...s, [k.engine]: key }));
                    }}
                  >
                    {shown[k.engine] ? t("flextvBroadcast.hide") : t("flextvBroadcast.show")}
                  </button>
                  <button type="button" className={styles.secondaryButton} onClick={async () => copy(await keyOf(k.engine))}>
                    {t("flextvBroadcast.copy")}
                  </button>
                </div>
              </li>
            );
          })}
        </ul>
      )}
      <p className={styles.warning}>{t("flextvBroadcast.keyWarning")}</p>
    </section>
  );
}

/* ── 방송 정보 ───────────────────────────────────────────── */

function BroadcastForm({ view, onResult }: { view: BroadcastView; onResult: (result: BroadcastResult, ok: string) => string | null }) {
  const { t } = useI18n();
  const d = view.defaults;
  const [title, setTitle] = useState(d.title);
  const [themeId, setThemeId] = useState(d.themeId ?? "");
  const [tags, setTags] = useState<string[]>(d.tagCodes);
  const [forAdult, setForAdult] = useState(d.forAdult);
  const [adultThumbnail, setAdultThumbnail] = useState(d.adultThumbnail);
  const [locked, setLocked] = useState(d.hasPassword);
  const [newPassword, setNewPassword] = useState<string | null>(d.hasPassword ? null : "");
  const [visitAllow, setVisitAllow] = useState(d.visitAllow);
  const [watermark, setWatermark] = useState(d.watermark);
  const [recordingWarning, setRecordingWarning] = useState(d.recordingWarning);
  const [displayMode, setDisplayMode] = useState(d.displayMode);
  const [resolution, setResolution] = useState<BroadcastResolution>("1080");
  const [agreed, setAgreed] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const disabled = !!view.suspension;

  const submit = () => {
    setError(null);
    const input: BroadcastInput = {
      title,
      themeId,
      tagCodes: tags,
      forAdult,
      adultThumbnail,
      password: !locked ? { mode: "NONE" } : newPassword === null ? { mode: "KEEP" } : { mode: "SET", value: newPassword },
      visitAllow,
      watermark,
      recordingWarning,
      displayMode,
      resolution,
      agreed
    };
    startTransition(async () => {
      const result = view.streaming ? await updateBroadcast(input) : await startBroadcast(input);
      setError(onResult(result, view.streaming ? t("flextvBroadcast.updated") : t("flextvBroadcast.started")));
    });
  };

  return (
    <form
      className={styles.card}
      aria-labelledby="bc-form"
      onSubmit={(e) => {
        e.preventDefault();
        submit();
      }}
    >
      <h2 id="bc-form" className={styles.cardTitle}>
        {t("flextvBroadcast.formTitle")}
      </h2>

      <label className={styles.field}>
        <span className={styles.label}>{t("flextvBroadcast.broadcastTitle")}</span>
        <input className={styles.input} value={title} onChange={(e) => setTitle(e.target.value)} maxLength={BROADCAST_TITLE_MAX} required disabled={disabled} />
        <span className={styles.hint}>
          {title.length} / {BROADCAST_TITLE_MAX}
        </span>
      </label>

      <label className={styles.field}>
        <span className={styles.label}>{t("flextvBroadcast.category")}</span>
        <select className={styles.input} value={themeId} onChange={(e) => setThemeId(e.target.value)} disabled={disabled}>
          {view.themes.map((theme) => (
            <option key={theme.value} value={theme.value}>
              {theme.label}
            </option>
          ))}
        </select>
      </label>

      {view.tags.length > 0 && (
        <fieldset className={styles.field} disabled={disabled}>
          <legend className={styles.label}>{t("flextvBroadcast.tags", { max: BROADCAST_TAG_MAX })}</legend>
          <div className={styles.chips}>
            {view.tags.map((tag) => {
              const on = tags.includes(tag.value);
              return (
                <button
                  key={tag.value}
                  type="button"
                  className={on ? styles.chipOn : styles.chip}
                  aria-pressed={on}
                  disabled={!on && tags.length >= BROADCAST_TAG_MAX}
                  onClick={() => setTags((list) => (on ? list.filter((c) => c !== tag.value) : [...list, tag.value]))}
                >
                  {tag.label}
                </button>
              );
            })}
          </div>
        </fieldset>
      )}

      <div className={styles.twoCols}>
        <fieldset className={styles.field} disabled={disabled}>
          <legend className={styles.label}>{t("flextvBroadcast.orientation")}</legend>
          <div className={styles.radios}>
            {(["landscape", "portrait"] as const).map((m) => (
              <label key={m} className={styles.check}>
                <input type="radio" name="displayMode" checked={displayMode === m} onChange={() => setDisplayMode(m)} />
                {m === "landscape" ? t("flextvBroadcast.landscape") : t("flextvBroadcast.portrait")}
              </label>
            ))}
          </div>
        </fieldset>
        <fieldset className={styles.field} disabled={disabled || view.streaming}>
          <legend className={styles.label}>{t("flextvBroadcast.quality")}</legend>
          <div className={styles.radios}>
            {RESOLUTION_OPTIONS.map((r) => (
              <label key={r} className={styles.check}>
                <input type="radio" name="resolution" checked={resolution === r} onChange={() => setResolution(r)} />
                {r}p
              </label>
            ))}
          </div>
          {view.streaming && <span className={styles.hint}>{t("flextvBroadcast.qualityLocked")}</span>}
        </fieldset>
      </div>

      <fieldset className={styles.field} disabled={disabled}>
        <legend className={styles.label}>{t("flextvBroadcast.options")}</legend>
        <div className={styles.radios}>
          {/* Age lines: policy wording, Korean until an approved translation exists (TBD). */}
          <label className={styles.check} title={view.adult ? undefined : "만 19세 이상 회원만 설정할 수 있어요"}>
            <input type="checkbox" checked={forAdult} disabled={!view.adult} onChange={(e) => setForAdult(e.target.checked)} />
            {t("flextvBroadcast.forAdult")}
          </label>
          {forAdult && (
            <label className={styles.check}>
              <input type="checkbox" checked={adultThumbnail} onChange={(e) => setAdultThumbnail(e.target.checked)} />
              {t("flextvBroadcast.adultThumbnail")}
            </label>
          )}
          <label className={styles.check}>
            <input type="checkbox" checked={visitAllow} onChange={(e) => setVisitAllow(e.target.checked)} />
            {t("flextvBroadcast.visitAllow")}
          </label>
          <label className={styles.check}>
            <input type="checkbox" checked={watermark} onChange={(e) => setWatermark(e.target.checked)} />
            {t("flextvBroadcast.watermark")}
          </label>
          <label className={styles.check}>
            <input type="checkbox" checked={recordingWarning} onChange={(e) => setRecordingWarning(e.target.checked)} />
            {t("flextvBroadcast.recordingWarning")}
          </label>
          <label className={styles.check}>
            <input type="checkbox" checked={locked} onChange={(e) => setLocked(e.target.checked)} />
            {t("flextvBroadcast.locked")}
          </label>
        </div>
        {!view.adult && <span className={styles.hint}>연령제한 방송은 만 19세 이상 회원만 설정할 수 있어요.</span>}
        {locked &&
          (newPassword === null ? (
            <div className={styles.inline}>
              <span className={styles.hint}>{t("flextvBroadcast.passwordKept")}</span>
              <button type="button" className={styles.linkButton} onClick={() => setNewPassword("")}>
                {t("flextvBroadcast.passwordChange")}
              </button>
            </div>
          ) : (
            <input
              className={styles.input}
              type="password"
              autoComplete="new-password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value.replace(/\s/g, ""))}
              maxLength={BROADCAST_PASSWORD_MAX}
              placeholder={t("flextvBroadcast.password")}
              aria-label={t("flextvBroadcast.password")}
            />
          ))}
      </fieldset>

      {!view.streaming && (
        <details className={styles.policy}>
          <summary>{t("flextvBroadcast.policy")}</summary>
          {/* FLEXTV's 방송 준수사항 are its own text and stay Korean; the consent below is translated like main's 채널 만들기 (channel.agree). */}
          <ul>
            {STREAM_POLICY.map((line) => (
              <li key={line}>{line}</li>
            ))}
          </ul>
        </details>
      )}
      {!view.streaming && (
        <label className={styles.check}>
          <input type="checkbox" checked={agreed} onChange={(e) => setAgreed(e.target.checked)} disabled={disabled} />
          {t("flextvBroadcast.policyAgree")}
        </label>
      )}

      {error && (
        <p className={styles.error} role="alert">
          {error}
        </p>
      )}

      <button
        type="submit"
        className={styles.primaryButton}
        disabled={disabled || pending || !title.trim() || !themeId || (!view.streaming && !agreed) || (locked && newPassword === "")}
        aria-busy={pending || undefined}
      >
        {pending ? t("flextvBroadcast.sending") : view.streaming ? t("flextvBroadcast.update") : t("flextvBroadcast.start")}
      </button>
      {!view.streaming && <p className={styles.hint}>{t("flextvBroadcast.startHint")}</p>}
    </form>
  );
}
