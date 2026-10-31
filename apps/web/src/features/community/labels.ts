import type { MessageKey } from "@/lib/i18n/translate";
import type { BoardCategory } from "@/services/community/communityTypes";

/** 커뮤니티 분류 names (BOARD_CATEGORIES) in the viewer's language (2026-11-01). */
export const BOARD_CATEGORY_KEY: Record<BoardCategory, MessageKey> = {
  FREE: "community.catFree",
  TIP: "community.catTip",
  QNA: "community.catQna",
  BUG: "community.catBug",
  BRAG: "community.catBrag"
};
