import type { Animal } from "./types";

// Per-animal UI configuration for the procurement comparison. The component is
// otherwise animal-agnostic (it operates on AnimalData.cuts); everything that
// genuinely differs between mutton and cow lives here.
export interface AnimalConfig {
  animal: Animal;
  label: string; // "Mutton" / "Cow"
  unitWord: string; // lowercase noun used in copy: "mutton" / "cow"
  // In-house whole-animal cost slider
  defaultLiveWeight: number; // kg
  defaultDressingPct: number; // dressed carcass as % of live weight
  defaultLivePrice: number; // all-in whole-animal cost (purchase + slaughter + transport)
  livePriceMin: number;
  livePriceMax: number;
  livePriceStep: number;
  liveSliderLabel: string;
  // True when we have no real purchase anchor for the whole animal (cow: we never
  // buy live/whole cow), so the slider value must be flagged as an unverified estimate.
  livePriceEstimate: boolean;
  // Operationally-sensible re-routing of over-supplied cuts into over-demanded ones.
  routes: { id: string; src: string; dst: string; desc: string }[];
}

export const ANIMAL_CONFIG: Record<Animal, AnimalConfig> = {
  mutton: {
    animal: "mutton",
    label: "Mutton",
    unitWord: "mutton",
    defaultLiveWeight: 30,
    defaultDressingPct: 47,
    defaultLivePrice: 35000,
    livePriceMin: 20000,
    livePriceMax: 45000,
    livePriceStep: 100,
    liveSliderLabel: "Whole mutton all-in cost (purchase + raising + slaughter + transport)",
    livePriceEstimate: false,
    routes: [
      { id: "shoulder_keema", src: "puth_shoulder", dst: "keema", desc: "Grind shoulder excess into mince" },
      { id: "raanbl_keema", src: "raan_boneless", dst: "keema", desc: "Grind boneless excess" },
      { id: "nalli_keema", src: "nalli_shank", dst: "keema", desc: "Debone shank, grind" },
      { id: "chaap_karahi", src: "chaap_ribs", dst: "karahi", desc: "Mix ribs into karahi blend" },
      { id: "fat_keema", src: "fat", dst: "keema", desc: "Add fat content to mince blend" },
    ],
  },
  cow: {
    animal: "cow",
    label: "Cow",
    unitWord: "cow",
    defaultLiveWeight: 250,
    defaultDressingPct: 50,
    defaultLivePrice: 200000,
    livePriceMin: 120000,
    livePriceMax: 320000,
    livePriceStep: 1000,
    liveSliderLabel: "Whole cow all-in cost (purchase + slaughter + transport)",
    livePriceEstimate: true, // we do not buy live/whole cow today — this is an estimate
    routes: [
      { id: "pasanda_keema", src: "pasanda", dst: "keema", desc: "Grind thin steaks into mince" },
      { id: "champ_karahi", src: "champ_rack", dst: "karahi", desc: "Mix rack into karahi blend" },
      { id: "chaap_karahi", src: "chaap_ribs", dst: "karahi", desc: "Mix ribs into karahi blend" },
      { id: "bong_keema", src: "bong_foreshank", dst: "keema", desc: "Debone foreshank, grind" },
      { id: "fat_keema", src: "fat", dst: "keema", desc: "Add fat content to mince blend" },
    ],
  },
};
