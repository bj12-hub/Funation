"use client";

import type { ReactNode } from "react";
import { PreviewStage } from "@/features/overlayTheme/PreviewStage";
import { useI18n } from "@/lib/i18n/I18nProvider";
import { MINI_MAX_FN } from "@/services/donations/donationCatalog";
import { ThemeChoiceField } from "@/features/overlayTheme/ThemeChoiceField";
import { effectLabel, resolveTheme } from "@/services/creator/overlayThemeTypes";
import { MINI_LINES, eventLines, miniLines, recentLines } from "@/services/creator/widgetOverlayCore";
import { EventView, MiniView, RecentView } from "./WidgetViews";
import { SAMPLE_ALERTS, SAMPLE_MINI_ALERTS } from "./widgetSamples";
import {
  EVENT_ORDERS,
  EVENT_STYLES,
  RECENT_EFFECTS,
  RECENT_PLATFORMS,
  RECENT_SCROLL_SPEEDS,
  TEMPLATE_MAX
} from "@/services/creator/widgetSettingsTypes";
import { FontFields, NumberField, Radios, Row, Section, Select, SwitchText } from "./fields";
import type { FormProps } from "./forms";
import { optionText, translatedOptions } from "./widgetFormLabels";
import styles from "./widgets.module.css";


function Stacked({ label, children, htmlFor }: { label: string; children: ReactNode; htmlFor?: string }) {
  return (
    <Row stacked label={label} htmlFor={htmlFor}>
      {children}
    </Row>
  );
}

function SwitchLine({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <div className={styles.switchLine}>
      <span className={styles.rowLabel}>{label}</span>
      <SwitchText label={label} checked={checked} onChange={onChange} />
    </div>
  );
}

// ── 최근알림 (531:1370) ────────────────────────────────────────────────────────

export function RecentForm({ value: v, onChange, live }: FormProps<"RECENT">) {
  const set = <P extends keyof typeof v>(k: P, x: (typeof v)[P]) => onChange({ ...v, [k]: x });
  const { t } = useI18n();
  return (
    <>
      <Section title={t("widgetForm.preview")}>
        <PreviewStage width={800} minHeight={120} label={t("widgetFormList.recentPreview")}>
          <RecentView settings={v} lines={recentLines(SAMPLE_ALERTS, v)} theme={resolveTheme(live.appearance, v.theme)} />
        </PreviewStage>
      </Section>
      <Section title={t("widgetForm.theme")}>
        <div className={styles.rows}>
          <ThemeChoiceField value={v.theme} onChange={(x) => set("theme", x)} appearance={live.appearance} />
          <SwitchText label={t("widgetForm.bgCard")} checked={v.card} onChange={(x) => set("card", x)} text={t("widgetForm.bgCardHint")} />
        </div>
      </Section>
      <Section title={t("widgetForm.basic")}>
        <div className={styles.rows}>
          <div className={styles.grid2}>
            <Stacked label={t("widgetForm.effect")}>
              <Select
                label={t("widgetForm.effect")}
                value={v.effect}
                options={RECENT_EFFECTS}
                width={220}
                format={(x) => optionText(effectLabel(x), t)}
                onChange={(x) => set("effect", x)}
              />
            </Stacked>
            <Stacked label={t("widgetFormList.count")}>
              <NumberField label={t("widgetFormList.count")} value={v.count} max={10} width={120} suffix={t("widgetForm.unitItems")} onChange={(x) => set("count", x)} />
            </Stacked>
            <Stacked label={t("widgetFormList.lineGap")}>
              <NumberField label={t("widgetFormList.lineGap")} value={v.lineGap} max={50} width={120} suffix="px" onChange={(x) => set("lineGap", x)} />
            </Stacked>
            <Stacked label={t("widgetFormList.scrollSpeed")}>
              <Select
                label={t("widgetFormList.scrollSpeed")}
                value={v.scrollSpeedSec}
                options={RECENT_SCROLL_SPEEDS}
                format={(s) => t("widgetForm.seconds", { s })}
                onChange={(x) => set("scrollSpeedSec", x)}
              />
            </Stacked>
          </div>
          <Stacked label={t("widgetFormList.alertFont")}>
            <FontFields label={t("widgetFormList.alertFontLabel")} value={v.font} onChange={(x) => set("font", x)} />
          </Stacked>
          <SwitchLine label={t("widgetFormList.useNicknameColor")} checked={v.nicknameColor} onChange={(x) => set("nicknameColor", x)} />
          <SwitchLine label={t("widgetForm.textOutline")} checked={v.textOutline} onChange={(x) => set("textOutline", x)} />
          <div className={styles.subCard}>
            <strong>{t("widgetFormList.templates")}</strong>
            <p className={styles.hint}>{t("widgetFormList.tokens")}</p>
            {RECENT_PLATFORMS.map((p) => (
              <Stacked key={p.key} label={t("widgetFormList.platformTemplate", { platform: optionText(p.label, t) })} htmlFor={`tpl-${p.key}`}>
                <input
                  id={`tpl-${p.key}`}
                  className={styles.input}
                  maxLength={TEMPLATE_MAX}
                  value={v.templates[p.key]}
                  onChange={(e) => set("templates", { ...v.templates, [p.key]: e.target.value })}
                />
              </Stacked>
            ))}
          </div>
        </div>
      </Section>
    </>
  );
}

