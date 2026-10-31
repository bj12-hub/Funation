"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, useTransition, type KeyboardEvent, type PointerEvent } from "react";
import { useI18n } from "@/lib/i18n/I18nProvider";
import type { MessageKey } from "@/lib/i18n/translate";
import { OVERLAYS } from "@/services/creator/overlayCatalog";
import { saveOverlayLayout } from "@/services/creator/overlayLayout";
import {
  LAYOUT_CANVASES,
  LAYOUT_ITEMS_MAX,
  LAYOUT_POS_LIMIT,
  LAYOUT_SCALE_MAX,
  LAYOUT_SCALE_MIN,
  LAYOUT_SIZE_MAX,
  LAYOUT_SIZE_MIN,
  canvasInfo,
  catalogSize,
  placeNew,
  type CanvasLayout,
  type LayoutCanvas,
  type LayoutItem,
  type OverlayLayoutView
} from "@/services/creator/overlayLayoutTypes";
import { shownOverlayAddress } from "../crew/overlayAddress";
import styles from "../crew/crew.module.css";
import { CopyButton } from "../settings/SettingsCards";
import local from "./overlayLayout.module.css";
import { overlayGroup, overlaySize, overlayTitle } from "./overlayCatalogText";

type Drafts = Record<LayoutCanvas, LayoutItem[]>;
type Editing = { loaded: Record<LayoutCanvas, CanvasLayout>; drafts: Drafts };
type Drag = { id: string; mode: "move" | "scale"; px: number; py: number; x: number; y: number; scale: number; width: number };

const KEYS = LAYOUT_CANVASES.map((c) => c.key);
const GROUPS = [...new Set(OVERLAYS.map((o) => o.group))];
const overlayOf = (id: string) => OVERLAYS.find((o) => o.id === id);
const same = (a: LayoutItem[], b: LayoutItem[]) => JSON.stringify(a) === JSON.stringify(b);
const clamp = (v: number, min: number, max: number) => Math.min(max, Math.max(min, v));
const clampPos = (v: number) => clamp(Math.round(v), -LAYOUT_POS_LIMIT, LAYOUT_POS_LIMIT);
const clampScale = (v: number) => clamp(Math.round(v * 100) / 100, LAYOUT_SCALE_MIN, LAYOUT_SCALE_MAX);
/** The preview is at most this tall on screen (a 세로 canvas would otherwise run off the page). */
const STAGE_MAX_HEIGHT = 640;
/** Canvas labels by key (the service's LAYOUT_CANVASES stay as written, 2026-11-01). */
const CANVAS_KEY: Record<LayoutCanvas, MessageKey> = {
  PC: "studioToolsOverlays.canvasPc",
  LANDSCAPE: "studioToolsOverlays.canvasLandscape",
  PORTRAIT: "studioToolsOverlays.canvasPortrait"
};

/**
 * 원소스 오버레이 배치 — code-first (no Figma frame; StreamDonate "오버레이 설정 (원소스)" 참고, P3). Route
 * `/creator/widgets/onesource`. Per 캔버스 (PC 16:9 · 모바일 가로 · 세로 9:16): a scaled preview where placed overlays are
 * dragged (and scaled from the corner handle; arrow keys nudge 1px, Shift 10px), the 레이어 list (top first; drag or ↑ ↓ to
 * reorder, 숨김), the selected overlay's 위치 · 가로 · 세로 · 스케일, 오버레이 추가 from the 오버레이 주소 catalog, 저장 per
 * canvas and its 원소스 OBS address. 실시간 미리보기 shows the real overlays in their boxes.
 */
