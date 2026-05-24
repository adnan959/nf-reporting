# Project status

Last updated: 2026-05-25

## Deployed

- Vercel URL: [to be added when first deployed]
- Current state: Procurement tab — routing modal, numbers audit, foundational specs complete and ready to deploy.

## Mid-flight

- Nothing currently in progress.

## Known issues

- "Today" vendor side prices cuts at Shopify retail × markup. Real vendor invoice rates (which live in the MySQL finance tables) sit lower (~Rs 2,400-2,590/kg for mutton). This inflates the savings number. The swap to real invoice rates is a known open item but not yet implemented. The current model is honest about its framing in the methodology footer.
- Bones row saving math may overstate loss. Bones are not really sold at retail today; the model values bones leftover at full retail, which probably exaggerates the in-house cost. Worth reviewing during the next iteration.

## Next planned

- Deploy to Vercel.
- Verify markup assumption against 3 real butcher invoices (one afternoon task for the founder).
- Screenshot tool at verified markup; send to Taimur with three caveats (markup verified, opex is an estimate, shortfall purchases mean we don't escape vendors entirely).
- Tab 2 candidates: Profit & Closing, Inventory. To be scoped after Taimur conversation.

## Recent changes

- 2026-05-25 · procurement · Routing modal + audit + foundational specs.
- 2026-05-24 · procurement · Saving column, routing UI scaffolding, opportunity icons, yield assumptions modal.
- 2026-05-23 · procurement · Single-page rebuild with honest math (shortfall, leftover, zero-recovery default).
