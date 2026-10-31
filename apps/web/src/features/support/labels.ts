import type { MessageKey } from "@/lib/i18n/translate";
import type { FaqCategory, InquiryStatus, NoticeCategory, SupportTab } from "@/services/support/supportTypes";

/** Message keys for the 고객센터 labels kept in services (tabs, categories, statuses), in the viewer's language (2026-11-01). */
export const SUPPORT_TAB_KEY: Record<SupportTab, MessageKey> = { notices: "support.tabNotices", faq: "support.tabFaq", inquiry: "support.tabInquiry" };

export const NOTICE_CATEGORY_KEY: Record<NoticeCategory, MessageKey> = { GENERAL: "support.noticeGeneral", UPDATE: "support.noticeUpdate", CHECK: "support.noticeCheck" };

export const FAQ_CATEGORY_KEY: Record<FaqCategory, MessageKey> = {
  ACCOUNT: "support.catAccount",
  CHARGE: "support.catCharge",
  DONATION: "support.catDonation",
  SETTLEMENT: "support.catSettlement",
  CREATOR: "support.catCreator",
  WIDGET: "support.catWidget",
  EVENT: "support.catEvent",
  COMMUNITY: "support.catCommunity",
  GENERAL: "support.catGeneral"
};

export const INQUIRY_STATUS_KEY: Record<InquiryStatus, MessageKey> = { RECEIVED: "support.statusReceived", ANSWERED: "support.statusAnswered" };
