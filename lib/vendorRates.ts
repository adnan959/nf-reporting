import { query } from "./db";

// Real vendor invoice rates, derived live from t_fin_vendor_purchase_items
// (actual rate_per_unit paid to meat vendors). This is the honest "what we pay
// today" baseline — distinct from Shopify retail in lib/retail.ts, which is what
// we SELL at. See docs/spec/procurement.md "Baseline modes".
//
// Finding from the data (2026-05): vendors invoice us for GENERIC "Mutton" at a
// single blended rate, not per cut. The only cut-level real rate is Fat. So the
// real baseline values every cut at the blended rate, with Fat as the one
// exception. We do NOT fabricate per-cut vendor rates the invoices don't contain.

export interface VendorRateInfo {
  blendedRate: number; // Rs/kg, generic mutton cuts, over the window (fallback: all-time, then constant)
  fatRate: number; // Rs/kg, mutton fat
  wholeRate: number; // Rs/kg, whole dressed mutton (reference for the in-house carcass cost)
  liveRate: number; // Rs/kg, live-weight goat (reference; sourced from Aqeeqa/Sadqa live purchases)
  sampleKg: number; // kg of generic-cut purchases the blended rate is built from
  sampleLines: number; // invoice line count behind the blended rate
  windowMatched: boolean; // true if blended rate is from the backtest window, false if it fell back to all-time
  rateDateMin: string | null;
  rateDateMax: string | null;
  source: string;
}

// Conservative fallbacks if the finance tables are unreachable or empty. Anchored
// on the observed 2025-26 invoice range so the page degrades honestly, not to zero.
export const FALLBACK_VENDOR_RATES = {
  mutton: { blended: 2450, fat: 500, whole: 2654, live: 1298 },
  cow: { blended: 1900, fat: 200, whole: 2100, live: 900 },
};

const MIN_LINES = 30; // below this in-window, fall back to all-time for a stabler blended rate

interface RateAgg {
  generic_rate: number | null;
  generic_kg: number | null;
  generic_lines: number | null;
  generic_min: string | null;
  generic_max: string | null;
  fat_rate: number | null;
  whole_rate: number | null;
  live_rate: number | null;
}

// Predicate fragments reused across the CASE expressions.
const IS_MUTTON = "(li.product_name LIKE '%mutton%' OR li.product_name LIKE '%bakra%')";
const IS_FAT = "(li.product_name LIKE '%fat%' OR li.product_name LIKE '%charbi%')";
const IS_LIVE = "li.product_name LIKE '%live%'";
const IS_WHOLE = "li.product_name LIKE '%whole%'";
const IS_QURBANI = "(li.product_name LIKE '%aqeeqa%' OR li.product_name LIKE '%sadqa%' OR li.product_name LIKE '%hissa%')";
// Generic cut = mutton, sold by kg, that is NOT fat, NOT whole carcass, NOT live animal, NOT charity.
const IS_GENERIC = `${IS_MUTTON} AND li.unit='kg' AND NOT ${IS_FAT} AND NOT ${IS_LIVE} AND NOT ${IS_WHOLE} AND NOT ${IS_QURBANI}`;

function wavg(field: "generic" | "fat" | "whole" | "live", predicate: string, dateClause = ""): string {
  return `SUM(CASE WHEN ${predicate}${dateClause} THEN li.line_total END) / NULLIF(SUM(CASE WHEN ${predicate}${dateClause} THEN li.quantity END),0) AS ${field}_rate`;
}

export async function buildVendorRates(dateMin: string, dateMax: string): Promise<VendorRateInfo> {
  const fb = FALLBACK_VENDOR_RATES.mutton;
  const win = ` AND DATE(li.created_at) BETWEEN '${dateMin}' AND '${dateMax}'`;

  try {
    // One pass: window-matched generic rate + its sample, plus all-time fat/whole/live anchors.
    const rows = await query<RateAgg>(
      `SELECT
         ${wavg("generic", IS_GENERIC, win)},
         SUM(CASE WHEN ${IS_GENERIC}${win} THEN li.quantity END) AS generic_kg,
         SUM(CASE WHEN ${IS_GENERIC}${win} THEN 1 END) AS generic_lines,
         MIN(CASE WHEN ${IS_GENERIC}${win} THEN DATE(li.created_at) END) AS generic_min,
         MAX(CASE WHEN ${IS_GENERIC}${win} THEN DATE(li.created_at) END) AS generic_max,
         ${wavg("fat", `${IS_MUTTON} AND li.unit='kg' AND ${IS_FAT}`)},
         ${wavg("whole", `${IS_MUTTON} AND li.unit='kg' AND ${IS_WHOLE} AND NOT ${IS_LIVE}`)},
         ${wavg("live", `${IS_LIVE} AND li.unit='kg' AND (li.product_name LIKE '%goat%' OR ${IS_MUTTON})`)}
       FROM t_fin_vendor_purchase_items li`,
    );
    const r = rows[0] ?? ({} as RateAgg);

    let blendedRate = Number(r.generic_rate) || 0;
    let sampleKg = Math.round(Number(r.generic_kg) || 0);
    let sampleLines = Number(r.generic_lines) || 0;
    let rateDateMin = r.generic_min;
    let rateDateMax = r.generic_max;
    let windowMatched = true;

    // Thin in-window sample → fall back to an all-time blended rate (more stable, less period-pure).
    if (sampleLines < MIN_LINES) {
      const allRows = await query<RateAgg>(
        `SELECT ${wavg("generic", IS_GENERIC)},
                SUM(CASE WHEN ${IS_GENERIC} THEN li.quantity END) AS generic_kg,
                SUM(CASE WHEN ${IS_GENERIC} THEN 1 END) AS generic_lines,
                MIN(CASE WHEN ${IS_GENERIC} THEN DATE(li.created_at) END) AS generic_min,
                MAX(CASE WHEN ${IS_GENERIC} THEN DATE(li.created_at) END) AS generic_max
         FROM t_fin_vendor_purchase_items li`,
      );
      const a = allRows[0] ?? ({} as RateAgg);
      if (Number(a.generic_rate)) {
        blendedRate = Number(a.generic_rate);
        sampleKg = Math.round(Number(a.generic_kg) || 0);
        sampleLines = Number(a.generic_lines) || 0;
        rateDateMin = a.generic_min;
        rateDateMax = a.generic_max;
        windowMatched = false;
      }
    }

    return {
      blendedRate: Math.round(blendedRate) || fb.blended,
      fatRate: Math.round(Number(r.fat_rate)) || fb.fat,
      wholeRate: Math.round(Number(r.whole_rate)) || fb.whole,
      liveRate: Math.round(Number(r.live_rate)) || fb.live,
      sampleKg,
      sampleLines,
      windowMatched,
      rateDateMin: rateDateMin ?? null,
      rateDateMax: rateDateMax ?? null,
      source: "t_fin_vendor_purchase_items",
    };
  } catch {
    // Finance tables unreachable: degrade to documented fallbacks, flagged as not window-matched.
    return {
      blendedRate: fb.blended, fatRate: fb.fat, wholeRate: fb.whole, liveRate: fb.live,
      sampleKg: 0, sampleLines: 0, windowMatched: false,
      rateDateMin: null, rateDateMax: null, source: "fallback (finance tables unreachable)",
    };
  }
}

// Resolve the real vendor invoice rate for a given cut. Fat is the one cut with
// its own invoice rate; everything else is bought as generic mutton at the blend.
export function vendorRateForCut(cutKey: string, info: VendorRateInfo): number {
  if (cutKey === "fat") return info.fatRate;
  return info.blendedRate;
}
