"use client";

import Link from "next/link";
import { useCallback, useState } from "react";
import { Modal } from "@/components/ui/Modal";
import { Toast } from "@/components/ui/Toast";
import { useI18n } from "@/lib/i18n/I18nProvider";
import type { MessageKey } from "@/lib/i18n/translate";
import type { OverlayTarget } from "@/services/creator/alertTypes";
import type { OverlayAppearance } from "@/services/creator/overlayThemeTypes";
import { isEditableWidget, type EditableWidgetKey } from "@/services/creator/widgetSettingsTypes";
import { ThemeGallery } from "@/features/overlayTheme/ThemeGallery";
import { OverlayOffNotice } from "../remote/OverlayOffNotice";
import { CopyButton } from "../settings/SettingsCards";
import { ALL_COUNT, FLEXTV_ITEMS, GROUPS, POPULAR, TOOLS, type CatalogItem } from "./widgetCatalog";
import { WIDGET_EDITOR_COPY, WidgetEditorBody, useWidgetEditor } from "./WidgetEditor";
import catalog from "./widgetCatalog.module.css";
import styles from "./widgets.module.css";

/** Catalog titles and descriptions by item id, and the group titles, as message keys (2026-11-01); ./widgetCatalog.ts keeps the Korean. */
const ITEM_KEYS: Record<string, { title: MessageKey; description: MessageKey }> = {
  ALERT: { title: "widgetFormCatalog.alertTitle", description: "widgetFormCatalog.alertDesc" },
  RANKING: { title: "widgetFormCatalog.rankingTitle", description: "widgetFormCatalog.rankingDesc" },
  GOAL: { title: "widgetFormCatalog.goalTitle", description: "widgetFormCatalog.goalDesc" },
  QUEST: { title: "widgetFormCatalog.questTitle", description: "widgetFormCatalog.questDesc" },
  VIDEO: { title: "widgetFormCatalog.videoTitle", description: "widgetFormCatalog.videoDesc" },
  SIGNATURE: { title: "widgetFormCatalog.signatureTitle", description: "widgetFormCatalog.signatureDesc" },
  CUSTOM_SOUND: { title: "widgetFormCatalog.customSoundTitle", description: "widgetFormCatalog.customSoundDesc" },
  MINI: { title: "widgetFormCatalog.miniTitle", description: "widgetFormCatalog.miniDesc" },
  RECENT: { title: "widgetFormCatalog.recentTitle", description: "widgetFormCatalog.recentDesc" },
  EVENT: { title: "widgetFormCatalog.eventTitle", description: "widgetFormCatalog.eventDesc" },
  TOP_DONATION: { title: "widgetFormCatalog.topDonationTitle", description: "widgetFormCatalog.topDonationDesc" },
  DONATION_MONITOR: { title: "widgetFormCatalog.monitorTitle", description: "widgetFormCatalog.monitorDesc" },
  SIG_QUEUE: { title: "widgetFormCatalog.sigQueueTitle", description: "widgetFormCatalog.sigQueueDesc" },
  SIG_WALLPAPER: { title: "widgetFormCatalog.sigWallpaperTitle", description: "widgetFormCatalog.sigWallpaperDesc" },
  TOTAL: { title: "widgetFormCatalog.totalTitle", description: "widgetFormCatalog.totalDesc" },
  CREW_BOARD: { title: "widgetFormCatalog.crewBoardTitle", description: "widgetFormCatalog.crewBoardDesc" },
  BANNER: { title: "widgetFormCatalog.bannerTitle", description: "widgetFormCatalog.bannerDesc" },
  SUBTITLE: { title: "widgetFormCatalog.subtitleTitle", description: "widgetFormCatalog.subtitleDesc" },
  TEXT_SLOTS: { title: "widgetFormCatalog.textSlotsTitle", description: "widgetFormCatalog.textSlotsDesc" },
  MARQUEE: { title: "widgetFormCatalog.marqueeTitle", description: "widgetFormCatalog.marqueeDesc" },
  CREDITS: { title: "widgetFormCatalog.creditsTitle", description: "widgetFormCatalog.creditsDesc" },
  CHAT: { title: "widgetFormCatalog.chatTitle", description: "widgetFormCatalog.chatDesc" },
  QR: { title: "widgetFormCatalog.qrTitle", description: "widgetFormCatalog.qrDesc" },
  WALLPAPER: { title: "widgetFormCatalog.wallpaperTitle", description: "widgetFormCatalog.wallpaperDesc" },
  EMOJI: { title: "widgetFormCatalog.emojiTitle", description: "widgetFormCatalog.emojiDesc" },
  LAYER: { title: "widgetFormCatalog.layerTitle", description: "widgetFormCatalog.layerDesc" },
  VOTE: { title: "widgetFormCatalog.voteTitle", description: "widgetFormCatalog.voteDesc" },
  ROULETTE: { title: "widgetFormCatalog.rouletteTitle", description: "widgetFormCatalog.rouletteDesc" },
  WHEEL: { title: "widgetFormCatalog.wheelTitle", description: "widgetFormCatalog.wheelDesc" },
  GACHA: { title: "widgetFormCatalog.gachaTitle", description: "widgetFormCatalog.gachaDesc" },
  DRAWING: { title: "widgetFormCatalog.drawingTitle", description: "widgetFormCatalog.drawingDesc" },
  TIMER: { title: "widgetFormCatalog.timerTitle", description: "widgetFormCatalog.timerDesc" },
  CLOCK: { title: "widgetFormCatalog.clockTitle", description: "widgetFormCatalog.clockDesc" },
  OVERLAYS: { title: "widgetFormCatalog.overlaysTitle", description: "widgetFormCatalog.overlaysDesc" },
  REMOTE: { title: "widgetFormCatalog.remoteTitle", description: "widgetFormCatalog.remoteDesc" },
  ASSETS: { title: "widgetFormCatalog.assetsTitle", description: "widgetFormCatalog.assetsDesc" },
  LINK: { title: "widgetFormCatalog.linkTitle", description: "widgetFormCatalog.linkDesc" }
};
/** With FLEXTV the 리모컨 card also hands out the overlay addresses (./widgetCatalog.ts FLEXTV_ITEMS). */
const FLEXTV_ITEM_KEYS: typeof ITEM_KEYS = {
  ...ITEM_KEYS,
  REMOTE: { title: "flextvWidgets.remoteTitle", description: "flextvWidgets.remoteDesc" }
};
const GROUP_KEYS: Record<string, MessageKey> = {
  "후원 알림": "widgetFormCatalog.groupAlerts",
  "게이지 · 랭킹": "widgetFormCatalog.groupGauges",
  "표시 · 자막": "widgetFormCatalog.groupDisplay",
  "이펙트 · 효과": "widgetFormCatalog.groupEffects",
  "게임 · 이벤트": "widgetFormCatalog.groupGames",
  타이머: "widgetFormCatalog.groupTimers"
};

