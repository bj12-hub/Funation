"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { Toast } from "@/components/ui/Toast";
import type { OverlayTarget } from "@/services/creator/alertTypes";
import type { WidgetDetail } from "@/services/creator/widgetSettingsTypes";
import { OverlayOffNotice } from "@/features/creatorStudio/remote/OverlayOffNotice";
import { WidgetEditorBody, useWidgetEditor } from "@/features/creatorStudio/widgets/WidgetEditor";
import type { WidgetPage } from "./widgetPages";
import styles from "./helper.module.css";

/**
 * A 도우미 feature page for one or more 후원 위젯 — code-first (no Figma frame), 2026-10-14. Legacy FlexTV 도우미 page
 * structure: title and one-line description, tabs when the feature has several widgets, then the widget's OBS address,
 * its settings with the live preview, and a save bar. The form is the studio popup's (`WidgetEditor.tsx`).
 */
export function WidgetFeaturePage({
  feature,
  page,
  tab,
  detail,
  switches
}: {
  feature: string;
  page: WidgetPage;
  tab: string;
  detail: WidgetDetail;
  switches: Record<OverlayTarget, boolean>;
}) {
  const [toast, setToast] = useState<string | null>(null);
  const clearToast = useCallback(() => setToast(null), []);
  const current = page.tabs.find((t) => t.slug === tab) ?? page.tabs[0];
  const editor = useWidgetEditor(current.key, { initial: detail, onSaved: () => setToast("설정을 저장했어요.") });
  const { state, saving, save, dirty, selfSaving } = editor;

  // Leaving with unsaved changes (closing the tab, reloading) asks first; moving inside the helper does not.
  useEffect(() => {
    if (!dirty) return;
    const warn = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);

  return (
    <div className={styles.content}>
      <header className={styles.pageHeader}>
        <h1>{page.title}</h1>
        <p>{page.description}</p>
      </header>
      {page.tabs.length > 1 && (
        <nav className={styles.tabs} aria-label={`${page.title} 메뉴`}>
          {page.tabs.map((t, i) => (
            <Link
              key={t.slug}
              href={i === 0 ? `/${feature}` : `/${feature}?tab=${t.slug}`}
              className={`${styles.tab} ${t.slug === current.slug ? styles.tabOn : ""}`}
              aria-current={t.slug === current.slug ? "page" : undefined}
            >
              {t.label}
            </Link>
          ))}
        </nav>
      )}
      <OverlayOffNotice targets={[page.target]} switches={switches} />
      <section className={styles.editor} aria-label={`${current.label} 설정`} aria-busy={state.status === "LOADING" || saving}>
        <WidgetEditorBody editor={editor} />
      </section>
      {!selfSaving && (
        <div className={styles.saveBar}>
          <span className={styles.saveState} role="status">
            {dirty ? "저장하지 않은 변경이 있어요." : "방송 화면에 보이는 설정이에요."}
          </span>
          <button type="button" className={styles.saveButton} onClick={save} disabled={state.status !== "READY" || saving || !dirty}>
            {saving ? "저장 중…" : "설정 저장"}
          </button>
        </div>
      )}
      <Toast message={toast} onDone={clearToast} />
    </div>
  );
}
