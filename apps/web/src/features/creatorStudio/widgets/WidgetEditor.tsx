"use client";

import { useEffect, useRef, useState, useTransition, type ComponentType } from "react";
import { useI18n } from "@/lib/i18n/I18nProvider";
import type { MessageKey } from "@/lib/i18n/translate";
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
import { SigWallpaperForm } from "./SigWallpaperForm";
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
  SIG_QUEUE: SigQueueForm,
  SIG_WALLPAPER: SigWallpaperForm
};

/** Popup titles; the URL label varies in the design (통합 채팅창 URL · 위젯 연동 URL …). Message keys (2026-11-01). */
export const WIDGET_EDITOR_COPY: Record<EditableWidgetKey, { title: MessageKey; urlLabel: MessageKey | null }> = {
  ALERT: { title: "widgetFormEditor.alertTitle", urlLabel: "widgetFormEditor.alertUrl" },
  CHAT: { title: "widgetFormEditor.chatTitle", urlLabel: "widgetFormEditor.chatUrl" },
  QR: { title: "widgetFormEditor.qrTitle", urlLabel: "widgetFormEditor.qrUrl" },
  GOAL: { title: "widgetFormEditor.goalTitle", urlLabel: "widgetFormEditor.goalUrl" },
  TOTAL: { title: "widgetFormEditor.totalTitle", urlLabel: "widgetFormEditor.totalUrl" },
  RECENT: { title: "widgetFormEditor.recentTitle", urlLabel: "widgetFormEditor.recentUrl" },
  EVENT: { title: "widgetFormEditor.eventTitle", urlLabel: "widgetFormEditor.eventUrl" },
  MINI: { title: "widgetFormEditor.miniTitle", urlLabel: "widgetFormEditor.miniUrl" },
  RANKING: { title: "widgetFormEditor.rankingTitle", urlLabel: "widgetFormEditor.rankingUrl" },
  VOTE: { title: "widgetFormEditor.voteTitle", urlLabel: "widgetFormEditor.voteUrl" },
  // 373:1307 has no URL box: sounds play through the alert widget.
  CUSTOM_SOUND: { title: "widgetFormEditor.customSoundTitle", urlLabel: null },
  QUEST: { title: "widgetFormEditor.questTitle", urlLabel: "widgetFormEditor.questUrl" },
  GACHA: { title: "widgetFormEditor.gachaTitle", urlLabel: "widgetFormEditor.gachaUrl" },
  ROULETTE: { title: "widgetFormEditor.rouletteTitle", urlLabel: "widgetFormEditor.rouletteUrl" },
  WALLPAPER: { title: "widgetFormEditor.wallpaperTitle", urlLabel: "widgetFormEditor.wallpaperUrl" },
  CLOCK: { title: "widgetFormEditor.clockTitle", urlLabel: "widgetFormEditor.clockUrl" },
  TOP_DONATION: { title: "widgetFormEditor.topDonationTitle", urlLabel: "widgetFormEditor.topDonationUrl" },
  DONATION_MONITOR: { title: "widgetFormEditor.monitorTitle", urlLabel: "widgetFormEditor.monitorUrl" },
  SIG_QUEUE: { title: "widgetFormEditor.sigQueueTitle", urlLabel: "widgetFormEditor.sigQueueUrl" },
  SIG_WALLPAPER: { title: "widgetFormEditor.sigWallpaperTitle", urlLabel: "widgetFormEditor.sigWallpaperUrl" }
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
  const { t } = useI18n();

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
        } else setError(result.status === "INVALID" ? result.message : t("widgetForm.loginAgain"));
      } catch {
        setError(t("widgetForm.saveFailed"));
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
  const { t } = useI18n();
  return (
    <>
      {state.status === "LOADING" && <p className={styles.state}>{t("widgetForm.loading")}</p>}
      {state.status === "ERROR" && (
        <div className={styles.state}>
          <p>{t("widgetForm.loadError")}</p>
          <button type="button" className={styles.smallButton} onClick={retry}>
            {t("widgetForm.retry")}
          </button>
        </div>
      )}
      {state.status === "READY" && draft && (
        <>
          {copy.urlLabel && (
            <div className={styles.urlBox}>
              <span className={styles.urlLabel}>{t(copy.urlLabel)}</span>
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
  const { t } = useI18n();
  return (
    <div className={styles.urlRow}>
      <span className={styles.urlField}>{shown}</span>
      <CopyButton value={url} label={t("widgetForm.copyUrl")} className={styles.copyButton} />
      <a href={url} target="_blank" rel="noopener noreferrer" className={styles.openButton}>
        {t("widgetForm.open")}
      </a>
    </div>
  );
}
