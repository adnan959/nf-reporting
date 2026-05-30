import type { SkuMapping, Animal } from "./types";

// Cut-code system observed in the catalog, e.g. "Mutton (LR) LEAN Leg (Raan)...".
// The parenthetical code is the most reliable signal; keywords are the fallback.
const MUTTON_CODE: Record<string, string> = {
  LR: "raan_leg", MQ: "keema", MB: "karahi", DT: "puth_shoulder",
  BP: "chops", LP: "raan_leg", FC: "champ_rack", BL: "raan_boneless",
  JS: "nalli_shank", NK: "karahi", HB: "__whole", WB: "__whole",
};
const COW_CODE: Record<string, string> = {
  MQ: "keema", BL: "boti_boneless", MB: "karahi", BP: "boti_boneless",
  NH: "nalli_shank", UC: "undercut", BT: "boti_boneless", SK: "undercut",
};

// Ordered keyword fallbacks: [regex, muttonCut, cowCut]. First match wins.
const KEYWORDS: [RegExp, string | null, string | null][] = [
  [/qeema|minced|mince/, "keema", "keema"],
  [/boneless|prime boneless|cubes/, "raan_boneless", "boti_boneless"],
  [/undercut|tenderloin/, null, "undercut"],
  [/pasanda|cutlet/, null, "pasanda"],
  [/back chops|puth/, "chops", "chaap_ribs"],
  [/front chops|champ|chaanmp|chanmp/, "champ_rack", "champ_rack"],
  [/nihari|ossobuco|\bshank\b|\bnalli\b|\bbong\b/, "nalli_shank", "nalli_shank"],
  [/karahi|mix boti|mix lean|kunna/, "karahi", "karahi"],
  [/shoulder|dasti/, "puth_shoulder", "puth_shoulder"],
  [/raan|\bleg\b/, "raan_leg", "boti_boneless"],
  [/sirloin|steak/, null, "boti_boneless"],
  [/\bchops\b|chaap|ribs/, "chops", "chaap_ribs"],
  [/\bneck\b|gardan/, "karahi", "karahi"],
  [/brain|maghaz/, "maghaz_brain", "maghaz_brain"],
  [/liver|kaleji/, "kaleji_liver", "kaleji_liver"],
  [/kidney|gurda/, "gurda_kidney", "gurda_kidney"],
  [/heart|\bdil\b/, "dil_heart", "dil_heart"],
  [/tongue|zaban/, "zaban_tongue", "zaban_tongue"],
  [/soup bone|\bbone\b|\bbones\b|oxtail|\bdum\b/, "bones", "bones"],
  [/\bfat\b/, "fat", "fat"],
  [/\bpaya\b|trotter/, "paya", "paya"],
];

// Chicken sale forms, matched on descriptive SKU names (first match wins).
// Order matters: breast (fillet/julienne/butterfly) and thigh are checked before
// the generic "boneless", so "Thigh Boneless" → thigh and "Boneless Fillet" → breast.
const CHICKEN_KEYWORDS: [RegExp, string][] = [
  [/karahi/, "karahi_cut"],
  [/qorma|korma/, "qorma_cut"],
  [/biryani/, "biryani_cut"],
  [/mince|qeema|keema/, "mince"],
  [/breast|fillet|julienne|butterfly/, "breast"],
  [/thigh/, "thigh"],
  [/drumstick|tikka leg|\bleg\b/, "drumstick"],
  [/wing/, "wing"],
  [/boneless|cubes|\bboti\b/, "boneless"],
  [/whole|roast|baby chicken/, "whole_roast"],
  [/\bbones?\b/, "bones"],
  [/liver|gizzard|offal/, "offal"],
];

function extractCode(name: string): string | null {
  // matches "(LR)", "(HB 3.5)", "(MQ)" etc.
  const m = name.match(/\(([A-Z]{2,3})(?:\s*[\d.]+)?\)/);
  return m ? m[1] : null;
}

