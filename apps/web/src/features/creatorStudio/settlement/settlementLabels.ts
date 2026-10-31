import type { MessageKey } from "@/lib/i18n/translate";
import type { ManagePeriod, MemberType, ReviewStatus, SettlementStatus } from "@/services/creator/settlementTypes";

/**
 * Message keys for the settlement labels the services define (`settlementTypes`: statuses, member types, 기간 presets),
 * so the studio shows them in the viewer's language (2026-11-01). The Korean messages equal the services' labels.
 */
export const SETTLEMENT_STATUS_KEY: Record<SettlementStatus, MessageKey> = {
  PENDING: "studioSettlement.statePending",
  APPROVED: "studioSettlement.stateApproved",
  PAID: "studioSettlement.statePaid",
  REJECTED: "studioSettlement.stateRejected",
  FORFEITED: "studioSettlement.stateForfeited"
};

export const REVIEW_KEY: Record<ReviewStatus, MessageKey> = {
  NOT_SUBMITTED: "studioSettlement.reviewNotSubmitted",
  IN_REVIEW: "studioSettlement.reviewInReview",
  APPROVED: "studioSettlement.reviewApproved",
  REJECTED: "studioSettlement.reviewRejected"
};

/** `MEMBER_TYPES[].label` (이용동의, 정산 관리). */
export const MEMBER_TYPE_KEY: Record<MemberType, MessageKey> = {
  INDIVIDUAL: "studioSettlement.memberIndividual",
  FOREIGN_RESIDENT: "studioSettlement.memberForeignResident",
  SOLE_PROPRIETOR: "studioSettlement.memberSoleProprietor",
  CORPORATION: "studioSettlement.memberCorporation"
};

/** `MEMBER_TYPES[].formLabel` (정산 자료 등록 type tabs). */
export const MEMBER_TYPE_FORM_KEY: Record<MemberType, MessageKey> = {
  INDIVIDUAL: "studioSettlement.memberIndividualForm",
  FOREIGN_RESIDENT: "studioSettlement.memberForeignResidentForm",
  SOLE_PROPRIETOR: "studioSettlement.memberSoleProprietorForm",
  CORPORATION: "studioSettlement.memberCorporationForm"
};

export const MANAGE_PERIOD_KEY: Record<ManagePeriod, MessageKey> = {
  day: "studioSettlementApply.periodDay",
  week: "studioSettlementApply.periodWeek",
  month: "studioSettlementApply.periodMonth",
  year: "studioSettlementApply.periodYear",
  custom: "studioSettlementApply.periodCustom"
};