// ── 이벤트 (531:1598) ──────────────────────────────────────────────────────────

export function EventForm({ value: v, onChange, live }: FormProps<"EVENT">) {
  const set = <P extends keyof typeof v>(k: P, x: (typeof v)[P]) => onChange({ ...v, [k]: x });
  const { t } = useI18n();
  return (
    <>
      <Section title={t("widgetForm.preview")}>
        <PreviewStage width={500} minHeight={160} label={t("widgetFormList.eventPreview")}>
          <EventView settings={v} lines={eventLines(SAMPLE_ALERTS, v)} theme={resolveTheme(live.appearance, v.theme)} now={null} />
        </PreviewStage>
      </Section>
      <Section title={t("widgetForm.theme")}>
        <ThemeChoiceField value={v.theme} onChange={(x) => set("theme", x)} appearance={live.appearance} />
      </Section>
      <Section title={t("widgetForm.basic")}>
        <div className={styles.rows}>
          <Stacked label={t("widgetForm.widgetStyle")}>
            <Radios name="event-style" label={t("widgetForm.widgetStyle")} options={translatedOptions(EVENT_STYLES, t)} value={v.style} onChange={(x) => set("style", x)} />
          </Stacked>
          <div className={styles.grid2}>
            <Stacked label={t("widgetFormList.order")}>
              <Select label={t("widgetFormList.order")} value={v.order} options={EVENT_ORDERS} format={(x) => optionText(x, t)} onChange={(x) => set("order", x)} />
            </Stacked>
            <Stacked label={t("widgetForm.effect")}>
              <Select
                label={t("widgetForm.effect")}
                value={v.effect}
                options={RECENT_EFFECTS}
                width={220}
                format={(x) => optionText(effectLabel(x), t)}
                onChange={(x) => set("effect", x)}
              />
            </Stacked>
          </div>
          <Stacked label={t("widgetForm.fontSettings")}>
            <FontFields label={t("widgetFormList.eventFontLabel")} value={v.font} onChange={(x) => set("font", x)} />
          </Stacked>
          <SwitchLine label={t("widgetFormList.useNicknameColor")} checked={v.nicknameColor} onChange={(x) => set("nicknameColor", x)} />
          <Stacked label={t("widgetFormList.nicknameBg")}>
            <Radios
              name="event-nick-bg"
              label={t("widgetFormList.nicknameBg")}
              options={[
                { key: "ON", label: t("widgetFormList.on") },
                { key: "OFF", label: t("widgetForm.off") }
              ]}
              value={v.nicknameBackground ? "ON" : "OFF"}
              onChange={(x) => set("nicknameBackground", x === "ON")}
            />
          </Stacked>
          <div className={styles.grid2}>
            <Stacked label={t("widgetFormList.maxLines")}>
              <NumberField label={t("widgetFormList.maxLines")} value={v.maxLines} max={20} width={120} suffix={t("widgetFormList.unitLines")} onChange={(x) => set("maxLines", x)} />
            </Stacked>
            <Stacked label={t("widgetForm.hideAfter")}>
              <NumberField label={t("widgetForm.hideAfter")} value={v.hideAfterSec} max={3600} width={120} suffix={t("widgetForm.unitSec")} onChange={(x) => set("hideAfterSec", x)} />
            </Stacked>
          </div>
          <SwitchLine label={t("widgetFormList.autoHide")} checked={v.autoHide} onChange={(x) => set("autoHide", x)} />
        </div>
      </Section>
    </>
  );
}

