# Cow tool — spec

## Purpose

The Cow tab answers the same operational question as Procurement (mutton), for cow/veal: **across the last 90/180 days of real customer orders, would slaughtering whole cow in-house have been cheaper than buying cuts from vendors?**

It is a backtest against actual MySQL order data, mirroring the mutton tool. It shares the same engine, layout, and math; only the cut anatomy, retail rates, demand filter, and in-house cost defaults differ.

## Status

Built 2026-05-30. The "Cow" species tab is now active alongside Mutton (Chicken remains "SOON").

## Big caveat (read first)

**We do not buy live or whole cow today.** Every cow vendor purchase in `t_fin_vendor_purchase_items` is a specific cut (Veal Raan ~Rs 1,350/kg, Boneless ~Rs 1,550/kg, Mix ~Rs 1,300/kg, Undercut ~Rs 2,450/kg). There are zero live-cow or whole-carcass purchases. So the in-house side has **no real cost anchor**: the whole-cow all-in cost (default Rs 200,000) is a pure estimate. This is noted in the methodology footer (a prominent amber notice was removed on 2026-05-30 at the founder's request). The founder must supply a real figure before the cow in-house result can be trusted. This is a weaker backtest than mutton, where live-goat purchases (~Rs 1,300/kg) at least anchor the animal cost.

Decision (2026-05-30): per the founder, mirror the mutton tool exactly and flag the estimate, rather than reframe cow around its (real) per-cut vendor rates. Rationale: consistency with the mutton tab; the per-cut-rate reframing is closer to the real-invoice view that was reverted for mutton on the same day.

## Data

- **Demand**: `buildAnimalData("cow", days)` pulls order lines matching `%beef%`/`%veal%`/`%cow%`, classified by `mapSku` (veal/beef → cow; Qurbani "Cow Share / Hissa" excluded). Over 180 days: **8,737 kg mapped to cuts** across 166 order-days (larger than mutton's ~6,400 kg). Top cuts: Keema/Mince 2,968 kg, Boneless Boti 2,068, Nalli 1,320, Karahi 1,070, Undercut 868.
- **Excluded/unmapped** (surfaced in the methodology footer): per-piece and processed items (Beef Shami Kabab, Beef Qeema Samosa, Veal Kidney per piece) and a few small uncovered cuts (Brisket, Chest/Seena, Tendons). Same pattern as mutton's per-piece exclusions.
- **Cut anatomy**: `CUTS_COW` in lib/cuts.ts (yields sum to 100%). **Retail rates**: `RETAIL_RATES.cow` in lib/retail.ts (Shopify storefront).
- **Carcass**: default live weight 250 kg × 50% dressing = 125 kg dressed (editable in the Yields modal). `carcassEquivalents` ≈ 70 cows over 180 days.

## What is shared with mutton (architecture)

The tool was generalised on 2026-05-30 so mutton and cow run one code path:

- `lib/animalData.ts` — `buildAnimalData(animal, days)`: the demand builder for any animal (swaps cut anatomy, retail rates, and the order-line name filter). Replaces the old mutton-only `lib/mutton.ts`.
- `lib/animalConfig.ts` — `ANIMAL_CONFIG[animal]`: per-animal UI config (live-weight/dressing/price defaults and slider bounds, the live-price-is-an-estimate flag, routing rules, copy nouns).
- `components/ProcurementTool.tsx` — parent `ProcurementTool` owns the species switch and renders `AnimalView` keyed by species (a remount on switch resets every per-animal input to that animal's defaults). `AnimalView` is the former mutton component, parameterised.

## Key formulas

Identical to the mutton spec (see docs/spec/procurement.md "Key formulas"). Baseline = `Σ demand × retail × (1 + markup%)`; in-house = `N × whole_cow_price + shortfall − leftover_resold + routing`. The markup baseline (not real invoice) is used, consistent with the reverted mutton model.

## Assumptions and defaults (cow-specific)

- Whole-cow all-in cost: default Rs 200,000, range Rs 120,000-320,000. **Unverified estimate** (no live-cow purchases exist). Flagged in the UI.
- Live weight 250 kg, dressing 50% → 125 kg dressed carcass. Editable.
- Vendor markup: default 10%, range 5-20% (shared with mutton).
- Routing rules (cow): pasanda → keema, champ/rack → karahi, chaap/ribs → karahi, bong/foreshank → keema, fat → keema.
- Conversion cost Rs 50/kg (shared).

## Known caveats

- **In-house cost is an estimate, not anchored to invoices** (see "Big caveat"). At the Rs 200k placeholder and 10% markup, the headline shows in-house ~13% MORE expensive over 180 days — but that number moves entirely with the unverified cost input.
- **Cow yields are spec defaults**, not validated against Nizami's own processing.
- **Processed items** (Beef Shami Kabab, Qeema Samosa) that map to keema by keyword are counted as keema demand; per-piece versions are excluded. Minor.
- All mutton caveats about uniform per-kg carcass-cost allocation and retail-derived baseline apply equally to cow.

## Open questions

- What is the realistic all-in cost of a whole cow (purchase + slaughter + transport) if we ever did slaughter in-house? Without this, the cow in-house side is illustrative only.
- Is in-house cow slaughter even on the table operationally, given a single cow yields ~125 kg that must clear before spoilage (worse lumpiness than mutton)? The day strip surfaces this.
- Should cow use its real per-cut vendor rates (which exist, unlike mutton's blended rate) for a more honest baseline? Deferred to stay consistent with the mutton model.
