import { isValidNickname } from "@/lib/validation";
import { namesTakenByOthers } from "@/services/supporter/identityCore";
import { isReservedNickname } from "@/services/supporter/identityTypes";
import { mockIdentity } from "@/services/supporter/mockIdentityStore";
import { MOCK_FORBIDDEN_WORDS, mockAccount } from "./mockStore";
import { isWithdrawn } from "./withdrawalCore";

/**
 * Member nickname rules — server-only (not a "use server" module): one check for sign-up
 * (`checkNicknameAvailability`, `signup`) and 마이페이지 (`checkNickname`, `changeNickname`).
 *
 * The member nickname is also the default 별명 (identityCore `MEMBER_NICKNAME_ID`), so it follows the 별명 rules
 * too: 2–12 한글/영문/숫자, no forbidden words, not the hidden-profile label 익명, and (2026-10-08 결정) not another
 * member's nickname or a channel name. Callers look the taken names up first, then check and write without
 * awaiting in between.
 */

export type NicknameVerdict = "AVAILABLE" | "INVALID" | "FORBIDDEN" | "DUPLICATE";

const norm = (name: string) => name.trim().toLowerCase();

/** Names a signed-in member cannot take: other members' and channels' names, and their own other 별명. */
export async function nicknamesTakenForMember(): Promise<Set<string>> {
  const taken = await namesTakenByOthers();
  for (const n of mockIdentity.nicknames) taken.add(norm(n.name));
  return taken;
}

/**
 * Names someone signing up cannot take. The mock's one account counts as another member while it is active;
 * whether a withdrawn account's nickname stays reserved is TBD (the mock frees it, as the account is gone).
 */
export async function nicknamesTakenForSignup(): Promise<Set<string>> {
  const taken = await namesTakenByOthers();
  if (!isWithdrawn()) taken.add(norm(mockAccount.nickname));
  return taken;
}

export function judgeNickname(nickname: unknown, taken: Set<string>): NicknameVerdict {
  if (typeof nickname !== "string" || !isValidNickname(nickname)) return "INVALID";
  const lower = norm(nickname);
  // 익명 is what a hidden profile shows on stream: a nickname cannot pose as it.
  if (isReservedNickname(nickname) || MOCK_FORBIDDEN_WORDS.some((w) => lower.includes(w))) return "FORBIDDEN";
  return taken.has(lower) ? "DUPLICATE" : "AVAILABLE";
}
