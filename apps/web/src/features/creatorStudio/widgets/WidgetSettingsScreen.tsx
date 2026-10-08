"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState, useTransition, type ComponentType } from "react";
import { Modal } from "@/components/ui/Modal";
import { Toast } from "@/components/ui/Toast";
import type { OverlayTarget } from "@/services/creator/alertTypes";
import type { OverlayAppearance } from "@/services/creator/overlayThemeTypes";
import { getWidgetDetail, saveWidgetSettings } from "@/services/creator/widgetSettings";
import {
  isEditableWidget,
  type EditableWidgetKey,
  type WidgetDetail
} from "@/services/creator/widgetSettingsTypes";
import { ThemeGallery } from "@/features/overlayTheme/ThemeGallery";
import { OverlayOffNotice } from "../remote/OverlayOffNotice";
import { CopyButton } from "../settings/SettingsCards";
import { CustomSoundForm } from "./CustomSoundForm";
import { ChatForm, GoalForm, QrForm, TotalForm, type FormProps } from "./forms";
import { GachaForm } from "./GachaForm";
import { QuestForm } from "./gameForms";
import { EventForm, MiniForm, RecentForm } from "./listForms";
import { RankingForm } from "./RankingForm";
import { RouletteForm } from "./RouletteForm";
import { VoteForm } from "./VoteForm";
import { WallpaperForm } from "./WallpaperForm";
import { ALL_COUNT, GROUPS, POPULAR, TOOLS, type CatalogItem } from "./widgetCatalog";
import catalog from "./widgetCatalog.module.css";
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
  CUSTOM_SOUND: CustomSoundForm,
  QUEST: QuestForm,
  GACHA: GachaForm,
  ROULETTE: RouletteForm,
  WALLPAPER: WallpaperForm
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
  CUSTOM_SOUND: { title: "커스텀 사운드 설정", urlLabel: "" },
  QUEST: { title: "퀘스트 위젯 설정", urlLabel: "퀘스트 위젯 URL" },
  GACHA: { title: "뽑기 후원 위젯 설정", urlLabel: "뽑기 후원 위젯 URL" },
  ROULETTE: { title: "룰렛 설정", urlLabel: "룰렛 위젯 URL" },
  WALLPAPER: { title: "벽지 위젯 설정", urlLabel: "벽지 위젯 URL" }
};

/** Widgets whose popup saves item by item instead of through the footer. */
const SELF_SAVING: EditableWidgetKey[] = ["CUSTOM_SOUND"];

/**
 * 후원위젯/알림설정. Figma 529:4 (route `/creator/widgets`); popups 364:6 · 364:158 · 364:265 · 372:7 ·
 * 531:1370 (최근알림) · 531:1598 (이벤트) · 531:1826 (미니후원) · 315:650 (후원랭킹) · 315:858 (투표) · 373:1307 (커스텀 사운드) ·
 * 373:1598 (퀘스트) · 373:3675 (뽑기 후원) · 395:145 (벽지) · code-first 룰렛. 럭키박스 (373:1356) and 플레이 (373:1785)
 * were removed (2026-10-04 결정).
 * Catalog layout follows the funnation 위젯 page (인기 · 전체 by group · 도구; see ./widgetCatalog.ts).
 * The Figma 후원 알림 설정 alert-type cards are no longer listed (they had no popups); 그림후원 links to its own page.
 * 오버레이 테마 (code-first, 2026-10-08) sits above the catalog: the 전체 테마 every overlay is drawn in.
 */
export function WidgetSettingsScreen({ alertWidgetUrl, switches, appearance }: { alertWidgetUrl: string; switches: Record<OverlayTarget, boolean>; appearance: OverlayAppearance }) {
  const [openKey, setOpenKey] = useState<EditableWidgetKey | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const clearToast = useCallback(() => setToast(null), []);

  return (
    <div className={styles.content}>
      <header className={catalog.header}>
        <h1 className={catalog.title}>위젯</h1>
        <p className={catalog.subtitle}>방송 화면에 띄울 위젯을 고르고 설정하세요. 오버레이 주소는 도구에서 한 번에 복사할 수 있어요.</p>
      </header>
      <OverlayOffNotice targets={["widgets"]} switches={switches} />
      <ThemeGallery initial={appearance} />
      <CatalogGrid title="인기" count={POPULAR.length} items={POPULAR} onOpen={setOpenKey} />
      <section className={styles.group} aria-label="전체 위젯">
        <h2 className={styles.groupTitle}>
          전체 <span className={catalog.count}>{ALL_COUNT}</span>
        </h2>
        {GROUPS.map((g) => (
          <CatalogGrid key={g.title} title={g.title} items={g.items} onOpen={setOpenKey} sub />
        ))}
      </section>
      <CatalogGrid title="도구" count={TOOLS.length} items={TOOLS} onOpen={setOpenKey} />
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

/** One catalog section (funnation 위젯 layout). `sub` renders a group inside 전체. */
function CatalogGrid({ title, count, items, onOpen, sub = false }: { title: string; count?: number; items: CatalogItem[]; onOpen: (k: EditableWidgetKey) => void; sub?: boolean }) {
  const Heading = sub ? "h3" : "h2";
  return (
    <section className={sub ? catalog.subGroup : styles.group} aria-label={title}>
      <Heading className={sub ? catalog.subTitle : styles.groupTitle}>
        {title} {count !== undefined && <span className={catalog.count}>{count}</span>}
      </Heading>
      <ul className={styles.grid}>
        {items.map((item) => {
          const body = (
            <>
              <span className={styles.cardIcon} style={{ background: "var(--color-surface-raised)" }} aria-hidden="true">
                {item.emoji}
              </span>
              <span className={styles.cardText}>
                <strong>
                  {item.title}
                  {item.action.type === "soon" && <span className={catalog.soon}>준비 중</span>}
                </strong>
                <span>{item.description}</span>
              </span>
            </>
          );
          const a = item.action;
          return (
            <li key={item.id}>
              {a.type === "widget" && isEditableWidget(a.key) ? (
                <button type="button" className={`${styles.card} ${styles.cardButton}`} aria-haspopup="dialog" onClick={() => onOpen(a.key as EditableWidgetKey)}>
                  {body}
                </button>
              ) : a.type === "link" ? (
                <Link href={a.href} className={`${styles.card} ${styles.cardButton}`}>
                  {body}
                </Link>
              ) : (
                <div className={`${styles.card} ${styles.cardSoon}`} title="준비 중인 기능입니다" aria-disabled="true">
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
