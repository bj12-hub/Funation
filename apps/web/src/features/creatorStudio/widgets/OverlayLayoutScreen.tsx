"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, useTransition, type KeyboardEvent, type PointerEvent } from "react";
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

/**
 * 원소스 오버레이 배치 — code-first (no Figma frame; StreamDonate "오버레이 설정 (원소스)" 참고, P3). Route
 * `/creator/widgets/onesource`. Per 캔버스 (PC 16:9 · 모바일 가로 · 세로 9:16): a scaled preview where placed overlays are
 * dragged (and scaled from the corner handle; arrow keys nudge 1px, Shift 10px), the 레이어 list (top first; drag or ↑ ↓ to
 * reorder, 숨김), the selected overlay's 위치 · 가로 · 세로 · 스케일, 오버레이 추가 from the 오버레이 주소 catalog, 저장 per
 * canvas and its 원소스 OBS address. 실시간 미리보기 shows the real overlays in their boxes.
 */
export function OverlayLayoutScreen({ view }: { view: OverlayLayoutView }) {
  const router = useRouter();
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
          setMessage({ tone: "ok", text: `${canvasInfo(target).label} 배치를 저장했어요. OBS에는 5초 안에 반영돼요.` });
          router.refresh();
        } else if (res.status === "UNAUTHORIZED") router.push("/login?role=creator&next=/creator/widgets/onesource");
        else {
          saveId.current = null;
          setMessage({ tone: res.status === "CONFLICT" ? "conflict" : "error", text: res.message });
        }
      } catch {
        setMessage({ tone: "error", text: "저장하지 못했어요. 잠시 후 다시 시도해 주세요." });
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
        <h1 className={styles.title}>원소스 오버레이</h1>
        <p className={styles.subtitle}>OBS 브라우저 소스 하나에 여러 오버레이를 배치해요. PC · 모바일 가로 · 세로 캔버스마다 따로 저장돼요.</p>
        <p className={styles.note}>
          오버레이마다의 설정 · 테마 · <Link href="/creator/remote">리모컨</Link> 켜기/끄기는 그대로 적용되고, 여기서는 위치 · 크기 · 순서만 정해요. 개별 주소는{" "}
          <Link href="/creator/widgets/overlays">오버레이 주소</Link>에 있어요.
        </p>
      </header>

      <div className={styles.segment} role="group" aria-label="캔버스">
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
            {c.label}
            {!same(ed.drafts[c.key], ed.loaded[c.key].items) && " •"}
          </button>
        ))}
      </div>

      {message && (
        <p className={message.tone === "ok" ? styles.ok : styles.error} role={message.tone === "ok" ? "status" : "alert"}>
          {message.text}{" "}
          {message.tone === "conflict" && (
            <button type="button" className={styles.ghost} onClick={reload}>
              최신 배치 불러오기
            </button>
          )}
        </p>
      )}

      <section className={styles.card} aria-labelledby="layout-stage-title">
        <div className={local.stageHead}>
          <h2 id="layout-stage-title" className={styles.cardTitle}>
            {info.label} · {info.width} × {info.height}
          </h2>
          <label className={styles.checkRow}>
            <input type="checkbox" checked={live} onChange={(e) => setLive(e.target.checked)} />
            실시간 미리보기
          </label>
        </div>
        <div ref={wrap} className={local.wrap}>
          <div className={local.stage} style={{ width: info.width * fit, height: info.height * fit }} onPointerDown={() => setSelected(null)}>
            {items.length === 0 && <p className={local.stageEmpty}>아직 놓은 오버레이가 없어요. 아래 &lsquo;오버레이 추가&rsquo;에서 골라 주세요.</p>}
            {items.map((i) => {
              const o = overlayOf(i.overlayId);
              const title = o?.title ?? "없는 오버레이";
              return (
                <div
                  key={i.id}
                  role="button"
                  tabIndex={0}
                  aria-pressed={selected === i.id}
                  aria-label={`${title} — X ${i.x}, Y ${i.y}, ${Math.round(i.scale * 100)}%`}
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
                      title={`${title} 미리보기`}
                      tabIndex={-1}
                      className={local.frame}
                      style={{ width: i.width, height: i.height, transform: `scale(${i.scale * fit})` }}
                    />
                  )}
                  <span className={local.boxLabel}>
                    {title}
                    {i.hidden && " (숨김)"}
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
        <p className={styles.note}>
          끌어서 옮기고, 고른 오버레이의 오른쪽 아래 손잡이로 크기(스케일)를 바꿔요. 방향키로 1px · Shift+방향키로 10px 옮겨요. 캔버스 밖으로 나간 부분은 방송에 보이지 않아요.
        </p>
      </section>

      <div className={local.panels}>
        <section className={styles.card} aria-labelledby="layout-layers-title">
          <h2 id="layout-layers-title" className={styles.cardTitle}>
            레이어 <span className={styles.muted}>(위가 앞)</span>
          </h2>
          {items.length === 0 ? (
            <p className={styles.empty}>놓은 오버레이가 없어요.</p>
          ) : (
            <LayerList items={items} selected={selected} onSelect={setSelected} onMove={move} onToggle={(i) => patch(i.id, { hidden: !i.hidden })} />
          )}
          <div className={styles.addRow}>
            <select className={`${styles.select} ${local.picker}`} aria-label="추가할 오버레이" value={adding} onChange={(e) => setAdding(e.target.value)}>
              {GROUPS.map((g) => (
                <optgroup key={g} label={g}>
                  {OVERLAYS.filter((o) => o.group === g).map((o) => (
                    <option key={o.id} value={o.id}>
                      {o.title} ({o.size})
                    </option>
                  ))}
                </optgroup>
              ))}
            </select>
            <button type="button" className={styles.ghost} disabled={items.length >= LAYOUT_ITEMS_MAX} onClick={add}>
              오버레이 추가
            </button>
          </div>
          <p className={styles.note}>
            한 캔버스에 {LAYOUT_ITEMS_MAX}개까지 놓을 수 있어요. 같은 오버레이를 원소스와 따로 추가한 브라우저 소스에 함께 두면 알림 소리가 두 번 날 수 있어요.
          </p>
        </section>

        <section className={styles.card} aria-labelledby="layout-item-title">
          <h2 id="layout-item-title" className={styles.cardTitle}>
            {sel ? (overlayOf(sel.overlayId)?.title ?? "없는 오버레이") : "고른 오버레이"}
          </h2>
          {!sel ? (
            <p className={styles.empty}>미리보기나 레이어에서 오버레이를 골라 주세요.</p>
          ) : (
            <ItemFields item={sel} canvas={canvas} onPatch={(p) => patch(sel.id, p)} onRemove={() => remove(sel.id)} />
          )}
        </section>
      </div>

      <section className={styles.card} aria-labelledby="layout-save-title">
        <h2 id="layout-save-title" className={styles.cardTitle}>
          저장 · OBS 주소
        </h2>
        <p className={styles.note}>
          {dirty ? `${info.label} 캔버스에 저장하지 않은 변경이 있어요.` : `${info.label} 캔버스는 저장된 상태예요.`} 캔버스는 하나씩 저장해요.
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
            되돌리기
          </button>
          <button type="button" className={styles.primary} disabled={pending || !dirty} onClick={save}>
            {pending ? "저장하는 중…" : `${info.label} 저장`}
          </button>
        </div>
        <p className={styles.note}>
          OBS에 브라우저 소스 하나를 {info.width} × {info.height} 크기로 추가하고 아래 주소를 넣어요. 캔버스마다 주소가 달라요.
        </p>
        <div className={styles.addRow}>
          <input className={styles.input} value={shownOverlayAddress(origin, path, query)} readOnly aria-label={`${info.label} 원소스 주소`} onFocus={(e) => e.target.select()} />
          <CopyButton value={`${origin}${path}${query}`} label="복사" className={styles.ghost} />
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
  const from = useRef<number | null>(null);
  const last = items.length - 1;
  return (
    <ol className={local.layers}>
      {items
        .map((i, index) => ({ i, index }))
        .reverse()
        .map(({ i, index }) => {
          const title = overlayOf(i.overlayId)?.title ?? "없는 오버레이";
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
              <button type="button" aria-label={`${title} ${i.hidden ? "보이기" : "숨기기"}`} aria-pressed={i.hidden} onClick={() => onToggle(i)}>
                {i.hidden ? "🙈" : "👁"}
              </button>
              <button type="button" aria-label={`${title} 앞으로`} disabled={index === last} onClick={() => onMove(index, index + 1)}>
                ↑
              </button>
              <button type="button" aria-label={`${title} 뒤로`} disabled={index === 0} onClick={() => onMove(index, index - 1)}>
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
        {num("width", "가로", LAYOUT_SIZE_MIN, LAYOUT_SIZE_MAX)}
        {num("height", "세로", LAYOUT_SIZE_MIN, LAYOUT_SIZE_MAX)}
        <label className={local.field}>
          <span className={styles.muted}>스케일 %</span>
          <input
            className={styles.inputSmall}
            type="number"
            inputMode="numeric"
            aria-label="스케일"
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
        가로 · 세로는 브라우저 소스 크기예요{o && ` (권장 ${o.size})`}. 방송에는 스케일을 곱한 {Math.round(item.width * item.scale)} × {Math.round(item.height * item.scale)}으로 보여요.
      </p>
      <label className={styles.checkRow}>
        <input type="checkbox" checked={item.hidden} onChange={(e) => onPatch({ hidden: e.target.checked })} />
        OBS에서 숨기기 (배치는 남겨 둬요)
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
            권장 크기로
          </button>
        )}
        <button type="button" className={styles.ghost} onClick={() => onPatch({ scale: 1 })}>
          100%로
        </button>
        <button
          type="button"
          className={styles.ghost}
          onClick={() => onPatch({ x: Math.round((c.width - item.width * item.scale) / 2), y: Math.round((c.height - item.height * item.scale) / 2) })}
        >
          가운데로
        </button>
        <button type="button" className={styles.ghost} onClick={onRemove}>
          빼기
        </button>
      </div>
    </>
  );
}
