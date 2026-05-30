# Project status

Last updated: 2026-05-30

## Deployed

- Vercel URL: production deploy live via the GitHub integration (project adnan959s-projects/nf-reporting). Exact alias confirmed after the revert build completes.
- Current state: Procurement tab on its original **retail × markup** baseline. The real-invoice baseline experiment (2026-05-30) was reverted at the founder's call.

## Mid-flight

- Cow tab — starting build-out. Currently a "SOON" placeholder in the species selector. Procurement (mutton) is the shipped reference implementation to mirror.

## Known issues

- "Today" vendor side prices cuts at Shopify retail × markup. Real vendor invoice rates (which live in the MySQL finance tables, ~Rs 2,460/kg blended for mutton) sit lower. This inflates the savings number. We built and then reverted a real-invoice baseline on 2026-05-30; the finding (in-house is not cheaper at real rates and the current cost assumption) is recorded in CHANGELOG but is intentionally not wired into the tool. The current model is honest about its framing in the methodology footer.
- Bones row saving math may overstate loss. Bones are not really sold at retail today; the model values bones leftover at full retail, which probably exaggerates the in-house cost. Worth reviewing during the next iteration.

## Next planned

- Build the Cow tab: mirror the procurement comparison for cow/veal using CUTS_COW, cow retail rates, and cow demand from MySQL. Activate the "Cow" species button (currently disabled "SOON").
- Verify markup assumption against 3 real butcher invoices (one afternoon task for the founder).
- Tab 2 candidates beyond Cow: Profit & Closing, Inventory. To be scoped after the Taimur conversation.

## Recent changes

- 2026-05-30 · procurement · Reverted the real-invoice baseline experiment; procurement returns to the retail × markup baseline. First production deploy to Vercel via GitHub integration.
- 2026-05-25 · procurement · Routing modal + audit + foundational specs.
- 2026-05-24 · procurement · Saving column, routing UI scaffolding, opportunity icons, yield assumptions modal.
- 2026-05-23 · procurement · Single-page rebuild with honest math (shortfall, leftover, zero-recovery default).
