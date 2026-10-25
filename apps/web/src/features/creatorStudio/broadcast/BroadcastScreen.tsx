"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useState, useTransition } from "react";
import { Modal } from "@/components/ui/Modal";
import { Toast } from "@/components/ui/Toast";
import { changeStreamEngine, revealStreamKey, startBroadcast, stopBroadcast, updateBroadcast } from "@/services/creator/broadcast";
import {
  BROADCAST_PASSWORD_MAX,
  BROADCAST_TAG_MAX,
  BROADCAST_TITLE_MAX,
  RESOLUTION_OPTIONS,
  type BroadcastInput,
  type BroadcastResolution,
  type BroadcastResult,
  type BroadcastView
} from "@/services/creator/broadcastTypes";
import { STREAM_POLICY } from "@/services/channel/streamerTypes";
import styles from "./broadcast.module.css";

const LOGIN = "/login?role=creator&next=/creator/broadcast";

/**
 * 방송 설정 (phase 5; code-first, no Figma frame — FLEXTV's own broadcast page is the reference). Route
 * `/creator/broadcast`. OBS sends to FLEXTV with the 서버 and 스트림 키 below; the broadcast starts once OBS is sending,
 * and ends with 방송 종료 (stopping OBS leaves it open, as on FLEXTV). Every value is checked again on the server.
 */
