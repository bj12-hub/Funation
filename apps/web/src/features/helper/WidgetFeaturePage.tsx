"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { Toast } from "@/components/ui/Toast";
import { useI18n } from "@/lib/i18n/I18nProvider";
import type { OverlayTarget } from "@/services/creator/alertTypes";
import type { WidgetDetail } from "@/services/creator/widgetSettingsTypes";
import { OverlayOffNotice } from "@/features/creatorStudio/remote/OverlayOffNotice";
import { WidgetEditorBody, useWidgetEditor } from "@/features/creatorStudio/widgets/WidgetEditor";
import { widgetPageText, widgetTabLabel } from "./helperText";
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
  const { t } = useI18n();
  const [toast, setToast] = useState<string | null>(null);
  const clearToast = useCallback(() => setToast(null), []);
  const current = page.tabs.find((x) => x.slug === tab) ?? page.tabs[0];
  const text = widgetPageText(feature, page, t);
  const editor = useWidgetEditor(current.key, { initial: detail, onSaved: () => setToast(t("helper.saved")) });
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
        <h1>{text.title}</h1>
        <p>{text.description}</p>
      </header>
      {page.tabs.length > 1 && (
        <nav className={styles.tabs} aria-label={t("helper.tabsAria", { title: text.title })}>
          {page.tabs.map((x, i) => (
            <Link
              key={x.slug}
              href={i === 0 ? `/${feature}` : `/${feature}?tab=${x.slug}`}
              className={`${styles.tab} ${x.slug === current.slug ? styles.tabOn : ""}`}
              aria-current={x.slug === current.slug ? "page" : undefined}
            >
              {widgetTabLabel(x, t)}
            </Link>
          ))}
        </nav>
      )}
      <OverlayOffNotice targets={[page.target]} switches={switches} />
      <section className={styles.editor} aria-label={t("helper.editorAria", { label: widgetTabLabel(current, t) })} aria-busy={state.status === "LOADING" || saving}>
        <WidgetEditorBody editor={editor} />
      </section>
      {!selfSaving && (
        <div className={styles.saveBar}>
          <span className={styles.saveState} role="status">
            {dirty ? t("helper.unsaved") : t("helper.onStream")}
          </span>
          <button type="button" className={styles.saveButton} onClick={save} disabled={state.status !== "READY" || saving || !dirty}>
            {saving ? t("helper.saving") : t("helper.save")}
          </button>
        </div>
      )}
      <Toast message={toast} onDone={clearToast} />
    </div>
  );
}
