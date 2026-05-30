import type { CutDef, Animal } from "./types";

// Pakistani-standard carcass cut anatomy (defaults from the PoC spec).
// Every yield % is a default and is editable in the UI. They sum to ~100.

export const CUTS_MUTTON: CutDef[] = [
  { key: "chops", label: "Chops", yieldPct: 10 },
  { key: "raan_leg", label: "Raan / Leg (bone-in)", yieldPct: 18 },
  { key: "raan_boneless", label: "Raan boneless", yieldPct: 6 },
  { key: "puth_shoulder", label: "Puth / Shoulder", yieldPct: 14 },
  { key: "karahi", label: "Karahi cut (mixed bone-in)", yieldPct: 18 },
  { key: "keema", label: "Keema / Mince", yieldPct: 8 },
  { key: "champ_rack", label: "Champ / Rack", yieldPct: 4 },
  { key: "chaap_ribs", label: "Chaap / Ribs", yieldPct: 4 },
  { key: "nalli_shank", label: "Nalli / Shank", yieldPct: 4 },
  { key: "paya", label: "Paya / Trotters", yieldPct: 3 },
  { key: "kaleji_liver", label: "Kaleji / Liver", yieldPct: 2 },
  { key: "maghaz_brain", label: "Maghaz / Brain", yieldPct: 0.8 },
  { key: "gurda_kidney", label: "Gurda / Kidney", yieldPct: 0.5 },
  { key: "dil_heart", label: "Dil / Heart", yieldPct: 0.5 },
  { key: "zaban_tongue", label: "Zaban / Tongue", yieldPct: 0.3 },
  { key: "siri_head", label: "Siri / Head", yieldPct: 2 },
  { key: "bones", label: "Bones", yieldPct: 3 },
  { key: "fat", label: "Fat", yieldPct: 1 },
  { key: "trim", label: "Trim / waste", yieldPct: 0.9 },
];

export const CUTS_COW: CutDef[] = [
  { key: "undercut", label: "Undercut / Tenderloin", yieldPct: 2 },
  { key: "boti_boneless", label: "Boti boneless / Lean", yieldPct: 28 },
  { key: "pasanda", label: "Pasanda / Thin steaks", yieldPct: 6 },
  { key: "keema", label: "Keema / Mince", yieldPct: 14 },
  { key: "karahi", label: "Karahi cut (mixed bone-in)", yieldPct: 18 },
  { key: "champ_rack", label: "Champ / Rack", yieldPct: 3 },
  { key: "chaap_ribs", label: "Chaap / Ribs", yieldPct: 4 },
  { key: "nalli_shank", label: "Nalli / Shank", yieldPct: 5 },
  { key: "bong_foreshank", label: "Bong / Foreshank", yieldPct: 2 },
  { key: "paya", label: "Paya / Trotters", yieldPct: 2 },
  { key: "kaleji_liver", label: "Kaleji / Liver", yieldPct: 2 },
  { key: "maghaz_brain", label: "Maghaz / Brain", yieldPct: 0.4 },
  { key: "gurda_kidney", label: "Gurda / Kidney", yieldPct: 0.4 },
  { key: "dil_heart", label: "Dil / Heart", yieldPct: 0.5 },
  { key: "zaban_tongue", label: "Zaban / Tongue", yieldPct: 0.3 },
  { key: "siri_head", label: "Siri / Head", yieldPct: 1.5 },
  { key: "bones", label: "Bones", yieldPct: 7 },
  { key: "fat", label: "Fat", yieldPct: 3 },
  { key: "trim", label: "Trim / waste", yieldPct: 0.9 },
];

// Chicken is sold mostly as processing/sale forms (karahi cut, boneless cubes,
// mince, breast) rather than strict anatomy, so — like CUTS_COW's boti/keema/
// karahi — these "cuts" are an allocation of a dressed bird's sellable kg across
// the forms customers actually buy. Yields sum to 100. Defaults are broiler-mix
// approximations; validate against real processing once available.
export const CUTS_CHICKEN: CutDef[] = [
  { key: "karahi_cut", label: "Karahi cut (bone-in)", yieldPct: 22 },
  { key: "breast", label: "Breast (boneless)", yieldPct: 16 },
  { key: "boneless", label: "Boneless cubes", yieldPct: 14 },
  { key: "thigh", label: "Thigh", yieldPct: 9 },
  { key: "drumstick", label: "Drumstick / Leg", yieldPct: 8 },
  { key: "mince", label: "Keema / Mince", yieldPct: 8 },
  { key: "qorma_cut", label: "Qorma cut (bone-in)", yieldPct: 7 },
  { key: "whole_roast", label: "Whole (roast)", yieldPct: 5 },
  { key: "biryani_cut", label: "Biryani cut (bone-in)", yieldPct: 4 },
  { key: "wing", label: "Wings", yieldPct: 3 },
  { key: "bones", label: "Bones", yieldPct: 3 },
  { key: "offal", label: "Offal (liver / gizzard)", yieldPct: 1 },
];

export function cutsFor(animal: Animal): CutDef[] {
  if (animal === "mutton") return CUTS_MUTTON;
  if (animal === "cow") return CUTS_COW;
  return CUTS_CHICKEN;
}

export function defaultCutYields(animal: Animal): Record<string, number> {
  const out: Record<string, number> = {};
  for (const c of cutsFor(animal)) out[c.key] = c.yieldPct;
  return out;
}

export function cutLabel(animal: Animal, key: string): string {
  return cutsFor(animal).find((c) => c.key === key)?.label ?? key;
}

// Data-informed defaults. Mutton live price is anchored on real "Mutton Live Weight"
// vendor invoices (~Rs 1,300/kg). Cow live price is a spec estimate (we do not
// buy live cows today) and is flagged as such in the UI.
export const DEFAULT_MUTTON_LIVE_PER_KG = 1300;
export const DEFAULT_MUTTON_LIVE_WEIGHT = 28;
export const DEFAULT_COW_LIVE_WEIGHT = 250;
export const DEFAULT_COW_WHOLE_PRICE = 200000;
