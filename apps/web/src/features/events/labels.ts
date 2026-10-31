import type { MessageKey } from "@/lib/i18n/translate";
import type { EventFilter, EventPhase } from "@/services/events/eventTypes";

/** 이벤트 filter and phase names (EVENT_FILTERS · PHASE_LABEL) in the viewer's language (2026-11-01). */
export const FILTER_KEY: Record<EventFilter, MessageKey> = { all: "events.all", ongoing: "events.ongoing", upcoming: "events.upcoming", ended: "events.ended", mine: "events.mine" };

export const PHASE_KEY: Record<EventPhase, MessageKey> = { ongoing: "events.ongoing", upcoming: "events.upcoming", ended: "events.ended" };