export function BroadcastScreen({ view }: { view: BroadcastView }) {
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
      return "FLEXTV가 응답하지 않았어요. 방송 상태를 다시 불러왔으니 확인해 주세요.";
    }
    return "message" in result ? result.message : null;
  };

  const [stopError, setStopError] = useState<string | null>(null);
  const stop = () =>
    startStopping(async () => {
      setStopError(onResult(await stopBroadcast(), "방송을 종료했어요. OBS 송출도 멈춰 주세요."));
      setConfirmStop(false);
    });

  return (
    <div className={styles.content}>
      <h1 className={styles.pageTitle}>방송 설정</h1>

      {view.suspension && (
        <p className={styles.alert} role="alert">
          <strong>이용이 정지된 채널이에요.</strong>{" "}
          {view.suspension.permanent ? "영구 정지" : view.suspension.until ? `${view.suspension.until.slice(0, 10)}까지` : ""}
          {view.suspension.reason ? ` · ${view.suspension.reason}` : ""} 정지 기간에는 방송할 수 없어요.
        </p>
      )}

      <section className={styles.card} aria-labelledby="bc-status">
        <div className={styles.statusRow}>
          <div className={styles.statusText}>
            <h2 id="bc-status" className={styles.cardTitle}>
              {view.channelName}
            </h2>
            <span className={styles.badge} data-live={view.live || undefined}>
              {view.live ? "● 방송 중" : view.streaming ? "송출 대기 중" : "방송 전"}
            </span>
          </div>
          <div className={styles.actions}>
            <Link href={view.watchPath} className={styles.secondaryButton}>
              내 방송 보기
            </Link>
            {view.streaming && (
              <button type="button" className={styles.dangerButton} onClick={() => setConfirmStop(true)}>
                방송 종료
              </button>
            )}
          </div>
        </div>
        {view.streaming && !view.live && <p className={styles.help}>OBS 송출이 끊겼어요. 다시 송출하면 이어서 방송되고, 끝내려면 방송 종료를 눌러 주세요.</p>}
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
        title="방송을 종료할까요?"
        description="시청자에게 방송이 바로 종료돼요. 종료한 뒤 OBS 송출도 멈춰 주세요."
        footer={
          <>
            <button type="button" className={styles.secondaryButton} disabled={stopping} onClick={() => setConfirmStop(false)}>
              취소
            </button>
            <button type="button" className={styles.dangerButton} disabled={stopping} aria-busy={stopping || undefined} onClick={stop}>
              {stopping ? "종료하는 중..." : "방송 종료"}
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
  const router = useRouter();
  const [shown, setShown] = useState<Record<string, string>>({});
  const [pending, startTransition] = useTransition();

  const keyOf = async (engine: string): Promise<string | null> => {
    if (shown[engine]) return shown[engine];
    const r = await revealStreamKey(engine);
    if (r.status === "UNAUTHORIZED") router.push(LOGIN);
    else if (r.status !== "OK") onToast("스트림 키를 불러오지 못했어요. 잠시 후 다시 시도해 주세요.");
    return r.status === "OK" ? r.streamKey : null;
  };
  const copy = async (text: string | null) => {
    if (!text) return;
    try {
      await navigator.clipboard.writeText(text);
      onToast("복사했어요.");
    } catch {
      onToast("복사하지 못했어요. 직접 선택해 복사해 주세요.");
    }
  };
  const use = (engine: string) =>
    startTransition(async () => {
      const r = await changeStreamEngine(engine);
      if (r.status === "UNAUTHORIZED") return router.push(LOGIN);
      onToast(r.status === "SAVED" ? "송출 방식을 바꿨어요. OBS에 이 방식의 서버와 키를 넣어 주세요." : "송출 방식을 바꾸지 못했어요. 방송 중이 아닐 때 다시 시도해 주세요.");
      if (r.status === "SAVED") router.refresh();
    });

  return (
    <section className={styles.card} aria-labelledby="bc-keys">
      <h2 id="bc-keys" className={styles.cardTitle}>
        OBS 송출 정보
      </h2>
      <p className={styles.help}>OBS 설정 › 방송에서 서비스를 &lsquo;사용자 지정&rsquo;으로 고르고, 아래 서버와 스트림 키를 붙여 넣은 뒤 방송 시작(송출)을 눌러 주세요.</p>
      {view.keys.length === 0 ? (
        <p className={styles.empty}>스트림 키를 불러오지 못했어요. 잠시 후 새로고침해 주세요.</p>
      ) : (
        <ul className={styles.keys}>
          {view.keys.map((k) => {
            const current = view.engine === k.engine;
            return (
              <li key={k.engine} className={styles.keyItem} data-current={current || undefined}>
                <div className={styles.keyHead}>
                  <strong>{k.label}</strong>
                  {current ? (
                    <span className={styles.chipOn}>사용 중</span>
                  ) : (
                    !view.streaming && (
                      <button type="button" className={styles.linkButton} disabled={pending} onClick={() => use(k.engine)}>
                        이 방식으로 송출
                      </button>
                    )
                  )}
                </div>
                <div className={styles.fieldRow}>
                  <span className={styles.fieldLabel}>서버</span>
                  <span className={styles.value}>{k.serverUrl}</span>
                  <button type="button" className={styles.secondaryButton} onClick={() => copy(k.serverUrl)}>
                    복사
                  </button>
                </div>
                <div className={styles.fieldRow}>
                  <span className={styles.fieldLabel}>스트림 키</span>
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
                    {shown[k.engine] ? "숨기기" : "보기"}
                  </button>
                  <button type="button" className={styles.secondaryButton} onClick={async () => copy(await keyOf(k.engine))}>
                    복사
                  </button>
                </div>
              </li>
            );
          })}
        </ul>
      )}
      <p className={styles.warning}>스트림 키를 아는 사람은 누구나 내 채널로 방송할 수 있어요. 화면 공유나 방송 중에 키가 보이지 않게 해 주세요.</p>
    </section>
  );
}

/* ── 방송 정보 ───────────────────────────────────────────── */

function BroadcastForm({ view, onResult }: { view: BroadcastView; onResult: (result: BroadcastResult, ok: string) => string | null }) {
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
      setError(onResult(result, view.streaming ? "방송 정보를 바꿨어요." : "방송을 시작했어요."));
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
        방송 정보
      </h2>

      <label className={styles.field}>
        <span className={styles.label}>방송 제목</span>
        <input className={styles.input} value={title} onChange={(e) => setTitle(e.target.value)} maxLength={BROADCAST_TITLE_MAX} required disabled={disabled} />
        <span className={styles.hint}>
          {title.length} / {BROADCAST_TITLE_MAX}
        </span>
      </label>

      <label className={styles.field}>
        <span className={styles.label}>카테고리</span>
        <select className={styles.input} value={themeId} onChange={(e) => setThemeId(e.target.value)} disabled={disabled}>
          {view.themes.map((t) => (
            <option key={t.value} value={t.value}>
              {t.label}
            </option>
          ))}
        </select>
      </label>

      {view.tags.length > 0 && (
        <fieldset className={styles.field} disabled={disabled}>
          <legend className={styles.label}>태그 (최대 {BROADCAST_TAG_MAX}개)</legend>
          <div className={styles.chips}>
            {view.tags.map((t) => {
              const on = tags.includes(t.value);
              return (
                <button
                  key={t.value}
                  type="button"
                  className={on ? styles.chipOn : styles.chip}
                  aria-pressed={on}
                  disabled={!on && tags.length >= BROADCAST_TAG_MAX}
                  onClick={() => setTags((list) => (on ? list.filter((c) => c !== t.value) : [...list, t.value]))}
                >
                  {t.label}
                </button>
              );
            })}
          </div>
        </fieldset>
      )}

      <div className={styles.twoCols}>
        <fieldset className={styles.field} disabled={disabled}>
          <legend className={styles.label}>화면 방향</legend>
          <div className={styles.radios}>
            {(["landscape", "portrait"] as const).map((m) => (
              <label key={m} className={styles.check}>
                <input type="radio" name="displayMode" checked={displayMode === m} onChange={() => setDisplayMode(m)} />
                {m === "landscape" ? "가로" : "세로"}
              </label>
            ))}
          </div>
        </fieldset>
        <fieldset className={styles.field} disabled={disabled || view.streaming}>
          <legend className={styles.label}>화질</legend>
          <div className={styles.radios}>
            {RESOLUTION_OPTIONS.map((r) => (
              <label key={r} className={styles.check}>
                <input type="radio" name="resolution" checked={resolution === r} onChange={() => setResolution(r)} />
                {r}p
              </label>
            ))}
          </div>
          {view.streaming && <span className={styles.hint}>화질은 방송 중에 바꿀 수 없어요.</span>}
        </fieldset>
      </div>

      <fieldset className={styles.field} disabled={disabled}>
        <legend className={styles.label}>방송 속성</legend>
        <div className={styles.radios}>
          <label className={styles.check} title={view.adult ? undefined : "만 19세 이상 회원만 설정할 수 있어요"}>
            <input type="checkbox" checked={forAdult} disabled={!view.adult} onChange={(e) => setForAdult(e.target.checked)} />
            연령제한 (19)
          </label>
          {forAdult && (
            <label className={styles.check}>
              <input type="checkbox" checked={adultThumbnail} onChange={(e) => setAdultThumbnail(e.target.checked)} />
              성인 썸네일
            </label>
          )}
          <label className={styles.check}>
            <input type="checkbox" checked={visitAllow} onChange={(e) => setVisitAllow(e.target.checked)} />
            탐방허용
          </label>
          <label className={styles.check}>
            <input type="checkbox" checked={watermark} onChange={(e) => setWatermark(e.target.checked)} />
            워터마크
          </label>
          <label className={styles.check}>
            <input type="checkbox" checked={recordingWarning} onChange={(e) => setRecordingWarning(e.target.checked)} />
            녹화 방지 경고
          </label>
          <label className={styles.check}>
            <input type="checkbox" checked={locked} onChange={(e) => setLocked(e.target.checked)} />
            비밀번호방
          </label>
        </div>
        {!view.adult && <span className={styles.hint}>연령제한 방송은 만 19세 이상 회원만 설정할 수 있어요.</span>}
        {locked &&
          (newPassword === null ? (
            <div className={styles.inline}>
              <span className={styles.hint}>설정된 비밀번호를 그대로 써요.</span>
              <button type="button" className={styles.linkButton} onClick={() => setNewPassword("")}>
                비밀번호 바꾸기
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
              placeholder="방 비밀번호"
              aria-label="방 비밀번호"
            />
          ))}
      </fieldset>

      {!view.streaming && (
        <details className={styles.policy}>
          <summary>FLEXTV 방송 준수사항</summary>
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
          방송 준수사항에 동의합니다 (필수)
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
        {pending ? "보내는 중..." : view.streaming ? "방송 정보 변경" : "방송 시작하기"}
      </button>
      {!view.streaming && <p className={styles.hint}>OBS에서 송출을 먼저 시작한 뒤 눌러 주세요. 송출이 FLEXTV에 닿아야 방송이 시작돼요.</p>}
    </form>
  );
}