export function OverlayLayoutScreen({ view }: { view: OverlayLayoutView }) {
  const router = useRouter();
  const { t } = useI18n();
  const [canvas, setCanvas] = useState<LayoutCanvas>("PC");
  const [ed, setEd] = useState<Editing>(() => ({ loaded: view.canvases, drafts: Object.fromEntries(KEYS.map((k) => [k, view.canvases[k].items])) as Drafts }));
  const [selected, setSelected] = useState<string | null>(null);
  const [live, setLive] = useState(false);
  const [adding, setAdding] = useState(OVERLAYS[0].id);
  const [message, setMessage] = useState<{ tone: "error" | "ok" | "conflict"; text: string } | null>(null);
  const [pending, startTransition] = useTransition();
  const [origin, setOrigin] = useState("");
  useEffect(() => setOrigin(window.location.origin), []);

  // A newer saved layout (after a save, another tab) replaces a canvas's draft unless it has unsaved edits — or the
  // creator asked for the newest one after a conflict.
  const adopt = useRef<LayoutCanvas | null>(null);
  useEffect(() => {
    const force = adopt.current;
    adopt.current = null;
    setEd((s) => {
      let changed = false;
      const loaded = { ...s.loaded };
      const drafts = { ...s.drafts };
      for (const k of KEYS) {
        const next = view.canvases[k];
        if (next.revision === s.loaded[k].revision && k !== force) continue;
        if (k === force || same(s.drafts[k], s.loaded[k].items)) {
          loaded[k] = next;
          drafts[k] = next.items;
          changed = true;
        }
      }
      return changed ? { loaded, drafts } : s;
    });
  }, [view]);

  const info = canvasInfo(canvas);
  const canvasLabel = t(CANVAS_KEY[canvas]);
  const titleOf = (id: string) => {
    const o = overlayOf(id);
    return o ? overlayTitle(o, t) : t("studioToolsOverlays.missingOverlay");
  };
  const items = ed.drafts[canvas];
  const dirty = !same(items, ed.loaded[canvas].items);
  const sel = items.find((i) => i.id === selected) ?? null;
  const setItems = (fn: (list: LayoutItem[]) => LayoutItem[]) => setEd((s) => ({ ...s, drafts: { ...s.drafts, [canvas]: fn(s.drafts[canvas]) } }));
  const patch = (id: string, p: Partial<LayoutItem>) => setItems((list) => list.map((i) => (i.id === id ? { ...i, ...p } : i)));
  const move = (from: number, to: number) =>
    setItems((list) => {
      if (from === to || to < 0 || to >= list.length) return list;
      const next = [...list];
      const [it] = next.splice(from, 1);
      next.splice(to, 0, it);
      return next;
    });

  // The preview's scale: the canvas fitted to the room (and to STAGE_MAX_HEIGHT).
  const wrap = useRef<HTMLDivElement>(null);
  const [fit, setFit] = useState(0.3);
  useEffect(() => {
    const el = wrap.current;
    if (!el) return;
    const size = () => setFit(Math.min(el.clientWidth / info.width, STAGE_MAX_HEIGHT / info.height));
    size();
    const ro = new ResizeObserver(size);
    ro.observe(el);
    return () => ro.disconnect();
  }, [info.width, info.height]);

  const drag = useRef<Drag | null>(null);
  const startDrag = (i: LayoutItem, mode: Drag["mode"]) => (e: PointerEvent<HTMLElement>) => {
    if (e.button !== 0) return;
    e.preventDefault();
    e.stopPropagation();
    setSelected(i.id);
    e.currentTarget.setPointerCapture(e.pointerId);
    drag.current = { id: i.id, mode, px: e.clientX, py: e.clientY, x: i.x, y: i.y, scale: i.scale, width: i.width };
  };
  const onDrag = (e: PointerEvent<HTMLElement>) => {
    const d = drag.current;
    if (!d) return;
    const dx = (e.clientX - d.px) / fit;
    const dy = (e.clientY - d.py) / fit;
    if (d.mode === "move") patch(d.id, { x: clampPos(d.x + dx), y: clampPos(d.y + dy) });
    else patch(d.id, { scale: clampScale((d.width * d.scale + dx) / d.width) });
  };
  const endDrag = () => (drag.current = null);
  const nudge = (i: LayoutItem) => (e: KeyboardEvent<HTMLElement>) => {
    const step = e.shiftKey ? 10 : 1;
    const by = { ArrowLeft: [-step, 0], ArrowRight: [step, 0], ArrowUp: [0, -step], ArrowDown: [0, step] }[e.key];
    if (!by) return;
    e.preventDefault();
    patch(i.id, { x: clampPos(i.x + by[0]), y: clampPos(i.y + by[1]) });
  };

  const add = () => {
    const o = overlayOf(adding);
    if (!o || items.length >= LAYOUT_ITEMS_MAX) return;
    const it = placeNew(`it-${crypto.randomUUID().slice(0, 8)}`, o.id, catalogSize(o.size), canvas);
    setItems((list) => [...list, it]);
    setSelected(it.id);
  };
  const remove = (id: string) => {
    setItems((list) => list.filter((i) => i.id !== id));
    setSelected(null);
  };

  const saveId = useRef<string | null>(null);
  const save = () => {
    setMessage(null);
    saveId.current ??= crypto.randomUUID();
    const requestId = saveId.current;
    const sent = items;
    const target = canvas;
    const revision = ed.loaded[target].revision;
    startTransition(async () => {
      try {
        const res = await saveOverlayLayout({ canvas: target, items: sent, revision, requestId });
        if (res.status === "SAVED") {
          saveId.current = null;
          setEd((s) => ({ ...s, loaded: { ...s.loaded, [target]: { items: sent, revision: res.revision, updatedAt: new Date().toISOString() } } }));
          setMessage({ tone: "ok", text: t("studioToolsOverlays.layoutSaved", { canvas: t(CANVAS_KEY[target]) }) });
          router.refresh();
        } else if (res.status === "UNAUTHORIZED") router.push("/login?role=creator&next=/creator/widgets/onesource");
        else {
          saveId.current = null;
          setMessage({ tone: res.status === "CONFLICT" ? "conflict" : "error", text: res.message });
        }
      } catch {
        setMessage({ tone: "error", text: t("studioTools.saveFailed") });
      }
    });
  };
  const reload = () => {
    adopt.current = canvas;
    setMessage(null);
    setSelected(null);
    router.refresh();
  };

  const path = `/overlay/onesource/${view.overlayKey}`;
  const query = `?canvas=${info.query}`;

  return (
    <div className={styles.content}>
      <header className={styles.header}>
        <h1 className={styles.title}>{t("studioToolsOverlays.layoutTitle")}</h1>
        <p className={styles.subtitle}>{t("studioToolsOverlays.layoutSubtitle")}</p>
        <p className={styles.note}>
          {t("studioToolsOverlays.layoutNoteBefore")}
          <Link href="/creator/remote">{t("studioTools.remote")}</Link>
          {t("studioToolsOverlays.layoutNoteMiddle")}
          <Link href="/creator/widgets/overlays">{t("studioToolsOverlays.title")}</Link>
          {t("studioToolsOverlays.layoutNoteAfter")}
        </p>
      </header>

      <div className={styles.segment} role="group" aria-label={t("studioToolsOverlays.canvasAria")}>
        {LAYOUT_CANVASES.map((c) => (
          <button
            key={c.key}
            type="button"
            aria-pressed={canvas === c.key}
            onClick={() => {
              setCanvas(c.key);
              setSelected(null);
            }}
          >
            {t(CANVAS_KEY[c.key])}
            {!same(ed.drafts[c.key], ed.loaded[c.key].items) && " •"}
          </button>
        ))}
      </div>

      {message && (
        <p className={message.tone === "ok" ? styles.ok : styles.error} role={message.tone === "ok" ? "status" : "alert"}>
          {message.text}{" "}
          {message.tone === "conflict" && (
            <button type="button" className={styles.ghost} onClick={reload}>
              {t("studioToolsOverlays.loadLatest")}
            </button>
          )}
        </p>
      )}

      <section className={styles.card} aria-labelledby="layout-stage-title">
        <div className={local.stageHead}>
          <h2 id="layout-stage-title" className={styles.cardTitle}>
            {canvasLabel} · {info.width} × {info.height}
          </h2>
          <label className={styles.checkRow}>
            <input type="checkbox" checked={live} onChange={(e) => setLive(e.target.checked)} />
            {t("studioToolsOverlays.livePreview")}
          </label>
        </div>
        <div ref={wrap} className={local.wrap}>
          <div className={local.stage} style={{ width: info.width * fit, height: info.height * fit }} onPointerDown={() => setSelected(null)}>
            {items.length === 0 && <p className={local.stageEmpty}>{t("studioToolsOverlays.stageEmpty")}</p>}
            {items.map((i) => {
              const o = overlayOf(i.overlayId);
              const title = titleOf(i.overlayId);
              return (
                <div
                  key={i.id}
                  role="button"
                  tabIndex={0}
                  aria-pressed={selected === i.id}
                  aria-label={t("studioToolsOverlays.boxAria", { title, x: i.x, y: i.y, scale: Math.round(i.scale * 100) })}
                  className={local.box}
                  data-hidden={i.hidden || undefined}
                  style={{ left: i.x * fit, top: i.y * fit, width: i.width * i.scale * fit, height: i.height * i.scale * fit }}
                  onPointerDown={startDrag(i, "move")}
                  onPointerMove={onDrag}
                  onPointerUp={endDrag}
                  onPointerCancel={endDrag}
                  onKeyDown={nudge(i)}
                  onFocus={() => setSelected(i.id)}
                >
                  {live && o && !i.hidden && (
                    <iframe
                      src={o.path(view.overlayKey)}
                      title={t("studioToolsOverlays.previewTitle", { title })}
                      tabIndex={-1}
                      className={local.frame}
                      style={{ width: i.width, height: i.height, transform: `scale(${i.scale * fit})` }}
                    />
                  )}
                  <span className={local.boxLabel}>
                    {title}
                    {i.hidden && t("studioToolsOverlays.hiddenSuffix")}
                  </span>
                </div>
              );
            })}
            {/* The selection is drawn above every box, so the boxes keep their layer order. */}
            {sel && (
              <div className={local.selection} style={{ left: sel.x * fit, top: sel.y * fit, width: sel.width * sel.scale * fit, height: sel.height * sel.scale * fit }} aria-hidden>
                <span className={local.handle} onPointerDown={startDrag(sel, "scale")} onPointerMove={onDrag} onPointerUp={endDrag} onPointerCancel={endDrag} />
              </div>
            )}
          </div>
        </div>
        <p className={styles.note}>{t("studioToolsOverlays.stageNote")}</p>
      </section>

      <div className={local.panels}>
        <section className={styles.card} aria-labelledby="layout-layers-title">
          <h2 id="layout-layers-title" className={styles.cardTitle}>
            {t("studioToolsOverlays.layers")} <span className={styles.muted}>{t("studioToolsOverlays.layersFront")}</span>
          </h2>
          {items.length === 0 ? (
            <p className={styles.empty}>{t("studioToolsOverlays.noneplaced")}</p>
          ) : (
            <LayerList items={items} selected={selected} onSelect={setSelected} onMove={move} onToggle={(i) => patch(i.id, { hidden: !i.hidden })} />
          )}
          <div className={styles.addRow}>
            <select className={`${styles.select} ${local.picker}`} aria-label={t("studioToolsOverlays.addAria")} value={adding} onChange={(e) => setAdding(e.target.value)}>
              {GROUPS.map((g) => (
                <optgroup key={g} label={overlayGroup(g, t)}>
                  {OVERLAYS.filter((o) => o.group === g).map((o) => (
                    <option key={o.id} value={o.id}>
                      {overlayTitle(o, t)} ({overlaySize(o, t)})
                    </option>
                  ))}
                </optgroup>
              ))}
            </select>
            <button type="button" className={styles.ghost} disabled={items.length >= LAYOUT_ITEMS_MAX} onClick={add}>
              {t("studioToolsOverlays.addOverlay")}
            </button>
          </div>
          <p className={styles.note}>{t("studioToolsOverlays.maxNote", { max: LAYOUT_ITEMS_MAX })}</p>
        </section>

        <section className={styles.card} aria-labelledby="layout-item-title">
          <h2 id="layout-item-title" className={styles.cardTitle}>
            {sel ? titleOf(sel.overlayId) : t("studioToolsOverlays.selectedTitle")}
          </h2>
          {!sel ? (
            <p className={styles.empty}>{t("studioToolsOverlays.pickPrompt")}</p>
          ) : (
            <ItemFields item={sel} canvas={canvas} onPatch={(p) => patch(sel.id, p)} onRemove={() => remove(sel.id)} />
          )}
        </section>
      </div>

      <section className={styles.card} aria-labelledby="layout-save-title">
        <h2 id="layout-save-title" className={styles.cardTitle}>
          {t("studioToolsOverlays.saveTitle")}
        </h2>
        <p className={styles.note}>
          {dirty ? t("studioToolsOverlays.dirtyNote", { canvas: canvasLabel }) : t("studioToolsOverlays.cleanNote", { canvas: canvasLabel })} {t("studioToolsOverlays.oneByOne")}
        </p>
        <div className={styles.actions}>
          <button
            type="button"
            className={styles.ghost}
            disabled={pending || !dirty}
            onClick={() => {
              setItems(() => ed.loaded[canvas].items);
              setSelected(null);
            }}
          >
            {t("studioTools.revert")}
          </button>
          <button type="button" className={styles.primary} disabled={pending || !dirty} onClick={save}>
            {pending ? t("studioTools.savingLong") : t("studioToolsOverlays.saveCanvas", { canvas: canvasLabel })}
          </button>
        </div>
        <p className={styles.note}>{t("studioToolsOverlays.obsNote", { width: info.width, height: info.height })}</p>
        <div className={styles.addRow}>
          <input
            className={styles.input}
            value={shownOverlayAddress(origin, path, query)}
            readOnly
            aria-label={t("studioToolsOverlays.addressAria", { canvas: canvasLabel })}
            onFocus={(e) => e.target.select()}
          />
          <CopyButton value={`${origin}${path}${query}`} label={t("studioTools.copy")} className={styles.ghost} />
        </div>
      </section>
    </div>
  );
}

