# Changelog

All notable changes to the Nizami Farms internal dashboard. Format: date · tab · what changed · why.

## 2026-05-30 · chicken · Chicken species tab + remove cow estimate box

Activated the Chicken tab (Mutton, Cow, Chicken all live now). Added "chicken" to the `Animal` type and the supporting tables: `CUTS_CHICKEN` (sale-form allocation — karahi cut, breast, boneless, thigh, drumstick, mince, qorma/biryani, whole, wings, bones, offal — summing to 100%), `RETAIL_RATES.chicken` (realized selling prices from real orders, not invented), a dedicated chicken keyword path in skuMap (its `(C0)/(B2)` codes are letter+digit, so name-based), plus chicken entries in ANIMAL_CONFIG / DRESSED_CARCASS_KG / NAME_LIKE and page.tsx. Result: 9,947 kg mapped over 180 days (172 order-days, 88% coverage; processed and "organic desi" lines excluded).

Two bug fixes surfaced by chicken, both also correct for the other species: (1) the unit detector now treats "(22 Pcs) per kg" as sold-by-weight ("per kg" wins over the piece-count descriptor) instead of per-piece; (2) `allocate()` no longer drops any animal that isn't mutton/cow (it silently returned [] for chicken). Mutton and cow demand are byte-identical after these fixes (verified), so no regression.

Caveats (chicken is the most speculative tab): we buy zero chicken from vendors, so the in-house whole-bird cost (Rs 750 default) is a pure estimate; the slaughter-in-house framing fits chicken least; cuts are sale-form allocations with broiler-mix yields. All noted in the methodology footer and docs/spec/chicken.md. The baseline, however, is grounded in real realized prices.

Also removed the prominent amber "estimate" box on the cow in-house cost (founder request); the estimate caveat now lives as a quiet line in the methodology footer for both cow and chicken.

## 2026-05-30 · cow · Cow species tab (mirrors mutton)

Activated the Cow tab. Generalised the engine so mutton and cow share one code path: new `lib/animalData.ts` (`buildAnimalData(animal, days)`, replacing the mutton-only `lib/mutton.ts`), new `lib/animalConfig.ts` (`ANIMAL_CONFIG` — per-animal defaults, slider bounds, routing, copy, and a live-price-is-an-estimate flag), and `components/MuttonTool.tsx` → `components/ProcurementTool.tsx` split into a `ProcurementTool` parent (owns the species switch) and a parameterised `AnimalView` (remounted per species so inputs reset to that animal's defaults). `app/page.tsx` now builds both animals.

Cow demand is real and larger than mutton (8,737 kg mapped over 180 days, 166 order-days; top cuts Keema, Boneless Boti, Nalli, Karahi, Undercut), so the tab is data-backed. But we never buy live/whole cow (every cow vendor purchase is a cut), so the in-house whole-cow cost (Rs 200k default) has no invoice anchor and is flagged in the UI as an unverified estimate. At that placeholder and 10% markup, in-house reads ~13% MORE expensive over 180 days. Decision (founder): mirror mutton and flag the estimate rather than reframe cow around its real per-cut vendor rates. See docs/spec/cow.md. Why generalise rather than duplicate: one engine means a fix to the math helps both animals and avoids a 700-line copy drifting out of sync.

## 2026-05-30 · procurement · Reverted real-invoice baseline experiment

Reverted the real vendor invoice baseline (commit 98218c4) and returned the procurement tool to its retail × markup baseline. Why: founder opted to keep the original model rather than reframe the headline around real invoice rates. Removed lib/vendorRates.ts and the baseline-mode toggle. The data finding stands for the record (at real invoice rates ~Rs 2,463/kg, in-house slaughter is not cheaper at the current cost assumption), but it is no longer wired into the tool. One small carry-forward: the two `query<>` calls in lib/mutton.ts are kept explicitly typed (not `any`) so `next build` passes on Vercel; this is build hygiene, not a model change.

## 2026-05-25 · procurement · Routing modal, numbers audit, foundational specs

Added routing opportunities modal with 5 default routes (Puth/Shoulder → Keema, Raan boneless → Keema, Nalli/Shank → Keema, Chaap/Ribs → Karahi cut, Fat → Keema). Per-route editable kg input, global conversion cost (Rs 50/kg default), live recompute of all upstream numbers. Companion "+Rs X via routing →" CTA next to Saving column total. Why: leftover and shortfall can offset each other through operational discipline; treating cuts as immutable overstated both sides.

Completed numbers audit of every visible value on the procurement page. Output: docs/audit/procurement-audit-2026-05-25.md. Why: tool is being sent to a sceptical partner; any number that can't be defended would destroy trust.

Initialised docs/spec/procurement.md, CLAUDE.md, docs/STATUS.md, and this changelog. Established documentation discipline: every code change touching model/math/visible behaviour requires a spec update in the same commit; STATUS.md updated at end of every commit-producing session. Why: as the dashboard grows to multiple tabs, context drift across sessions becomes the biggest risk to quality; tooling and discipline must enforce what willpower alone won't.

## 2026-05-24 · procurement · Multiple iterations on the core comparison

Established the page layout: side-by-side Today (vendors) vs Slaughtering in-house comparison, 90-day backtest from MySQL, mutton-only, Qurbani-excluded. Added all cuts ranked by demand on both sides. Demand / Yield / Sold (stacked bar) / Short (kg + Rs) / Unsold (kg + Rs) / Can sell / Saving columns on the in-house side. Day strip with hover tooltips showing kg demand and goats-needed per day. Editable carcass yield assumptions modal (live weight, dressing %, per-cut yield % editable, totals must sum to 100%). Markup overrides modal ranked by real 90-day sales with greying for negligible cuts. Opportunity lightbulb icons on materially imbalanced cuts (red = over-demanded, amber = over-supplied). Saving column replaced earlier Recovery column to surface portfolio-rebalancing signal at-a-glance. Default vendor markup 10% (range 5-20%); default mutton all-in cost Rs 35-40k; default leftover recovery zero (honest waste assumption); per-cut Can sell inputs allow live what-if. Container widened to 1600px, equal columns, tables vertically aligned. Species tab bar (Mutton active, Cow/Chicken SOON). Methodology footer in bullet form.

## 2026-05-23 · procurement · Initial single-page rebuild

Reset all prior routes (/, /scenario, /optimiser, /carcass, per-day drilldown) and rebuilt as a single page at /. Established the data pipeline (MySQL connection, SKU-to-cut mapping, yield table, retail prices) as the only thing carried forward. Goat-only, Qurbani-excluded, 90-day backtest.
