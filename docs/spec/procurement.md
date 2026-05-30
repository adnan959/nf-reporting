# Procurement tool — spec

## Purpose

The Procurement tool answers a single operational question: **across the last 90 days of real customer orders, would slaughtering whole mutton in-house have been cheaper than buying cuts from vendors?**

It is a backtest against actual MySQL order data, not a forecast. The output is intended to inform a strategic conversation between the founder (Adnan) and his partner (Taimur) about whether to vertically integrate mutton procurement.

The tool is mutton-only. Cow and chicken tabs exist as placeholders ("SOON") but are not built. Qurbani days are excluded because festival demand spikes would distort the steady-state model.

## Page structure

Top to bottom:

1. Header — title, subtitle, metadata pills (date range, total demand kg, carcass-equivalents, scope).
2. Species selector (Mutton active, Cow/Chicken SOON) + 90-day window selector (disabled, clearly labelled as fixed for now).
3. Two-column comparison:
   - **Left (Today: Buying from vendors).** Vendor markup slider (5-20%, default 10%) with cog-icon Markups override modal. Big number: 90-day vendor spend. Sub-label: kg of cuts sold. Table of all cuts ranked by demand: Cut | Share % | Demand kg | Cost.
   - **Right (Slaughtering in-house).** Whole mutton all-in cost slider (default Rs 35-40k). Cog-icon Yields override modal. Cog-icon Routing modal. Big number: 90-day net cost + saving/loss % badge. Sub-label: kg of cuts sold. Table of all cuts ranked by demand: Cut | Share % | Yield kg | Sold (stacked bar) | Demand kg | Short (kg + Rs) | Unsold (kg + Rs) | Can sell (editable input) | Saving (Rs).
4. Cost stack below the in-house table: Whole mutton (N × Rs X) + Shortfall from vendors − Leftover sold (your input) − Routed savings = Net cost.
5. "Where the money moves" narrative paragraph reconciling every rupee.
6. "How the 90 days actually played out" — day strip of 90 squares, green if daily demand justified slaughter (≥75% of dressed carcass kg), amber otherwise. Hover tooltip per square shows date, kg demand, goats needed, decision.
7. Methodology and data — bullet list at the bottom: window, Qurbani excluded count, unmapped SKUs, fat treatment.

## Architecture note (2026-05-30)

The tool was generalised when the Cow tab was added, so mutton and cow share one code path. Demand is built by `buildAnimalData(animal, days)` in lib/animalData.ts (replacing the old mutton-only lib/mutton.ts); per-animal UI defaults/routing/copy live in `lib/animalConfig.ts`; the component is `components/ProcurementTool.tsx` (parent `ProcurementTool` owns the species switch, `AnimalView` is the parameterised per-animal view). The mutton model, math, and defaults are unchanged by the refactor. See docs/spec/cow.md.

## Data sources

- **MySQL operational database** (app.nizamifarms.com). Read-only access via lib/db.ts. Connection details in environment variables.
- **Order lines table** filtered to the window, per-species (mutton: `%Mutton%`/`%Bakra%`), excluding Qurbani patterns (regex match on /qurbani|aqeeqa|sadqa/ in SKU name or order line metadata).
- **SKU-to-cut mapping** in lib/skuMap.ts. Maps raw Shopify SKU names to canonical cut categories (Karahi cut, Raan / Leg, Puth / Shoulder, etc.). Per-piece SKUs (Brain, Lungs, certain Chest cuts) are excluded from the kg model and noted in the methodology footer.
- **Carcass yield table** in lib/cuts.ts. Canonical yield % per cut for a balanced mutton carcass at the default 30 kg live weight × 47% dressing yield = 14.1 kg dressed.
- **Retail prices** in lib/retail.ts. Pulled from the Shopify storefront. Note: these are higher than real vendor invoice rates (mutton retail ~Rs 2,950-4,860/kg vs vendor invoices ~Rs 2,400-2,590/kg). This is a known caveat affecting the headline saving.

## Key formulas

