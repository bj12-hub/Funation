"use client";

import { useEffect, useRef, useState, useTransition, type ComponentType } from "react";
import { getWidgetDetail, saveWidgetSettings } from "@/services/creator/widgetSettings";
import type { EditableWidgetKey, WidgetDetail } from "@/services/creator/widgetSettingsTypes";
import { CopyButton } from "../settings/SettingsCards";
import { AlertForm } from "./AlertForm";
import { ClockForm } from "./ClockForm";
import { CustomSoundForm } from "./CustomSoundForm";
import { ChatForm, QrForm, TotalForm, type FormProps } from "./forms";
import { GoalForm } from "./GoalForm";
import { GachaForm } from "./GachaForm";
import { QuestForm } from "./gameForms";
import { EventForm, MiniForm, RecentForm } from "./listForms";
import { DonationMonitorForm, SigQueueForm, TopDonationForm } from "./MonitorForms";
import { RankingForm } from "./RankingForm";
import { RouletteForm } from "./RouletteForm";
import { VoteForm } from "./VoteForm";
import { WallpaperForm } from "./WallpaperForm";
import styles from "./widgets.module.css";

const FORMS: { [K in EditableWidgetKey]: ComponentType<FormProps<K>> } = {
  ALERT: AlertForm,
  CHAT: ChatForm,
  QR: QrForm,
  GOAL: GoalForm,
  TOTAL: TotalForm,
  RECENT: RecentForm,
  EVENT: EventForm,
  MINI: MiniForm,
  RANKING: RankingForm,
  VOTE: VoteForm,
  CUSTOM_SOUND: CustomSoundForm,
  QUEST: QuestForm,
  GACHA: GachaForm,
  ROULETTE: RouletteForm,
  WALLPAPER: WallpaperForm,
  CLOCK: ClockForm,
  TOP_DONATION: TopDonationForm,
  DONATION_MONITOR: DonationMonitorForm,
  SIG_QUEUE: SigQueueForm
};

/** Popup titles; the URL label varies in the design (통합 채팅창 URL · 위젯 연동 URL …). */
export const WIDGET_EDITOR_COPY: Record<EditableWidgetKey, { title: string; urlLabel: string }> = {
  ALERT: { title: "후원 알림 디자인", urlLabel: "후원 알림 URL" },
  CHAT: { title: "채팅창 위젯 설정", urlLabel: "통합 채팅창 URL" },
  QR: { title: "후원 QR코드 위젯 설정", urlLabel: "QR코드 위젯 URL" },
  GOAL: { title: "후원목표 위젯 설정", urlLabel: "후원목표 위젯 URL" },
  TOTAL: { title: "후원누적금액 위젯 설정", urlLabel: "위젯 연동 URL" },
  RECENT: { title: "최근알림 위젯 설정", urlLabel: "최근알림 위젯 URL" },
  EVENT: { title: "이벤트 위젯 설정", urlLabel: "이벤트 위젯 URL" },
  MINI: { title: "미니후원 위젯 설정", urlLabel: "미니후원 위젯 URL" },
  RANKING: { title: "후원랭킹 위젯 설정", urlLabel: "후원랭킹 위젯 URL" },
  VOTE: { title: "투표 위젯 설정", urlLabel: "투표 위젯 URL" },
  // 373:1307 has no URL box: sounds play through the alert widget.
  CUSTOM_SOUND: { title: "커스텀 사운드 설정", urlLabel: "" },
  QUEST: { title: "퀘스트 위젯 설정", urlLabel: "퀘스트 위젯 URL" },
  GACHA: { title: "뽑기 후원 위젯 설정", urlLabel: "뽑기 후원 위젯 URL" },
  ROULETTE: { title: "룰렛 설정", urlLabel: "룰렛 위젯 URL" },
  WALLPAPER: { title: "벽지 위젯 설정", urlLabel: "벽지 위젯 URL" },
  CLOCK: { title: "시계 위젯 설정", urlLabel: "시계 위젯 URL" },
  TOP_DONATION: { title: "최고 후원 위젯 설정", urlLabel: "최고 후원 위젯 URL" },
  DONATION_MONITOR: { title: "후원 모니터링 위젯 설정", urlLabel: "후원 모니터링 위젯 URL" },
  SIG_QUEUE: { title: "시그 큐 모니터 위젯 설정", urlLabel: "시그 큐 모니터 위젯 URL" }
};

/** Widgets whose editor saves item by item instead of through a save button. */
export const isSelfSaving = (key: EditableWidgetKey) => key === "CUSTOM_SOUND";

type LoadState = { status: "LOADING" } | { status: "ERROR" } | { status: "READY"; detail: WidgetDetail };

export type WidgetEditor = ReturnType<typeof useWidgetEditor>;

