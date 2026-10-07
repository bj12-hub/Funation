# Community (커뮤니티 · 채널 커뮤니티 · 쪽지 · 신고 · 차단)

Code-first (no Figma frame; screens in `docs/figma/code-first-screens.md`). Social content moves no FN, so it is not
part of the Donation Core, Wallet or Settlement.

## 커뮤니티 board and channel community

- Reading is public; writing needs a session. Suspended and withdrawn members are signed out, so they cannot write.
- Only the author edits or deletes a post or comment; the server checks it. A write looks the post up after its last
  await, so a post deleted or hidden meanwhile is not written to.
- 글쓰기, 댓글 and channel posts carry a request id per form, kept per member and per account: a retry after a lost
  response writes once, and the screen starts a new id when the text changes after a failed or lost submit.
- 2026-10-08 결정: a withdrawn member's posts, comments and channel posts stay up with the author shown as
  "탈퇴한 회원" (the same label as 정산 심사), also on block lists. Nobody can edit or delete them; after a 재가입 they
  belong to the withdrawn account's own member id (`…-wN`), not to the new account. Reporting and blocking them works.

## 쪽지

- 4 mailboxes (받은 쪽지함 · 보낸 쪽지 · 보관함 · 스팸함); received mail moves between 받은 쪽지함, 보관함 and 스팸함, and
  deleting is a soft delete that can be repeated.
- 쪽지 보내기 carries a request id: a retry after a lost response sends once and does not count toward the hourly limit
  (the limit itself is a placeholder, TBD).
- 스팸신고 moves the mail to 스팸함; it does not file a report (2026-10-08: kept as is).

## 신고 · 차단

- A report points at the content; the server resolves its author and keeps a snapshot of the text for the operator.
  One open report per member and content.
- 차단 hides the author's posts, comments, channel posts and mail from the blocker (board counts included). The
  author is not told. Block entries carry their own id; the blocked member's id never reaches the browser. A creator
  channel can be reported but not blocked.
- Operators settle a report in the admin app (숨김 or 기각, note required, final, audited); one decision closes every
  open report on the same content.

TBD: what each report reason means for sanctions, appeals, abuse limits on reports, retention of withdrawn members'
content, images and notices on the board.