**Vendor spend (left column total):**
```
vendor_spend = Σ (cut_demand_kg × retail_price × (1 + markup%))
```
Per-cut Cost is the same formula applied per cut. Share % is cut_demand_kg / total_demand_kg.

**In-house yield per cut:**
```
yield_kg = goats_count × cut_yield_kg_per_goat
```
Where `goats_count` is derived to satisfy total demand at the dominant cut's yield, and `cut_yield_kg_per_goat = dressed_carcass_kg × (cut_yield_% / 100)`.

**Per-cut economics:**
```
sold = min(demand, yield)
short_kg = max(0, demand - yield)
short_Rs = short_kg × retail_price × (1 + markup%)
unsold_kg = max(0, yield - demand)
unsold_Rs = unsold_kg × retail_price
recovery_Rs = min(can_sell_kg, unsold_kg) × retail_price
```

**Routing net saving (per route, per cut):**
```
net_saving = kg_routed × (destination_butcher_price - conversion_cost_per_kg)
```
Where destination_butcher_price = retail_price × (1 + markup%) of the destination cut, and conversion_cost is global (default Rs 50/kg). Source cut is treated as "free" raw material because it was already paid for in the whole-animal cost.

**In-house net cost (right column total):**
```
net_cost = (goats_count × all_in_mutton_price)
         + Σ (short_kg × retail_price × (1 + markup%))      // shortfall buy
         - Σ (can_sell_kg × retail_price)                   // leftover sold
         - Σ (kg_routed × (destination_butcher_price - conversion_cost))  // routing
```

**Per-cut saving (displayed in the Saving column):**
```
per_cut_saving = today_cost_for_this_cut - inhouse_cost_for_this_cut
```
Where today_cost is the left column's per-cut Cost, and inhouse_cost is the share of the whole-animal cost attributable to that cut plus any shortfall buy minus any recovery for that cut.

**Headline saving:**
```
saving = vendor_spend - net_cost
saving_% = saving / vendor_spend × 100
annualised_saving = saving × (365 / 90)
```

## Assumptions and defaults

- Vendor markup: default 10%, range 5-20%. The single most load-bearing assumption — unverified against real invoices.
- Whole mutton all-in cost: default Rs 35-40k. Includes purchase + raising + slaughter + transport.
- Conversion cost (for routing): default Rs 50/kg. Covers labour, grinding, repackaging.
- Live weight: default 30 kg. Editable in Yields modal.
- Dressing yield: default 47%. Editable in Yields modal.
- Dressed carcass: 30 × 47% = 14.1 kg. Derived, not measured.
- Per-cut yield defaults: industry-standard Pakistani mutton butchery yields, ±2-3% variance. Listed in lib/cuts.ts and editable in the Yields modal. All defaults sum to exactly 100%.
- Leftover recovery: default zero. The honest waste assumption. User enters per-cut sellable kg interactively to reveal upside.
- Operational overhead (livestock buyer, processing staff, wholesale relationships): estimated Rs 1.5M/year. Subtracted from the annualised saving in the headline projection. This estimate is hand-wavy and should be refined.

## Decisions made

