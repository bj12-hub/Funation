import { isRecord } from "@/lib/flextv/client";
import { ADULT_THEME, RESOLUTIONS, type Option, type StreamForm } from "@/lib/flextv/studio";
import { BROADCAST_PASSWORD_MAX, BROADCAST_TAG_MAX, BROADCAST_TITLE_MAX } from "./broadcastTypes";

/**
 * The 방송 설정 form as the server reads it (./broadcast.ts): what FLEXTV's own broadcast form allows, checked again
 * on the server against FLEXTV's current lists and the member's age.
 */

export type ParsedBroadcast = {
  form: Omit<StreamForm, "password">;
  password: { mode: "NONE" } | { mode: "KEEP" } | { mode: "SET"; value: string };
  agreed: boolean;
};

const clean = (value: unknown) => (typeof value === "string" ? value.replace(/[\u0000-\u001f\u007f]/g, " ").trim() : null);
const bool = (value: unknown) => value === true;
const PASSWORD = new RegExp(`^[\\x21-\\x7e]{1,${BROADCAST_PASSWORD_MAX}}$`);

export function parseBroadcast(input: unknown, { themes, tags, adult }: { themes: Option[]; tags: Option[]; adult: boolean }): ParsedBroadcast | { invalid: string } {
  if (!isRecord(input)) return { invalid: "잘못된 요청이에요. 다시 시도해 주세요." };
  const title = clean(input.title);
  if (!title) return { invalid: "방송 제목을 입력해 주세요." };
  if (title.length > BROADCAST_TITLE_MAX) return { invalid: `방송 제목은 ${BROADCAST_TITLE_MAX}자까지 쓸 수 있어요.` };
  const themeId = typeof input.themeId === "string" && themes.some((t) => t.value === input.themeId) ? input.themeId : null;
  if (!themeId) return { invalid: "카테고리를 골라 주세요." };

  const tagCodes = Array.isArray(input.tagCodes) ? [...new Set<unknown>(input.tagCodes)] : [];
  if (tagCodes.length > BROADCAST_TAG_MAX) return { invalid: `태그는 ${BROADCAST_TAG_MAX}개까지 고를 수 있어요.` };
  if (!tagCodes.every((c): c is string => typeof c === "string" && tags.some((t) => t.value === c))) return { invalid: "고를 수 없는 태그가 있어요." };

  const forAdult = bool(input.forAdult);
  if (forAdult && !adult) return { invalid: "연령제한 방송은 만 19세 이상 회원만 설정할 수 있어요." };
  if (themeId === ADULT_THEME && !forAdult) return { invalid: "성인 카테고리는 연령제한을 켜고 방송해요." };

  const pw = isRecord(input.password) ? input.password : {};
  let password: ParsedBroadcast["password"];
  if (pw.mode === "NONE") password = { mode: "NONE" };
  else if (pw.mode === "KEEP") password = { mode: "KEEP" };
  else if (pw.mode === "SET" && typeof pw.value === "string" && PASSWORD.test(pw.value)) password = { mode: "SET", value: pw.value };
  else return { invalid: `비밀번호는 공백 없이 영문 · 숫자 · 기호로 ${BROADCAST_PASSWORD_MAX}자까지 쓸 수 있어요.` };

  const displayMode = input.displayMode === "portrait" || input.displayMode === "landscape" ? input.displayMode : null;
  if (!displayMode) return { invalid: "화면 방향을 골라 주세요." };
  const resolution = RESOLUTIONS.find((r) => r === input.resolution);
  if (!resolution) return { invalid: "화질을 골라 주세요." };

  return {
    form: {
      title,
      themeId,
      tagCodes: tagCodes as string[],
      forAdult,
      visitAllow: bool(input.visitAllow),
      watermark: bool(input.watermark),
      recordingWarning: bool(input.recordingWarning),
      adultThumbnail: forAdult && bool(input.adultThumbnail),
      displayMode,
      resolution
    },
    password,
    agreed: bool(input.agreed)
  };
}