// ── 미니후원 (531:1826) ────────────────────────────────────────────────────────

export function MiniForm({ value: v, onChange, live }: FormProps<"MINI">) {
  const set = <P extends keyof typeof v>(k: P, x: (typeof v)[P]) => onChange({ ...v, [k]: x });
  const lines = miniLines(SAMPLE_MINI_ALERTS, v);
  const { t } = useI18n();
  return (
    <>
      <Section title={t("widgetForm.preview")}>
        {lines.length > 0 ? (
          <PreviewStage width={800} minHeight={120} label={t("widgetFormList.miniPreview")}>
            <MiniView settings={v} lines={lines} theme={resolveTheme(live.appearance, v.theme)} />
          </PreviewStage>
        ) : (
          <p className={styles.hint}>{t("widgetFormList.miniBelowMin")}</p>
        )}
        <p className={styles.hint}>{t("widgetFormList.miniHint", { count: MINI_LINES })}</p>
      </Section>
      <Section title={t("widgetForm.theme")}>
        <div className={styles.rows}>
          <ThemeChoiceField value={v.theme} onChange={(x) => set("theme", x)} appearance={live.appearance} />
          <SwitchText label={t("widgetForm.bgCard")} checked={v.card} onChange={(x) => set("card", x)} text={t("widgetFormList.miniCardHint")} />
        </div>
      </Section>
      <Section title={t("widgetForm.basic")}>
        <div className={styles.rows}>
          <div className={styles.grid2}>
            <Stacked label={t("widgetFormList.style")}>
              <Radios
                name="mini-style"
                label={t("widgetFormList.style")}
                options={[
                  { key: "SCROLL", label: t("widgetFormList.scroll") },
                  { key: "BUBBLE", label: t("widgetFormOptions.bubble") }
                ]}
                value={v.style}
                onChange={(x) => set("style", x)}
              />
            </Stacked>
            <Stacked label={t("widgetFormList.direction")}>
              <Radios
                name="mini-dir"
                label={t("widgetFormList.direction")}
                options={[
                  { key: "RTL", label: t("widgetFormList.rtl") },
                  { key: "LTR", label: t("widgetFormList.ltr") }
                ]}
                value={v.direction}
                onChange={(x) => set("direction", x)}
              />
            </Stacked>
            <Stacked label={t("widgetFormList.speed")}>
              <NumberField label={t("widgetFormList.speed")} value={v.speed} max={100} width={120} suffix="(1~100)" onChange={(x) => set("speed", Math.max(1, x))} />
            </Stacked>
            <Stacked label={t("widgetFormList.startPos")}>
              <NumberField label={t("widgetFormList.startPos")} value={v.startPercent} max={100} width={120} suffix="%" onChange={(x) => set("startPercent", x)} />
            </Stacked>
          </div>
          <SwitchLine label={t("widgetForm.showAmount")} checked={v.showAmount} onChange={(x) => set("showAmount", x)} />
          <SwitchLine label={t("widgetFormList.showNickname")} checked={v.showNickname} onChange={(x) => set("showNickname", x)} />
          <Stacked label={t("widgetFormList.minAmount")}>
            <NumberField label={t("widgetFormList.minAmount")} value={v.minAmount} max={MINI_MAX_FN} grouped width={160} suffix="FN" onChange={(x) => set("minAmount", x)} />
          </Stacked>
          <Stacked label={t("widgetForm.fontSettings")}>
            <FontFields label={t("widgetFormList.miniFontLabel")} value={v.font} onChange={(x) => set("font", x)} />
          </Stacked>
          <SwitchLine label={t("widgetFormList.outlineShort")} checked={v.textOutline} onChange={(x) => set("textOutline", x)} />
        </div>
      </Section>
    </>
  );
}
