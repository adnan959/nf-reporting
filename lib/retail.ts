import type { VendorRates } from "./types";

// Retail selling prices per cut (PKR/kg), derived from the Shopify storefront
// catalog (nizamifarms.myshopify.com). Used to value EXCESS cuts IF a resale
// channel exists. These are defaults and are editable in the UI. A few obvious
// outliers were sanitised (mutton raan inflated by whole-leg roasts; cow undercut
// raised to at least its vendor cost).
export const RETAIL_RATES: VendorRates = {
  mutton: {
    raan_leg: 4860, raan_boneless: 2850, karahi: 3290, keema: 2420, chops: 3020,
    champ_rack: 3350, chaap_ribs: 3035, puth_shoulder: 4002, nalli_shank: 3720,
    pasanda: 3150, kaleji_liver: 1700, gurda_kidney: 505, maghaz_brain: 420,
    bones: 1285, fat: 400, paya: 600, siri_head: 500, dil_heart: 500, zaban_tongue: 500, trim: 300,
  },
  cow: {
    boti_boneless: 2104, keema: 1998, karahi: 1798, undercut: 2452, nalli_shank: 2001,
    bong_foreshank: 1800, pasanda: 1915, chops: 1820, champ_rack: 1800, chaap_ribs: 1800,
    puth_shoulder: 1800, kaleji_liver: 1275, gurda_kidney: 300, maghaz_brain: 400,
    bones: 777, fat: 200, paya: 400, siri_head: 400, dil_heart: 400, zaban_tongue: 400, trim: 200,
  },
};
