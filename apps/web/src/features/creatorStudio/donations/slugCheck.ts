import type { SlugCheckResult } from "@/services/creator/donationManagementTypes";

export type SlugCheckView = { tone: "ok" | "error"; text: string; available?: boolean };

/**
 * 후원 페이지 링크 설정 › 중복확인: the line under the address, for the address that was checked. `null` once the address
 * was edited while the check ran — that answer is about another address, and showing it (with "이 주소로 변경") under the
 * new one would offer an address nobody checked.
 */
export function slugCheckView(checked: string, current: string, r: SlugCheckResult): SlugCheckView | null {
  if (checked !== current) return null;
  if (r.status === "AVAILABLE") return { tone: "ok", text: "사용할 수 있는 주소입니다.", available: true };
  if (r.status === "SAME") return { tone: "ok", text: "현재 사용 중인 주소입니다." };
  if (r.status === "TAKEN") return { tone: "error", text: "이미 사용 중인 주소입니다." };
  return { tone: "error", text: r.status === "INVALID" ? r.message : "로그인이 필요합니다." };
}
