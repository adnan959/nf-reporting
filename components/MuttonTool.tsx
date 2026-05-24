"use client";

import { useEffect, useMemo, useState } from "react";
import type { MuttonData } from "@/lib/mutton";
import { rs, kg, pct } from "@/lib/format";
import { Settings, Lightbulb, ChevronDown, Shuffle } from "lucide-react";

const C = {
  orange: "#D94B1F", deep: "#7A2410", warm: "#FFF4EC", page: "#F4F1EA",
  text: "#221E1A", text2: "#6E6052", faint: "#A89C8B",
  heroBg: "#FBF7F1", heroBorder: "#ECE2D2",
  cardBorder: "#EAE0D1", rowBorder: "#F1EBE0", rowHover: "#FAF6F0",
  green: "#1D9E75", greenDark: "#0B6B4F", greenBg: "#E6F4EE",
  amber: "#EF9F27", amberDark: "#8A5208", amberBg: "#FBF1DD",
  red: "#A32D2D", redBg: "#FBEAEA",
};
const SHADOW = "0 1px 2px rgba(45,30,15,0.04), 0 12px 28px -16px rgba(45,30,15,0.20)";
const HEAD_H = 46; // identical header height on both comparison tables
const ROW_H = 50;  // identical data-row height so the two tables line up row-for-row

const sum = <T,>(a: T[], f: (t: T) => number) => a.reduce((s, x) => s + f(x), 0);

// Operationally-sensible re-routing of over-supplied cuts into over-demanded ones.
const ROUTES: { id: string; src: string; dst: string; desc: string }[] = [
  { id: "shoulder_keema", src: "puth_shoulder", dst: "keema", desc: "Grind shoulder excess into mince" },
  { id: "raanbl_keema", src: "raan_boneless", dst: "keema", desc: "Grind boneless excess" },
  { id: "nalli_keema", src: "nalli_shank", dst: "keema", desc: "Debone shank, grind" },
  { id: "chaap_karahi", src: "chaap_ribs", dst: "karahi", desc: "Mix ribs into karahi blend" },
  { id: "fat_keema", src: "fat", dst: "keema", desc: "Add fat content to mince blend" },
];

