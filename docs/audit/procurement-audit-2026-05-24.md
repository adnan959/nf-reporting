# Procurement Optimiser — Numbers Audit

**Date:** 2026-05-24
**Auditor:** automated trace + live sensitivity testing
**Scope:** every visible number on the single-page tool (`Today vs in-house slaughter`), traced to its formula and source data.
**Default state audited:** Mutton · 180-day window · markup 10% · whole-mutton cost Rs 35,000 · zero recovery · zero routing.

**Headline result:** No calculation errors were found. Every visible figure reconciles to its formula and to the data pipeline. The findings below are *baked-in assumptions* (defensible but worth disclosing) and a handful of UI/spec mismatches, not arithmetic bugs. One small precision caveat (per-cut Saving under yield-drift) is documented and is consistent with the tool's existing drift warning.

---

## 1. Source data pipeline (`lib/mutton.ts`, `lib/skuMap.ts`)

| Step | Logic | Verified |
|---|---|---|
| Window | `dateMax = DATE(MAX(order_date))` from `v_crm_all_orders`; `dateMin = dateMax − (days−1)`. Span back to 2021-02-01 (35,814 orders) so 90/180 are fully covered. | ✅ |
| Line pull | `o.order_status <> 'cancelled'` **AND** (`li.name LIKE '%Mutton%' OR '%Bakra%'`) **AND** `DATE(order_date) BETWEEN dateMin AND dateMax`. Grouped by `(li.name, date)`. | ✅ |
| Classification | each line → `mapSku()`. `animal==="qurbani"` → excluded (counted). `animal!=="mutton"` → skipped. `unit!=="kg"` or no `cutKey` → unmapped (counted). | ✅ |
| Allocation | `allocate()`: combo SKUs split equally across matched cuts; `__whole` (whole/half bakra) explodes into **all** cuts by `yieldPct`. | ✅ |
| `soldKg` per cut | Σ allocated kg, rounded 1 dp. | ✅ |
| `totalSoldKg` | Σ `cut.soldKg`. (180d = 6,486.5 kg.) | ✅ |
| `perDay[i].kg` | Σ allocated kg on that calendar day; one entry per day in window (0 where none). | ✅ |
| `daysWithOrders` | count of distinct days with **mapped mutton kg** (`perDayMap` keys). 180d → 168 (after Qurbani/per-piece exclusions). | ✅ |

---

## 2. Left column — "Buying from vendors" (today / baseline)

| Number | Formula (code) | Verified |
|---|---|---|
| Hero "vendor spend" | `today90 = Σ (demand × butcherPrice)` where `butcherPrice = retail × (1 + markup%)` | ✅ |
| Per-cut **Cost** | `demand × retail × (1 + eff%)`, `eff = override ?? globalMarkup` | ✅ reconciles to total |
| **Share %** | `demand / Σdemand × 100` | ✅ |
| **Demand (kg)** | `cut.soldKg` (MySQL, Qurbani-excluded) | ✅ |

## 3. Right column — "Slaughtering in-house" (alternative)

Let `carcassUnitCost = live / carcassKg` (whole-animal cost spread evenly per kg of yield).

