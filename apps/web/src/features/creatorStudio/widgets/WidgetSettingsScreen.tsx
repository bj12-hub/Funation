"use client";

import Link from "next/link";
import { useCallback, useState } from "react";
import { Modal } from "@/components/ui/Modal";
import { Toast } from "@/components/ui/Toast";
import type { OverlayTarget } from "@/services/creator/alertTypes";
import type { OverlayAppearance } from "@/services/creator/overlayThemeTypes";
import { isEditableWidget, type EditableWidgetKey } from "@/services/creator/widgetSettingsTypes";
import { ThemeGallery } from "@/features/overlayTheme/ThemeGallery";
import { OverlayOffNotice } from "../remote/OverlayOffNotice";
import { CopyButton } from "../settings/SettingsCards";
import { ALL_COUNT, GROUPS, POPULAR, TOOLS, type CatalogItem } from "./widgetCatalog";
import { WIDGET_EDITOR_COPY, WidgetEditorBody, useWidgetEditor } from "./WidgetEditor";
import catalog from "./widgetCatalog.module.css";
import styles from "./widgets.module.css";

/**
 * 후원위젯/알림설정. Figma 529:4 (route `/creator/widgets`); popups 364:6 · 364:158 · 364:265 · 372:7 ·
 * 531:1370 (최근알림) · 531:1598 (이벤트) · 531:1826 (미니후원) · 315:650 (후원랭킹) · 315:858 (투표) · 373:1307 (커스텀 사운드) ·
 * 373:1598 (퀘스트) · 373:3675 (뽑기 후원) · 395:145 (벽지) · code-first 룰렛. 럭키박스 (373:1356) and 플레이 (373:1785)
 * were removed (2026-10-04 결정).
 * Catalog layout follows the funnation 위젯 page (인기 · 전체 by group · 도구; see ./widgetCatalog.ts).
 * The Figma 후원 알림 설정 alert-type cards are no longer listed (they had no popups); 그림후원 links to its own page.
 * 오버레이 테마 (code-first, 2026-10-08) sits above the catalog: the 전체 테마 every overlay is drawn in.
 */
export function WidgetSettingsScreen({
  alertWidgetUrl,
  switches,
  appearance,
  initialOpen = null
}: {
  alertWidgetUrl: string;
  switches: Record<OverlayTarget, boolean>;
  appearance: OverlayAppearance;
  /** `?open=` — the popup to show first. */
  initialOpen?: EditableWidgetKey | null;
}) {
  const [openKey, setOpenKey] = useState<EditableWidgetKey | null>(initialOpen);
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

/** The studio popup around the shared editor (`WidgetEditor.tsx`, also used by the 도우미 feature pages). */
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
  const editor = useWidgetEditor(widgetKey, { onSaved });
  const { state, saving, save, selfSaving } = editor;
  const copy = WIDGET_EDITOR_COPY[widgetKey];

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
        <WidgetEditorBody editor={editor} />
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
