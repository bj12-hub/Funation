import { beforeEach, describe, expect, it, vi } from "vitest";
import { mockSessionModule, resetMockStores } from "@/test/mockEnv";

vi.mock("@/lib/mock", () => ({ USE_MOCK: true, mockDelay: () => Promise.resolve() }));
vi.mock("@/lib/session", () => mockSessionModule());

/**
 * 커스텀 사운드 in the 후원 알림 overlay (code-first): the overlay read carries each word with a short audio address,
 * never the audio itself, and `/api/custom-sound/[id]` serves the saved bytes.
 */
async function load() {
  const remote = await import("./alertRemote");
  const widgets = await import("./widgetSettings");
  const route = await import("@/app/api/custom-sound/[id]/route");
  const { mockCreator } = await import("./mockCreatorStore");
  return { ...remote, ...widgets, GET: route.GET, overlayKey: mockCreator.integrationKey };
}

const MP3 = [0x49, 0x44, 0x33, 4, 0, 0, 0, 0];
const soundForm = (word: string, volume = 70) => {
  const fd = new FormData();
  fd.set("id", "");
  fd.set("word", word);
  fd.set("volume", String(volume));
  fd.set("file", new File([new Uint8Array(MP3)], `${word}.mp3`, { type: "audio/mpeg" }));
  return fd;
};
const fetchSound = (m: Awaited<ReturnType<typeof load>>, url: string) => m.GET(new Request(`http://localhost${url}`), { params: Promise.resolve({ id: url.split("/").pop()! }) });

describe("커스텀 사운드 → 후원 알림 오버레이", () => {
  beforeEach(() => resetMockStores());

  it("sends the words with audio addresses and serves the saved bytes there", async () => {
    const m = await load();
    const read0 = await m.getOverlayAlert(m.overlayKey);
    if (read0 === "FORBIDDEN") throw new Error("overlay");
    expect(read0.customSounds).toEqual([]);

    const saved = await m.saveCustomSound(soundForm("ㅋㅋ", 70));
    if (saved.status !== "SAVED") throw new Error(JSON.stringify(saved));
    const read = await m.getOverlayAlert(m.overlayKey);
    if (read === "FORBIDDEN") throw new Error("overlay");
    expect(read.customSounds).toEqual([{ word: "ㅋㅋ", url: `/api/custom-sound/${saved.sound.id}`, volume: 70 }]);
    expect(JSON.stringify(read)).not.toContain("data:audio");

    const res = await fetchSound(m, read.customSounds[0].url);
    expect(res.status).toBe(200);
    expect(res.headers.get("Content-Type")).toBe("audio/mpeg");
    expect(res.headers.get("X-Content-Type-Options")).toBe("nosniff");
    expect([...new Uint8Array(await res.arrayBuffer())]).toEqual(MP3);
  });

  it("stops serving a deleted sound and answers unknown ids with 404", async () => {
    const m = await load();
    const saved = await m.saveCustomSound(soundForm("박수"));
    if (saved.status !== "SAVED") throw new Error(JSON.stringify(saved));
    expect((await m.deleteCustomSound(saved.sound.id)).status).toBe("DELETED");
    expect((await fetchSound(m, `/api/custom-sound/${saved.sound.id}`)).status).toBe(404);
    expect((await fetchSound(m, "/api/custom-sound/nope")).status).toBe(404);
    const read = await m.getOverlayAlert(m.overlayKey);
    if (read === "FORBIDDEN") throw new Error("overlay");
    expect(read.customSounds).toEqual([]);
  });
});