/**
 * Loads, edits and saves one 후원 위젯's settings — shared by the studio popup (위젯 page) and the 도우미 feature pages.
 * `initial` (read on the server) skips the first load. The server validates and stores; the draft is only a draft.
 */
export function useWidgetEditor(widgetKey: EditableWidgetKey, { initial, onSaved }: { initial?: WidgetDetail; onSaved?: () => void } = {}) {
  const [state, setState] = useState<LoadState>(initial ? { status: "READY", detail: initial } : { status: "LOADING" });
  const [draft, setDraft] = useState<WidgetDetail["settings"] | null>(initial?.settings ?? null);
  const [saved, setSaved] = useState<WidgetDetail["settings"] | null>(initial?.settings ?? null);
  const [error, setError] = useState<string | null>(null);
  const [saving, startSaving] = useTransition();
  const [attempt, setAttempt] = useState(0);
  const busy = useRef(false);
  const preloaded = attempt === 0 && !!initial;

  useEffect(() => {
    if (preloaded) return;
    let alive = true;
    getWidgetDetail(widgetKey)
      .then((detail) => {
        if (!alive) return;
        if (!detail) return setState({ status: "ERROR" });
        setState({ status: "READY", detail });
        setDraft(detail.settings);
        setSaved(detail.settings);
      })
      .catch(() => alive && setState({ status: "ERROR" }));
    return () => {
      alive = false;
    };
  }, [widgetKey, attempt, preloaded]);

  const save = () => {
    if (!draft || busy.current) return;
    busy.current = true;
    setError(null);
    const sent = draft;
    startSaving(async () => {
      try {
        const result = await saveWidgetSettings(widgetKey, sent);
        if (result.status === "SAVED") {
          setSaved(sent);
          onSaved?.();
        } else setError(result.status === "INVALID" ? result.message : "로그인이 필요합니다. 다시 로그인해 주세요.");
      } catch {
        setError("저장하지 못했습니다. 잠시 후 다시 시도해 주세요.");
      } finally {
        busy.current = false;
      }
    });
  };

  const retry = () => {
    setState({ status: "LOADING" });
    setAttempt((n) => n + 1);
  };

  const dirty = draft !== null && saved !== null && JSON.stringify(draft) !== JSON.stringify(saved);
  return { widgetKey, state, draft, setDraft, error, saving, save, retry, dirty, selfSaving: isSelfSaving(widgetKey) };
}

/** The editor's body: loading · error states, the overlay address and the widget's form. */
export function WidgetEditorBody({ editor }: { editor: WidgetEditor }) {
  const { widgetKey, state, draft, setDraft, error, retry } = editor;
  const copy = WIDGET_EDITOR_COPY[widgetKey];
  const Form = FORMS[widgetKey] as ComponentType<FormProps<EditableWidgetKey>>;
  return (
    <>
      {state.status === "LOADING" && <p className={styles.state}>설정을 불러오는 중입니다…</p>}
      {state.status === "ERROR" && (
        <div className={styles.state}>
          <p>설정을 불러오지 못했습니다.</p>
          <button type="button" className={styles.smallButton} onClick={retry}>
            다시 시도
          </button>
        </div>
      )}
      {state.status === "READY" && draft && (
        <>
          {copy.urlLabel && (
            <div className={styles.urlBox}>
              <span className={styles.urlLabel}>{copy.urlLabel}</span>
              <WidgetUrl detail={state.detail} />
            </div>
          )}
          <Form value={draft} onChange={setDraft} live={state.detail.live} />
        </>
      )}
      {error && (
        <p className={styles.error} role="alert">
          {error}
        </p>
      )}
    </>
  );
}

const maskKey = (path: string) => path.replace(/[^/]+$/, (k) => `${k.slice(0, 4)}-····-····-····`);

/**
 * The widget's address. A 후원 위젯 with an OBS overlay (code-first) shows its real overlay URL with the
 * key masked (copy · 열기 use the full URL); the others keep the design's placeholder URL (TBD).
 */
function WidgetUrl({ detail }: { detail: WidgetDetail }) {
  const [origin, setOrigin] = useState("");
  useEffect(() => setOrigin(window.location.origin), []);
  const url = detail.overlayPath ? `${origin}${detail.overlayPath}` : detail.url;
  const shown = detail.overlayPath ? `${origin}${maskKey(detail.overlayPath)}` : detail.url;
  return (
    <div className={styles.urlRow}>
      <span className={styles.urlField}>{shown}</span>
      <CopyButton value={url} label="URL 복사" className={styles.copyButton} />
      <a href={url} target="_blank" rel="noopener noreferrer" className={styles.openButton}>
        열기
      </a>
    </div>
  );
}
