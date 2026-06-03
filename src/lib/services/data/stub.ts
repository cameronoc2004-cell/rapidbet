// =============================================================================
// DataProvider — settle-grade sports results.
//
// Phase 1: not wired to a real feed yet. fetchOfficialResult() returns null,
// forcing the admin manual-settle path. balldontlie / MySportsFeeds is the
// recommended free Phase-1 plug; SLA-backed (Sportradar / DataFeeds) is
// REQUIRED before any real-money settle. The settle code guard explicitly
// refuses real-money settle when result.slaBacked is false.
//
// TODO(vendor): pick + wire. Until then, the admin form remains the official
// source of truth for free-to-play settle.
// =============================================================================

import type {
  DataProvider,
  DataProviderQuestionContext,
  OfficialResult,
} from "../types";

class StubDataProvider implements DataProvider {
  async fetchOfficialResult(_ctx: DataProviderQuestionContext): Promise<OfficialResult | null> {
    // Returning null tells the settle layer "no automated result available".
    // The admin form still works and is the only source of truth in Phase 1.
    return null;
  }
}

export const dataProvider: DataProvider = new StubDataProvider();
