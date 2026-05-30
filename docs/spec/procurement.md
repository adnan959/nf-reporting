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

## Data sources

- **MySQL operational database** (app.nizamifarms.com). Read-only access via lib/db.ts. Connection details in environment variables.
- **Order lines table** filtered to last 90 days, mutton-only, excluding Qurbani patterns (regex match on /qurbani|aqeeqa|sadqa/ in SKU name or order line metadata).
- **SKU-to-cut mapping** in lib/skuMap.ts. Maps raw Shopify SKU names to canonical cut categories (Karahi cut, Raan / Leg, Puth / Shoulder, etc.). Per-piece SKUs (Brain, Lungs, certain Chest cuts) are excluded from the kg model and noted in the methodology footer.
- **Carcass yield table** in lib/cuts.ts. Canonical yield % per cut for a balanced mutton carcass at the default 30 kg live weight × 47% dressing yield = 14.1 kg dressed.
- **Retail prices** in lib/retail.ts. Pulled from the Shopify storefront. These are the SELL prices (what customers pay), not what we pay vendors. Used only in the "Retail × markup" comparison mode and to value surplus leftover.
- **Real vendor invoice rates** in lib/vendorRates.ts, derived live from `t_fin_vendor_purchase_items` (actual `rate_per_unit` paid to meat vendors) over the same window as the order backtest. This is the honest "what we pay today" baseline. Finding (2026-05): vendors invoice us for generic "Mutton" at a single blended rate (~Rs 2,430-2,630/kg depending on window), not per cut; the only cut-level real rate is Fat (~Rs 500/kg). So the real baseline values every cut at the blended rate, with Fat as the one exception. We do not fabricate per-cut vendor rates the invoices don't contain. Whole dressed mutton (~Rs 2,654/kg) and live-weight goat (~Rs 1,298/kg) are surfaced as reference anchors for the in-house carcass cost.

## Key formulas

**Vendor spend (left column total):** depends on the baseline mode.
```
real_invoice mode (default):  vendor_spend = Σ (cut_demand_kg × vendor_rate)
retail_markup mode:           vendor_spend = Σ (cut_demand_kg × retail_price × (1 + markup%))
```
Where `vendor_rate` is the real invoice rate for the cut (blended mutton rate, or Fat's own rate). The same `vendor_rate` (real mode) or `retail × (1 + markup)` (retail mode) is used to value the shortfall buy on the in-house side, so both sides of every vendor transaction use one consistent price. Per-cut Cost is the same formula applied per cut. Share % is cut_demand_kg / total_demand_kg. The markup slider and per-cut overrides apply only in retail_markup mode.

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

- Baseline mode: default **real_invoice** (real vendor rates from MySQL). The retail_markup mode is kept as a comparison toggle only. Switching from retail to real flips the headline from a saving to a loss (see Decisions 2026-05-30).
- Vendor markup: default 10%, range 5-20%. Applies only in retail_markup mode. Now superseded as the baseline by real invoice rates.
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
- **2026-05-30** · Real vendor invoice baseline wired in and made the default; retail × markup demoted to a comparison toggle. Reason: the "today" baseline was valuing vendor purchases at Shopify retail × markup (the SELL price), which inflated the headline saving. The real rate lives in `t_fin_vendor_purchase_items` and was pulled live: vendors invoice generic mutton at one blended rate (~Rs 2,463/kg over 180d, ~Rs 2,627/kg over 90d), with Fat at ~Rs 500/kg. **Impact: at the unchanged Rs 35k all-in cost, the headline flips from +17% saving to −19% loss (180d), i.e. in-house is ~Rs 3.0M MORE expensive over 180 days.** The retail-derived saving was essentially an artifact of the baseline. Alternatives considered: (a) keep retail baseline and only annotate it as optimistic — rejected, the artifact was too large to leave as the default a partner sees; (b) fabricate per-cut vendor rates for granularity — rejected, the invoices only support a blended rate plus Fat, and inventing per-cut prices would fake precision the data can't support; (c) also bump the live-cost default to the real ~Rs 37-39k anchor — deferred, left at Rs 35k with the real whole-carcass/live anchors surfaced beside the slider so the founder sets it deliberately. Note: real-data finding — vendors do not price per cut, so the per-cut Cost breakdown is uniform in real mode (a truth the retail view obscured).

## Known caveats

- **RESOLVED (2026-05-30): "Today" baseline now uses real vendor invoice rates by default.** Previously valued at Shopify retail × markup, which inflated the saving. Now pulled live from `t_fin_vendor_purchase_items` (~Rs 2,463/kg blended over 180d). Retail × markup is retained as an explicit comparison toggle. With the real baseline the headline is a loss, not a saving, at the current cost assumption.
- **Live all-in cost (Rs 35k default) now looks optimistic against real data.** Real whole-dressed-mutton invoices are ~Rs 2,654/kg (≈ Rs 37.4k for a 14.1 kg carcass) and live-weight goat is ~Rs 1,298/kg, both before slaughter/transport/labour. The slider default was left at Rs 35k but the real anchors are shown beside it; a more honest default would be ~Rs 38-40k, which widens the in-house loss further. Open item.
- **Fat (111.5 kg) is real bulk demand**, not a SKU mapping error. Traced to four "Mutton Fat / Charbi" SKUs sold to tallow/rendering buyers. Kept as-is in the model.
- **240 goats over 90 days at 14.1 kg dressed carcass** is a derived figure, not a measurement. Goats_count is computed to satisfy total customer demand at the dominant cut's yield. If yield assumptions change in the Yields modal, goats_count recomputes live.
- **Rs 1.5M operational overhead** is a hand-wavy estimate, not a measured cost. Likely range Rs 1.2-2.5M depending on staffing, cold-chain expansion, risk provisions. The headline annualised saving subtracts a fixed Rs 1.5M; this should be parameterised in a future iteration.
- **Per-piece SKUs excluded from the kg model:** Mutton Brain (Maghaz) per piece (306 kg counted as pieces), Mutton Lungs (Phipra) per piece (39 kg), Mutton (CS) LEAN Chest (Seen, 23.4 kg), Mutton (CS) Chest (Seena) pe (7.6 kg). Noted in the methodology footer.
- **Bones row saving math may overstate loss.** Bones aren't really sold at retail today; the model values bones leftover at full retail, which probably exaggerates the in-house cost. Open for review.

## Open questions

- ~~What is the real vendor markup on mutton?~~ ANSWERED 2026-05-30 from `t_fin_vendor_purchase_items`: we buy generic mutton at a blended ~Rs 2,463/kg (180d), not at a per-cut markup over retail. The retail×markup framing did not reflect what we actually pay.
- Should the live all-in cost default move to the real ~Rs 38-40k anchor (whole carcass Rs 2,654/kg + slaughter/transport)? This would deepen the in-house loss; left at Rs 35k pending the founder's true cost figure.
- What is the realistic all-in cost per mutton (purchase + raising + slaughter + transport) at the scale we'd need (~80 mutton/month)?
- What is the realistic operational overhead for running in-house slaughter at this volume?
- What's the disposition channel for unsold cuts? Today the model treats leftover as waste by default, recovered only via the user's Can sell input. In practice, is there a wholesale buyer for shoulder, ribs, paya, head?
- Should bones, trim, and fat be excluded from the saving calculation entirely (treated as zero-value byproduct on both sides) or valued at a realistic byproduct rate (10-20% of retail)?
- Should the 90-day window be configurable, or is one fixed window the right call to avoid sample-size gaming?
- Does the model need a "what would we have to charge customers" view to evaluate margin lift from in-house, not just cost savings?