export function MuttonTool({ d90, d180 }: { d90: MuttonData; d180: MuttonData }) {
  const [windowDays, setWindowDays] = useState<90 | 180>(180);
  const data = windowDays === 90 ? d90 : d180;
  const [markup, setMarkup] = useState(10);
  const [overrides, setOverrides] = useState<Record<string, number>>({});
  const [modal, setModal] = useState(false);
  const [yieldModal, setYieldModal] = useState(false);
  const [routeModal, setRouteModal] = useState(false);
  const [routing, setRouting] = useState<Record<string, number>>({}); // kg applied per route id
  const [conversionCost, setConversionCost] = useState(50); // Rs per kg routed (labour + grinding + repackaging)
  const [live, setLive] = useState(35000); // all-in cost per mutton (purchase + raising + slaughter + transport)
  const [canSell, setCanSell] = useState<Record<string, number>>({}); // kg of each leftover cut you can sell at retail

  // Carcass assumptions are now editable and drive every projection live.
  const defaultYields = useMemo(() => Object.fromEntries(data.cuts.map((c) => [c.key, c.yieldPct])), [data]);
  const [liveWeight, setLiveWeight] = useState(30); // live animal weight (kg)
  const [dressingPct, setDressingPct] = useState(47); // dressed carcass as % of live weight
  const [yields, setYields] = useState<Record<string, number>>(() => ({ ...defaultYields }));
  const [tip, setTip] = useState<{ text: string; x: number; y: number } | null>(null); // shared hover tooltip

  // Delegated tooltip: any element with a data-tip attribute shows a styled, fixed-position
  // tooltip (native title tooltips are slow and get clipped by the table's overflow container).
  useEffect(() => {
    const onOver = (e: MouseEvent) => {
      const el = (e.target as HTMLElement)?.closest?.("[data-tip]") as HTMLElement | null;
      if (!el) return setTip(null);
      const r = el.getBoundingClientRect();
      const x = Math.min(Math.max(r.left + r.width / 2, 180), (window.innerWidth || 1600) - 180);
      setTip({ text: el.getAttribute("data-tip") || "", x, y: r.top });
    };
    document.addEventListener("mouseover", onOver);
    return () => document.removeEventListener("mouseover", onOver);
  }, []);

  const totalDemandKg = useMemo(() => sum(data.cuts, (c) => c.soldKg), [data]);
  const carcassKg = liveWeight * (dressingPct / 100); // dressed carcass kg (default 30 × 47% = 14.1)
  const N = carcassKg > 0 ? totalDemandKg / carcassKg : 0; // mutton needed to cover total demand
  const sumYields = sum(data.cuts, (c) => yields[c.key] ?? c.yieldPct);
  const driftWarn = Math.abs(sumYields - 100) > 0.05;

  const calc = useMemo(() => {
    const carcassUnitCost = carcassKg > 0 ? live / carcassKg : 0; // Rs per kg of carcass meat (whole-animal cost spread over yield)
    // 1) Base per-cut metrics (pre-routing).
    const base = data.cuts.map((c) => {
      const eff = overrides[c.key] ?? markup;
      const butcherPrice = c.retail * (1 + eff / 100); // vendor price = retail × (1 + markup)
      const cutYield = yields[c.key] ?? c.yieldPct;
      const kgPerMutton = carcassKg * (cutYield / 100);
      const demand = c.soldKg; // real customer demand
      const yielded = N * kgPerMutton; // what N carcasses produce
      const carcassSold = Math.min(demand, yielded);
      const shortfall = Math.max(0, demand - yielded); // over-demanded → bought from vendor
      const leftover = Math.max(0, yielded - demand); // over-supplied
      const todaySpend = demand * butcherPrice;
      return { c, eff, butcherPrice, kgPerMutton, demand, yielded, carcassSold, shortfall, leftover, todaySpend };
    });
    const byKey = Object.fromEntries(base.map((b) => [b.c.key, b])) as Record<string, (typeof base)[number]>;

    // 2) Routing: walk routes in order; each capped by REMAINING source leftover & dest shortfall
    //    so multiple routes into the same destination can't over-fill it (no double-count).
    const remLeft: Record<string, number> = {};
    const remShort: Record<string, number> = {};
    for (const b of base) { remLeft[b.c.key] = b.leftover; remShort[b.c.key] = b.shortfall; }
    const routedIn: Record<string, number> = {};
    const routedOut: Record<string, number> = {};
    const routeRows = ROUTES.map((rt) => {
      const s = byKey[rt.src]; const d = byKey[rt.dst];
      const maxKg = s && d ? Math.max(0, Math.min(remLeft[rt.src], remShort[rt.dst])) : 0;
      const applied = Math.min(Math.max(0, routing[rt.id] ?? 0), maxKg);
      remLeft[rt.src] -= applied; remShort[rt.dst] -= applied;
      routedOut[rt.src] = (routedOut[rt.src] ?? 0) + applied;
      routedIn[rt.dst] = (routedIn[rt.dst] ?? 0) + applied;
      const dstPrice = d ? d.butcherPrice : 0;
      const netSaving = applied * (dstPrice - conversionCost); // avoided vendor buy − conversion (raw cut already sunk in animal cost)
      return { id: rt.id, desc: rt.desc, srcKey: rt.src, dstKey: rt.dst, srcLabel: s?.c.label ?? rt.src, dstLabel: d?.c.label ?? rt.dst, maxKg, applied, netSaving, enabled: maxKg > 0.5 };
    });
    const totalRoutedKg = routeRows.reduce((acc, r) => acc + r.applied, 0);
    const conversionTotal = totalRoutedKg * conversionCost;
    const routingSaving = routeRows.reduce((acc, r) => acc + r.netSaving, 0);

    // 3) Effective rows after routing: shortfall/leftover reduced; conversion charged to the destination.
    const rows = base.map((b) => {
      const k = b.c.key;
      const rin = routedIn[k] ?? 0; // kg routed INTO this cut (cuts its shortfall)
      const rout = routedOut[k] ?? 0; // kg routed OUT of this cut (cuts its leftover)
      const shortfall = Math.max(0, b.shortfall - rin);
      const leftover = Math.max(0, b.leftover - rout);
      const shortfallCost = shortfall * b.butcherPrice;
      const leftoverValue = leftover * b.c.retail;
      const canSellKg = Math.min(Math.max(0, canSell[k] ?? 0), leftover); // can't resell what you routed away
      const recovery = canSellKg * b.c.retail;
      const conversionCostRow = rin * conversionCost;
      const pctSold = b.yielded > 0 ? (b.carcassSold / b.yielded) * 100 : 0;
      // Per-cut saving = today's vendor cost − in-house cost (carcass-meat share + shortfall bought − leftover resold + routing conversion).
      const saving = b.todaySpend - (b.yielded * carcassUnitCost + shortfallCost - recovery + conversionCostRow);
      return { ...b.c, eff: b.eff, butcherPrice: b.butcherPrice, kgPerMutton: b.kgPerMutton, demand: b.demand, yielded: b.yielded, carcassSold: b.carcassSold, shortfall, leftover, routedIn: rin, routedOut: rout, todaySpend: b.todaySpend, shortfallCost, leftoverValue, canSellKg, recovery, pctSold, saving };
    });

    const today90 = sum(rows, (r) => r.todaySpend);
    const shortfall90 = sum(rows, (r) => r.shortfallCost);
    const shortfallKg90 = sum(rows, (r) => r.shortfall);
    const leftoverVal90 = sum(rows, (r) => r.leftoverValue);
    const recovery90 = sum(rows, (r) => r.recovery); // only from explicit "can sell" inputs
    const gross90 = N * live;
    // In-house = whole mutton + shortfall bought from vendors − leftover resold + routing conversion cost.
    const inhouse90 = gross90 + shortfall90 - recovery90 + conversionTotal;
    return {
      rows, routeRows, today90, shortfall90, shortfallKg90, leftoverVal90, recovery90, gross90,
      conversionTotal, routingSaving, totalRoutedKg, inhouse90,
      diff90: today90 - inhouse90,
      totalSoldKgDemand: sum(rows, (r) => r.demand),
      totalYielded90: sum(rows, (r) => r.yielded),
      totalCarcassSold90: sum(rows, (r) => r.carcassSold),
      totalLeftover90: sum(rows, (r) => r.leftover),
    };
  }, [data, markup, overrides, live, canSell, N, carcassKg, yields, routing, conversionCost]);

  const W = data.windowDays;
  const periodWord = `${W} days`;
  const cheaper = calc.diff90 > 0;
  const savingPct = calc.today90 > 0 ? (calc.diff90 / calc.today90) * 100 : 0; // + = in-house cheaper

  const THRESH = 0.75 * carcassKg; // a day "justifies" slaughter if demand >= 75% of one carcass
  const greenDays = data.perDay.filter((d) => d.kg >= THRESH).length;
  const amberDays = data.perDay.length - greenDays;

  const orderedRows = [...calc.rows].sort((a, b) => b.demand - a.demand); // same order on both tables so rows line up
  const topShortfall = [...calc.rows].filter((r) => r.shortfall > 0.05).sort((a, b) => b.shortfall - a.shortfall).slice(0, 2).map((r) => r.label);
  const ovCount = Object.keys(overrides).length;
  const cutsBySales = [...data.cuts].sort((a, b) => b.soldKg - a.soldKg);
  const totalSold = calc.totalSoldKgDemand;
  const totalCanSellKg = calc.rows.reduce((s, r) => s + r.canSellKg, 0);
  const setCanSellFor = (key: string, max: number, raw: number) => setCanSell((s) => ({ ...s, [key]: Math.max(0, Math.min(max, raw || 0)) }));
  const setYieldFor = (key: string, raw: number) => setYields((y) => ({ ...y, [key]: Math.max(0, raw || 0) }));
  const setRoutingFor = (id: string, raw: number) => setRouting((s) => ({ ...s, [id]: Math.max(0, raw || 0) }));
  const clearRouting = () => setRouting({});
  const resetAssumptions = () => { setLiveWeight(30); setDressingPct(47); setYields({ ...defaultYields }); };
  const fatKg = data.cuts.find((c) => c.key === "fat")?.soldKg ?? 0;
  const sharePct = (demand: number) => pct(calc.totalSoldKgDemand > 0 ? (demand / calc.totalSoldKgDemand) * 100 : 0);
  const yieldHalf = Math.ceil(data.cuts.length / 2);
  const yieldCols = [data.cuts.slice(0, yieldHalf), data.cuts.slice(yieldHalf)]; // two-column yield editor

  return (
    <div style={{ background: C.page, color: C.text }} className="min-h-screen">
      {/* Top-level navigation */}
      <nav className="border-b" style={{ borderColor: C.cardBorder, background: "white" }}>
        <div className="mx-auto flex max-w-[1600px] items-center gap-1.5 px-5 py-3">
          <span className="mr-4 text-[15px] font-bold tracking-tight" style={{ color: C.deep }}>Nizami Farms</span>
          {[
            { label: "Procurement", active: true },
            { label: "Profit & Closing", active: false },
            { label: "Inventory", active: false },
          ].map((n) => (
            <span key={n.label} title={n.active ? undefined : "Coming soon"}
              className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium transition-colors"
              style={n.active ? { background: C.warm, color: C.deep } : { color: C.faint, cursor: "not-allowed" }}>
              {n.label}
              {!n.active && <span className="rounded-full px-1.5 py-[1px] text-[9px] font-semibold uppercase tracking-wide" style={{ background: "#EBE4D8", color: C.text2 }}>Soon</span>}
            </span>
          ))}
        </div>
      </nav>
      <div className="mx-auto max-w-[1600px] space-y-5 px-5 py-9">

        {/* 1. Header */}
        <header className="pb-1">
          <div className="text-[11px] font-semibold uppercase tracking-[0.18em]" style={{ color: C.orange }}>Buy vs slaughter · {W}-day backtest</div>
          <h1 className="mt-1.5 text-[34px] font-bold leading-tight tracking-tight" style={{ color: C.deep }}>Today vs in-house slaughter</h1>
          <p className="mt-1.5 max-w-3xl text-[15px] leading-relaxed" style={{ color: C.text2 }}>
            A {W}-day backtest on real order data: would slaughtering whole mutton in-house beat buying cuts from vendors? Adjust the assumptions and the whole comparison recalculates.
          </p>
          <div className="mt-3.5 flex flex-wrap items-center gap-x-2.5 gap-y-1.5 text-[12px]" style={{ color: C.text2 }}>
            <Meta>{data.dateMin} – {data.dateMax}</Meta>
            <Meta>{kg(totalDemandKg)} mutton demand</Meta>
            <Meta>{Math.round(N).toLocaleString("en-PK")} carcass-equivalents</Meta>
            <Meta>Mutton only · Qurbani excluded</Meta>
          </div>
        </header>

        {/* Species tabs + fixed data window */}
        <div className="flex flex-wrap items-center gap-3">
          <div className="inline-flex items-center gap-1 rounded-xl border p-1" style={{ borderColor: C.cardBorder, background: "white", boxShadow: SHADOW }}>
            {[
              { k: "mutton", label: "Mutton", active: true },
              { k: "cow", label: "Cow", active: false },
              { k: "chicken", label: "Chicken", active: false },
            ].map((t) => (
              <button key={t.k} disabled={!t.active} title={t.active ? undefined : "Coming soon"}
                className="flex items-center gap-1.5 rounded-lg px-4 py-1.5 text-sm font-semibold transition-colors"
                style={t.active ? { background: C.deep, color: "white" } : { color: C.faint, cursor: "not-allowed" }}>
                {t.label}
                {!t.active && <span className="rounded-full px-1.5 py-[1px] text-[9px] font-semibold uppercase tracking-wide" style={{ background: "#EBE4D8", color: C.text2 }}>Soon</span>}
              </button>
            ))}
          </div>
          <div className="relative" title="Backtest window">
            <select value={String(windowDays)} onChange={(e) => setWindowDays(Number(e.target.value) as 90 | 180)} aria-label="Backtest window"
              className="cursor-pointer appearance-none rounded-xl border bg-white py-2 pl-3.5 pr-9 text-sm font-semibold outline-none transition-colors hover:bg-black/[0.02] focus:border-[#D94B1F] focus:ring-2 focus:ring-[#D94B1F]/25" style={{ borderColor: C.cardBorder, color: C.text, boxShadow: SHADOW }}>
              <option value="90">90 days</option>
              <option value="180">180 days</option>
            </select>
            <ChevronDown size={15} className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2" style={{ color: C.faint }} />
          </div>
        </div>

        {/* 2. Side-by-side comparison */}
        <div className="grid grid-cols-1 gap-5 xl:grid-cols-[2fr_3fr]">
          {/* Left: Today */}
          <Card>
            <div className="flex items-start justify-between gap-2">
              <div>
                <div className="text-[10.5px] font-semibold uppercase tracking-[0.14em]" style={{ color: C.faint }}>Baseline · what you do now</div>
                <h2 className="mt-1 text-[17px] font-semibold" style={{ color: C.text }}>Buying from vendors</h2>
              </div>
              <button onClick={() => setModal(true)} title="Override markup per cut" aria-label="Override markup per cut" className="-mr-1 flex shrink-0 items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-[12px] font-medium transition-colors hover:bg-black/5" style={{ borderColor: "#D9CEBD", color: C.text2 }}>
                <Settings size={15} /> Markups
              </button>
            </div>
            <div className="mt-3 space-y-3">
              <Slider label="Vendor markup over wholesale" value={markup} min={5} max={20} step={1} suffix="%" onChange={setMarkup} />
              {ovCount > 0 && (
                <div className="text-[11px]" style={{ color: C.text2 }}>
                  Overrides: {Object.entries(overrides).map(([k, v]) => `${data.cuts.find((c) => c.key === k)?.label ?? k} ${v}%`).join(", ")}
                </div>
              )}
            </div>
            <HeroNumber dot={<LiveDot />} value={rs(calc.today90)} label={`${W}-day vendor spend`} sub={`${kg(calc.totalSoldKgDemand)} of cuts sold`} />
            <table className="mt-5 w-full text-sm">
              <thead>
                <tr className="text-left align-bottom" style={{ height: HEAD_H, color: C.text2 }}>
                  <th className="pb-2 pr-2 font-medium">Cut</th>
                  <th className="pb-2 px-2 text-right font-medium"><Th title="Share of total kg sold (this cut vs all cuts)">Share</Th></th>
                  <th className="pb-2 px-2 text-right font-medium"><Th title="Customer demand for this cut, from real orders">Demand</Th></th>
                  <th className="pb-2 pl-2 text-right font-medium"><Th title="What you pay vendors: kg × retail price × (1 + markup)">Cost</Th></th>
                </tr>
              </thead>
              <tbody>
                {orderedRows.map((r) => (
                  <tr key={r.key} className="border-t align-middle transition-colors hover:bg-[#FAF6F0]" style={{ height: ROW_H, borderColor: C.rowBorder }}>
                    <td className="pr-2">{r.label}</td>
                    <td className="px-2 text-right tabular-nums" style={{ color: C.text2 }}>{sharePct(r.demand)}</td>
                    <td className="px-2 text-right tabular-nums">{Math.round(r.demand)}</td>
                    <td className="pl-2 text-right font-medium tabular-nums">{rs(r.todaySpend)}</td>
                  </tr>
                ))}
                <tr className="border-t-2 align-middle font-semibold" style={{ height: ROW_H, borderColor: C.text2 }}>
                  <td className="pr-2">Total</td>
                  <td className="px-2 text-right tabular-nums">100%</td>
                  <td className="px-2 text-right tabular-nums">{Math.round(calc.totalSoldKgDemand)}</td>
                  <td className="pl-2 text-right tabular-nums">{rs(calc.today90)}</td>
                </tr>
              </tbody>
            </table>
          </Card>

          {/* Right: In-house */}
          <Card>
            <div className="flex items-start justify-between gap-2">
              <div>
                <div className="text-[10.5px] font-semibold uppercase tracking-[0.14em]" style={{ color: C.faint }}>Alternative · the proposed model</div>
                <h2 className="mt-1 text-[17px] font-semibold" style={{ color: C.text }}>Slaughtering in-house</h2>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                <button onClick={() => setRouteModal(true)} data-tip="Reuse leftover cuts to fill shortfalls. Click to see opportunities." aria-label="Routing opportunities" className="flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-[12px] font-medium transition-colors hover:bg-black/5" style={{ borderColor: "#D9CEBD", color: C.text2 }}>
                  <Shuffle size={14} /> Routing
                </button>
                <button onClick={() => setYieldModal(true)} title="Carcass yield assumptions" aria-label="Carcass yield assumptions" className="-mr-1 flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-[12px] font-medium transition-colors hover:bg-black/5" style={{ borderColor: "#D9CEBD", color: C.text2 }}>
                  <Settings size={15} /> Yields
                </button>
              </div>
            </div>
            <div className="mt-3 space-y-3">
              <Slider label="Whole mutton all-in cost (purchase + raising + slaughter + transport)" value={live} min={20000} max={45000} step={100} suffix="" fmt={rs} onChange={setLive} />
            </div>
            <HeroNumber
              dot={<span className="inline-block h-2.5 w-2.5 rounded-full" style={{ background: C.amber }} title="Projected from carcass yields" />}
              value={rs(calc.inhouse90)}
              badge={
                <span className="rounded-full px-2.5 py-0.5 text-[13px] font-semibold" style={{ color: cheaper ? C.greenDark : C.red, background: cheaper ? C.greenBg : C.redBg }}>
                  {cheaper ? "−" : "+"}{Math.abs(savingPct).toFixed(0)}% · {rs(Math.abs(calc.diff90))} vs today
                </span>
              }
              label={`${W}-day net cost`}
              sub={`${kg(calc.totalSoldKgDemand)} of cuts sold`}
            />
            <div className="mt-5 overflow-x-auto">
            <table className="w-full min-w-[640px] text-sm">
              <thead>
                <tr className="text-left align-bottom" style={{ height: HEAD_H, color: C.text2 }}>
                  <th className="pb-2 pr-2 font-medium">Cut</th>
                  <th className="pb-2 px-2 text-right font-medium"><Th title="Share of total kg sold (this cut vs all cuts)">Share</Th></th>
                  <th className="pb-2 px-2 text-right font-medium"><Th title="Kg of this cut the whole carcasses produce">Yield</Th></th>
                  <th className="pb-2 px-2 font-medium"><Th title="Carcass yield sold to customers (green), unsold leftover (amber), shortfall bought elsewhere (red)">Sold</Th></th>
                  <th className="pb-2 px-2 text-right font-medium"><Th title="Customer demand for this cut, from real orders">Demand</Th></th>
                  <th className="pb-2 px-2 text-right font-medium"><Th title="Extra kg bought from vendors because demand exceeds carcass yield, valued at vendor price (kg / Rs)">Short</Th></th>
                  <th className="pb-2 px-2 text-right font-medium"><Th title="Carcass yield with no customer demand, valued at retail (kg / Rs)">Unsold</Th></th>
                  <th className="pb-2 px-2 text-right font-medium"><Th title="Kg of leftover you can resell at retail (editable, capped at unsold)">Can sell</Th></th>
                  <th className="pb-2 pl-2 text-right font-medium"><Th title="Per-cut saving vs buying everything from vendors: today's vendor cost minus in-house cost (carcass-meat share + shortfall bought − leftover resold)">Saving</Th></th>
                </tr>
              </thead>
              <tbody>
                {orderedRows.map((r) => (
                  <tr key={r.key} className="border-t align-middle transition-colors hover:bg-[#FAF6F0]" style={{ height: ROW_H, borderColor: C.rowBorder }}>
                    <td className="pr-2"><span className="inline-flex items-center gap-1.5">{r.label}<OppIcon r={r} /></span></td>
                    <td className="px-2 text-right tabular-nums" style={{ color: C.text2 }}>{sharePct(r.demand)}</td>
                    <td className="px-2 text-right tabular-nums" style={{ color: C.text2 }}>{Math.round(r.yielded)}</td>
                    <td className="px-2"><FitBar sold={r.carcassSold} leftover={r.leftover} shortfall={r.shortfall} recovered={r.canSellKg} /></td>
                    <td className="px-2 text-right tabular-nums">{Math.round(r.demand)}</td>
                    <td className="whitespace-nowrap px-2 text-right tabular-nums" style={{ color: r.shortfall > 0.05 ? C.red : C.faint }}>
                      {r.shortfall > 0.05 ? (<div className="leading-tight"><div className="font-medium">{Math.round(r.shortfall)}</div><div className="text-[11px]">{rs(r.shortfallCost)}</div></div>) : "—"}
                    </td>
                    <td className="whitespace-nowrap px-2 text-right tabular-nums" style={{ color: r.leftover > 0.05 ? C.amberDark : C.faint }}>
                      {r.leftover > 0.05 ? (<div className="leading-tight"><div className="font-medium">{Math.round(r.leftover)}</div><div className="text-[11px]">{rs(r.leftoverValue)}</div></div>) : "—"}
                    </td>
                    <td className="px-2 text-right">
                      {r.leftover > 0.05 ? (
                        <span className="relative inline-block">
                          <span className="pointer-events-none absolute left-2 top-1/2 -translate-y-1/2 text-[11px]" style={{ color: C.faint }}>kg</span>
                          <input type="number" min={0} max={Math.floor(r.leftover)} step={10} value={canSell[r.key] ?? 0}
                            onChange={(e) => setCanSellFor(r.key, r.leftover, Number(e.target.value))}
                            className="spin w-[92px] rounded-md border bg-white py-1 pl-7 pr-1.5 text-right text-sm tabular-nums outline-none transition focus:border-[#D94B1F] focus:ring-2 focus:ring-[#D94B1F]/25"
                            style={{ borderColor: "#D9CEBD" }} />
                        </span>
                      ) : <span style={{ color: C.faint }}>—</span>}
                    </td>
                    <td className="pl-2 text-right font-medium tabular-nums" style={{ color: r.saving >= 0 ? C.green : C.red }}>{rs(r.saving)}</td>
                  </tr>
                ))}
                <tr className="border-t-2 align-middle font-semibold" style={{ height: ROW_H, borderColor: C.text2 }}>
                  <td className="pr-2">Total</td>
                  <td className="px-2 text-right tabular-nums">100%</td>
                  <td className="px-2 text-right tabular-nums">{Math.round(calc.totalYielded90)}</td>
                  <td className="px-2"><FitBar sold={calc.totalCarcassSold90} leftover={calc.totalLeftover90} shortfall={calc.shortfallKg90} recovered={totalCanSellKg} /></td>
                  <td className="px-2 text-right tabular-nums">{Math.round(calc.totalSoldKgDemand)}</td>
                  <td className="whitespace-nowrap px-2 text-right tabular-nums" style={{ color: C.red }}><div className="leading-tight"><div>{Math.round(calc.shortfallKg90)}</div><div className="text-[11px] font-normal">{rs(calc.shortfall90)}</div></div></td>
                  <td className="whitespace-nowrap px-2 text-right tabular-nums" style={{ color: C.amberDark }}><div className="leading-tight"><div>{Math.round(calc.totalLeftover90)}</div><div className="text-[11px] font-normal">{rs(calc.leftoverVal90)}</div></div></td>
                  <td className="px-2 text-right tabular-nums">{Math.round(totalCanSellKg)}</td>
                  <td className="pl-2 text-right tabular-nums" style={{ color: calc.diff90 >= 0 ? C.green : C.red }}>{rs(calc.diff90)}</td>
                </tr>
              </tbody>
            </table>
            </div>
            <div className="mt-5 flex flex-wrap items-end justify-between gap-4">
              <div className="w-full max-w-sm space-y-1 text-sm">
                <StackRow label={`Whole mutton (${Math.round(N)} × ${rs(live)})`} value={rs(calc.gross90)} />
                <StackRow label="+ Shortfall from vendors" value={rs(calc.shortfall90)} />
                <StackRow label="− Leftover sold (your input)" value={rs(calc.recovery90)} color={calc.recovery90 > 0 ? C.green : C.text2} />
                {calc.conversionTotal > 0 && <StackRow label="+ Routing conversion" value={rs(calc.conversionTotal)} color={C.amberDark} />}
                <StackRow label="= Net cost" value={rs(calc.inhouse90)} bold />
              </div>
              <button onClick={() => setRouteModal(true)} data-tip="Reuse leftover cuts to fill shortfalls" aria-label="Open routing opportunities"
                className="inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-semibold transition-colors hover:brightness-95"
                style={{ background: C.amberBg, color: C.amberDark }}>
                + {rs(calc.routingSaving)} via routing <span aria-hidden>→</span>
              </button>
            </div>
            <p className="mt-2.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px]" style={{ color: C.faint }}>
              <span>Quantities in kg; enter kg of each leftover cut you can sell at retail (capped at its unsold leftover).</span>
              <span className="inline-flex items-center gap-1.5">
                <span className="inline-block h-2.5 w-5 rounded-sm" style={{ backgroundColor: C.greenBg, backgroundImage: `repeating-linear-gradient(45deg, ${C.green}, ${C.green} 2px, transparent 2px, transparent 4px)` }} />
                marked sellable
              </span>
              <span className="inline-flex items-center gap-1"><Lightbulb size={12} style={{ color: C.orange }} /> rebalancing opportunity (hover)</span>
            </p>
          </Card>
        </div>

        {/* 3. Narrative: where the money actually moves */}
        <div className="rounded-2xl border p-5" style={{ borderColor: C.cardBorder, background: "#FFFCF8", boxShadow: SHADOW }}>
          <div className="text-[10.5px] font-semibold uppercase tracking-[0.14em]" style={{ color: C.faint }}>Where the money moves</div>
          <p className="mt-1.5 text-[14px] leading-relaxed" style={{ color: C.text2 }}>
            Of the {rs(calc.today90)} {periodWord} vendor spend, slaughtering {Math.round(N).toLocaleString("en-PK")} mutton in-house replaces it with {rs(calc.gross90)} of whole-mutton purchases.
            You would still spend {rs(calc.shortfall90)} buying shortfall cuts from vendors{topShortfall.length ? ` (mainly ${listNames(topShortfall)})` : ""}.
            By default all {rs(calc.leftoverVal90)} of leftover is treated as waste; mark cuts as sellable in the table above to recover value{calc.recovery90 > 0 ? `, currently ${rs(calc.recovery90)}` : ""}.
            {calc.totalRoutedKg > 0.5 ? ` Re-routing ${kg(calc.totalRoutedKg)} of leftover into shortfall cuts saves a further ${rs(calc.routingSaving)} (net of ${rs(calc.conversionTotal)} conversion).` : ""}
            Net {cheaper ? "saving" : "extra cost"}: <b style={{ color: cheaper ? C.greenDark : C.red }}>{rs(Math.abs(calc.diff90))}</b> over {periodWord}.
          </p>
        </div>

        {/* 4. Day strip */}
        <Card>
          <h2 className="text-[17px] font-semibold">How the {W} days actually played out</h2>
          <p className="mt-1 text-[13.5px] leading-relaxed" style={{ color: C.text2 }}>
            Each square is one day. Color shows whether that day had enough demand to justify slaughtering a whole mutton — at least 75% of carcass weight ({kg(THRESH)}) in customer demand. Hover any square for the day&apos;s numbers.
          </p>
          <div className="mt-4 grid gap-1" style={{ gridTemplateColumns: "repeat(30, minmax(0, 1fr))" }}>
            {data.perDay.map((d) => {
              const muttonNeeded = carcassKg > 0 ? d.kg / carcassKg : 0;
              const decision = d.kg >= THRESH ? "Slaughter justified" : "Low demand — stay piecemeal";
              return (
                <div key={d.date}
                  data-tip={`${d.date}\n${d.kg} kg mutton demand\n${muttonNeeded.toFixed(1)} mutton needed (${kg(carcassKg)}/carcass)\n${decision}`}
                  className="aspect-square cursor-help rounded-[3px] transition-transform hover:scale-110"
                  style={{ background: d.kg >= THRESH ? C.green : C.amber }} />
              );
            })}
          </div>
          <div className="mt-3.5 flex flex-wrap gap-5 text-xs" style={{ color: C.text2 }}>
            <span><Dot color={C.green} /> Slaughter justified ({greenDays} days)</span>
            <span><Dot color={C.amber} /> Low demand, stay piecemeal ({amberDays} days)</span>
          </div>
        </Card>

        {/* Carcass yield assumptions — modal opened from the in-house card cog */}
        {yieldModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={() => setYieldModal(false)}>
            <div className="max-h-[88vh] w-full max-w-3xl overflow-auto rounded-2xl bg-white p-6 shadow-2xl" onClick={(e) => e.stopPropagation()}>
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h3 className="text-[16px] font-semibold">Carcass yield assumptions</h3>
                  <p className="mt-1 text-[13px] leading-relaxed" style={{ color: C.text2 }}>These drive every projection in the comparison. Change them to match your own animals and processing — it recalculates live.</p>
                </div>
                <button onClick={() => setYieldModal(false)} className="shrink-0 rounded-lg px-4 py-1.5 text-sm font-semibold text-white transition-colors hover:opacity-90" style={{ background: C.orange }}>Done</button>
              </div>
          <div className="mt-4 flex flex-wrap items-end gap-x-8 gap-y-4 rounded-xl border p-4" style={{ borderColor: C.heroBorder, background: C.heroBg }}>
            <NumField label="Live weight (kg)" value={liveWeight} step={1} onChange={setLiveWeight} />
            <NumField label="Dressing yield (%)" value={dressingPct} step={1} onChange={setDressingPct} />
            <div className="hidden h-11 w-px self-center sm:block" style={{ background: C.heroBorder }} />
            <Derived label="Dressed carcass" value={kg(carcassKg)} />
            <Derived label={`Mutton over ${W} days`} value={Math.round(N).toLocaleString("en-PK")} />
            <button onClick={resetAssumptions} className="ml-auto self-center rounded-lg border bg-white px-3.5 py-2 text-[13px] font-medium transition-colors hover:bg-black/5" style={{ borderColor: "#D9CEBD", color: C.text2 }}>
              Reset to defaults
            </button>
          </div>
          <div className="mt-6 grid grid-cols-1 gap-x-14 md:grid-cols-2">
            {yieldCols.map((cuts, i) => (
              <table key={i} className="h-fit w-full text-sm">
                <thead>
                  <tr className="text-left" style={{ color: C.text2 }}>
                    <th className="py-1.5 pr-2 font-medium">Cut</th>
                    <th className="py-1.5 px-2 text-right font-medium"><Th title="Editable — your yield % for this cut; everything above recalculates from it. Pre-filled with standard Pakistani mutton butchery defaults.">Yield %</Th></th>
                    <th className="py-1.5 pl-2 text-right font-medium"><Th title="Kg of this cut from one dressed carcass: carcass kg × yield %">Kg per mutton</Th></th>
                  </tr>
                </thead>
                <tbody>
                  {cuts.map((c) => {
                    const y = yields[c.key] ?? c.yieldPct;
                    const edited = Math.abs(y - c.yieldPct) > 0.001;
                    return (
                      <tr key={c.key} className="border-t" style={{ borderColor: C.rowBorder }}>
                        <td className="py-1.5 pr-2">{c.label}</td>
                        <td className="py-1.5 px-2 text-right">
                          <input type="number" min={0} step={0.1} value={y}
                            onChange={(e) => setYieldFor(c.key, Number(e.target.value))}
                            className="w-16 rounded-md border bg-white px-1.5 py-1 text-right text-sm tabular-nums outline-none transition focus:border-[#D94B1F] focus:ring-2 focus:ring-[#D94B1F]/25"
                            style={{ borderColor: edited ? C.orange : "#D9CEBD" }} />
                        </td>
                        <td className="py-1.5 pl-2 text-right tabular-nums" style={{ color: C.text2 }}>{kg(carcassKg * (y / 100))}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            ))}
          </div>
          <div className="mt-4 flex max-w-md items-center justify-between border-t-2 pt-3 text-sm font-semibold" style={{ borderColor: C.text2 }}>
            <span>Total yield</span>
            <span className="tabular-nums">
              <span style={{ color: driftWarn ? C.amberDark : C.text }}>{pct(sumYields)}</span>
              <span style={{ color: C.faint }}> · {kg(carcassKg * (sumYields / 100))} per mutton</span>
            </span>
          </div>
          {driftWarn && (
            <p className="mt-3 max-w-xl rounded-lg p-2.5 text-xs leading-relaxed" style={{ background: C.amberBg, color: C.amberDark }}>
              Your yields sum to {pct(sumYields)}, not 100%. The projection still runs, but total carcass yield no longer equals total demand, so the shortfall and leftover totals will not match. Adjust the cuts until this reads 100%.
            </p>
          )}
          <p className="mt-4 text-xs leading-relaxed" style={{ color: C.faint }}>
            Defaults sourced from standard Pakistani mutton butchery yields, ±2-3% variance per cut depending on breed, age, and butchery skill. Validate against your own processing data once you have it.
          </p>
            </div>
          </div>
        )}

        {/* Routing opportunities — modal opened from the in-house card */}
        {routeModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={() => setRouteModal(false)}>
            <div className="max-h-[88vh] w-full max-w-3xl overflow-auto rounded-2xl bg-white p-6 shadow-2xl" onClick={(e) => e.stopPropagation()}>
              <div>
                <h3 className="text-[16px] font-semibold">Routing opportunities</h3>
                <p className="mt-1 max-w-xl text-[13px] leading-relaxed" style={{ color: C.text2 }}>Many leftover cuts can be operationally re-purposed into shortfall cuts. Specify how many kg you would actually route — the headline saving recomputes live.</p>
              </div>
              <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border p-4" style={{ borderColor: C.heroBorder, background: C.heroBg }}>
                <label className="flex items-center gap-3">
                  <span className="text-xs font-medium" style={{ color: C.text2 }}>Conversion cost</span>
                  <span className="relative inline-block">
                    <input type="number" min={0} step={5} value={conversionCost} onChange={(e) => setConversionCost(Math.max(0, Number(e.target.value) || 0))}
                      className="spin w-[112px] rounded-md border bg-white py-1.5 pl-2.5 pr-14 text-right text-sm tabular-nums outline-none transition focus:border-[#D94B1F] focus:ring-2 focus:ring-[#D94B1F]/25" style={{ borderColor: "#D9CEBD" }} />
                    <span className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-[11px]" style={{ color: C.faint }}>Rs/kg</span>
                  </span>
                </label>
                <span className="text-[11px]" style={{ color: C.faint }}>Labour + grinding + repackaging</span>
              </div>
              <table className="mt-5 w-full text-sm">
                <thead>
                  <tr className="text-left align-bottom" style={{ color: C.text2 }}>
                    <th className="pb-2 pr-2 font-medium">Route</th>
                    <th className="pb-2 px-2 text-right font-medium"><Th title="Most you can route: min(source unsold, destination shortfall), after earlier routes have taken their share">Max kg</Th></th>
                    <th className="pb-2 px-2 text-right font-medium">Apply</th>
                    <th className="pb-2 pl-2 text-right font-medium"><Th title="kg routed × (destination vendor price − conversion cost). The raw cut is already paid for in the whole-animal cost.">Net saving</Th></th>
                  </tr>
                </thead>
                <tbody>
                  {calc.routeRows.map((r) => (
                    <tr key={r.id} className="border-t align-middle" style={{ borderColor: C.rowBorder, opacity: r.enabled ? 1 : 0.5 }}>
                      <td className="py-2 pr-2">
                        <div className="font-medium" style={{ color: C.text }}>{r.srcLabel} <span style={{ color: C.faint }}>→</span> {r.dstLabel}</div>
                        <div className="text-[11px]" style={{ color: C.faint }}>{r.desc}</div>
                      </td>
                      <td className="py-2 px-2 text-right tabular-nums" style={{ color: C.text2 }}>{Math.round(r.maxKg)}</td>
                      <td className="py-2 px-2 text-right">
                        <span className="relative inline-block">
                          <span className="pointer-events-none absolute left-2 top-1/2 -translate-y-1/2 text-[11px]" style={{ color: C.faint }}>kg</span>
                          <input type="number" min={0} step={10} disabled={!r.enabled} value={Math.round(r.applied)}
                            onChange={(e) => setRoutingFor(r.id, Number(e.target.value))}
                            className="spin w-[92px] rounded-md border bg-white py-1 pl-7 pr-1.5 text-right text-sm tabular-nums outline-none transition focus:border-[#D94B1F] focus:ring-2 focus:ring-[#D94B1F]/25 disabled:cursor-not-allowed disabled:bg-black/[0.03]" style={{ borderColor: "#D9CEBD" }} />
                        </span>
                      </td>
                      <td className="py-2 pl-2 text-right font-medium tabular-nums" style={{ color: r.netSaving > 0 ? C.green : C.faint }}>{r.applied > 0.5 ? rs(r.netSaving) : "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <div className="mt-5 flex items-center justify-between gap-3">
                <button onClick={clearRouting} className="text-xs font-medium" style={{ color: C.text2 }}>Clear all</button>
                <div className="flex items-center gap-3">
                  <span className="rounded-full px-3 py-1.5 text-sm font-semibold" style={{ background: C.greenBg, color: C.greenDark }}>Total routing saving {rs(calc.routingSaving)}</span>
                  <button onClick={() => setRouteModal(false)} className="rounded-lg px-5 py-2 text-sm font-semibold text-white transition-colors hover:opacity-90" style={{ background: C.orange }}>Done</button>
                </div>
              </div>
            </div>
          </div>
        )}

        <footer className="border-t pt-5 pb-8" style={{ borderColor: C.cardBorder }}>
          <div className="text-[11px] font-semibold uppercase tracking-[0.14em]" style={{ color: C.text2 }}>Methodology &amp; data</div>
          <ul className="mt-3 grid gap-x-10 gap-y-2.5 text-[12.5px] leading-relaxed sm:grid-cols-2" style={{ color: C.text2 }}>
            <Li><b style={{ color: C.text }}>Window</b> — {data.dateMin} to {data.dateMax}; {data.daysWithOrders} of {data.windowDays} days had mutton orders.</Li>
            <Li><b style={{ color: C.text }}>Qurbani excluded</b> — {kg(data.qurbaniExcludedKg)} across {data.qurbaniExcludedLines} order lines (festival spikes would distort a steady-state model).</Li>
            <Li><b style={{ color: C.text }}>Unmapped / per-piece SKUs</b>, excluded from the kg model — {data.unmapped.length > 0 ? data.unmapped.slice(0, 4).map((u) => `${u.name.slice(0, 28)} (${kg(u.kg)})`).join("; ") : "none"}.</Li>
            {fatKg > 0 && <Li><b style={{ color: C.text }}>Fat ({kg(fatKg)})</b> is real bulk demand across four &ldquo;Mutton Fat / Charbi&rdquo; SKUs (tallow / rendering buyers) — not a mapping error, so it is kept as-is.</Li>}
          </ul>
        </footer>
      </div>

      {/* Shared hover tooltip */}
      {tip && tip.text && (
        <div className="pointer-events-none fixed z-[100] max-w-xs -translate-x-1/2 -translate-y-full whitespace-pre-line rounded-lg px-2.5 py-1.5 text-[11px] font-normal normal-case leading-snug text-white shadow-xl"
          style={{ left: tip.x, top: tip.y - 8, background: "#2A2320" }}>
          {tip.text}
        </div>
      )}

      {/* Per-cut markup override modal */}
      {modal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={() => setModal(false)}>
          <div className="max-h-[80vh] w-full max-w-lg overflow-auto rounded-2xl bg-white p-6 shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-[16px] font-semibold">Override markup per cut</h3>
            <p className="mt-1 text-xs leading-relaxed" style={{ color: C.text2 }}>Ranked by sales over the {W}-day window. Leave blank to use the global markup of {markup}%. Greyed cuts had no meaningful direct sales (volume only from whole-bakra orders).</p>
            <div className="mt-3 space-y-0.5">
              {cutsBySales.map((c, idx) => {
                const share = totalSold > 0 ? (c.soldKg / totalSold) * 100 : 0;
                const dim = c.soldKg < 5;
                return (
                  <div key={c.key} className="flex items-center justify-between gap-2 rounded-md px-2 py-0.5 text-sm transition-colors hover:bg-[#FAF6F0]" style={{ opacity: dim ? 0.45 : 1 }}>
                    <span className="flex items-baseline gap-2">
                      <span className="w-5 text-right text-[11px] tabular-nums" style={{ color: C.faint }}>{idx + 1}</span>
                      <span style={{ color: C.text }}>{c.label}</span>
                      <span className="text-[11px] tabular-nums" style={{ color: C.faint }}>{kg(c.soldKg)} &middot; {pct(share)}</span>
                    </span>
                    <div className="flex items-center gap-1">
                      <input type="number" placeholder={String(markup)} value={overrides[c.key] ?? ""}
                        onChange={(e) => setOverrides((o) => {
                          const n = { ...o }; const v = e.target.value;
                          if (v === "" || Number.isNaN(Number(v))) delete n[c.key]; else n[c.key] = Number(v);
                          return n;
                        })}
                        className="w-20 rounded-md border bg-white px-2 py-1 text-right text-sm outline-none transition focus:border-[#D94B1F] focus:ring-2 focus:ring-[#D94B1F]/25" style={{ borderColor: "#D9CEBD" }} />
                      <span className="text-xs" style={{ color: C.text2 }}>%</span>
                    </div>
                  </div>
                );
              })}
            </div>
            <div className="mt-5 flex items-center justify-between">
              <button onClick={() => setOverrides({})} className="text-xs font-medium" style={{ color: C.text2 }}>Clear all</button>
              <button onClick={() => setModal(false)} className="rounded-lg px-5 py-2 text-sm font-semibold text-white transition-colors hover:opacity-90" style={{ background: C.orange }}>Done</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function Card({ children }: { children: React.ReactNode }) {
  return <div className="rounded-2xl border bg-white p-6" style={{ borderColor: C.cardBorder, boxShadow: SHADOW }}>{children}</div>;
}

function Meta({ children }: { children: React.ReactNode }) {
  return <span className="rounded-full border px-2.5 py-1" style={{ borderColor: C.cardBorder, background: "white" }}>{children}</span>;
}

function Li({ children }: { children: React.ReactNode }) {
  return (
    <li className="flex gap-2">
      <span aria-hidden className="select-none" style={{ color: C.orange }}>•</span>
      <span>{children}</span>
    </li>
  );
}

// Flags a cut where carcass supply and customer demand are badly mismatched — the
// whole point of the exercise: where can we save money or rebalance the portfolio?
function OppIcon({ r }: { r: { label: string; demand: number; shortfall: number; yielded: number; leftover: number; eff: number; shortfallCost: number; leftoverValue: number } }) {
  if (r.demand < 1) return null;
  const shortPct = r.shortfall / r.demand;
  const overPct = r.yielded > 0 ? r.leftover / r.yielded : 0;
  let color: string | null = null;
  let text = "";
  if (r.shortfall > 50 && shortPct > 0.2 && r.shortfallCost > 150000) {
    color = C.red;
    text = `Over-demanded: customers want ${Math.round(r.shortfall)} kg more ${r.label} than a balanced carcass yields, so you top up from vendors at +${r.eff}% (${rs(r.shortfallCost)} this window). Opportunity — line up a direct supply for this cut, lift its price, or steer demand toward cuts you over-produce.`;
  } else if (r.leftover > 50 && overPct > 0.3 && r.leftoverValue > 200000) {
    color = C.amberDark;
    text = `Over-supplied: a balanced carcass yields ${Math.round(r.leftover)} kg of ${r.label} beyond demand (${rs(r.leftoverValue)} at retail). Opportunity — secure a bulk/wholesale buyer, or bundle and discount it to clear instead of wasting it.`;
  }
  if (!color) return null;
  return (
    <span data-tip={text} className="inline-flex shrink-0 cursor-help">
      <Lightbulb size={13} style={{ color }} />
    </span>
  );
}

function HeroNumber({ dot, value, badge, label, sub }: { dot: React.ReactNode; value: string; badge?: React.ReactNode; label: string; sub: string }) {
  return (
    <div className="mt-5 rounded-xl border px-4 py-4" style={{ background: C.heroBg, borderColor: C.heroBorder }}>
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
        {dot}
        <span className="text-[30px] font-bold leading-none tracking-tight" style={{ color: C.text }}>{value}</span>
        {badge}
      </div>
      <div className="mt-2.5 text-[11px] font-semibold uppercase tracking-[0.12em]" style={{ color: C.text2 }}>{label}</div>
      <div className="mt-1 text-[13px]" style={{ color: C.text2 }}>{sub}</div>
    </div>
  );
}

function Slider({ label, value, min, max, step, suffix, onChange, fmt }: { label: string; value: number; min: number; max: number; step: number; suffix: string; onChange: (v: number) => void; fmt?: (n: number) => string }) {
  return (
    <label className="block">
      <div className="flex items-baseline justify-between gap-3">
        <span className="text-xs font-medium" style={{ color: C.text2 }}>{label}</span>
        <span className="text-sm font-semibold tabular-nums" style={{ color: C.orange }}>{fmt ? fmt(value) : `${value}${suffix}`}</span>
      </div>
      <input type="range" min={min} max={max} step={step} value={value} onChange={(e) => onChange(Number(e.target.value))} className="mt-2 w-full cursor-pointer" style={{ accentColor: C.orange }} />
    </label>
  );
}

function NumField({ label, value, step, onChange }: { label: string; value: number; step: number; onChange: (v: number) => void }) {
  return (
    <label className="block">
      <div className="text-xs font-medium" style={{ color: C.text2 }}>{label}</div>
      <input type="number" step={step} value={value} onChange={(e) => onChange(Number(e.target.value))}
        className="mt-1.5 w-24 rounded-lg border bg-white px-2.5 py-1.5 text-sm tabular-nums outline-none transition focus:border-[#D94B1F] focus:ring-2 focus:ring-[#D94B1F]/25"
        style={{ borderColor: "#D9CEBD" }} />
    </label>
  );
}

function Derived({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-xs font-medium" style={{ color: C.text2 }}>{label}</div>
      <div className="mt-1.5 text-2xl font-bold tabular-nums" style={{ color: C.deep }}>{value}</div>
    </div>
  );
}

function Dot({ color }: { color: string }) {
  return <span className="mr-1.5 inline-block h-2.5 w-2.5 rounded-[3px] align-middle" style={{ background: color }} />;
}

function LiveDot() {
  return (
    <span className="relative inline-flex h-2.5 w-2.5" title="Live data from MySQL">
      <span className="absolute inline-flex h-full w-full animate-ping rounded-full opacity-75" style={{ background: C.green }} />
      <span className="relative inline-flex h-2.5 w-2.5 rounded-full" style={{ background: C.green }} />
    </span>
  );
}

function Th({ title, children }: { title: string; children: React.ReactNode }) {
  return <span data-tip={title} className="cursor-help border-b border-dotted" style={{ borderColor: "#CBBDA9" }}>{children}</span>;
}

// Per-cut fill bar: green = sold from carcass, hatched green = leftover you marked sellable
// (transient what-if), amber = leftover still unsold, red = shortfall bought elsewhere.
function FitBar({ sold, leftover, shortfall, recovered = 0 }: { sold: number; leftover: number; shortfall: number; recovered?: number }) {
  const total = sold + leftover + shortfall;
  const w = (x: number) => (total > 0 ? (x / total) * 100 : 0);
  const rec = Math.min(Math.max(0, recovered), leftover); // leftover marked sellable
  const remain = Math.max(0, leftover - rec); // leftover still unsold
  const title = `${total > 0 ? Math.round((sold / total) * 100) : 0}% of throughput from carcass`
    + (rec > 0.05 ? `; ${Math.round(rec)} kg marked sellable` : "")
    + (shortfall > 0.05 ? `; ${Math.round(shortfall)} kg shortfall bought elsewhere` : remain > 0.05 ? `; ${Math.round(remain)} kg unsold` : "");
  return (
    <div className="flex h-2.5 w-[90px] cursor-help overflow-hidden rounded-full" style={{ background: "#ECE6DC" }} data-tip={title}>
      <div style={{ width: `${w(sold)}%`, background: C.green }} />
      <div style={{ width: `${w(rec)}%`, backgroundColor: C.greenBg, backgroundImage: `repeating-linear-gradient(45deg, ${C.green}, ${C.green} 2px, transparent 2px, transparent 4px)` }} />
      <div style={{ width: `${w(remain)}%`, background: C.amber }} />
      <div style={{ width: `${w(shortfall)}%`, background: C.red }} />
    </div>
  );
}

function StackRow({ label, value, color, bold }: { label: string; value: string; color?: string; bold?: boolean }) {
  return (
    <div className="flex items-baseline justify-between" style={{ borderTop: bold ? `1px solid ${C.cardBorder}` : undefined, paddingTop: bold ? 6 : 0, marginTop: bold ? 2 : 0 }}>
      <span className={bold ? "font-semibold" : ""} style={{ color: C.text2 }}>{label}</span>
      <span className={`tabular-nums ${bold ? "font-bold text-[15px]" : ""}`} style={{ color: color ?? (bold ? C.text : C.text2) }}>{value}</span>
    </div>
  );
}

function listNames(names: string[]): string {
  if (names.length <= 1) return names[0] ?? "";
  return names.slice(0, -1).join(", ") + " and " + names[names.length - 1];
}