export function mapSku(rawName: string): SkuMapping {
  const name = rawName.trim();
  const s = name.toLowerCase();
  const base: SkuMapping = {
    name, animal: "other", cutKey: null, unit: "kg",
    whole: false, processed: false, confidence: "low", flagged: true, reason: "",
  };

  // 1. Non-regular lines first (excluded from the model).
  if (/qurbani|hissa|cow share|aqeeqa|sadqa/.test(s))
    return { ...base, animal: "qurbani", flagged: false, reason: "Qurbani/charity line, excluded by spec" };
  if (/dog food|^df\b|\bdf -|\(df/.test(s))
    return { ...base, animal: "other", flagged: false, reason: "Dog food, excluded" };
  if (/\blamb\b/.test(s))
    return { ...base, animal: "lamb", flagged: true, reason: "Lamb (sheep), not mutton/cow, review" };

  // 2. Animal.
  const animal: Animal | null = /mutton|bakra/.test(s) ? "mutton" : /beef|veal/.test(s) ? "cow" : /chicken|murgh/.test(s) ? "chicken" : null;
  if (!animal) return { ...base, reason: "Animal type not recognised" };

  // "per kg" wins over a piece-count descriptor: chicken cuts like "Karahi Cut
  // (22 Pcs) per kg" are sold by weight; the "(22 Pcs)" just describes the chop.
  const unit: "kg" | "piece" = /per kg|per kilo/.test(s)
    ? "kg"
    : /per piece|per pcs|\(\d+\s*pcs?\)|\bpcs\b/.test(s) ? "piece" : "kg";
  const processed = /shami|samosa|kabab|patties|nugget|sausage|hunter beef|seekh|spring roll/.test(s);

  // 2b. Chicken: own path. Chicken SKUs use letter+digit codes (C0, B2, ...) that
  // extractCode doesn't capture, but the names are descriptive, so match on those.
  // Bone-in forms (karahi/qorma/biryani/whole) and boneless/breast/mince are the
  // sale forms in CUTS_CHICKEN. Dog-food chicken necks are already excluded above.
  if (animal === "chicken") {
    for (const [re, cut] of CHICKEN_KEYWORDS) {
      if (re.test(s))
        return { ...base, animal, unit, processed, cutKey: cut, confidence: "keyword",
          flagged: processed || unit !== "kg",
          reason: `Chicken keyword (${re.source.split("|")[0]})` + (processed ? " + processed" : "") + (unit !== "kg" ? " + per piece" : "") };
    }
    return { ...base, animal, unit, processed, reason: "Chicken line, no cut keyword match" };
  }

  // 3. Whole/half animal -> demands all cuts proportionally.
  if (/whole bakra|half bakra/.test(s) || extractCode(name) === "HB" || extractCode(name) === "WB")
    return { ...base, animal, unit, whole: true, cutKey: "__whole", confidence: "code", flagged: false,
      reason: "Whole/half carcass order (all cuts proportionally)" };

  // 3b. Combo SKUs ("Leg (Raan) & Back Chops (Puth) Mix") span 2+ cuts -> split.
  if (name.includes("&")) {
    const found: string[] = [];
    for (const [re, gc, cc] of KEYWORDS) {
      if (re.test(s)) { const cut = animal === "mutton" ? gc : cc; if (cut && !found.includes(cut)) found.push(cut); }
    }
    if (found.length >= 2) {
      const frac = 1 / found.length;
      return { ...base, animal, unit, processed, cutKey: found[0],
        splits: found.map((c) => ({ cutKey: c, frac })), confidence: "keyword", flagged: true,
        reason: `Combo split across ${found.length} cuts: ${found.join(", ")}` };
    }
  }

  const codeMap = animal === "mutton" ? MUTTON_CODE : COW_CODE;
  const code = extractCode(name);

  // 4. Code-based mapping (highest confidence).
  if (code && codeMap[code] && codeMap[code] !== "__whole") {
    return { ...base, animal, unit, processed, cutKey: codeMap[code], confidence: "code",
      flagged: processed || unit === "piece",
      reason: `Code (${code})` + (processed ? " + processed product" : "") + (unit === "piece" ? " + sold per piece" : "") };
  }

  // 5. Keyword fallback.
  for (const [re, gc, cc] of KEYWORDS) {
    if (re.test(s)) {
      const cut = animal === "mutton" ? gc : cc;
      if (cut) return { ...base, animal, unit, processed, cutKey: cut, confidence: "keyword",
        flagged: true, reason: `Keyword match (${re.source.split("|")[0]})` + (processed ? " + processed" : "") };
    }
  }

  return { ...base, animal, unit, processed, reason: "No code or keyword match, needs manual mapping" };
}

// Distribute one line's kg into cut buckets, honouring combo splits.
// Returns [] for non-mutton/cow or non-kg lines. "__whole" is returned as-is
// (callers explode it via carcass yields).
export function allocate(m: SkuMapping, kg: number): { cutKey: string; kg: number }[] {
  if (m.unit !== "kg" || (m.animal !== "mutton" && m.animal !== "cow" && m.animal !== "chicken")) return [];
  if (m.splits?.length) return m.splits.map((s) => ({ cutKey: s.cutKey, kg: kg * s.frac }));
  if (m.cutKey) return [{ cutKey: m.cutKey, kg }];
  return [];
}

// Map a coarse vendor purchase product_name to a canonical cut group (for real rates).
export function mapVendorProduct(rawName: string): { animal: Animal | null; cutKey: string | null } {
  const s = rawName.toLowerCase();
  if (/onion|garlic|potato|ginger|carrot|chilli|piyaaz|lehsan|aaloo|adrak/.test(s)) return { animal: null, cutKey: null };
  const animal: Animal | null = /mutton/.test(s) ? "mutton" : /veal|beef/.test(s) ? "cow" : /goat/.test(s) ? "mutton" : null;
  if (!animal) return { animal: null, cutKey: null };
  if (/undercut/.test(s)) return { animal, cutKey: "undercut" };
  if (/boneless/.test(s)) return { animal, cutKey: "boti_boneless" };
  if (/soup bone|\bbones?\b|\bnalli\b/.test(s)) return { animal, cutKey: "bones" }; // keep cheap bones out of __generic
  if (/raan|haddi wali/.test(s)) return { animal, cutKey: "raan_leg" };
  if (/\bmix\b/.test(s)) return { animal, cutKey: "karahi" };
  if (/\bfat\b/.test(s)) return { animal, cutKey: "fat" };
  // generic mutton/veal purchase -> applies as a blended rate to all cuts
  return { animal, cutKey: "__generic" };
}
