"use server";

import { FlextvUnavailableError, isRecord } from "@/lib/flextv/client";
import { FLEXTV_STUDIO } from "@/lib/flextv/mode";
import { createQueue } from "@/lib/flextv/queue";
import { requestDeviceContext } from "@/lib/flextv/request";
import {
  ADULT_THEME,
  editStream,
  fetchEngine,
  fetchMemberProfile,
  fetchMyChannelData,
  fetchStreamKeys,
  fetchTags,
  fetchThemes,
  isStreamEngine,
  readAdult,
  readMyChannel,
  readOpenStreamPassword,
  setEngine,
  startStream,
  stopStream,
  type Option,
  type StreamEngine,
  type StreamForm,
  type StreamOutcome
} from "@/lib/flextv/studio";
import { parseBroadcast } from "./broadcastInput";
import { myChannel, studioContext } from "./flextvStudio";
import {
  ENGINE_LABEL,
  type BroadcastDefaults,
  type BroadcastResult,
  type BroadcastView,
  type EngineResult,
  type RevealResult
} from "./broadcastTypes";

/**
 * 방송 설정 with FLEXTV (phase 5, docs/development/flextv-backend.md "5단계"): OBS's 서버 and 스트림 키, and starting,
 * changing and ending a broadcast on the member's FLEXTV channel. FLEXTV starts a broadcast only while OBS is already
 * sending, and ends it only when asked (OBS stopping leaves it open), as on FLEXTV's own broadcast page.
 *
 * Everything the browser sends is checked again here; the channel, the open stream and the engine are always the
 * member's own as FLEXTV reports them, never ids from the browser. The room password and the stream key stay on the
 * server unless the owner asks to see the key. One call at a time per member.
 */

const serialize = createQueue("broadcast");

/** FLEXTV's form starts on theme 5 when the member never broadcast. */
const DEFAULT_THEME = "5";

const onlyFlextv = () => {
  if (!FLEXTV_STUDIO) throw new Error("방송 설정 runs on the FLEXTV backend only.");
};

export async function getBroadcastView(): Promise<BroadcastView | null> {
  onlyFlextv();
  const ctx = await studioContext();
  if (!ctx) return null;
  const [profile, mine, keys, engine, themes, tags] = await Promise.all([
    fetchMemberProfile(ctx.token),
    myChannel(ctx.token),
    fetchStreamKeys(ctx.token),
    fetchEngine(ctx.token),
    fetchThemes(),
    // Tags are optional: the form works without them.
    fetchTags(ctx.token).catch(() => [] as Option[])
  ]);
  if (!profile || !mine) return null;
  const { channel } = mine;
  const adult = readAdult(profile);
  const themeOptions = adult ? themes : themes.filter((t) => t.value !== ADULT_THEME);
  const source = channel.stream ?? channel.last;
  const defaults: BroadcastDefaults = source
    ? {
        title: source.title,
        themeId: source.themeId,
        tagCodes: source.tagCodes.filter((c) => tags.some((t) => t.value === c)),
        forAdult: adult && source.forAdult,
        hasPassword: source.hasPassword,
        visitAllow: source.visitAllow,
        watermark: source.watermark,
        recordingWarning: source.recordingWarning,
        adultThumbnail: adult && source.forAdult && source.adultThumbnail,
        displayMode: source.displayMode
      }
    : { title: "", themeId: null, tagCodes: [], forAdult: false, hasPassword: false, visitAllow: false, watermark: false, recordingWarning: false, adultThumbnail: false, displayMode: "landscape" };
  if (!defaults.themeId || !themeOptions.some((t) => t.value === defaults.themeId)) {
    defaults.themeId = themeOptions.find((t) => t.value === DEFAULT_THEME)?.value ?? themeOptions[0]?.value ?? null;
  }
  return {
    channelId: channel.channelId,
    channelName: channel.name || ctx.session.nickname,
    watchPath: `/creators/${channel.channelId}`,
    live: channel.live,
    streaming: channel.stream !== null,
    defaults,
    suspension: channel.suspension,
    keys: keys.map((k) => ({ engine: k.engine, label: ENGINE_LABEL[k.engine], serverUrl: k.serverUrl })),
    engine,
    themes: themeOptions,
    tags,
    adult
  };
}

/** The owner's stream key for OBS, read from FLEXTV each time and kept nowhere. */
export async function revealStreamKey(engine: unknown): Promise<RevealResult> {
  onlyFlextv();
  if (!isStreamEngine(engine)) return { status: "NOT_FOUND" };
  const ctx = await studioContext();
  if (!ctx) return { status: "UNAUTHORIZED" };
  try {
    const key = (await fetchStreamKeys(ctx.token)).find((k) => k.engine === engine);
    return key ? { status: "OK", streamKey: key.streamKey } : { status: "NOT_FOUND" };
  } catch (error) {
    if (error instanceof FlextvUnavailableError) return { status: "UNKNOWN" };
    throw error;
  }
}

