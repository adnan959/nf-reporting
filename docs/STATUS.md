# Project status

Last updated: 2026-05-30

## Deployed

- Vercel URL: [to be added when first deployed]
- Current state: Procurement tab — real-invoice baseline now wired in and default. Routing modal, numbers audit, foundational specs complete.

## Mid-flight

- On branch `feat/real-invoice-baseline` (not yet merged to main). Real vendor rates from MySQL are live; awaiting founder review before merge/deploy.

## Headline finding (2026-05-30)

- With the **real vendor invoice baseline** (default), slaughtering in-house is NOT cheaper at the current Rs 35k all-in cost. The headline flips from the old retail-derived +17% saving to a **−19% loss (180d) / −14% (90d)** — in-house is ~Rs 3.0M MORE expensive over 180 days. The earlier saving was an artifact of valuing the baseline at Shopify retail × markup. Toggle to "Retail × markup" to see the old view.

## Known issues

- Live all-in cost default (Rs 35k) is optimistic vs real data (whole dressed carcass ~Rs 2,654/kg ≈ Rs 37.4k; live goat ~Rs 1,298/kg, both pre-slaughter/transport). Anchors are shown beside the slider; default left at Rs 35k pending the founder's true figure. A realistic ~Rs 38-40k widens the loss.
- Bones row saving math may overstate loss. Root cause is the uniform per-kg carcass-cost allocation (every kg charged live/carcass), not retail valuation — it inflates the loss on cheap/waste cuts and the gain on premium cuts in the per-cut Saving column. Headline total is unaffected. Worth a value-based allocation in a future iteration.
- Surplus leftover and "Can sell" recovery are still valued at full retail even in real mode; a wholesale/byproduct rate would be more honest. Does not affect the default headline (recovery default 0).

## Next planned

- Founder to confirm the true all-in cost per mutton (purchase + raising + slaughter + transport) so the live slider default can be set honestly; current real anchors imply ~Rs 38-40k.
- Decide framing for Taimur now that the honest answer is "buying cuts is cheaper than slaughtering at current costs." The tool's value shifts from "here's the saving" to "here's why vertical integration doesn't pay yet, and what would have to change (cheaper live sourcing, byproduct resale channel, premium-cut demand) for it to."
- Merge `feat/real-invoice-baseline` to main and deploy to Vercel.
- Tab 2 candidates: Profit & Closing, Inventory. To be scoped after Taimur conversation.

## Recent changes

- 2026-05-30 · procurement · Real vendor invoice baseline wired from t_fin_vendor_purchase_items, made default; retail × markup demoted to a toggle. Headline flips to a loss.
- 2026-05-25 · procurement · Routing modal + audit + foundational specs.
- 2026-05-24 · procurement · Saving column, routing UI scaffolding, opportunity icons, yield assumptions modal.
- 2026-05-23 · procurement · Single-page rebuild with honest math (shortfall, leftover, zero-recovery default).
