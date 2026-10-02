// Renders the original mock illustrations (scenes.mjs) into apps/web/public/mock with headless Chrome.
// Usage: node scripts/mock-images/render.mjs [filter]
import { spawn } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import * as S from "./scenes.mjs";

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1")), "../../apps/web/public/mock");
const CHROME = process.env.CHROME ?? "C:/Program Files/Google/Chrome/Application/chrome.exe";

// Creator characters stay the same across screens (seed per creator id).
const C = { c1: 101, c2: 102, c3: 103, c4: 104, c5: 105, c6: 106, c7: 107, c8: 108, c9: 109, c10: 110 };
const COPTS = { c3: { headset: true }, c5: { headset: true }, c7: { anime: true, ears: "bunny" } };
const av = (size, id) => S.avatar(size, C[id], COPTS[id] ?? {});
const crewA = ["하늘", "바다", "솔", "길동", "별", "구름"];
const crewB = ["루나", "제이", "모모", "도윤", "하린", "새봄"];

/** [file, width, height, svg] */
const JOBS = [
  ["home/hero-1.jpg", 1536, 672, S.heroArt(1536, 672, 7, "excel")],
  ["home/promo-banner.jpg", 1536, 672, S.heroArt(1536, 672, 8, "promo")],
  ["home/trending-1.jpg", 960, 549, S.excelThumb(960, 549, 11, { members: crewA, count: 6, title: "불꽃크루 엑셀방송 · 시즌2 4회차" })],
  ["home/trending-2.jpg", 960, 549, S.talkThumb(960, 549, C.c1, { neon: "소통" })],
  ["home/trending-3.jpg", 960, 549, S.mukbangThumb(960, 549, C.c6)],
  ["home/trending-4.jpg", 960, 549, S.gameThumb(960, 549, C.c3)],
  ["home/ranking-5.jpg", 960, 549, S.virtualThumb(960, 549, C.c7)],
  ["home/live-1.jpg", 960, 549, S.singThumb(960, 549, C.c2)],
  ["home/live-3.jpg", 960, 549, S.excelThumb(960, 549, 23, { members: crewB, count: 5, title: "별빛크루 직급전 · 1부", wall: ["#4a044e", "#1e0b2b"] })],
  ...["c4", "c1", "c2", "c3", "c10", "c6"].map((id, i) => [`home/creator-${i + 1}.png`, 208, 208, av(208, id)]),
  ["live/thumb-1.jpg", 720, 402, S.excelThumb(720, 402, 31, { members: crewA, count: 5, title: "엑셀방송 · 실시간 점수" })],
  ["live/thumb-2.jpg", 720, 402, S.singThumb(720, 402, 32)],
  ["live/thumb-3.jpg", 720, 402, S.gameThumb(720, 402, 33)],
  ["live/thumb-4.jpg", 720, 402, S.talkThumb(720, 402, 34, { neon: "TALK" })],
  ["live/thumb-5.jpg", 720, 402, S.mukbangThumb(720, 402, 35)],
  ["live/thumb-6.jpg", 720, 402, S.excelThumb(720, 402, 36, { members: crewB, count: 5, title: "댄스크루 엑셀 · 직급전", wall: ["#4a044e", "#1e0b2b"] })],
  ["live/thumb-7.jpg", 720, 402, S.virtualThumb(720, 402, 37)],
  ["live/thumb-8.jpg", 720, 402, S.radioThumb(720, 402, 38)],
  ["live/thumb-9.jpg", 720, 402, S.singThumb(720, 402, 39)],
  ["live/thumb-10.jpg", 720, 402, S.excelThumb(720, 402, 40, { members: ["모모", "하린", "제이", "루나"], count: 4, title: "커버댄스 크루 · 연습 회차", wall: ["#083344", "#0b1026"] })],
  ["live/thumb-11.jpg", 720, 402, S.talkThumb(720, 402, 48, { neon: "같이보기", wall: ["#1e293b", "#0b1026"] })],
  ["live/thumb-12.jpg", 720, 402, S.talkThumb(720, 402, 49, { neon: "투표", wall: ["#3f1d38", "#140a14"] })],
  ...[41, 42, 43, 44, 45, 46, 47].map((seed, i) => [`live/avatar-${i + 1}.png`, 72, 72, S.avatar(72, seed, seed === 47 ? { anime: true } : {})]),
  ...Object.keys(C).map((id, i) => [`creators/creator-${i + 1}.png`, 180, 180, av(180, id)]),
  ...["c4", "c3", "c1", "c2"].map((id, i) => [`favorites/creator-${i + 1}.png`, 96, 96, av(96, id)]),
  ...[51, 52, 53, 54].map((seed, i) => [`room/chat-avatar-${i + 1}.png`, 48, 48, S.avatar(48, seed)]),
  ["room/offline.jpg", 900, 672, S.offlineArt(900, 672, 55)],
  ["room/stream-chat.jpg", 896, 1200, S.talkThumb(896, 1200, C.c1, { neon: "ON AIR" })],
  ["hall-of-fame/hero.jpg", 1536, 672, S.heroArt(1536, 672, 61, "trophy")],
  ["hall-of-fame/promo.jpg", 1536, 672, S.heroArt(1536, 672, 62, "promo")],
  ...[1, 2, 3].map((n) => [`hall-of-fame/supporter-${n}.png`, 188, 208, S.avatar(208, 70 + n).replace('width="208"', 'width="188"').replace('viewBox="0 0 208 208"', 'viewBox="10 0 188 208"')]),
  ...[4, 5, 6, 7, 8, 9, 10].map((n) => [`hall-of-fame/supporter-${n}.png`, 88, 88, S.avatar(88, 70 + n)]),
  ["account/avatar.png", 160, 160, S.avatar(160, 99)],
  // Video donation thumbnails shown in mock mode instead of i.ytimg.com (320×180 like YouTube mqdefault)
  ["video/thumb-1.jpg", 320, 180, S.singThumb(320, 180, 81)],
  ["video/thumb-2.jpg", 320, 180, S.gameThumb(320, 180, 82)],
  ["video/thumb-3.jpg", 320, 180, S.excelThumb(320, 180, 83, { members: crewA, count: 4, title: "하이라이트 · 역전" })],
  ["video/thumb-4.jpg", 320, 180, S.mukbangThumb(320, 180, 84)],
  ["video/thumb-5.jpg", 320, 180, S.talkThumb(320, 180, 85, { neon: "클립" })],
  ["video/thumb-6.jpg", 320, 180, S.virtualThumb(320, 180, 86)]
];

