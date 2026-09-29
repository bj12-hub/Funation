"use client";

import { useCallback, useEffect, useRef, useState, useTransition, type ComponentType } from "react";
import { Modal } from "@/components/ui/Modal";
import { Toast } from "@/components/ui/Toast";
import { getWidgetDetail, saveWidgetSettings } from "@/services/creator/widgetSettings";
import {
  ALERT_CARDS,
  WIDGET_CARDS,
  isEditableWidget,
  type CatalogCard,
  type EditableWidgetKey,
  type WidgetDetail,
  type WidgetKey
} from "@/services/creator/widgetSettingsTypes";
import { CopyButton } from "../settings/SettingsCards";
import { CustomSoundForm } from "./CustomSoundForm";
import { ChatForm, GoalForm, QrForm, TotalForm, type FormProps } from "./forms";
import { EventForm, MiniForm, RecentForm } from "./listForms";
import { RankingForm } from "./RankingForm";
import { VoteForm } from "./VoteForm";
import styles from "./widgets.module.css";

const FORMS: { [K in EditableWidgetKey]: ComponentType<FormProps<K>> } = {
  CHAT: ChatForm,
  QR: QrForm,
  GOAL: GoalForm,
  TOTAL: TotalForm,
  RECENT: RecentForm,
  EVENT: EventForm,
  MINI: MiniForm,
  RANKING: RankingForm,
  VOTE: VoteForm,
  CUSTOM_SOUND: CustomSoundForm
};

/** Popup titles; the URL label varies in the design (통합 채팅창 URL · 위젯 연동 URL …). */
const MODAL_COPY: Record<EditableWidgetKey, { title: string; urlLabel: string }> = {
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
  CUSTOM_SOUND: { title: "커스텀 사운드 설정", urlLabel: "" }
};

/** Widgets whose popup saves item by item instead of through the footer. */
const SELF_SAVING: EditableWidgetKey[] = ["CUSTOM_SOUND"];

/**
 * 후원위젯/알림설정. Figma 529:4 (route `/creator/widgets`); popups 364:6 · 364:158 · 364:265 · 372:7 ·
 * 531:1370 (최근알림) · 531:1598 (이벤트) · 531:1826 (미니후원) · 315:650 (후원랭킹) · 315:858 (투표) · 373:1307 (커스텀 사운드).
 * The alert cards have no designed popup yet, and the remaining widget popups follow in later PRs.
 */
export function WidgetSettingsScreen({ alertWidgetUrl }: { alertWidgetUrl: string }) {
  const [openKey, setOpenKey] = useState<EditableWidgetKey | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const clearToast = useCallback(() => setToast(null), []);

  return (
    <div className={styles.content}>
      <h1 className={styles.srOnly}>후원위젯/알림설정</h1>
      <CardGrid title="후원 알림 설정" cards={ALERT_CARDS} />
      <CardGrid title="후원 위젯 설정" cards={WIDGET_CARDS} onOpen={(k) => isEditableWidget(k) && setOpenKey(k)} />
      {openKey && (
        <WidgetModal
          key={openKey}
          widgetKey={openKey}
          alertWidgetUrl={alertWidgetUrl}
          onClose={() => setOpenKey(null)}
          onSaved={() => {
            setOpenKey(null);
            setToast("설정을 저장했습니다.");
          }}
        />
      )}
      <Toast message={toast} onDone={clearToast} />
    </div>
  );
}

function CardGrid<K extends string>({ title, cards, onOpen }: { title: string; cards: CatalogCard<K>[]; onOpen?: (k: WidgetKey) => void }) {
  return (
    <section className={styles.group} aria-label={title}>
      <h2 className={styles.groupTitle}>{title}</h2>
      <ul className={styles.grid}>
        {cards.map((c) => {
          const body = (
            <>
              <span className={styles.cardIcon} style={{ background: c.color }} aria-hidden="true">
                {c.emoji}
              </span>
              <span className={styles.cardText}>
                <strong>{c.title}</strong>
                <span>{c.description}</span>
              </span>
            </>
          );
          const ready = onOpen && isEditableWidget(c.key);
          return (
            <li key={c.key}>
              {ready ? (
                <button type="button" className={`${styles.card} ${styles.cardButton}`} aria-haspopup="dialog" onClick={() => onOpen(c.key as WidgetKey)}>
                  {body}
                </button>
              ) : (
                <div className={`${styles.card} ${onOpen ? styles.cardSoon : ""}`} title={onOpen ? "준비 중인 기능입니다" : undefined}>
                  {body}
                </div>
              )}
            </li>
          );
        })}
      </ul>
    </section>
  );
}

