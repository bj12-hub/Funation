/**
 * OBS 씬 일괄 다운로드 — code-first (funnation "OBS 씬 컬렉션 일괄 다운로드", 2026-10-06 결정). Builds an OBS
 * Studio scene collection (장면 모음 → 가져오기) with a "전체" scene holding every overlay, one scene per 오버레이 분류
 * (2026-10-06 결정) and one browser source per overlay at its recommended size, centred on a 1920 × 1080 canvas. The
 * scenes share the sources, so a source set up once is the same in every scene. The file holds the creator's overlay key, so it is
 * built in the browser from the page's own data and never sent anywhere.
 */
import { kstDateString } from "@/lib/period";
import type { OverlayEntry } from "./overlayCatalog";

export const OBS_COLLECTION_NAME = "Ssumnation 오버레이";
const CANVAS = { x: 1920, y: 1080 };
/** Sources and scenes share one name space in OBS (분류 "타이머" vs overlay "타이머"), so scenes get their own prefix. */
const PREFIX = "Ssumnation · ";
const SCENE_PREFIX = "Ssumnation 장면 · ";
/** The scene with every overlay (no 분류 is called this). */
export const OBS_ALL_SCENE = `${SCENE_PREFIX}전체`;

/** "800 × 600" → [800, 600] (the catalog's recommended OBS size). */
export function overlaySize(size: string): [number, number] {
  const m = size.match(/(\d+)\s*×\s*(\d+)/);
  return m ? [Number(m[1]), Number(m[2])] : [CANVAS.x, CANVAS.y];
}

/** Fields OBS would otherwise read as 0 (volume 0 = silent, scale 0 = invisible), so they are always written. */
const sourceBase = { mixers: 255, sync: 0, flags: 0, volume: 1, balance: 0.5, enabled: true, muted: false, monitoring_type: 0, private_settings: {}, hotkeys: {} };

/**
 * The scene collection for `overlays` (in catalog order). `origin` + each overlay path is the full source URL;
 * `uuid` is injectable for tests.
 */
export function obsSceneCollection(overlays: OverlayEntry[], origin: string, overlayKey: string, uuid: () => string = () => crypto.randomUUID()) {
  const groups = [...new Set(overlays.map((o) => o.group))];
  const browser = overlays.map((o) => {
    const [width, height] = overlaySize(o.size);
    const settings = { url: `${origin}${o.path(overlayKey)}`, width, height };
    return { group: o.group, source: { ...sourceBase, id: "browser_source", versioned_id: "browser_source", name: `${PREFIX}${o.title}`, uuid: uuid(), settings } };
  });
  const scene = (name: string, members: typeof browser) => {
    const items = members.map(({ source: s }, i) => ({
        name: s.name,
        source_uuid: s.uuid,
        id: i + 1,
        visible: true,
        locked: false,
        rot: 0,
        pos: { x: Math.max(0, Math.round((CANVAS.x - s.settings.width) / 2)), y: Math.max(0, Math.round((CANVAS.y - s.settings.height) / 2)) },
        scale: { x: 1, y: 1 },
        align: 5,
        bounds_type: 0,
        bounds_align: 0,
        bounds: { x: 0, y: 0 },
        crop_left: 0,
        crop_top: 0,
        crop_right: 0,
        crop_bottom: 0,
        group_item_backup: false,
        scale_filter: "disable",
        blend_method: "default",
        blend_type: "normal",
        private_settings: {}
      }));
    return { ...sourceBase, mixers: 0, id: "scene", versioned_id: "scene", name, uuid: uuid(), settings: { id_counter: items.length, custom_size: false, items } };
  };
  const scenes = [scene(OBS_ALL_SCENE, browser), ...groups.map((g) => scene(`${SCENE_PREFIX}${g}`, browser.filter((b) => b.group === g)))];
  const first = scenes[0]?.name ?? "";
  return {
    name: OBS_COLLECTION_NAME,
    current_scene: first,
    current_program_scene: first,
    scene_order: scenes.map((s) => ({ name: s.name })),
    sources: [...browser.map((b) => b.source), ...scenes],
    groups: [],
    quick_transitions: [],
    transitions: [],
    saved_projectors: [],
    current_transition: "Fade",
    transition_duration: 300,
    preview_locked: false,
    scaling_enabled: false,
    scaling_level: 0,
    scaling_off_x: 0,
    scaling_off_y: 0,
    modules: {}
  };
}

/** `Ssumnation-오버레이-20261006.json` (the Korean date, whatever the browser's zone). */
export function obsFileName(now = new Date()) {
  return `Ssumnation-오버레이-${kstDateString(now).replaceAll("-", "")}.json`;
}
