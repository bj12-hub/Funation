/**
 * 채널 만들기 (Creator 역할 부여) — code-first, no Figma frame (docs/figma/code-first-screens.md).
 * Reference: docs/research/funnation-reference.md P1-3. Whether a new channel needs review/approval,
 * identity verification or platform-account proof before it may receive donations is TBD.
 */

export const CHANNEL_SLUG_RULE = /^[a-z0-9](?:[a-z0-9-]{1,28}[a-z0-9])$/;
export const CHANNEL_INTRO_MAX = 200;

export type ChannelCreateInput = { slug: string; name: string; intro: string; agreed: boolean };

export type ChannelCreateResult =
  | { status: "CREATED"; slug: string }
  | { status: "INVALID"; message: string; field?: "slug" | "name" | "intro" | "agreed" }
  | { status: "SLUG_TAKEN" }
  | { status: "ALREADY_CREATOR" | "UNAUTHORIZED" };

export type SlugCheck = { status: "AVAILABLE" | "TAKEN" | "INVALID" };