/**
 * 후원위젯/알림설정. Figma 529:4 (route `/creator/widgets`); popups 364:6 · 364:158 · 364:265 · 372:7 ·
 * 531:1370 (최근알림) · 531:1598 (이벤트) · 531:1826 (미니후원) · 315:650 (후원랭킹) · 315:858 (투표) · 373:1307 (커스텀 사운드) ·
 * 373:1598 (퀘스트) · 373:3675 (뽑기 후원) · 395:145 (벽지) · code-first 룰렛. 럭키박스 (373:1356) and 플레이 (373:1785)
 * were removed (2026-10-04 결정).
 * Catalog layout follows the funnation 위젯 page (인기 · 전체 by group · 도구; see ./widgetCatalog.ts).
 * The Figma 후원 알림 설정 alert-type cards are no longer listed (they had no popups); 그림후원 links to its own page.
 * 오버레이 테마 (code-first, 2026-10-08) sits above the catalog: the 전체 테마 every overlay is drawn in.
 * With FLEXTV (`flextv`, phase 8): the theme and the overlays FLEXTV runs (퀘스트 · 미니 · 룰렛 · 뽑기), whose look only is
 * set here — their rules are 후원 종류 설정's — and the 리모컨 for their addresses.
 */
export function WidgetSettingsScreen({
  alertWidgetUrl,
  switches,
  appearance,
  initialOpen = null,
  flextv = false
}: {
  alertWidgetUrl: string;
  switches: Record<OverlayTarget, boolean>;
  appearance: OverlayAppearance;
  /** `?open=` — the popup to show first. */
  initialOpen?: EditableWidgetKey | null;
  flextv?: boolean;
}) {
  const [openKey, setOpenKey] = useState<EditableWidgetKey | null>(initialOpen);
  const [toast, setToast] = useState<string | null>(null);
  const clearToast = useCallback(() => setToast(null), []);
  const { t } = useI18n();

  return (
    <div className={styles.content}>
      <header className={catalog.header}>
        <h1 className={catalog.title}>{t("widgetForm.title")}</h1>
        <p className={catalog.subtitle}>{t("widgetForm.subtitle")}</p>
      </header>
      {!flextv && <OverlayOffNotice targets={["widgets"]} switches={switches} />}
      <ThemeGallery initial={appearance} />
      {flextv ? (
        <CatalogGrid title={t("widgetForm.broadcastWidgets")} count={FLEXTV_ITEMS.length} items={FLEXTV_ITEMS} itemKeys={FLEXTV_ITEM_KEYS} onOpen={setOpenKey} />
      ) : (
        <>
          <CatalogGrid title={t("widgetForm.popular")} count={POPULAR.length} items={POPULAR} onOpen={setOpenKey} />
          <section className={styles.group} aria-label={t("widgetForm.allAria")}>
            <h2 className={styles.groupTitle}>
              {t("widgetForm.all")} <span className={catalog.count}>{ALL_COUNT}</span>
            </h2>
            {GROUPS.map((g) => (
              <CatalogGrid key={g.title} title={GROUP_KEYS[g.title] ? t(GROUP_KEYS[g.title]) : g.title} items={g.items} onOpen={setOpenKey} sub />
            ))}
          </section>
          <CatalogGrid title={t("widgetForm.tools")} count={TOOLS.length} items={TOOLS} onOpen={setOpenKey} />
        </>
      )}
      {openKey && (
        <WidgetModal
          key={openKey}
          widgetKey={openKey}
          alertWidgetUrl={flextv ? null : alertWidgetUrl}
          onClose={() => setOpenKey(null)}
          onSaved={() => {
            setOpenKey(null);
            setToast(t("widgetForm.saved"));
          }}
        />
      )}
      <Toast message={toast} onDone={clearToast} />
    </div>
  );
}

