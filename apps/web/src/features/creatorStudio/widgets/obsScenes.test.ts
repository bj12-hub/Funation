import { describe, expect, it } from "vitest";
import { OVERLAYS } from "./overlayCatalog";
import { OBS_ALL_SCENE, obsFileName, obsSceneCollection, overlaySize } from "./obsScenes";

/** OBS 씬 일괄 다운로드 (code-first, 2026-10-06): an OBS scene collection with every overlay. */
describe("OBS 씬 컬렉션", () => {
  let n = 0;
  const c = obsSceneCollection(OVERLAYS, "https://ssumnation.test", "key-1234", () => `uuid-${++n}`);
  const browser = c.sources.filter((s) => s.id === "browser_source");
  const scenes = c.sources.filter((s) => s.id === "scene");

  it("has one browser source per overlay with its full URL and recommended size", () => {
    expect(browser).toHaveLength(OVERLAYS.length);
    const alert = browser.find((s) => s.name === "Ssumnation · 후원 알림")!;
    expect(alert.settings).toEqual({ url: "https://ssumnation.test/overlay/alert/key-1234", width: 800, height: 600 });
    expect(alert).toMatchObject({ volume: 1, enabled: true, muted: false });
    expect(new Set(c.sources.map((s) => s.name)).size).toBe(c.sources.length);
    expect(new Set(c.sources.map((s) => s.uuid)).size).toBe(c.sources.length);
  });

  it("has a 전체 scene first and one scene per 분류, each item pointing at an existing source", () => {
    const groups = [...new Set(OVERLAYS.map((o) => o.group))];
    expect(c.scene_order.map((s) => s.name)).toEqual([OBS_ALL_SCENE, ...groups.map((g) => `Ssumnation 장면 · ${g}`)]);
    expect(c.current_scene).toBe(OBS_ALL_SCENE);
    type Item = { name: string; source_uuid: string; id: number; scale: object; pos: { x: number; y: number } };
    const itemsOf = (s: (typeof scenes)[number]) => (s.settings as { items: Item[] }).items;
    // 전체 holds every overlay once; the 분류 scenes split the same sources between them.
    expect(itemsOf(scenes[0]).map((i) => i.source_uuid)).toEqual(browser.map((s) => s.uuid));
    expect(itemsOf(scenes[0]).map((i) => i.id)).toEqual(browser.map((_, i) => i + 1));
    const items = scenes.slice(1).flatMap(itemsOf);
    expect(items).toHaveLength(OVERLAYS.length);
    expect(new Set(items.map((i) => i.source_uuid)).size).toBe(OVERLAYS.length);
    for (const item of items) {
      expect(browser.find((s) => s.uuid === item.source_uuid)?.name).toBe(item.name);
      expect(item.scale).toEqual({ x: 1, y: 1 });
    }
    // Centred on 1920 × 1080; full-screen overlays sit at the origin.
    expect(items.find((i) => i.name === "Ssumnation · 후원 알림")!.pos).toEqual({ x: 560, y: 240 });
    expect(items.find((i) => i.name === "Ssumnation · 벽지")!.pos).toEqual({ x: 0, y: 0 });
    expect(JSON.parse(JSON.stringify(c))).toEqual(c);
  });

  it("reads sizes and names the file by date", () => {
    expect(overlaySize("1920 × 200")).toEqual([1920, 200]);
    expect(overlaySize("가변")).toEqual([1920, 1080]);
    expect(obsFileName(new Date(2026, 9, 6, 23, 59))).toBe("Ssumnation-오버레이-20261006.json");
  });
});
