// PKR formatting: thousands ("K") everywhere for consistency — no lakh/crore mixing.
// Rs X (under 1,000), else Rs <thousands>K (1 decimal under 100K, comma-grouped above).
export function rs(n: number): string {
  const neg = n < 0;
  const a = Math.abs(n);
  let s: string;
  if (a < 1000) s = "Rs " + Math.round(a).toLocaleString("en-PK");
  else {
    const k = a / 1000;
    s = "Rs " + (k < 100 ? trim1(k) : Math.round(k).toLocaleString("en-PK")) + "K";
  }
  return neg ? "-" + s : s;
}

function trim1(x: number): string {
  const v = Math.round(x * 10) / 10;
  return Number.isInteger(v) ? String(v) : v.toFixed(1);
}

// Full rupee figure, no k/L abbreviation (e.g. Rs 88,60,000).
export function rsFull(n: number): string {
  return "Rs " + Math.round(n).toLocaleString("en-PK");
}

export function kg(n: number): string {
  return (Math.round(n * 10) / 10).toLocaleString("en-PK", { maximumFractionDigits: 1 }) + " kg";
}

export function pct(n: number): string {
  return (Math.round(n * 10) / 10) + "%";
}
