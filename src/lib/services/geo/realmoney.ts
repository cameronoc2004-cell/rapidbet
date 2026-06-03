// =============================================================================
// Real-money geo gate — distinct from the Census state-verification used at
// onboarding for free play. This one runs PER REAL-MONEY ACTION (deposit,
// entry, withdrawal) and MUST use a vendor that provides anti-spoof signals.
//
// Defaults to BLOCKED. Wire MaxMind / Radar / GeoComply once chosen by legal.
// TODO(legal + vendor)
// =============================================================================

import type { RealMoneyGeoProvider } from "../types";

class BlockedRealMoneyGeoProvider implements RealMoneyGeoProvider {
  async check(): Promise<{ result: "blocked"; reason: string }> {
    return {
      result: "blocked",
      reason: "real_money_geo_provider_not_configured",
    };
  }
}

export const realMoneyGeoProvider: RealMoneyGeoProvider = new BlockedRealMoneyGeoProvider();
