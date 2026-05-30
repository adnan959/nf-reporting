# Changelog

All notable changes to the Nizami Farms internal dashboard. Format: date · tab · what changed · why.

## 2026-05-30 · procurement · Real vendor invoice baseline (default)

Added `lib/vendorRates.ts`, which derives real vendor rates live from `t_fin_vendor_purchase_items` (actual `rate_per_unit` paid to meat vendors) over the same window as the order backtest. Wired into `lib/mutton.ts` (each cut now carries a `vendorRate`; `MuttonData` carries a `vendorRates` summary). Added a baseline-mode toggle to the left column in `components/MuttonTool.tsx`: "Real invoice" (new default) vs "Retail × markup" (the old view, retained for comparison). In real mode the baseline spend and the shortfall buy both use the real rate; the markup slider and per-cut overrides apply only in retail mode. Surfaced real whole-carcass (Rs 2,654/kg) and live-goat (Rs 1,298/kg) anchors beside the in-house cost slider.

Why: the "today" baseline was valuing vendor purchases at Shopify retail × markup, which is the SELL price, not what we pay vendors. The real rate (~Rs 2,463/kg blended over 180d, vs retail Rs 2,950-4,860) sits at or below the in-house carcass cost. Effect: at the unchanged Rs 35k all-in cost the headline flips from +17% saving to −19% loss (180d) / −14% (90d) — in-house is ~Rs 3.0M MORE expensive over 180 days. The retail-derived saving was essentially an artifact of the baseline. Data finding: vendors invoice generic mutton at a single blended rate, not per cut (only Fat has its own rate), so we did not fabricate per-cut vendor prices.

## 2026-05-25 · procurement · Routing modal, numbers audit, foundational specs

Added routing opportunities modal with 5 default routes (Puth/Shoulder → Keema, Raan boneless → Keema, Nalli/Shank → Keema, Chaap/Ribs → Karahi cut, Fat → Keema). Per-route editable kg input, global conversion cost (Rs 50/kg default), live recompute of all upstream numbers. Companion "+Rs X via routing →" CTA next to Saving column total. Why: leftover and shortfall can offset each other through operational discipline; treating cuts as immutable overstated both sides.

Completed numbers audit of every visible value on the procurement page. Output: docs/audit/procurement-audit-2026-05-25.md. Why: tool is being sent to a sceptical partner; any number that can't be defended would destroy trust.

Initialised docs/spec/procurement.md, CLAUDE.md, docs/STATUS.md, and this changelog. Established documentation discipline: every code change touching model/math/visible behaviour requires a spec update in the same commit; STATUS.md updated at end of every commit-producing session. Why: as the dashboard grows to multiple tabs, context drift across sessions becomes the biggest risk to quality; tooling and discipline must enforce what willpower alone won't.

## 2026-05-24 · procurement · Multiple iterations on the core comparison

Established the page layout: side-by-side Today (vendors) vs Slaughtering in-house comparison, 90-day backtest from MySQL, mutton-only, Qurbani-excluded. Added all cuts ranked by demand on both sides. Demand / Yield / Sold (stacked bar) / Short (kg + Rs) / Unsold (kg + Rs) / Can sell / Saving columns on the in-house side. Day strip with hover tooltips showing kg demand and goats-needed per day. Editable carcass yield assumptions modal (live weight, dressing %, per-cut yield % editable, totals must sum to 100%). Markup overrides modal ranked by real 90-day sales with greying for negligible cuts. Opportunity lightbulb icons on materially imbalanced cuts (red = over-demanded, amber = over-supplied). Saving column replaced earlier Recovery column to surface portfolio-rebalancing signal at-a-glance. Default vendor markup 10% (range 5-20%); default mutton all-in cost Rs 35-40k; default leftover recovery zero (honest waste assumption); per-cut Can sell inputs allow live what-if. Container widened to 1600px, equal columns, tables vertically aligned. Species tab bar (Mutton active, Cow/Chicken SOON). Methodology footer in bullet form.

## 2026-05-23 · procurement · Initial single-page rebuild

Reset all prior routes (/, /scenario, /optimiser, /carcass, per-day drilldown) and rebuilt as a single page at /. Established the data pipeline (MySQL connection, SKU-to-cut mapping, yield table, retail prices) as the only thing carried forward. Goat-only, Qurbani-excluded, 90-day backtest.
