// Core domain types for the procurement backtest.

export type Animal = "mutton" | "cow";

// One canonical carcass cut, with its default yield % of dressed carcass.
export interface CutDef {
  key: string;
  label: string;
  yieldPct: number; // default % of dressed carcass weight
}

// Result of mapping a sales SKU (line-item name) to a canonical cut.
export interface SkuMapping {
  name: string; // raw line-item name
  animal: Animal | "chicken" | "lamb" | "qurbani" | "other";
  cutKey: string | null; // canonical cut, or null if unmapped
  unit: "kg" | "piece"; // sold by weight or by count
  whole: boolean; // whole/half-animal SKU -> demands all cuts proportionally
  processed: boolean; // value-added (kabab/samosa/patties/hunter beef)
  confidence: "code" | "keyword" | "low";
  flagged: boolean; // needs human confirmation
  reason: string; // why mapped / why flagged
  splits?: { cutKey: string; frac: number }[]; // combo SKUs spanning multiple cuts
  totalKg?: number; // demand over the window (display)
  lines?: number; // line-item count (display)
}

// Aggregated customer demand: date -> animal -> cutKey -> kg.
export type DemandByDayCut = Record<string, Record<Animal, Record<string, number>>>;

// Real vendor purchase rate per canonical cut (PKR/kg), per animal.
export type VendorRates = Record<Animal, Record<string, number>>;

export interface AnimalParams {
  liveWeightKg: number;
  dressingYieldPct: number;
  wholePricePkr: number; // all-in live animal cost
  processingCostPkr: number; // slaughter + processing per animal
  livePricePerKgSource: number | null; // real anchor from invoices, if any
  cutYields: Record<string, number>; // cutKey -> %
}

export interface Assumptions {
  baselineMode: "real_invoice" | "derived_markup";
  markupPct: number; // used in derived_markup mode + hybrid shortfall fallback
  perCutMarkup: Record<string, number>; // animal:cut overrides (optional)
  thresholdPct: number; // utilisation gate, default 75
  excessRecoveryPct: number; // 0 = conservative
  mutton: AnimalParams;
  cow: AnimalParams;
}

export interface WindowResult {
  selected: string[]; // YYYY-MM-DD, chronological
  excluded: { date: string; reason: string }[];
}

export interface CutLine {
  cutKey: string;
  label: string;
  demandKg: number;
  supplyKg: number;
  shortfallKg: number;
  excessKg: number;
  vendorRate: number;
}

export interface AnimalDayResult {
  animal: Animal;
  date: string;
  demandKg: number;
  decision: "slaughter" | "piecemeal";
  animalCount: number;
  utilisationPct: number; // % of slaughtered carcass directly sold
  piecemealCost: number;
  hybridCost: number;
  saving: number;
  fillIn: CutLine[]; // cuts bought from vendor (shortfall)
  excess: CutLine[]; // carcass cuts with no demand
}

export interface ModelResult {
  perDay: AnimalDayResult[];
  totals: {
    piecemeal: number;
    hybrid: number;
    saving: number;
    savingPct: number;
    annualised: number;
    muttonSlaughtered: number;
    cowSlaughtered: number;
    muttonPiecemealDays: number;
    cowPiecemealDays: number;
  };
}

export interface SkuDayKg {
  name: string;
  date: string;
  kg: number;
}

export interface Dataset {
  window: WindowResult;
  generatedAt: string;
  dbName: string;
  skuMap: SkuMapping[];
  skuDayKg: SkuDayKg[]; // raw per-SKU/day kg for live re-aggregation under overrides
  demand: DemandByDayCut;
  vendorRates: VendorRates;
  retailRates: VendorRates; // Shopify retail prices per cut, for excess valuation
  defaults: Assumptions;
  notes: string[];
}