/** One catalog section (funnation 위젯 layout). `sub` renders a group inside 전체. */
function CatalogGrid({
  title,
  count,
  items,
  itemKeys = ITEM_KEYS,
  onOpen,
  sub = false
}: {
  title: string;
  count?: number;
  items: CatalogItem[];
  itemKeys?: typeof ITEM_KEYS;
  onOpen: (k: EditableWidgetKey) => void;
  sub?: boolean;
}) {
  const Heading = sub ? "h3" : "h2";
  const { t } = useI18n();
  return (
    <section className={sub ? catalog.subGroup : styles.group} aria-label={title}>
      <Heading className={sub ? catalog.subTitle : styles.groupTitle}>
        {title} {count !== undefined && <span className={catalog.count}>{count}</span>}
      </Heading>
      <ul className={styles.grid}>
        {items.map((item) => {
          const keys = itemKeys[item.id];
          const body = (
            <>
              <span className={styles.cardIcon} style={{ background: "var(--color-surface-raised)" }} aria-hidden="true">
                {item.emoji}
              </span>
              <span className={styles.cardText}>
                <strong>
                  {keys ? t(keys.title) : item.title}
                  {item.action.type === "soon" && <span className={catalog.soon}>{t("widgetForm.soon")}</span>}
                </strong>
                <span>{keys ? t(keys.description) : item.description}</span>
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
                <div className={`${styles.card} ${styles.cardSoon}`} title={t("widgetForm.soonTitle")} aria-disabled="true">
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

/** The studio popup around the shared editor (`WidgetEditor.tsx`, also used by the 도우미 feature pages). */
function WidgetModal({
  widgetKey,
  alertWidgetUrl,
  onClose,
  onSaved
}: {
  widgetKey: EditableWidgetKey;
  /** Null with FLEXTV: its 후원 알림 is FLEXTV's 도우미. */
  alertWidgetUrl: string | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const editor = useWidgetEditor(widgetKey, { onSaved });
  const { state, saving, save, selfSaving } = editor;
  const copy = WIDGET_EDITOR_COPY[widgetKey];
  const { t } = useI18n();

  return (
    <Modal
      open
      onClose={onClose}
      title={t(copy.title)}
      width={680}
      className={styles.dialog}
      customHeader={
        <header className={styles.modalHeader}>
          <h2>{t(copy.title)}</h2>
          <button type="button" aria-label={t("widgetForm.close")} onClick={onClose}>
            ✕
          </button>
        </header>
      }
    >
      <div className={styles.modalBody} aria-busy={state.status === "LOADING" || saving}>
        <WidgetEditorBody editor={editor} />
      </div>
      <footer className={styles.modalFooter}>
        {/* The design leaves this button's action undefined; it copies the 통합 알림창 URL (TBD). */}
        {alertWidgetUrl !== null && <CopyButton value={alertWidgetUrl} label={t("widgetForm.alertUrl")} className={styles.footerGhost} />}
        <button type="button" className={styles.footerGhost} onClick={onClose}>
          {selfSaving ? t("widgetForm.close") : t("widgetForm.cancel")}
        </button>
        {!selfSaving && (
          <button type="button" className={styles.footerPrimary} onClick={save} disabled={state.status !== "READY" || saving}>
            {saving ? t("widgetForm.saving") : t("widgetForm.save")}
          </button>
        )}
      </footer>
    </Modal>
  );
}
