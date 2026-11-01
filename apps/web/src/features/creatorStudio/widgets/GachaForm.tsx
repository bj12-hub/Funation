"use client";

import { useEffect, useState } from "react";
import { Toggle } from "@/components/ui/Toggle";
import { formatNumber } from "@/lib/format";
import { useI18n } from "@/lib/i18n/I18nProvider";
import { PreviewStage } from "@/features/overlayTheme/PreviewStage";
import { ThemeChoiceField } from "@/features/overlayTheme/ThemeChoiceField";
import { resolveTheme } from "@/services/creator/overlayThemeTypes";
import {
  GACHA_BOARD_PERIODS,
  GACHA_BOARD_SPEEDS,
  GACHA_BOARD_TYPES,
  GACHA_MAX,
  GACHA_NAME_MAX,
  GACHA_PRIZES_MAX,
  GACHA_PRIZE_MODES,
  GACHA_STYLES,
  GACHA_THEMES,
  PRIZE_MAX,
  TEMPLATE_MAX,
  type Gacha,
  type GachaPrize,
  type GachaStyle
} from "@/services/creator/widgetSettingsTypes";
import { CopyButton } from "../settings/SettingsCards";
import { DesignOnlyNotice } from "./DesignOnlyNotice";
import { ColorField, NumberField, Radios, Row, Section, Select, SwitchText } from "./fields";
import { GachaView } from "./GameViews";
import type { FormProps } from "./forms";
import { LibrarySoundField } from "./library/LibrarySounds";
import { optionText, translatedOptions } from "./widgetFormLabels";
import styles from "./widgets.module.css";

