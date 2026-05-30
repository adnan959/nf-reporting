import { query } from "./db";
import { mapSku, allocate } from "./skuMap";
import { cutsFor } from "./cuts";
import { RETAIL_RATES } from "./retail";
import type { Animal } from "./types";

// Generalised demand builder for the procurement backtest. Works for any animal
// by swapping the cut anatomy (cutsFor), retail rates, and the order-line name
// filter. Mutton and cow share this code path so a fix to one helps both.

// Dressed-carcass weight used only for display fields (carcassEquivalents and the
// per-cut kgPerCarcass shown in the yields modal). The live comparison recomputes
// carcass kg from the editable live-weight × dressing sliders, so this is cosmetic.
export const DRESSED_CARCASS_KG: Record<Animal, number> = { mutton: 14, cow: 125, chicken: 1.2 };

// Order line-item name patterns per animal (Bakra = whole/half mutton; veal = young
// cow, the dominant cow product here). Qurbani/charity lines are excluded downstream
// by mapSku regardless of these patterns.
const NAME_LIKE: Record<Animal, string[]> = {
  mutton: ["%Mutton%", "%Bakra%"],
  cow: ["%beef%", "%veal%", "%cow%"],
  chicken: ["%chicken%", "%murgh%"],
};

export interface AnimalCut {
  key: string;
  label: string;
  yieldPct: number;
  kgPerCarcass: number; // dressedCarcassKg × yield%
  soldKg: number; // real demand over the window
  retail: number; // PKR/kg — Shopify storefront selling price
}

export interface AnimalData {
  animal: Animal;
  windowDays: number;
  dateMin: string;
  dateMax: string;
  daysWithOrders: number;
  cuts: AnimalCut[];
  totalSoldKg: number;
  carcassEquivalents: number; // totalSoldKg / dressedCarcassKg
  perDay: { date: string; kg: number }[];
  qurbaniExcludedKg: number;
  qurbaniExcludedLines: number;
  unmapped: { name: string; kg: number; reason: string }[];
}

function addDays(iso: string, n: number): string {
  const d = new Date(iso + "T00:00:00Z");
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

export async function buildAnimalData(animal: Animal, days = 90): Promise<AnimalData> {
  const cutsDef = cutsFor(animal);
  const cutKeys = new Set(cutsDef.map((c) => c.key));
  const dressedCarcassKg = DRESSED_CARCASS_KG[animal];
  const rates = RETAIL_RATES[animal];

  const maxRows = await query<{ mx: string }>("SELECT DATE(MAX(order_date)) mx FROM v_crm_all_orders");
  const dateMax = String(maxRows[0].mx);
  const dateMin = addDays(dateMax, -(days - 1));

  const likeClause = NAME_LIKE[animal].map(() => "li.name LIKE ?").join(" OR ");
  const rows = await query<{ name: string; d: string; kg: string | number; n_lines: number }>(
    `SELECT li.name, DATE(o.order_date) d, ROUND(SUM(li.quantity),3) kg, COUNT(*) n_lines
     FROM v_crm_all_orders o JOIN v_crm_all_order_line_items li ON li.order_id=o.id AND li.source_type=o.source_type
     WHERE o.order_status<>'cancelled'
       AND (${likeClause})
       AND DATE(o.order_date) BETWEEN ? AND ?
     GROUP BY li.name, d`,
    [...NAME_LIKE[animal], dateMin, dateMax],
  );

  const soldByCut: Record<string, number> = {};
  const perDayMap: Record<string, number> = {};
  const unmappedAgg = new Map<string, { kg: number; reason: string }>();
  let qurbaniExcludedKg = 0, qurbaniExcludedLines = 0;

  const addUnmapped = (name: string, kg: number, reason: string) => {
    const u = unmappedAgg.get(name) ?? { kg: 0, reason };
    u.kg += kg; unmappedAgg.set(name, u);
  };

  for (const r of rows) {
    const name = String(r.name);
    const kg = Number(r.kg);
    const date = String(r.d);
    const m = mapSku(name);

    if (m.animal === "qurbani") { qurbaniExcludedKg += kg; qurbaniExcludedLines += Number(r.n_lines); continue; }
    if (m.animal !== animal) continue; // wrong species (or "other") slipped the LIKE
    if (m.unit !== "kg" || !m.cutKey) {
      addUnmapped(name, kg, m.unit !== "kg" ? "sold per piece" : "no cut mapping");
      continue;
    }
    for (const { cutKey, kg: akg } of allocate(m, kg)) {
      if (cutKey === "__whole") {
        for (const c of cutsDef) soldByCut[c.key] = (soldByCut[c.key] ?? 0) + akg * (c.yieldPct / 100);
      } else if (cutKeys.has(cutKey)) {
        soldByCut[cutKey] = (soldByCut[cutKey] ?? 0) + akg;
      } else {
        // skuMap produced a cut this animal's carcass model doesn't carry — surface it,
        // never silently drop it (keeps totals honest; head-of-data principle).
        addUnmapped(name, akg, `cut "${cutKey}" not in ${animal} carcass model`);
        continue;
      }
      perDayMap[date] = (perDayMap[date] ?? 0) + akg;
    }
  }

  const cuts: AnimalCut[] = cutsDef.map((c) => ({
    key: c.key, label: c.label, yieldPct: c.yieldPct,
    kgPerCarcass: dressedCarcassKg * (c.yieldPct / 100),
    soldKg: Math.round((soldByCut[c.key] ?? 0) * 10) / 10,
    retail: rates[c.key] ?? 0,
  }));

  const totalSoldKg = cuts.reduce((s, c) => s + c.soldKg, 0);

  const perDay: { date: string; kg: number }[] = [];
  for (let i = 0; i < days; i++) {
    const date = addDays(dateMin, i);
    perDay.push({ date, kg: Math.round((perDayMap[date] ?? 0) * 10) / 10 });
  }

  return {
    animal, windowDays: days, dateMin, dateMax,
    daysWithOrders: Object.keys(perDayMap).length,
    cuts, totalSoldKg: Math.round(totalSoldKg),
    carcassEquivalents: totalSoldKg / dressedCarcassKg,
    perDay, qurbaniExcludedKg: Math.round(qurbaniExcludedKg), qurbaniExcludedLines,
    unmapped: Array.from(unmappedAgg.entries())
      .map(([name, v]) => ({ name, kg: Math.round(v.kg * 10) / 10, reason: v.reason }))
      .sort((a, b) => b.kg - a.kg),
  };
}