- **2026-05-23** · Single-page rebuild after multiple iterations of /scenario, /optimiser, /carcass. Decision: collapse everything into one page at /. Reason: each prior route answered a different question, but Taimur needs one coherent view. Alternatives considered: keep the multi-page structure with a summary on /. Rejected because navigation between pages broke the flow of the comparison.
- **2026-05-24** · Default leftover recovery changed from 50% × 60% retail to zero. Reason: backtest should be honest about waste; user enters per-cut sellable kg interactively. Alternatives considered: keep the 50%/60% default. Rejected because it inflated the headline saving and masked the real waste problem.
- **2026-05-24** · Replaced the standalone "Leftovers from in-house slaughter" section with an inline column in the main in-house table. Reason: avoid duplicate data on the page; the table already shows yield and demand per cut, adding leftover and shortfall completes the picture. Alternatives considered: keep both views. Rejected as redundant.
- **2026-05-24** · Per-cut Saving column added (replacing Recovery column). Reason: shows portfolio-rebalancing signal at-a-glance. A glance at the green/red column tells the viewer which cuts in-house wins on and which it loses on. Alternatives considered: show recovery only. Rejected because recovery is one piece of the per-cut economics, not the whole picture.
- **2026-05-24** · Default vendor markup changed to 10% (range 5-20%) from 15% (range 0-50%). Reason: anchor the conversation around realistic numbers; 15% was a guess on the high side. The range 5-20% covers the plausible band based on Pakistani livestock market dynamics. Alternatives considered: keep 15% default. Rejected because Taimur will instinctively dismiss anything that looks padded.
- **2026-05-24** · Opportunity lightbulb icons gated on rupee materiality, not just kg gap. Reason: small offal cuts had large % gaps but negligible rupee impact — flagging them was noise. Materiality gate keeps the signal tight to ~5 actionable cuts. Alternatives considered: flag every imbalanced cut. Rejected as visually noisy.
- **2026-05-25** · Routing introduced as a modal pattern (not an inline section or always-visible table). Reason: keeps the main page uncluttered; matches the existing Markups/Yields modal pattern partners already understand. Alternatives considered: collapsible section at the bottom (Option B), inline tooltip links (Option A), routing always-visible as a third column block (Option D). Rejected because they all added page weight for a feature most viewers won't engage with on first read.
- **2026-05-25** · Routing default per-route kg = 0 (not pre-filled with sensible defaults). Reason: consistent with Can-sell honest-default principle. Alternatives considered: pre-fill with sensible defaults (e.g. 200 kg shoulder, 100 kg ribs) to show the upside immediately. Rejected because the page should show the floor by default, with the user committing to upside explicitly.

## Known caveats

- **"Today" prices use Shopify retail × markup, not real vendor invoice rates.** Vendor invoices in the MySQL finance tables show mutton at ~Rs 2,400-2,590/kg, while Shopify retail sits at Rs 2,950-4,860/kg. This inflates the headline saving. The real-vendor-cost swap is on the open items list.
- **Fat (111.5 kg) is real bulk demand**, not a SKU mapping error. Traced to four "Mutton Fat / Charbi" SKUs sold to tallow/rendering buyers. Kept as-is in the model.
- **240 goats over 90 days at 14.1 kg dressed carcass** is a derived figure, not a measurement. Goats_count is computed to satisfy total customer demand at the dominant cut's yield. If yield assumptions change in the Yields modal, goats_count recomputes live.
- **Rs 1.5M operational overhead** is a hand-wavy estimate, not a measured cost. Likely range Rs 1.2-2.5M depending on staffing, cold-chain expansion, risk provisions. The headline annualised saving subtracts a fixed Rs 1.5M; this should be parameterised in a future iteration.
- **Per-piece SKUs excluded from the kg model:** Mutton Brain (Maghaz) per piece (306 kg counted as pieces), Mutton Lungs (Phipra) per piece (39 kg), Mutton (CS) LEAN Chest (Seen, 23.4 kg), Mutton (CS) Chest (Seena) pe (7.6 kg). Noted in the methodology footer.
- **Bones row saving math may overstate loss.** Bones aren't really sold at retail today; the model values bones leftover at full retail, which probably exaggerates the in-house cost. Open for review.

## Open questions

- What is the real vendor markup on mutton? Verifiable in one afternoon with three real butcher invoices vs same-day mandi prices.
- What is the realistic all-in cost per mutton (purchase + raising + slaughter + transport) at the scale we'd need (~80 mutton/month)?
- What is the realistic operational overhead for running in-house slaughter at this volume?
- What's the disposition channel for unsold cuts? Today the model treats leftover as waste by default, recovered only via the user's Can sell input. In practice, is there a wholesale buyer for shoulder, ribs, paya, head?
- Should bones, trim, and fat be excluded from the saving calculation entirely (treated as zero-value byproduct on both sides) or valued at a realistic byproduct rate (10-20% of retail)?
- Should the 90-day window be configurable, or is one fixed window the right call to avoid sample-size gaming?
- Does the model need a "what would we have to charge customers" view to evaluate margin lift from in-house, not just cost savings?
