"use server";

import { USE_MOCK, mockDelay } from "@/lib/mock";
import { getSession, hasRole } from "@/lib/session";
import { MOCK_FORBIDDEN_WORDS, mockSessionState } from "@/services/account/mockStore";
import { isValidChannelName } from "@/services/creator/creatorSettingsTypes";
import { mockCreator } from "@/services/creator/mockCreatorStore";
import { CHANNEL_INTRO_MAX, CHANNEL_SLUG_RULE, type ChannelCreateResult, type SlugCheck } from "./channelTypes";

/**
 * 채널 만들기 — code-first (no Figma frame). Route `/channel/new`. A signed-in member without the
 * Creator role creates a channel and receives the role. TBD: review/approval, identity or platform
 * verification before receiving donations, reserved-name policy, how many channels per member.
 */

const assertMock = () => {
  if (!USE_MOCK) throw new Error("Channel API is not connected yet.");
};

/** Reserved / taken slugs in the mock (routes and sample channels). */
const RESERVED = new Set(["admin", "creator", "channel", "donation", "wallet", "login", "signup", "support", "funation", "api", "overlay"]);
const takenSlugs = () => new Set([...RESERVED, "honggildong"]);

function slugCheck(slug: unknown): SlugCheck["status"] {
  if (typeof slug !== "string" || !CHANNEL_SLUG_RULE.test(slug) || slug.includes("--")) return "INVALID";
  return takenSlugs().has(slug) ? "TAKEN" : "AVAILABLE";
}

export async function checkChannelSlug(slug: unknown): Promise<SlugCheck> {
  assertMock();
  if (!(await getSession())) return { status: "INVALID" };
  await mockDelay(200);
  return { status: slugCheck(slug) };
}

export async function createChannel(input: unknown): Promise<ChannelCreateResult> {
  assertMock();
  const session = await getSession();
  if (!session) return { status: "UNAUTHORIZED" };
  if (hasRole(session, "CREATOR")) return { status: "ALREADY_CREATOR" };
  const v = (typeof input === "object" && input !== null ? input : {}) as Record<string, unknown>;

  const slug = typeof v.slug === "string" ? v.slug.trim().toLowerCase() : "";
  const slugStatus = slugCheck(slug);
  if (slugStatus === "INVALID") return { status: "INVALID", field: "slug", message: "영문 소문자, 숫자, 하이픈으로 3~30자를 입력해 주세요." };
  if (slugStatus === "TAKEN") return { status: "SLUG_TAKEN" };

  const name = typeof v.name === "string" ? v.name.trim() : "";
  if (!isValidChannelName(name)) return { status: "INVALID", field: "name", message: "채널 이름은 2~20자의 한글, 영문, 숫자, 공백, _로 입력해 주세요." };
  if (MOCK_FORBIDDEN_WORDS.some((w) => name.toLowerCase().includes(w) || slug.includes(w))) return { status: "INVALID", field: "name", message: "사용할 수 없는 단어가 포함되어 있어요." };

  const intro = typeof v.intro === "string" ? v.intro.trim() : "";
  if (intro.length > CHANNEL_INTRO_MAX) return { status: "INVALID", field: "intro", message: `소개는 ${CHANNEL_INTRO_MAX}자 이내로 입력해 주세요.` };
  if (v.agreed !== true) return { status: "INVALID", field: "agreed", message: "크리에이터 이용약관에 동의해 주세요." };

  await mockDelay(500);
  // Mock: the member's channel becomes the studio channel and the role is granted at once.
  // TODO: the backend creates the channel, records the terms consent (version + time) and grants the
  // role — possibly only after review (TBD).
  mockCreator.channelName = name;
  mockCreator.handle = slug;
  mockSessionState.roles = [...new Set([...(mockSessionState.roles ?? session.roles), "CREATOR" as const])];
  return { status: "CREATED", slug };
}