/** 레이어: top first. Drag a row (or ↑ ↓) to reorder; 👁 hides an overlay from OBS without removing it. */
function LayerList({
  items,
  selected,
  onSelect,
  onMove,
  onToggle
}: {
  items: LayoutItem[];
  selected: string | null;
  onSelect: (id: string) => void;
  onMove: (from: number, to: number) => void;
  onToggle: (item: LayoutItem) => void;
}) {
  const { t } = useI18n();
  const from = useRef<number | null>(null);
  const last = items.length - 1;
  return (
    <ol className={local.layers}>
      {items
        .map((i, index) => ({ i, index }))
        .reverse()
        .map(({ i, index }) => {
          const o = overlayOf(i.overlayId);
          const title = o ? overlayTitle(o, t) : t("studioToolsOverlays.missingOverlay");
          return (
            <li
              key={i.id}
              draggable
              data-selected={selected === i.id || undefined}
              data-hidden={i.hidden || undefined}
              onDragStart={(e) => {
                from.current = index;
                e.dataTransfer.effectAllowed = "move";
              }}
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => {
                e.preventDefault();
                if (from.current !== null) onMove(from.current, index);
                from.current = null;
              }}
            >
              <span className={local.grip} aria-hidden>
                ⠿
              </span>
              <button type="button" className={local.layerName} onClick={() => onSelect(i.id)}>
                {title}
              </button>
              <span className={styles.muted}>{Math.round(i.scale * 100)}%</span>
              <button type="button" aria-label={t(i.hidden ? "studioToolsOverlays.showAria" : "studioToolsOverlays.hideAria", { title })} aria-pressed={i.hidden} onClick={() => onToggle(i)}>
                {i.hidden ? "🙈" : "👁"}
              </button>
              <button type="button" aria-label={t("studioToolsOverlays.frontAria", { title })} disabled={index === last} onClick={() => onMove(index, index + 1)}>
                ↑
              </button>
              <button type="button" aria-label={t("studioToolsOverlays.backAria", { title })} disabled={index === 0} onClick={() => onMove(index, index - 1)}>
                ↓
              </button>
            </li>
          );
        })}
    </ol>
  );
}

