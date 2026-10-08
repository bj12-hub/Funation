import type { ResolvedTheme } from "@/services/creator/overlayThemeTypes";
import { OverlayThemeRoot, ov } from "./OverlayThemeRoot";
import s from "./themeSample.module.css";

/**
 * A small stream scene drawn in one theme — a donation alert, two chat lines and a goal bar — for the 오버레이 테마
 * gallery. Sample names are fictional (service-focus rule); amounts are display-only.
 */
export function ThemeSample({ theme }: { theme: ResolvedTheme }) {
  return (
    <div className={s.scene} aria-hidden="true">
      <OverlayThemeRoot theme={theme} className={s.layer}>
        <ul className={s.chat}>
          <li className={`${ov.card} ${s.chatLine}`}>
            <b className={ov.label}>도도쭈</b> 오늘 방송 레전드
          </li>
          <li className={`${ov.card} ${s.chatLine}`}>
            <b className={ov.label}>밤톨게임</b> 배틀 가자!
          </li>
        </ul>

        {theme.theme === "BOLD" ? (
          <div className={`${ov.accentCard} ${s.alert}`}>
            <span className={`${ov.chip} ${s.chip}`}>후원</span>
            <strong className={`${ov.display} ${s.amount}`}>
              10,000<small> FN</small>
            </strong>
            <span className={ov.label}>하루봄님, 고마워요!</span>
          </div>
        ) : theme.theme === "PILL" ? (
          <div className={`${ov.card} ${ov.pill} ${s.alertPill}`}>
            <span className={ov.avatar}>하</span>
            <span className={s.alertPillText}>
              <span className={ov.muted}>하루봄</span>
              <strong className={`${ov.display} ${s.amountPill}`}>
                10,000 <small className={ov.muted}>FN</small>
              </strong>
            </span>
            <span className={`${ov.muted} ${s.quote}`}>“오늘도 응원해요”</span>
          </div>
        ) : (
          <div className={`${ov.card} ${s.alertGlass}`}>
            <span className={s.glassHead}>
              <span className={ov.avatar}>하</span>
              <b className={ov.label}>하루봄</b>
              <span className={`${ov.chip} ${s.glassChip}`}>시그니처</span>
            </span>
            <strong className={`${ov.display} ${s.amountGlass}`}>10,000 FN</strong>
            <span className={ov.muted}>오늘도 응원해요</span>
          </div>
        )}

        <div className={s.goal}>
          <span className={`${ov.onStream} ${ov.label} ${s.goalHead}`}>
            <span>캠 장비 바꾸기</span>
            <span>72%</span>
          </span>
          <span className={`${ov.track} ${s.track}`}>
            <span className={ov.fill} style={{ width: "72%" }} />
          </span>
        </div>
      </OverlayThemeRoot>
    </div>
  );
}