type LoadState = { status: "LOADING" } | { status: "ERROR" } | { status: "READY"; detail: WidgetDetail };

function WidgetModal({
  widgetKey,
  alertWidgetUrl,
  onClose,
  onSaved
}: {
  widgetKey: EditableWidgetKey;
  alertWidgetUrl: string;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [state, setState] = useState<LoadState>({ status: "LOADING" });
  const [draft, setDraft] = useState<WidgetDetail["settings"] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, startSaving] = useTransition();
  const [attempt, setAttempt] = useState(0);
  const busy = useRef(false);
  const copy = MODAL_COPY[widgetKey];
  const selfSaving = SELF_SAVING.includes(widgetKey);

  useEffect(() => {
    let alive = true;
    getWidgetDetail(widgetKey)
      .then((detail) => {
        if (!alive) return;
        if (!detail) return setState({ status: "ERROR" });
        setState({ status: "READY", detail });
        setDraft(detail.settings);
      })
      .catch(() => alive && setState({ status: "ERROR" }));
    return () => {
      alive = false;
    };
  }, [widgetKey, attempt]);

  const save = () => {
    if (!draft || busy.current) return;
    busy.current = true;
    setError(null);
    startSaving(async () => {
      try {
        const result = await saveWidgetSettings(widgetKey, draft);
        if (result.status === "SAVED") onSaved();
        else setError(result.status === "INVALID" ? result.message : "로그인이 필요합니다. 다시 로그인해 주세요.");
      } catch {
        setError("저장하지 못했습니다. 잠시 후 다시 시도해 주세요.");
      } finally {
        busy.current = false;
      }
    });
  };

  const Form = FORMS[widgetKey] as ComponentType<FormProps<EditableWidgetKey>>;

  return (
    <Modal
      open
      onClose={onClose}
      title={copy.title}
      width={680}
      className={styles.dialog}
      customHeader={
        <header className={styles.modalHeader}>
          <h2>{copy.title}</h2>
          <button type="button" aria-label="닫기" onClick={onClose}>
            ✕
          </button>
        </header>
      }
    >
      <div className={styles.modalBody} aria-busy={state.status === "LOADING" || saving}>
        {state.status === "LOADING" && <p className={styles.state}>설정을 불러오는 중입니다…</p>}
        {state.status === "ERROR" && (
          <div className={styles.state}>
            <p>설정을 불러오지 못했습니다.</p>
            <button
              type="button"
              className={styles.smallButton}
              onClick={() => {
                setState({ status: "LOADING" });
                setAttempt((n) => n + 1);
              }}
            >
              다시 시도
            </button>
          </div>
        )}
        {state.status === "READY" && draft && (
          <>
            {copy.urlLabel && (
              <div className={styles.urlBox}>
                <span className={styles.urlLabel}>{copy.urlLabel}</span>
                <div className={styles.urlRow}>
                  <span className={styles.urlField}>{state.detail.url}</span>
                  <CopyButton value={state.detail.url} label="URL 복사" className={styles.copyButton} />
                  <a href={state.detail.url} target="_blank" rel="noopener noreferrer" className={styles.openButton}>
                    열기
                  </a>
                </div>
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
      </div>
      <footer className={styles.modalFooter}>
        {/* The design leaves this button's action undefined; it copies the 통합 알림창 URL (TBD). */}
        <CopyButton value={alertWidgetUrl} label="알림창 URL ⓘ" className={styles.footerGhost} />
        <button type="button" className={styles.footerGhost} onClick={onClose}>
          {selfSaving ? "닫기" : "취소"}
        </button>
        {!selfSaving && (
          <button type="button" className={styles.footerPrimary} onClick={save} disabled={state.status !== "READY" || saving}>
            {saving ? "저장 중…" : "설정 저장"}
          </button>
        )}
      </footer>
    </Modal>
  );
}