/** The selected overlay's numbers: typed values apply as soon as they are whole numbers. */
function ItemFields({ item, canvas, onPatch, onRemove }: { item: LayoutItem; canvas: LayoutCanvas; onPatch: (p: Partial<LayoutItem>) => void; onRemove: () => void }) {
  const { t } = useI18n();
  const o = overlayOf(item.overlayId);
  const c = canvasInfo(canvas);
  const num = (key: "x" | "y" | "width" | "height", label: string, min: number, max: number) => (
    <label className={local.field}>
      <span className={styles.muted}>{label}</span>
      <input
        className={styles.inputSmall}
        type="number"
        inputMode="numeric"
        aria-label={label}
        min={min}
        max={max}
        value={item[key]}
        onChange={(e) => {
          const n = Number(e.target.value);
          if (e.target.value !== "" && Number.isFinite(n)) onPatch({ [key]: Math.round(n) });
        }}
      />
    </label>
  );
  return (
    <>
      <div className={local.fields}>
        {num("x", "X", -LAYOUT_POS_LIMIT, LAYOUT_POS_LIMIT)}
        {num("y", "Y", -LAYOUT_POS_LIMIT, LAYOUT_POS_LIMIT)}
        {num("width", t("studioToolsOverlays.width"), LAYOUT_SIZE_MIN, LAYOUT_SIZE_MAX)}
        {num("height", t("studioToolsOverlays.height"), LAYOUT_SIZE_MIN, LAYOUT_SIZE_MAX)}
        <label className={local.field}>
          <span className={styles.muted}>{t("studioToolsOverlays.scalePercent")}</span>
          <input
            className={styles.inputSmall}
            type="number"
            inputMode="numeric"
            aria-label={t("studioToolsOverlays.scale")}
            min={LAYOUT_SCALE_MIN * 100}
            max={LAYOUT_SCALE_MAX * 100}
            value={Math.round(item.scale * 100)}
            onChange={(e) => {
              const n = Number(e.target.value);
              if (e.target.value !== "" && Number.isFinite(n)) onPatch({ scale: Math.round(n) / 100 });
            }}
          />
        </label>
      </div>
      <p className={styles.note}>
        {t("studioToolsOverlays.sizeNote", {
          recommended: o ? t("studioToolsOverlays.sizeRecommended", { size: overlaySize(o, t) }) : "",
          width: Math.round(item.width * item.scale),
          height: Math.round(item.height * item.scale)
        })}
      </p>
      <label className={styles.checkRow}>
        <input type="checkbox" checked={item.hidden} onChange={(e) => onPatch({ hidden: e.target.checked })} />
        {t("studioToolsOverlays.hideInObs")}
      </label>
      <div className={styles.actions}>
        {o && (
          <button
            type="button"
            className={styles.ghost}
            onClick={() => {
              const [width, height] = catalogSize(o.size);
              onPatch({ width, height });
            }}
          >
            {t("studioToolsOverlays.recommendedSize")}
          </button>
        )}
        <button type="button" className={styles.ghost} onClick={() => onPatch({ scale: 1 })}>
          {t("studioToolsOverlays.fullScale")}
        </button>
        <button
          type="button"
          className={styles.ghost}
          onClick={() => onPatch({ x: Math.round((c.width - item.width * item.scale) / 2), y: Math.round((c.height - item.height * item.scale) / 2) })}
        >
          {t("studioToolsOverlays.center")}
        </button>
        <button type="button" className={styles.ghost} onClick={onRemove}>
          {t("studioTools.remove")}
        </button>
      </div>
    </>
  );
}
