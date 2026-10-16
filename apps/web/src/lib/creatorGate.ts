import { getSession } from "@/lib/session";

/**
 * Where a creator-only window outside the studio and the 도우미 menus (the 리모컨 `/popout/remote`, 통합 채팅
 * `/popout/chat`) sends a visitor it cannot show: signed out → sign-in, then back to `next`; signed in without the
 * Creator role (no channel yet, e.g. after 탈퇴 → 재가입) → 채널 만들기, as the studio and the 도우미 offer it.
 * Never sign-in for a signed-in member: the sign-in page sends them straight back to `next`, and the two pages would
 * redirect to each other until the browser gives up.
 */
export async function creatorOnlyRedirect(next: string): Promise<string> {
  return (await getSession()) ? "/channel/new" : `/login?role=creator&next=${next}`;
}