const uid = (p: string) => `${p}-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;

const newGacha = (n: number): Gacha => ({
  id: uid("gacha"),
  name: `뽑기 후원 ${n}`,
  price: 3_000,
  enabled: true,
  style: "CAPSULE",
  theme: "BASIC",
  spinSec: 5,
  messageTemplate: "{닉네임}님이 {금액} 뽑기 후원을 하였습니다!",
  pointColor: "#519CFF",
  limitEnabled: false,
  limitCount: 1,
  prizeMode: "PROBABILITY",
  prizes: [{ id: uid("prize"), name: "뽑기1", kind: "BLANK", value: 100 }],
  winSoundId: null
});

/**
 * 뽑기 후원 위젯 설정 — Figma 373:3675. Viewers draw from the creator room (뽑기 donation type); prizes are the
 * creator's (2026-10-04 결정: FN 지급 없음). 당첨 내역 and the 전광판 read the real draws. Odds disclosure and
 * legal review for paid draws are TBD. With FLEXTV (`live.designOnly`, phase 8) the 뽑기 are 후원 종류 설정's: only their
 * look, the 크레딧 and the 당첨 리스트's title and speed are set here.
 */
export function GachaForm({ value: v, onChange, live }: FormProps<"GACHA">) {
  const designOnly = live.designOnly === true;
  const set = <P extends keyof typeof v>(k: P, x: (typeof v)[P]) => onChange({ ...v, [k]: x });
  const [previewStyle, setPreviewStyle] = useState<GachaStyle>(v.gachas[0]?.style ?? "CAPSULE");
  const [selectedId, setSelectedId] = useState<string | null>(v.gachas[0]?.id ?? null);
  const [checked, setChecked] = useState<string[]>([]);
  const [historyFor, setHistoryFor] = useState<string | null>(null);
  // The board URL is a path; the key is masked on screen and copied in full.
  const [origin, setOrigin] = useState("");
  useEffect(() => setOrigin(window.location.origin), []);
  const selected = v.gachas.find((g) => g.id === selectedId) ?? null;
  const updateGacha = (id: string, patch: Partial<Gacha>) => set("gachas", v.gachas.map((g) => (g.id === id ? { ...g, ...patch } : g)));
  const sample = selected ?? v.gachas[0];
  const { t } = useI18n();

  return (
    <>
      <div className={styles.playTabs} role="tablist" aria-label={t("widgetFormGacha.previewStyleAria")}>
        {GACHA_STYLES.map((s) => (
          <button key={s.key} type="button" role="tab" aria-selected={previewStyle === s.key} className={previewStyle === s.key ? styles.playTabOn : undefined} onClick={() => setPreviewStyle(s.key)}>
            {optionText(s.tab, t)}
          </button>
        ))}
      </div>
      <PreviewStage width={640} minHeight={300} label={t("widgetFormGacha.previewAria")}>
        <GachaView
          stage={{
            id: "sample",
            no: "G-0001",
            status: "RESULT",
            gachaName: sample?.name ?? "뽑기 후원",
            style: previewStyle,
            pointColor: sample?.pointColor ?? "#519CFF",
            donor: "하루봄",
            amount: sample?.price ?? 3_000,
            message: (sample?.messageTemplate ?? "{닉네임}님이 {금액} 뽑기 후원을 하였습니다!").replaceAll("{닉네임}", "하루봄").replaceAll("{금액}", `${formatNumber(sample?.price ?? 3_000)} FN`),
            prize: sample?.prizes.find((p) => p.kind === "PRIZE")?.name ?? "상품",
            blank: false,
            endsAt: ""
          }}
          history={live.gachaWins.slice(0, v.credit.historyCount).map((w) => ({ donor: "하루봄", prize: w.prize }))}
          theme={resolveTheme(live.appearance, v.overlayTheme)}
        />
      </PreviewStage>
      <Section title={t("widgetForm.theme")}>
        <ThemeChoiceField value={v.overlayTheme} onChange={(x) => set("overlayTheme", x)} appearance={live.appearance} />
        {designOnly && <DesignOnlyNotice rules={t("widgetFormGacha.designRules")} />}
      </Section>

      <Section
        title={t("widgetFormGacha.list")}
        aside={
          designOnly ? undefined : (
            <div className={styles.inline}>
              <button
                type="button"
                className={styles.dangerButton}
                disabled={checked.length === 0}
                onClick={() => {
                  set("gachas", v.gachas.filter((g) => !checked.includes(g.id)));
                  if (selectedId && checked.includes(selectedId)) setSelectedId(null);
                  setChecked([]);
                }}
              >
                {t("widgetFormGacha.delete")}
              </button>
              <button
                type="button"
                className={styles.blueButton}
                disabled={v.gachas.length >= GACHA_MAX}
                onClick={() => {
                  const g = newGacha(v.gachas.length + 1);
                  set("gachas", [...v.gachas, g]);
                  setSelectedId(g.id);
                }}
              >
                {t("widgetFormGacha.add")}
              </button>
            </div>
          )
        }
      >
        {v.gachas.length === 0 && <p className={styles.hint}>{designOnly ? t("widgetFormGacha.emptyDesign") : t("widgetFormGacha.empty")}</p>}
        <ul className={styles.presetList}>
          {v.gachas.map((g) => (
            <li key={g.id} className={`${styles.preset} ${g.id === selectedId ? styles.presetOn : ""}`}>
              <div className={styles.presetHead}>
                {designOnly ? (
                  <span className={styles.radio}>{g.name}</span>
                ) : (
                  <label className={styles.radio}>
                    <input
                      type="checkbox"
                      checked={checked.includes(g.id)}
                      onChange={(e) => setChecked((c) => (e.target.checked ? [...c, g.id] : c.filter((x) => x !== g.id)))}
                    />
                    {g.name}
                  </label>
                )}
                <span className={styles.suffix}>{formatNumber(g.price)}FN</span>
                {!designOnly && <Toggle label={t("widgetFormGacha.useNamed", { name: g.name })} checked={g.enabled} onChange={(x) => updateGacha(g.id, { enabled: x })} />}
                <button type="button" className={styles.linkButton} aria-expanded={g.id === selectedId} onClick={() => setSelectedId(g.id === selectedId ? null : g.id)}>
                  {t(designOnly ? "widgetFormGacha.look" : "widgetForm.settings")} {g.id === selectedId ? "▲" : "▼"}
                </button>
                {!designOnly && (
                  <button type="button" className={styles.purpleSmall} aria-expanded={historyFor === g.id} onClick={() => setHistoryFor(historyFor === g.id ? null : g.id)}>
                    {t("widgetFormGacha.history")}
                  </button>
                )}
              </div>
              {historyFor === g.id && <WinTable wins={live.gachaWins.filter((w) => w.gacha === g.name)} />}
            </li>
          ))}
        </ul>
      </Section>

      {selected &&
        (designOnly ? (
          <GachaLook key={selected.id} gacha={selected} onChange={(patch) => updateGacha(selected.id, patch)} />
        ) : (
          <GachaDetail key={selected.id} gacha={selected} onChange={(patch) => updateGacha(selected.id, patch)} />
        ))}

      <Section title={t("widgetFormGacha.credit")}>
        <div className={styles.rows}>
          <Row label={t("widgetFormGacha.historyCount")}>
            <Select
              label={t("widgetFormGacha.historyCount")}
              value={v.credit.historyCount}
              options={[1, 3, 5, 10, 20]}
              width={120}
              onChange={(x) => set("credit", { ...v.credit, historyCount: x })}
            />
          </Row>
          <Row label={t("widgetFormGacha.displaySec")}>
            <NumberField
              label={t("widgetFormGacha.displaySec")}
              value={v.credit.displaySec}
              max={60}
              suffix={t("widgetForm.unitSec")}
              onChange={(x) => set("credit", { ...v.credit, displaySec: x })}
            />
          </Row>
        </div>
      </Section>

      <Section title={t("widgetFormGacha.board")}>
        <div className={styles.rows}>
          <div className={styles.urlBox}>
            <span className={styles.urlLabel}>{t("widgetFormGacha.boardUrl")}</span>
            <div className={styles.urlRow}>
              <span className={styles.urlField}>{`${origin}${live.gachaBoardUrl.replace(/[^/]+$/, (k) => `${k.slice(0, 4)}-····-····-····`)}`}</span>
              <CopyButton value={`${origin}${live.gachaBoardUrl}`} label={t("widgetForm.copy")} className={styles.copyButton} />
            </div>
          </div>
          {!designOnly && (
            <>
              <div className={styles.subCard}>
                <strong>{t("widgetFormGacha.boardPreview")}</strong>
                <WinTable wins={live.gachaWins} unclaimed={live.gachaUnclaimed} />
              </div>
              <Row label={t("widgetFormGacha.productType")}>
                <Radios
                  name="board-type"
                  label={t("widgetFormGacha.productType")}
                  options={translatedOptions(GACHA_BOARD_TYPES, t)}
                  value={v.board.productType}
                  onChange={(x) => set("board", { ...v.board, productType: x })}
                />
              </Row>
            </>
          )}
          <Row label={t("widgetFormGacha.boardTitle")} htmlFor="board-title">
            <input id="board-title" className={styles.input} maxLength={20} value={v.board.title} onChange={(e) => set("board", { ...v.board, title: e.target.value })} />
          </Row>
          {!designOnly && (
            <Row label={t("widgetForm.period")}>
              <Select
                label={t("widgetForm.period")}
                value={v.board.period}
                options={GACHA_BOARD_PERIODS}
                width={180}
                format={(x) => optionText(x, t)}
                onChange={(x) => set("board", { ...v.board, period: x })}
              />
            </Row>
          )}
          <Row label={t("widgetForm.flowSpeed")}>
            <Radios
              name="board-speed"
              label={t("widgetForm.flowSpeed")}
              options={translatedOptions(GACHA_BOARD_SPEEDS, t)}
              value={v.board.speed}
              onChange={(x) => set("board", { ...v.board, speed: x })}
            />
          </Row>
        </div>
      </Section>
    </>
  );
}

function WinTable({ wins, unclaimed }: { wins: { gacha: string; prize: string; claimed: boolean | null }[]; unclaimed?: number }) {
  const { t } = useI18n();
  if (wins.length === 0) return <p className={styles.hint}>{t("widgetFormGacha.noWins")}</p>;
  return (
    <table className={styles.noteTable}>
      <thead>
        <tr>
          <th scope="col">{t("widgetFormGacha.name")}</th>
          <th scope="col">{t("widgetFormGacha.colPrize")}</th>
          <th scope="col">{unclaimed === undefined ? t("widgetFormGacha.claimed") : t("widgetFormGacha.unclaimedCount", { count: unclaimed })}</th>
        </tr>
      </thead>
      <tbody>
        {wins.map((w, i) => (
          <tr key={i}>
            <td>{w.gacha}</td>
            <td>{w.prize}</td>
            <td className={w.claimed === false ? styles.unclaimed : undefined}>
              {w.claimed === null ? "-" : w.claimed ? t("widgetFormGacha.claimed") : t("widgetFormGacha.notClaimed")}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

/** With FLEXTV: a 뽑기's look only — its machine style and point color. */
function GachaLook({ gacha: g, onChange }: { gacha: Gacha; onChange: (patch: Partial<Gacha>) => void }) {
  const { t } = useI18n();
  return (
    <Section title={t("widgetFormGacha.lookTitle", { name: g.name })}>
      <div className={styles.rows}>
        <Row label={t("widgetFormGacha.style")}>
          <Radios name={`${g.id}-style`} label={t("widgetFormGacha.style")} options={translatedOptions(GACHA_STYLES, t)} value={g.style} onChange={(x) => onChange({ style: x })} />
        </Row>
        <Row label={t("widgetFormGacha.pointColor")}>
          <ColorField label={t("widgetFormGacha.pointColor")} value={g.pointColor} onChange={(x) => onChange({ pointColor: x })} />
        </Row>
      </div>
    </Section>
  );
}

function GachaDetail({ gacha: g, onChange }: { gacha: Gacha; onChange: (patch: Partial<Gacha>) => void }) {
  const probability = g.prizeMode === "PROBABILITY";
  const total = g.prizes.reduce((s, p) => s + p.value, 0);
  const setPrize = (id: string, patch: Partial<GachaPrize>) => onChange({ prizes: g.prizes.map((p) => (p.id === id ? { ...p, ...patch } : p)) });
  const { t } = useI18n();
  const styleOptions = translatedOptions(GACHA_STYLES, t);

  return (
    <>
      <Section title={t("widgetFormGacha.basic", { name: g.name })}>
        <div className={styles.rows}>
          <Row label={t("widgetFormGacha.name")} htmlFor={`${g.id}-name`}>
            <input id={`${g.id}-name`} className={styles.input} maxLength={GACHA_NAME_MAX} value={g.name} onChange={(e) => onChange({ name: e.target.value })} />
          </Row>
          <Row label={t("widgetFormGacha.price")}>
            <NumberField label={t("widgetFormGacha.price")} value={g.price} max={PRIZE_MAX} grouped width={160} suffix="FN" onChange={(x) => onChange({ price: x })} />
          </Row>
          <Row label={t("widgetFormGacha.style")}>
            <div className={styles.filterBox}>
              <Radios name={`${g.id}-style`} label={t("widgetFormGacha.style")} options={styleOptions} value={g.style} onChange={(x) => onChange({ style: x })} />
              <div className={styles.gachaThumbs}>
                {styleOptions.map((s) => (
                  <button
                    key={s.key}
                    type="button"
                    aria-pressed={g.style === s.key}
                    aria-label={t("widgetForm.styleSelect", { label: s.label })}
                    className={`${styles.gachaThumb} ${g.style === s.key ? styles.thumbOn : ""}`}
                    onClick={() => onChange({ style: s.key })}
                  >
                    {optionText(s.tab, t)}
                  </button>
                ))}
              </div>
            </div>
          </Row>
          <Row label={t("widgetFormGacha.theme")}>
            <Radios name={`${g.id}-theme`} label={t("widgetFormGacha.theme")} options={translatedOptions(GACHA_THEMES, t)} value={g.theme} onChange={(x) => onChange({ theme: x })} />
          </Row>
        </div>
      </Section>

      <Section title={t("widgetFormGacha.effects")}>
        <div className={styles.rows}>
          <Row label={t("widgetFormGacha.winSound")}>
            {/* Code-first: the sound comes from 이미지·사운드 (the draw overlay that plays it is TBD). */}
            <LibrarySoundField
              label={t("widgetFormGacha.winSoundButton")}
              buttonClassName={styles.purpleSmall}
              value={g.winSoundId ?? null}
              onChange={(id) => onChange({ winSoundId: id })}
            />
          </Row>
          <Row label={t("widgetFormGacha.spin")}>
            <NumberField label={t("widgetFormGacha.spin")} value={g.spinSec} max={30} suffix={t("widgetForm.unitSec")} onChange={(x) => onChange({ spinSec: x })} />
          </Row>
          <Row label={t("widgetFormGacha.template")} htmlFor={`${g.id}-tpl`}>
            <input id={`${g.id}-tpl`} className={styles.input} maxLength={TEMPLATE_MAX} value={g.messageTemplate} onChange={(e) => onChange({ messageTemplate: e.target.value })} />
          </Row>
          <Row label={t("widgetFormGacha.pointColor")}>
            <ColorField label={t("widgetFormGacha.pointColor")} value={g.pointColor} onChange={(x) => onChange({ pointColor: x })} />
          </Row>
          <Row label={t("widgetFormGacha.limit")}>
            <div className={styles.inline}>
              <SwitchText label={t("widgetFormGacha.limit")} checked={g.limitEnabled} onChange={(x) => onChange({ limitEnabled: x })} />
              {g.limitEnabled && (
                <NumberField
                  label={t("widgetFormGacha.limitCount")}
                  value={g.limitCount}
                  max={1000}
                  suffix={t("widgetForm.limitSuffix")}
                  onChange={(x) => onChange({ limitCount: Math.max(1, x) })}
                />
              )}
            </div>
          </Row>
        </div>
      </Section>

      <Section
        title={t("widgetFormGacha.prizes")}
        aside={
          <button
            type="button"
            className={styles.blueButton}
            disabled={g.prizes.length >= GACHA_PRIZES_MAX}
            onClick={() => onChange({ prizes: [...g.prizes, { id: uid("prize"), name: `뽑기${g.prizes.length + 1}`, kind: "PRIZE", value: 0 }] })}
          >
            {t("widgetFormGacha.addPrize")}
          </button>
        }
      >
        <div className={styles.rows}>
          <Radios
            name={`${g.id}-mode`}
            label={t("widgetFormGacha.prizeMode")}
            options={translatedOptions(GACHA_PRIZE_MODES, t)}
            value={g.prizeMode}
            onChange={(x) => onChange({ prizeMode: x })}
          />
          <ul className={styles.prizeList}>
            {g.prizes.map((p, i) => (
              <li key={p.id}>
                <input
                  aria-label={t("widgetFormGacha.prizeName", { n: i + 1 })}
                  className={styles.input}
                  maxLength={GACHA_NAME_MAX}
                  value={p.name}
                  onChange={(e) => setPrize(p.id, { name: e.target.value })}
                />
                <Select
                  label={t("widgetFormGacha.prizeKind", { n: i + 1 })}
                  value={p.kind}
                  options={["PRIZE", "BLANK"] as const}
                  format={(k) => (k === "BLANK" ? t("widgetFormGacha.blank") : t("widgetFormGacha.prize"))}
                  onChange={(kind) => setPrize(p.id, { kind })}
                />
                <NumberField
                  label={t(probability ? "widgetFormGacha.prizeProb" : "widgetFormGacha.prizeQty", { n: i + 1 })}
                  value={p.value}
                  max={probability ? 100 : 100_000}
                  width={90}
                  suffix={probability ? "%" : t("widgetForm.unitItems")}
                  onChange={(x) => setPrize(p.id, { value: x })}
                />
                {g.prizes.length > 1 && (
                  <button
                    type="button"
                    className={styles.iconButton}
                    aria-label={t("widgetFormGacha.prizeDelete", { n: i + 1 })}
                    onClick={() => onChange({ prizes: g.prizes.filter((x) => x.id !== p.id) })}
                  >
                    ✕
                  </button>
                )}
              </li>
            ))}
          </ul>
          {probability && (
            <p className={total === 100 ? styles.okText : styles.warnText} role="status">
              {t("widgetForm.probTotal", { total })} {total === 100 ? "" : t("widgetForm.probWarn")}
            </p>
          )}
        </div>
      </Section>
    </>
  );
}