| Number | Formula (code) | Verified |
|---|---|---|
| `carcassKg` | `liveWeight × dressingPct / 100` (30 × 47% = 14.1 kg) | ✅ |
| `N` (carcass-equivalents) | `totalDemandKg / carcassKg` (6,486.5 / 14.1 = 460) | ✅ |
| **Yield (kg)** | `N × carcassKg × (yield% / 100)` = `N × kgPerMutton` | ✅ (Karahi 18%→20% raised yield 1168→1297 = +14.1×0.02×460 ≈ 130 kg) |
| **Sold** bar | green `min(demand, yield)`, amber `leftover`, red `shortfall` (proportions of throughput) | ✅ |
| **Short kg** | `max(0, demand − yield) − routedIn` | ✅ |
| **Short Rs** | `shortKg × butcherPrice` | ✅ |
| **Unsold kg** | `max(0, yield − demand) − routedOut` | ✅ |
| **Unsold Rs** | `unsoldKg × retail` (no markup — it's your own meat) | ✅ |
| **Can sell** → recovery | `recovery = min(canSellKg, effectiveLeftover) × retail` (capped at post-routing leftover) | ✅ cap verified |
| **Saving** (per cut) | `todaySpend − (yield×carcassUnitCost + shortCost − recovery + routedIn×conversion)` | ✅ sums to headline at 100% yield (see §6) |

## 4. Bottom totals (cost stack)

| Line | Formula | Verified |
|---|---|---|
| Whole mutton | `N × live` (460 × 35,000 = Rs 16,100K) | ✅ |
| + Shortfall from vendors | `Σ shortKg × butcherPrice` | ✅ |
| − Leftover sold | `Σ min(canSell, leftover) × retail` | ✅ |
| + Routing conversion *(shown only when routing > 0)* | `totalRoutedKg × conversionCost` | ✅ |
| = Net cost | `gross + shortfall − recovery + conversion` | ✅ |

## 5. Headline & day strip

| Number | Formula | Verified |
|---|---|---|
| Saving badge Rs | `diff90 = today90 − inhouse90` | ✅ manual recompute matches |
| Saving badge % | `diff90 / today90 × 100` | ✅ |
| Day strip squares | one per day in window = `windowDays` (180 default, 90 when toggled) | ✅ count = 180 |
| Green threshold | `dayDemand ≥ 0.75 × carcassKg` (≥ 10.6 kg at 14.1 carcass) | ✅ |
| Square tooltip | date / `kg` demand / `kg/carcassKg` mutton needed / decision | ✅ all 4 lines |

## 6. Routing modal (Deliverable 1)

| Number | Formula | Verified |
|---|---|---|
| **Max kg** (per route) | `min(remaining source leftover, remaining dest shortfall)` — routes walked **in order** so several routes into one destination can't over-fill it | ✅ no double-count |
| **Apply** | user input, displayed value clamped to Max (silently) | ✅ |
| **Net saving** (per route) | `kg × (destination butcherPrice − conversionCost)` — raw cut is sunk in animal cost, so only the avoided vendor purchase minus conversion counts | ✅ |
| **Total routing saving** | Σ per-route net saving | ✅ |
| Headline effect | routing reduces destination Short and source Unsold; conversion added to net cost; `Σ saving` rises by exactly the total routing saving | ✅ |

**Double-count check (the part the spec flagged):** routing kg of shoulder→mince does **not** add a separate "leftover recovered" term. The shoulder was already paid for inside `N × live`, so its raw-material value is sunk. Routing only (a) avoids buying mince from a vendor (`+kg × butcherPrice_dest`) and (b) costs conversion (`−kg × conversion`). The source's `canSell` recovery is capped at *post-routing* leftover, so the same kg can never be both routed and resold. Verified: applying 100 kg shoulder→mince at 180d/10%/Rs 50 gave net saving **Rs 261K** = 100 × (2420×1.10 − 50) = 261,200, and the headline diff moved Rs 3,980K → Rs 4,242K (Δ Rs 262K, rounding). "Clear all" returned the page to **exactly** Rs 3,980K.

---

## 7. Discrepancies found & fixes

No arithmetic errors required a code fix. Items surfaced:

1. **Per-cut Saving vs yield-drift (precision caveat, not a bug).** The per-cut carcass-cost allocation `Σ(yield × carcassUnitCost)` equals the whole-animal cost `gross90` **only when the editable yields sum to 100%**. If a user edits yields so they drift off 100%, the per-row Saving figures no longer sum to the headline `diff90` (shown in the Saving total cell). This is consistent with — and already covered by — the existing amber drift warning ("…shortfall and leftover totals will not match"). At the 100% default it ties out exactly. *No fix applied; documented as intended behaviour.*

2. **Spec checklist items that don't exist in the current UI** (removed in earlier simplifications, not defects):
   - *Annualised saving* (`saving × 365/window`) is **not displayed**. The tool shows only the in-window saving. If reinstated, it would be `diff90 × 365 / windowDays`.
   - *Day-strip count "= 90"* in the spec predates the 90/180 toggle; the count is now `windowDays` (180 by default).

3. **Markup-in-the-"today"-figure (design choice, disclosed).** "Today vendor spend" applies the markup slider on top of Shopify retail (`retail × (1+markup)`). This is intentional so the slider is live, but it means the baseline is *retail-derived*, not real vendor-invoice cost (see Remaining Risks).

---

## 8. Baked-in assumptions not visible to the user

- **Qurbani / charity exclusion regex** (`lib/skuMap.ts`): a line is dropped as "qurbani" when its lower-cased name matches `/qurbani|hissa|cow share|aqeeqa|sadqa/`. (Also excluded upstream: `/chicken/`, `/\blamb\b/`, and dog-food patterns.) The footer's "Qurbani excluded: X kg / Y lines" counts only the first regex.
- **Whole/half bakra explosion:** SKUs flagged `__whole` (codes HB/WB or "whole/half bakra") are assumed to consume the **standard cut distribution** — their kg is spread across every cut by `yieldPct`. A whole-carcass buyer who only wants specific cuts would distort this.
- **Per-kg carcass cost is uniform** (`live / carcassKg`). This spreads the whole-animal price evenly over every kg of yield, which **flatters premium cuts** (raan, karahi) and **penalises cheap cuts** (bones, offal) in the per-cut Saving column. It does not affect the headline total.
- **`daysWithOrders`** counts days with *mapped mutton kg* only; a day whose only mutton lines were Qurbani or per-piece won't count.
- **Retail prices** (`lib/retail.ts`) are a static snapshot from the Shopify storefront, with a few hand-sanitised outliers; they are **not** live.
- **Routing rules** are 5 hardcoded butchery-sensible defaults; "Fat → Mince" auto-disables because Fat is itself over-demanded (no excess) in this data.

---

## 9. Sensitivity checks (live, before → after)

Baseline = 180-day, markup 10%, cost Rs 35,000 → today **Rs 23,144K**, saving **−17% / Rs 3,980K**.

| # | Change | Expected | Actual | ✓ |
|---|---|---|---|---|
| 1 | Markup **5%** | lower vendor spend, smaller saving | today Rs 22,092K, saving **Rs 3,068K** (−14%) | ✅ |
| 1b | Markup **20%** | higher spend, bigger saving | today Rs 25,248K, saving **Rs 5,806K** (−23%) | ✅ exact (linear in markup) |
| 1c | Markup **0%** *(below 5% slider floor — predicted)* | smallest saving | predicted **≈ Rs 2,156K** (extrapolating the verified linear fit) | ⚠️ not reachable in UI |
| 2 | Cost **Rs 20,000** | in-house drops, saving grows | saving **Rs 10,881K** (−47%) = +460×(35k−20k) = +Rs 6,900K | ✅ exact |
| 2b | Cost **Rs 45,000** | saving shrinks/negative | saving **+Rs 620K** (in-house dearer) = −460×(45k−35k) = −Rs 4,600K | ✅ exact |
| 2c | Cost **Rs 50,000** *(above 45k slider cap — predicted)* | clearly negative | predicted **≈ −Rs 2,920K** (= Rs 3,980K − 460×15k) | ⚠️ not reachable in UI |
| 3 | Route **100 kg** shoulder→mince | saving +≈(mince vendor price − conversion)×100 | net **Rs 261K**; headline Rs 3,980K → Rs 4,242K | ✅ exact |

> Note: the spec's exact test values for markup 0% and cost Rs 50,000 now sit outside the deliberately-narrowed control ranges (markup 5–20%, cost 20–45k). Their predicted results are given from the verified linear relationships and can be reproduced by widening the slider bounds.

---

## 10. Remaining risks (hard to verify without external data)

1. **Retail prices carry Shopify errors forward.** Every Cost, Short Rs, Unsold Rs, recovery and routing net-saving is anchored on `lib/retail.ts`. If a SKU is mispriced in Shopify, the model inherits that error. These are a snapshot, not live.
2. **The "today" baseline is generous.** It values vendor purchases at retail × markup, which is **above** real vendor-invoice mutton (~Rs 2,400–2,590/kg historically). The *direction* of the saving is robust, but the *absolute* number is optimistic. A real-vendor-cost baseline would shrink it. (Swappable — offered previously.)
3. **Whole-animal price (Rs 35k default) is an input, not measured.** The single most leveraged number; the cost sensitivity (#2) shows the saving flips negative around Rs ~43k. The founder must validate the true all-in cost.
4. **Carcass yields are standard Pakistani defaults**, editable but not yet validated against Nizami's own processing. ±2–3% per cut is plausible; the day-strip threshold and every yield-kg figure move with them.
5. **Cut classification depends on SKU naming.** `mapSku` relies on code patterns (LR, MQ…) and keyword fallbacks; a renamed or novel SKU could be mis-bucketed or dropped to "unmapped" (surfaced in the footer for transparency).
6. **Routing feasibility is operational, not financial.** The model assumes any leftover kg up to the cap can be ground/blended into the destination cut at a flat conversion cost; real yield loss in grinding/deboning is not modelled.

---

*End of audit. All figures above were re-derived from `lib/mutton.ts`, `lib/skuMap.ts`, `lib/cuts.ts`, `lib/retail.ts`, `lib/format.ts` and the `calc` memo in `components/MuttonTool.tsx`, and cross-checked live in the running app.*