const only = process.argv[2];
const jobs = JOBS.filter(([f]) => !only || f.includes(only));

const port = 9400 + Math.floor(Math.random() * 300);
const chrome = spawn(CHROME, ["--headless=new", `--remote-debugging-port=${port}`, `--user-data-dir=${path.join(os.tmpdir(), "mock-img-profile")}`, "--hide-scrollbars", "--no-first-run", "about:blank"]);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let ws;
for (let i = 0; i < 60 && !ws; i++) {
  await sleep(250);
  try {
    const t = (await (await fetch(`http://127.0.0.1:${port}/json`)).json()).find((x) => x.type === "page");
    if (t) ws = new WebSocket(t.webSocketDebuggerUrl);
  } catch {}
}
await new Promise((r) => (ws.onopen = r));
let seq = 0;
const pending = new Map();
ws.onmessage = (m) => {
  const msg = JSON.parse(m.data);
  if (msg.id && pending.has(msg.id)) {
    const { res, rej } = pending.get(msg.id);
    pending.delete(msg.id);
    msg.error ? rej(new Error(JSON.stringify(msg.error))) : res(msg.result);
  }
};
const send = (method, params = {}) => new Promise((res, rej) => { const id = ++seq; pending.set(id, { res, rej }); ws.send(JSON.stringify({ id, method, params })); });
await send("Page.enable");
const frame = (await send("Page.getFrameTree")).frameTree.frame.id;

for (const [file, w, h, markup] of jobs) {
  await send("Emulation.setDeviceMetricsOverride", { width: w, height: h, deviceScaleFactor: 1, mobile: false });
  await send("Page.setDocumentContent", { frameId: frame, html: `<!doctype html><html><body style="margin:0;background:#000">${markup}</body></html>` });
  await sleep(120);
  const jpg = file.endsWith(".jpg");
  const shot = await send("Page.captureScreenshot", { format: jpg ? "jpeg" : "png", quality: jpg ? 86 : undefined, clip: { x: 0, y: 0, width: w, height: h, scale: 1 } });
  const out = path.join(ROOT, file);
  fs.mkdirSync(path.dirname(out), { recursive: true });
  fs.writeFileSync(out, Buffer.from(shot.data, "base64"));
  console.log(file, w + "x" + h);
}
ws.close();
chrome.kill();
process.exit(0);