/** Which key FLEXTV plays the channel from (FLEXTV's 적용하기). Not while a stream is open. */
export async function changeStreamEngine(engine: unknown): Promise<EngineResult> {
  onlyFlextv();
  if (!isStreamEngine(engine)) return { status: "INVALID" };
  const ctx = await studioContext();
  if (!ctx) return { status: "UNAUTHORIZED" };
  const context = await requestDeviceContext();
  return serialize(ctx.session.userId, async () => {
    try {
      const channel = readMyChannel(await fetchMyChannelData(ctx.token));
      if (!channel) return { status: "UNAUTHORIZED" };
      if (channel.stream) return { status: "INVALID" };
      return (await setEngine(ctx.token, context, channel.channelId, engine)) ? { status: "SAVED", engine } : { status: "INVALID" };
    } catch (error) {
      if (error instanceof FlextvUnavailableError) return { status: "UNKNOWN" };
      throw error;
    }
  });
}

export async function startBroadcast(input: unknown): Promise<BroadcastResult> {
  return act(input, "START");
}

export async function updateBroadcast(input: unknown): Promise<BroadcastResult> {
  return act(input, "UPDATE");
}

export async function stopBroadcast(): Promise<BroadcastResult> {
  onlyFlextv();
  const ctx = await studioContext();
  if (!ctx) return { status: "UNAUTHORIZED" };
  const context = await requestDeviceContext();
  return serialize(ctx.session.userId, () => answer(() => stopStream(ctx.token, context), "STOPPED"));
}

async function act(input: unknown, kind: "START" | "UPDATE"): Promise<BroadcastResult> {
  onlyFlextv();
  const ctx = await studioContext();
  if (!ctx) return { status: "UNAUTHORIZED" };
  const context = await requestDeviceContext();
  return serialize(ctx.session.userId, async () => {
    let profile: unknown, data: unknown, themes: Option[], tags: Option[], engine: StreamEngine | null;
    try {
      [profile, data, themes, tags, engine] = await Promise.all([
        fetchMemberProfile(ctx.token),
        fetchMyChannelData(ctx.token),
        fetchThemes(),
        fetchTags(ctx.token).catch(() => [] as Option[]),
        fetchEngine(ctx.token)
      ]);
    } catch (error) {
      if (error instanceof FlextvUnavailableError) return { status: "UNKNOWN" };
      throw error;
    }
    const channel = data === null ? null : readMyChannel(data);
    if (!profile || !channel) return { status: "UNAUTHORIZED" };
    if (channel.suspension) return { status: "REFUSED", message: SUSPENDED };
    // A page older than the stream: starting again would restart the broadcast, changing a closed one does nothing.
    if (kind === "START" && channel.stream) return { status: "INVALID", message: "이미 방송 중이에요. 화면을 새로고침해 주세요." };
    if (kind === "UPDATE" && !channel.stream) return { status: "INVALID", message: "진행 중인 방송이 없어요. 화면을 새로고침해 주세요." };

    const adult = readAdult(profile);
    const parsed = parseBroadcast(input, { themes: adult ? themes : themes.filter((t) => t.value !== ADULT_THEME), tags, adult });
    if ("invalid" in parsed) return { status: "INVALID", message: parsed.invalid };
    if (kind === "START" && !parsed.agreed) return { status: "INVALID", message: "방송 준수사항에 동의해 주세요." };

    const kept = kind === "UPDATE" ? readOpenStreamPassword(data) : readLastPassword(data);
    const form: StreamForm = { ...parsed.form, password: parsed.password.mode === "SET" ? parsed.password.value : parsed.password.mode === "KEEP" ? kept : "" };
    const using = engine ?? "ncp_llh";
    return kind === "START"
      ? answer(() => startStream(ctx.token, context, form, using), "STARTED")
      : answer(() => editStream(ctx.token, context, channel.stream!.streamId, form, using), "UPDATED");
  });
}

/** The last broadcast's room password, which FLEXTV's form starts from too. */
function readLastPassword(data: unknown): string {
  return isRecord(data) && isRecord(data.laststreams) && typeof data.laststreams.password === "string" ? data.laststreams.password : "";
}

const SUSPENDED = "이용이 정지된 채널이라 방송할 수 없어요.";

async function answer(call: () => Promise<StreamOutcome>, done: "STARTED" | "UPDATED" | "STOPPED"): Promise<BroadcastResult> {
  let outcome: StreamOutcome;
  try {
    outcome = await call();
  } catch (error) {
    if (error instanceof FlextvUnavailableError) return { status: "UNKNOWN" };
    throw error;
  }
  switch (outcome.kind) {
    case "OK":
      return { status: done };
    case "UNAUTHORIZED":
      return { status: "UNAUTHORIZED" };
    case "NO_SIGNAL":
      return { status: "REFUSED", message: "OBS에서 방송 송출을 먼저 시작해 주세요. 송출이 FLEXTV에 닿아야 방송을 시작할 수 있어요." };
    case "NOT_LIVE":
      return { status: "REFUSED", message: "지금 진행 중인 방송이 없어요." };
    case "SUSPENDED":
      return { status: "REFUSED", message: SUSPENDED };
    case "NOT_ALLOWED":
      return { status: "REFUSED", message: "방송 권한이 없거나, 연령제한 방송을 할 수 없는 계정이에요." };
    case "RETRY":
      return { status: "REFUSED", message: "잠시 후 다시 시도해 주세요." };
    default:
      return { status: "REFUSED", message: outcome.message ?? "FLEXTV가 요청을 받지 않았어요. 잠시 후 다시 시도해 주세요." };
  }
}
