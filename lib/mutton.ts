import { query } from "./db";
import { mapSku, allocate } from "./skuMap";
import { CUTS_MUTTON } from "./cuts";
import { RETAIL_RATES } from "./retail";

export const DRESSED_CARCASS_KG = 14; // dressed mutton carcass

export interface MuttonCut {
  key: string;
  label: string;
  yieldPct: number;
  kgPerMutton: number; // 14 * yield%
  soldKg: number; // real demand over the window
  retail: number; // PKR/kg
}

export interface MuttonData {
  windowDays: number;
  dateMin: string;
  dateMax: string;
  daysWithOrders: number;
  cuts: MuttonCut[];
  totalSoldKg: number;
  muttonEquivalents: number; // totalSoldKg / 14
  perDay: { date: string; kg: number }[]; // one entry per calendar day in the window
  qurbaniExcludedKg: number;
  qurbaniExcludedLines: number;
  unmapped: { name: string; kg: number; reason: string }[];
}

function addDays(iso: string, n: number): string {
  const d = new Date(iso + "T00:00:00Z");
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

export async function buildMuttonData(days = 90): Promise<MuttonData> {
  const maxRows = await query<any>("SELECT DATE(MAX(order_date)) mx FROM v_crm_all_orders");
  const dateMax = String(maxRows[0].mx);
  const dateMin = addDays(dateMax, -(days - 1));

  // Pull mutton line items (Mutton = mutton; Bakra catches whole/half mutton + Qurbani mutton).
  const rows = await query<any>(
    `SELECT li.name, DATE(o.order_date) d, ROUND(SUM(li.quantity),3) kg, COUNT(*) n_lines
     FROM v_crm_all_orders o JOIN v_crm_all_order_line_items li ON li.order_id=o.id AND li.source_type=o.source_type
     WHERE o.order_status<>'cancelled'
       AND (li.name LIKE '%Mutton%' OR li.name LIKE '%Bakra%')
       AND DATE(o.order_date) BETWEEN ? AND ?
     GROUP BY li.name, d`,
    [dateMin, dateMax],
  );

  const soldByCut: Record<string, number> = {};
  const perDayMap: Record<string, number> = {};
  const unmappedAgg = new Map<string, { kg: number; reason: string }>();
  let qurbaniExcludedKg = 0, qurbaniExcludedLines = 0;

  const yields: Record<string, number> = {};
  for (const c of CUTS_MUTTON) yields[c.key] = c.yieldPct;

  for (const r of rows) {
    const name = String(r.name);
    const kg = Number(r.kg);
    const date = String(r.d);
    const m = mapSku(name);

    if (m.animal === "qurbani") { qurbaniExcludedKg += kg; qurbaniExcludedLines += Number(r.n_lines); continue; }
    if (m.animal !== "mutton") continue; // safety: anything non-mutton that slipped the LIKE
    if (m.unit !== "kg" || !m.cutKey) {
      const u = unmappedAgg.get(name) ?? { kg: 0, reason: m.unit !== "kg" ? "sold per piece" : "no cut mapping" };
      u.kg += kg; unmappedAgg.set(name, u);
      continue;
    }
    for (const { cutKey, kg: akg } of allocate(m, kg)) {
      if (cutKey === "__whole") {
        for (const c of CUTS_MUTTON) soldByCut[c.key] = (soldByCut[c.key] ?? 0) + akg * (c.yieldPct / 100);
      } else {
        soldByCut[cutKey] = (soldByCut[cutKey] ?? 0) + akg;
      }
      perDayMap[date] = (perDayMap[date] ?? 0) + akg;
    }
  }

  const cuts: MuttonCut[] = CUTS_MUTTON.map((c) => ({
    key: c.key, label: c.label, yieldPct: c.yieldPct,
    kgPerMutton: DRESSED_CARCASS_KG * (c.yieldPct / 100),
    soldKg: Math.round((soldByCut[c.key] ?? 0) * 10) / 10,
    retail: RETAIL_RATES.mutton[c.key] ?? 0,
  }));

  const totalSoldKg = cuts.reduce((s, c) => s + c.soldKg, 0);

  // 90 contiguous calendar days for the strip (0 kg where no mutton demand).
  const perDay: { date: string; kg: number }[] = [];
  for (let i = 0; i < days; i++) {
    const date = addDays(dateMin, i);
    perDay.push({ date, kg: Math.round((perDayMap[date] ?? 0) * 10) / 10 });
  }

  return {
    windowDays: days, dateMin, dateMax,
    daysWithOrders: Object.keys(perDayMap).length,
    cuts, totalSoldKg: Math.round(totalSoldKg),
    muttonEquivalents: totalSoldKg / DRESSED_CARCASS_KG,
    perDay, qurbaniExcludedKg: Math.round(qurbaniExcludedKg), qurbaniExcludedLines,
    unmapped: Array.from(unmappedAgg.entries())
      .map(([name, v]) => ({ name, kg: Math.round(v.kg * 10) / 10, reason: v.reason }))
      .sort((a, b) => b.kg - a.kg),
  };
}
