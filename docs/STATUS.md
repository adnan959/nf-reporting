# Project status

Last updated: 2026-05-30

## Deployed

- Vercel URL: https://nf-reporting.vercel.app (production, tracks `main`, via the GitHub integration).
- Current state: Procurement tool with **Mutton + Cow + Chicken** species tabs all live. Retail × markup baseline (the real-invoice experiment was reverted on 2026-05-30). Cow and chicken in-house costs are unverified estimates (noted in the methodology footer; the prominent amber box was removed per founder request).

## Mid-flight

- On branch `feat/chicken-tab` (not yet merged/deployed at time of writing). Chicken tab added; cow estimate amber box removed.

## Known issues

- "Today" vendor side prices cuts at Shopify retail × markup. Real vendor invoice rates (which live in the MySQL finance tables, ~Rs 2,460/kg blended for mutton) sit lower. This inflates the savings number. We built and then reverted a real-invoice baseline on 2026-05-30; the finding (in-house is not cheaper at real rates and the current cost assumption) is recorded in CHANGELOG but is intentionally not wired into the tool. The current model is honest about its framing in the methodology footer.
- Bones row saving math may overstate loss. Bones are not really sold at retail today; the model values bones leftover at full retail, which probably exaggerates the in-house cost. Worth reviewing during the next iteration.
- COW and CHICKEN in-house costs are unverified estimates (cow Rs 200k/animal, chicken Rs 750/bird defaults). We never buy live/whole cow, and buy no chicken from vendors at all, so neither in-house side has an invoice anchor — both are illustrative until the founder supplies real figures. Noted in the methodology footer (the amber box was removed per founder request). See docs/spec/cow.md and docs/spec/chicken.md.
- CHICKEN's slaughter-in-house framing is the most tenuous of the three (chicken is a different business from red-meat vertical integration); the tab exists for completeness. Its baseline, however, is grounded in real realized selling prices.

## Next planned

- Founder to confirm real all-in costs for cow (~per animal) and chicken (~per bird) so their in-house sides are meaningful (currently flagged estimates).
- Verify markup assumption against 3 real butcher invoices (one afternoon task for the founder).
- Tab candidates beyond the species tabs: Profit & Closing, Inventory. To be scoped after the Taimur conversation.

## Recent changes

- 2026-05-30 · chicken · Built the Chicken species tab (all three species now live). Real retail rates from order data; in-house cost an estimate (no chicken purchases exist). Removed the cow in-house estimate amber box (moved to footer note).
- 2026-05-30 · cow · Built the Cow species tab by generalising the data layer (buildAnimalData) and component (ProcurementTool + AnimalView) so mutton and cow share one code path. Cow in-house cost flagged as an estimate (no live-cow purchases).
- 2026-05-30 · procurement · Reverted the real-invoice baseline experiment; procurement returns to the retail × markup baseline. First production deploy to Vercel via GitHub integration.
- 2026-05-25 · procurement · Routing modal + audit + foundational specs.
- 2026-05-24 · procurement · Saving column, routing UI scaffolding, opportunity icons, yield assumptions modal.
- 2026-05-23 · procurement · Single-page rebuild with honest math (shortfall, leftover, zero-recovery default).
