// =============================================================================
// GeoProvider — device-GPS location verification.
//
// Phase 1 (free-to-play): CensusGeoProvider reverse-geocodes the device's
// GPS coordinates via the US Census Geocoder (free, no key). The user
// HAS to grant browser geolocation; a self-reported state is not accepted.
//
// Phase 2 (real money): swap in GeoComply. Its SDK provides a signed
// attestation that the GPS was real (no VPN, no spoofing), which we forward
// to the server and verify here. // TODO(vendor): GeoComply
// =============================================================================

import { db } from "@/db/client";
import { geoChecks } from "@/db/schema";
import { PLAY_PERMITTED_STATES } from "@/lib/config";

export type GeoResult = "permitted" | "blocked" | "unknown";

export interface GeoCheckInput {
  userId: number;
  latitude: number;
  longitude: number;
}

export interface GeoCheckOutput {
  result: GeoResult;
  stateCode: string | null;
  vendor: string;
  vendorRef: string | null;
  geoCheckId: number;
  // Human-readable reason when result !== "permitted".
  blockReason?: "outside_permitted_state" | "non_us" | "lookup_failed";
}

export interface GeoProvider {
  check(input: GeoCheckInput): Promise<GeoCheckOutput>;
}

interface CensusGeographiesState {
  STUSAB?: string;
  NAME?: string;
}

interface CensusResponse {
  result?: {
    geographies?: {
      States?: CensusGeographiesState[];
    };
  };
}

class CensusGeoProvider implements GeoProvider {
  private readonly endpoint =
    "https://geocoding.geo.census.gov/geocoder/geographies/coordinates";

  async check({ userId, latitude, longitude }: GeoCheckInput): Promise<GeoCheckOutput> {
    let stateCode: string | null = null;
    let payload: Record<string, unknown> | null = null;
    let blockReason: GeoCheckOutput["blockReason"];

    try {
      const url =
        `${this.endpoint}?x=${encodeURIComponent(longitude)}` +
        `&y=${encodeURIComponent(latitude)}` +
        `&benchmark=Public_AR_Current&vintage=Current_Current&layers=States&format=json`;
      const res = await fetch(url, {
        signal: AbortSignal.timeout(7_000),
        // Census is public; no auth needed.
      });
      if (res.ok) {
        const json = (await res.json()) as CensusResponse;
        payload = json as unknown as Record<string, unknown>;
        const states = json.result?.geographies?.States ?? [];
        if (states.length > 0 && states[0].STUSAB) {
          stateCode = states[0].STUSAB.toUpperCase();
        } else {
          blockReason = "non_us";
        }
      } else {
        blockReason = "lookup_failed";
      }
    } catch (e) {
      blockReason = "lookup_failed";
      payload = { error: e instanceof Error ? e.message : String(e) };
    }

    const permitted =
      stateCode !== null && PLAY_PERMITTED_STATES.includes(stateCode);
    if (!permitted && !blockReason) blockReason = "outside_permitted_state";

    const result: GeoResult = permitted ? "permitted" : stateCode ? "blocked" : "unknown";

    const [row] = await db
      .insert(geoChecks)
      .values({
        userId,
        result,
        stateCode,
        vendor: "us_census",
        vendorRef: null,
        payload: {
          latitude,
          longitude,
          blockReason: blockReason ?? null,
          rawState: payload?.result ?? null,
        },
      })
      .returning();

    return {
      result,
      stateCode,
      vendor: row.vendor ?? "us_census",
      vendorRef: row.vendorRef,
      geoCheckId: row.id,
      blockReason: permitted ? undefined : blockReason,
    };
  }
}

export const geoProvider: GeoProvider = new CensusGeoProvider();
