# Vote (투표)

Decided 2026-10-04: **무료 투표만**. A vote moves no FN, so it is not part of the Donation Core,
Wallet or Settlement.

- The creator prepares presets on the 투표 위젯 (이름 · 색상 · 투표 시간 · 항목 2~10개) and starts one
  from the 리모컨. One vote runs at a time per channel.
- Signed-in viewers vote once per vote in the creator room. The same ballot again is a no-op (retry),
  another choice is refused, and nothing is recorded after the vote ends.
- Decided 2026-10-08: **one ballot per person**, identified like 출석 by the phone verified at sign-up. A 재가입
  account with the same phone sees its earlier ballot (내 투표) and cannot vote again; another person can. The
  backend must enforce this with a unique (vote, person) key. Responses carry counts and the viewer's own
  choice only, never who voted.
- A vote ends at its 투표 시간 or when the creator ends it early. The result stays on the overlay and in the
  room until the creator takes it down (결과 내리기) or starts the next vote.
- The 투표 overlay (`/overlay/widget/vote/[key]`) shows items ranked by votes (ties share a rank).
  투표 위젯 사용하기 off hides the overlay only; the room still takes votes.
- Starting a vote carries a request id, so a retried start does not start a second vote.

TBD: realtime push instead of polling, rate limiting, who may vote (e.g. 차단된 회원), audit of start/end.

Mock data: the studio channel has no public room, so 리모컨 votes are checked on the overlay; creator
room c1 has a sample running vote.
