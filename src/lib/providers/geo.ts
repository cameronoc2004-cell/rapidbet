// =============================================================================
// GeoProvider — device-GPS location verification before any REAL-MONEY entry.
//
// Phase 1 (free-to-play): StubGeoProvider returns "permitted" so the wiring is
// exercised end-to-end and every entry records a geo_checks row.
// Phase 2 (real money): swap in GeoComply (or equivalent). The check uses
// DEVICE GPS, not IP, not account address. PERMITTED_STATES gates the result.
// TODO(vendor): GeoComply SDK + server-side token verification.
// =============================================================================

import { db } from "@/db/client";
import { geoChecks } from "@/db/schema";
import { PERMITTED_STATES } from "@/lib/config";

export type GeoResult = "permitted" | "blocked" | "unknown";

export interface GeoCheckInput {
  userId: number;
  // In production this is a signed device-GPS attestation from the SDK.
  // For Phase 1 we accept a hint that the client claims a state.
  claimedStateCode?: string;
}

export interface GeoCheckOutput {
  result: GeoResult;
  stateCode: string | null;
  vendor: string;
  vendorRef: string | null;
  geoCheckId: number;
}

export interface GeoProvider {
  check(input: GeoCheckInput): Promise<GeoCheckOutput>;
}

// Phase 1 default. Records every attempt so audit history exists from day one.
class StubGeoProvider implements GeoProvider {
  async check({ userId, claimedStateCode }: GeoCheckInput): Promise<GeoCheckOutput> {
    const state = (claimedStateCode ?? "").toUpperCase();
    // In free-to-play we always permit; in real-money mode we require the
    // state to be on the allow-list.
    const permittedInRealMoney = state.length === 2 && PERMITTED_STATES.includes(state);

    const [row] = await db
      .insert(geoChecks)
      .values({
        userId,
        result: permittedInRealMoney ? "permitted" : (state ? "blocked" : "unknown"),
        stateCode: state || null,
        vendor: "stub",
        vendorRef: null,
        payload: { phase: 1, note: "stub provider — real-money path blocked" },
      })
      .returning();

    return {
      result: row.result as GeoResult,
      stateCode: row.stateCode,
      vendor: row.vendor ?? "stub",
      vendorRef: row.vendorRef,
      geoCheckId: row.id,
    };
  }
}

export const geoProvider: GeoProvider = new StubGeoProvider();
