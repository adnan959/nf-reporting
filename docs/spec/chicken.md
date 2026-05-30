# Chicken tool — spec

## Purpose

The Chicken tab runs the same buy-vs-slaughter backtest as Mutton and Cow, for chicken: **across the last 90/180 days of real orders, would processing whole chicken in-house have been cheaper than buying cuts from vendors?** It shares the generalised engine (buildAnimalData / ANIMAL_CONFIG / ProcurementTool).

## Status

Built 2026-05-30. The "Chicken" species tab is active (Mutton, Cow, Chicken all live).

## Big caveats (read first)

1. **We buy zero chicken from vendors.** `t_fin_vendor_purchase_items` has no chicken/murgh/poultry purchases at all — neither whole birds nor cuts. So the in-house whole-bird cost (default Rs 750/bird) is a pure estimate with no invoice anchor, flagged in the methodology footer. Like cow, the in-house side is illustrative until a real figure is supplied.
2. **The "slaughter in-house" framing fits chicken least.** Chicken is a different business from red-meat vertical integration (fresh daily slaughter, thin margins). The tab exists for completeness/consistency across species; treat its in-house result as the most speculative of the three.
3. **The baseline IS grounded.** Unlike the in-house side, the "today" baseline uses real realized selling prices (`line_subtotal / quantity`) from the last 180 days of orders (see RETAIL_RATES.chicken), so the vendor-spend side reflects what customers actually paid.

## Data

- **Demand**: `buildAnimalData("chicken", days)` pulls `%chicken%`/`%murgh%` order lines via mapSku. Over 180 days: **9,947 kg mapped** across 172 order-days (88% of chicken volume; the rest is processed/per-piece, correctly excluded). Top cuts: Karahi cut 2,065 kg, Breast 1,820, Thigh 1,178, Boneless 1,018, Mince 915, Drumstick 886, Whole 695, Qorma 664.
- **Excluded** (footer): processed items (Cheese Samosa, Spring Rolls, Shami/Reshmi Kebab, Qeema Samosa — per piece) and "Organic Desi Chicken Meat" (a distinct premium product at ~Rs 2,690/kg, not broiler cuts).
- **Cut model**: `CUTS_CHICKEN` in lib/cuts.ts — sale forms (karahi cut, breast, boneless, thigh, drumstick, mince, qorma/biryani cut, whole roast, wings, bones, offal), not strict anatomy, with yields summing to 100%. This mirrors how CUTS_COW already treats boti/keema/karahi. Bone-in "cuts" (karahi/qorma/biryani/whole) are whole-bird-chopped forms; the allocation is a broiler-mix approximation, not measured.
- **SKU mapping**: chicken has its own keyword path in lib/skuMap.ts (CHICKEN_KEYWORDS). Its `(C0)/(B2)` codes are letter+digit and not captured by extractCode, so mapping is name-based. The unit detector was fixed so "(22 Pcs) per kg" reads as kg (sold by weight), not per-piece.
- **Carcass**: default live 1.8 kg × 70% dressing = 1.26 kg dressed (DRESSED_CARCASS_KG 1.2 for display). carcassEquivalents ≈ 7,900 birds over 180 days.

## Retail rates (real, grounded)

RETAIL_RATES.chicken are realized prices from real orders: bone-in cuts (karahi/qorma/biryani/whole) ~Rs 950-1,020; boneless/breast/mince ~Rs 1,280-1,320; thigh ~Rs 1,200; drumstick ~Rs 1,020; wings ~Rs 681; bones ~Rs 200.

## Assumptions and defaults (chicken-specific)

- Whole-bird all-in cost: default Rs 750, range Rs 400-1,200. **Unverified estimate** (no chicken purchases exist). Flagged in the footer.
- Live weight 1.8 kg, dressing 70% → 1.26 kg dressed. Editable.
- Vendor markup 10% (5-20%), conversion cost Rs 50/kg — shared with the other species.
- Routes: thigh → boneless, drumstick → karahi cut, wings → karahi cut, whole → boneless, qorma → karahi cut.

## Known caveats

- In-house cost is an estimate (no anchor); broiler-mix yields are defaults; cuts are sale-form allocations with bone-in/boneless overlap; processed and "organic desi" lines excluded. All consistent with how mutton/cow handle their approximations.
- All shared-model caveats (uniform per-kg carcass-cost allocation; retail-derived baseline) apply.

## Open questions

- Is in-house chicken processing a real decision for Nizami at all, or is this tab purely illustrative? If illustrative, consider labelling it so for Taimur.
- What would a realistic all-in cost per processed bird be, if the in-house result is to mean anything?
