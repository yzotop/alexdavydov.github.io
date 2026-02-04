import * as React from "https://esm.sh/react@18";
import { createRoot } from "https://esm.sh/react-dom@18/client";
import {
  Area,
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "https://esm.sh/recharts@2.12.7?deps=react@18,react-dom@18";

import {
  defaultScenarioPlanningInputs,
  formatInt,
  formatMoney,
  formatPct,
  makeExportMarkdown,
  runScenarioPlanning,
} from "./model.js";

const h = React.createElement;
const { useMemo, useState, useEffect } = React;

const PALETTE = {
  BASE: "#2563EB",
  OPT: "#10B981",
  PESS: "#F97316",
  GRID: "#E5E7EB",
};

const RU_STRINGS = {
  nav: {
    back: "← Калькуляторы",
    unitsKm: "Единицы: K/M",
    unitsFull: "Единицы: полные",
    exportMd: "Экспорт отчёта (MD)",
    about: "Описание",
  },
  badges: {
    fpa: "FP&A (месяцы)",
    scale: "Масштабирование",
  },
  selected: {
    label: "Выбранный сценарий:",
  },
  scenarios: {
    base: "База",
    optimistic: "Оптимистичный",
    pessimistic: "Пессимистичный",
    locked: "Зафиксировано",
    title: "Сценарии (драйверы результата)",
    chip: "Спрос / Цена / FX / Логистика",
    demand: "Шок спроса",
    price: "Шок цены",
    fx: "Валютный шок (FX)",
    freight: "Шок логистики/фрахта",
    hintDemand: "Применяется к базовому объёму (units).",
    hintPrice: "Применяется к базовой цене.",
    hintFx: "Cost-side FX: влияет на себестоимость (unit cost).",
    hintFreight: "Применяется поверх % фрахта от COGS.",
  },
  kpi: {
    revTitle: "ГОДОВАЯ ВЫРУЧКА (выбранный)",
    ebitdaTitle: "ГОДОВАЯ EBITDA (выбранный)",
    netProfitTitle: "ГОДОВАЯ ЧИСТАЯ ПРИБЫЛЬ (выбранный)",
    netMarginTitle: "ЧИСТАЯ МАРЖА (выбранный)",
    baseScenario: "Базовый сценарий",
    ebitdaMargin: "Маржа EBITDA: ",
    netMargin: "Чистая маржа: ",
    dRev: "ΔВыручка vs база: ",
    dEbitda: "ΔEBITDA vs база: ",
    dNetProfit: "ΔЧистая прибыль vs база: ",
    dNetMargin: "ΔЧистая маржа vs база: ",
  },
  howToRead: {
    title: "Как читать",
    bullets: [
      "Верхние карточки — годовые KPI (annualized run-rate) для выбранного сценария.",
      "Графики показывают помесячную динамику на горизонте планирования.",
      "Base / Optimistic / Pessimistic отличаются шоками спроса, цены, FX и логистики.",
      "Цель: понять, как масштаб и шоки складываются в Revenue → EBITDA → Чистая прибыль.",
    ],
  },
  scale: {
    title: "Масштаб (пресет)",
    rarelyChanged: "Меняется редко",
    presetLabel: "Пресет",
    presetHint: "Фиксирует масштаб для контекста FP&A.",
    presetName: "Large FMCG distributor",
    presetSummaryTitle: "Описание пресета (только чтение)",
    presetSummaryLine1: "Масштаб годовой выручки: ~200–220B",
    presetSummaryLine2: "Чистая маржа: ~3–4%",
    impliedAnnualRevenue: "Оценка годовой выручки (масштаб)",
    horizonLabel: "Горизонт (мес.)",
    horizonHint: "Горизонт планирования: 12 / 24 / 36 мес.",
    h12: "12 мес.",
    h24: "24 мес.",
    h36: "36 мес.",
  },
  charts: {
    revenue: "Выручка",
    ebitda: "EBITDA",
    netProfit: "Чистая прибыль",
    monthly: "Помесячно",
    horizonSuffix: "мес.",
    tooltipMonth: "Месяц",
  },
  right: {
    title: "Итоги (для руководителя)",
    annualizedSelected: "Годовой run-rate (выбранный)",
    drivers: "Драйверы (концептуально)",
    sensitivity: "Чувствительность (как использовать)",
    revenue: "Revenue",
    ebitda: "EBITDA",
    netProfit: "Чистая прибыль",
    netMargin: "Чистая маржа",
    driver1: "Спрос и цена двигают выручку (Revenue).",
    driver2: "FX влияет на себестоимость (COGS).",
    driver3: "Логистика/фрахт влияет на расходы доставки.",
    driver4: "Revenue → EBITDA → Чистая прибыль разделяет операционные и ниже-EBITDA эффекты.",
    sensitivityText: "Двигайте слайдеры шоков и смотрите, как меняются линии и годовые KPI: важны направление и порядок величины.",
  },
};

function injectCssOnce(id, cssText) {
  if (document.getElementById(id)) return;
  const style = document.createElement("style");
  style.id = id;
  style.textContent = cssText;
  document.head.appendChild(style);
}

injectCssOnce(
  "scenario-planning-kpi-sticky-css",
  `
  :root { --stickyTop: calc(var(--kpiHeaderH, 0px) + 12px); }

  .kpiSticky {
    position: sticky;
    top: var(--topbar, 0px);
    z-index: 50;
    background: rgba(255,255,255,0.96);
    backdrop-filter: blur(6px);
    border-bottom: 1px solid rgba(0,0,0,0.06);
    box-shadow: 0 1px 0 rgba(0,0,0,0.02);
  }
  .kpiStickyInner { padding: 12px 0; transition: padding .18s ease; }
  .kpiSticky.isCompact .kpiStickyInner { padding: 6px 0; }

  .kpiGrid { gap: 12px; }
  .kpiSticky.isCompact .kpiGrid { gap: 8px; }

  .kpiTitle { font-size: 11px; letter-spacing: .02em; text-transform: uppercase; opacity: .72; }
  .kpiValue { font-size: 22px; font-weight: 700; line-height: 1.1; }
  .kpiSticky.isCompact .kpiValue { font-size: 18px; }
  .kpiDelta { font-size: 11px; opacity: .80; }
  .kpiSub { font-size: 11px; opacity: .70; }
  .kpiSticky.isCompact .kpiSub { display: none; }
  .kpiSticky.isCompact .kpiCard { padding: 10px; }

  .stickyCol {
    position: sticky;
    top: var(--stickyTop);
    align-self: start;
    background: #fff;
    border: 1px solid rgba(0,0,0,0.06);
    border-radius: 12px;
    box-shadow: 0 2px 8px rgba(0,0,0,0.04);
  }
  .stickyColInner {
    max-height: calc(100vh - var(--stickyTop) - 16px);
    overflow: auto;
  }
  @media (max-width: 1023px) {
    .stickyCol { position: static; max-height: none; overflow: visible; border: none; box-shadow: none; background: transparent; }
    .stickyColInner { max-height: none; overflow: visible; }
  }
  `
);

function fmtSigned(x, s) {
  return (x >= 0 ? "+" : "") + s;
}

function fmtCompactAbs(x, digits = 1) {
  const n = Math.abs(Number(x));
  if (!Number.isFinite(n)) return "—";
  if (n >= 1e6) return `${(n / 1e6).toFixed(digits)}M`;
  if (n >= 1e3) return `${(n / 1e3).toFixed(digits)}K`;
  return `${Math.round(n)}`;
}

function fmtSuffixInt(x) {
  const n = Number(x);
  if (!Number.isFinite(n)) return "—";
  const s = n < 0 ? "-" : "";
  const a = Math.abs(n);
  if (a >= 1e9) return `${s}${Math.round(a / 1e9)}B`;
  if (a >= 1e6) return `${s}${Math.round(a / 1e6)}M`;
  if (a >= 1e3) return `${s}${Math.round(a / 1e3)}K`;
  return `${s}${Math.round(a)}`;
}

function makeUiFormatters(compactNumbers) {
  const money = (x, digits = 0) => {
    if (!Number.isFinite(x)) return "—";
    if (!compactNumbers) return formatMoney(x, digits);
    const abs = Math.abs(x);
    if (abs >= 1e3) {
      const core = fmtCompactAbs(abs, 1);
      return (x < 0 ? "-" : "") + core;
    }
    return formatMoney(x, digits);
  };
  const int = (x) => {
    if (!Number.isFinite(x)) return "—";
    if (!compactNumbers) return formatInt(x);
    const abs = Math.abs(x);
    if (abs >= 1e3) return (x < 0 ? "-" : "") + fmtCompactAbs(abs, 1);
    return formatInt(x);
  };
  const pct = (x, digits = 1) => formatPct(x, digits);
  return { money, int, pct };
}

function Chip(text) {
  return h(
    "span",
    {
      className:
        "inline-flex items-center rounded-full border border-blue-200 bg-blue-50 px-2 py-0.5 text-[12px] font-medium text-blue-700",
    },
    text
  );
}

function Pill({ text, tone }) {
  return h(
    "span",
    { className: `inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-semibold ${tone}` },
    text
  );
}

function Field({ label, hint, control }) {
  return h(
    "div",
    { className: "space-y-1" },
    h("div", { className: "text-sm font-medium text-gray-900" }, label),
    control,
    hint ? h("div", { className: "text-xs text-gray-500" }, hint) : null
  );
}

function Select({ value, onChange, options }) {
  return h(
    "select",
    {
      className:
        "w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm outline-none focus:border-blue-500",
      value,
      onChange: (e) => onChange(e.target.value),
    },
    options.map((o) => h("option", { key: o.value, value: o.value }, o.label))
  );
}

function Slider({ value, onChange, min, max, step }) {
  return h("input", {
    className: "w-full",
    type: "range",
    min,
    max,
    step,
    value,
    onChange: (e) => onChange(Number(e.target.value)),
  });
}

function KpiCard({ title, value, delta, sub }) {
  return h(
    "div",
    { className: "card p-4 kpiCard" },
    h("div", { className: "kpiTitle text-gray-600" }, title),
    h("div", { className: "mono mt-1 kpiValue text-gray-900 tabular-nums" }, value),
    delta ? h("div", { className: "mono mt-1 kpiDelta text-gray-700 tabular-nums" }, delta) : null,
    sub ? h("div", { className: "mt-1 kpiSub text-gray-600" }, sub) : null
  );
}

function ScenarioCard({ preset, onChange }) {
  const s = preset.shocks;
  const locked = !!preset.locked;
  const lockNote = locked ? h(Pill, { text: RU_STRINGS.scenarios.locked, tone: "bg-gray-100 text-gray-800 border-gray-200" }) : null;
  const hdrTone =
    preset.id === "base"
      ? "border-gray-200 bg-white"
      : preset.id === "optimistic"
        ? "border-emerald-200 bg-emerald-50"
        : "border-amber-200 bg-amber-50";

  function rowPct(label, key, hint) {
    return h(Field, {
      label,
      hint,
      control: h(
        "div",
        { className: "space-y-2" },
        h(Slider, {
          value: s[key],
          onChange: (v) => !locked && onChange({ ...s, [key]: v }),
          min: -30,
          max: 30,
          step: 1,
        }),
        h("div", { className: "flex items-center justify-between gap-3" }, [
          h("div", { key: "left", className: "text-xs text-gray-500" }, "-30%"),
          h(
            "div",
            { key: "mid", className: "mono text-sm font-semibold text-gray-900" },
            `${Number(s[key]).toFixed(0)}%`
          ),
          h("div", { key: "right", className: "text-xs text-gray-500" }, "+30%"),
        ])
      ),
    });
  }

  return h(
    "div",
    { className: `rounded-xl border p-4 ${hdrTone}` },
    h("div", { className: "mb-3 flex items-center justify-between gap-3" }, [
      h("div", { key: "t", className: "text-sm font-semibold text-gray-900" }, preset.title),
      h("div", { key: "r", className: "flex items-center gap-2" }, lockNote),
    ]),
    h("div", { className: locked ? "opacity-60 pointer-events-none" : "" }, [
      rowPct(RU_STRINGS.scenarios.demand, "demand_pct", RU_STRINGS.scenarios.hintDemand),
      rowPct(RU_STRINGS.scenarios.price, "price_pct", RU_STRINGS.scenarios.hintPrice),
      rowPct(RU_STRINGS.scenarios.fx, "fx_pct", RU_STRINGS.scenarios.hintFx),
      rowPct(RU_STRINGS.scenarios.freight, "freight_pct", RU_STRINGS.scenarios.hintFreight),
    ])
  );
}

function downloadText(filename, text) {
  const blob = new Blob([text], { type: "text/markdown;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

function todayISO() {
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

function ScenarioPlanningApp() {
  const [cfg, setCfg] = useState(() => defaultScenarioPlanningInputs());
  const [selectedScenario, setSelectedScenario] = useState("base");
  const [compactNumbers, setCompactNumbers] = useState(true);

  useEffect(() => {
    const sticky = document.getElementById("kpiSticky");
    if (!sticky) return;

    function measureTopbar() {
      const selectors = ["header", "#topbar", ".topbar", ".site-header", ".navbar"];
      let maxH = 0;
      for (const sel of selectors) {
        for (const el of Array.from(document.querySelectorAll(sel))) {
          const cs = window.getComputedStyle(el);
          if (cs.position !== "fixed" && cs.position !== "sticky") continue;
          const rect = el.getBoundingClientRect();
          if (rect.top > 1) continue;
          maxH = Math.max(maxH, rect.height);
        }
      }
      return Math.round(maxH);
    }

    function applyTopbarVar() {
      const hh = measureTopbar();
      document.documentElement.style.setProperty("--topbar", `${hh}px`);
    }

    function setKpiHeaderH() {
      if (sticky) {
        const h = sticky.getBoundingClientRect().height;
        document.documentElement.style.setProperty("--kpiHeaderH", `${Math.round(h)}px`);
      }
    }

    const ro = typeof ResizeObserver !== "undefined" && sticky ? new ResizeObserver(() => setKpiHeaderH()) : null;
    if (ro) ro.observe(sticky);

    let raf = 0;
    function onScroll() {
      if (raf) return;
      raf = window.requestAnimationFrame(() => {
        raf = 0;
        sticky.classList.toggle("isCompact", window.scrollY > 80);
      });
    }

    function onResize() {
      applyTopbarVar();
      setKpiHeaderH();
    }

    applyTopbarVar();
    setKpiHeaderH();
    onScroll();

    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onResize);
    return () => {
      if (ro && sticky) ro.unobserve(sticky);
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onResize);
      if (raf) window.cancelAnimationFrame(raf);
    };
  }, []);

  function patch(patchObj) {
    setCfg((c) => ({ ...c, ...patchObj }));
  }

  const output = useMemo(() => runScenarioPlanning(cfg), [cfg]);
  const fmt = useMemo(() => makeUiFormatters(compactNumbers), [compactNumbers]);

  const baseRes = output.results.base;
  const selRes = output.results[selectedScenario];
  const selTotals = selRes.totals;
  const baseTotals = baseRes.totals;

  const annualize = (x) => x * (12 / cfg.horizon);

  const selRevenue = Math.max(0, selTotals.revenue_total);
  const baseRevenue = Math.max(0, baseTotals.revenue_total);

  const selEbitda = selTotals.ebitda_total;
  const baseEbitda = baseTotals.ebitda_total;

  const selNetProfit = selTotals.net_profit_total ?? 0;
  const baseNetProfit = baseTotals.net_profit_total ?? 0;

  const selNetMargin = selRevenue > 0 ? selNetProfit / selRevenue : 0;
  const baseNetMargin = baseRevenue > 0 ? baseNetProfit / baseRevenue : 0;

  const dRevAbs = annualize(selRevenue) - annualize(baseRevenue);
  const dRevPct = annualize(baseRevenue) > 0 ? dRevAbs / annualize(baseRevenue) : 0;
  const dEbitdaAbs = annualize(selEbitda) - annualize(baseEbitda);
  const dEbitdaPct = annualize(baseEbitda) !== 0 ? dEbitdaAbs / Math.abs(annualize(baseEbitda)) : 0;
  const dNpAbs = annualize(selNetProfit) - annualize(baseNetProfit);
  const dNpPct = annualize(baseNetProfit) !== 0 ? dNpAbs / Math.abs(annualize(baseNetProfit)) : 0;
  const dNetMarginAbs = selNetMargin - baseNetMargin;
  const dNetMarginPct = baseNetMargin !== 0 ? dNetMarginAbs / Math.abs(baseNetMargin) : 0;

  const deltaRevLine =
    selectedScenario === "base"
      ? "Δ к базе: —"
      : `Δ к базе: ${fmtSigned(dRevPct, fmt.pct(dRevPct, 1))} (${fmtSigned(dRevAbs, fmt.money(dRevAbs))})`;
  const deltaEbitdaLine =
    selectedScenario === "base"
      ? "Δ к базе: —"
      : `Δ к базе: ${fmtSigned(dEbitdaPct, fmt.pct(dEbitdaPct, 1))} (${fmtSigned(dEbitdaAbs, fmt.money(dEbitdaAbs))})`;
  const deltaNetProfitLine =
    selectedScenario === "base"
      ? "Δ к базе: —"
      : `Δ к базе: ${fmtSigned(dNpPct, fmt.pct(dNpPct, 1))} (${fmtSigned(dNpAbs, fmt.money(dNpAbs))})`;
  const deltaNetMarginLine =
    selectedScenario === "base"
      ? "Δ к базе: —"
      : `Δ к базе: ${fmtSigned(dNetMarginPct, fmt.pct(dNetMarginPct, 1))} (${fmtSigned(
          dNetMarginAbs,
          `${(dNetMarginAbs * 100).toFixed(1)}pp`
        )})`;

  const chartRevenue = useMemo(() => {
    return output.charts.revenue.map((d) => {
      const base = Math.max(0, d.base);
      const opt = Math.max(0, d.optimistic);
      const pess = Math.max(0, d.pessimistic);
      const low = Math.min(opt, pess);
      const high = Math.max(opt, pess);
      return { ...d, base, optimistic: opt, pessimistic: pess, bandHigh: high, bandLow: low };
    });
  }, [output]);
  const chartEbitda = useMemo(() => {
    return output.charts.ebitda.map((d) => {
      const opt = d.optimistic;
      const pess = d.pessimistic;
      const low = Math.min(opt, pess);
      const high = Math.max(opt, pess);
      return { ...d, bandHigh: high, bandLow: low };
    });
  }, [output]);

  function scenarioLabel(id) {
    if (id === "base") return RU_STRINGS.scenarios.base;
    if (id === "optimistic") return RU_STRINGS.scenarios.optimistic;
    return RU_STRINGS.scenarios.pessimistic;
  }

  function scenarioTone(id) {
    if (id === "base") return "bg-blue-50 text-blue-800 border-blue-200";
    if (id === "optimistic") return "bg-emerald-50 text-emerald-800 border-emerald-200";
    return "bg-amber-50 text-amber-900 border-amber-200";
  }

  function mkScenarioSwitch() {
    const items = [
      { id: "base", label: "Base", color: PALETTE.BASE },
      { id: "optimistic", label: "Optimistic", color: PALETTE.OPT },
      { id: "pessimistic", label: "Pessimistic", color: PALETTE.PESS },
    ];
    return h(
      "div",
      { className: "flex flex-wrap items-center gap-2" },
      items.map((it) => {
        const active = selectedScenario === it.id;
        return h(
          "button",
          {
            key: it.id,
            type: "button",
            className: active
              ? "rounded-lg border border-gray-900 bg-gray-900 px-3 py-2 text-sm font-medium text-white hover:bg-gray-800"
              : "rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm font-medium hover:bg-gray-50",
            onClick: () => setSelectedScenario(it.id),
          },
          h("span", { className: "inline-flex items-center gap-2" }, [
            h("span", { key: "dot", className: "inline-block h-2 w-2 rounded-full", style: { background: it.color } }),
            h("span", { key: "t" }, it.label),
          ])
        );
      })
    );
  }

  const header = h(
    "div",
    { className: "space-y-1" },
    h(
      "div",
      { className: "flex flex-wrap items-center gap-3" },
      h("h1", { className: "text-2xl font-semibold text-gray-900" }, "Scenario Planning & P&L Forecast"),
      Chip(RU_STRINGS.badges.fpa),
      Chip(RU_STRINGS.badges.scale)
    ),
    h(
      "div",
      { className: "max-w-4xl text-sm text-gray-600" },
      "Forecast sales and profit under demand, price, FX and logistics scenarios."
    ),
    h("div", { className: "text-xs text-gray-500" }, "KPI cards are annualized (run-rate). Charts are monthly.")
  );

  const nav = h(
    "div",
    { className: "flex flex-wrap items-center justify-between gap-3" },
    h("a", { href: "/calculators/", className: "text-sm text-blue-700 hover:underline" }, RU_STRINGS.nav.back),
    h("div", { className: "flex flex-wrap items-center gap-2" }, [
      h(
        "a",
        {
          key: "about",
          href: "/calculators/scenario-planning/about/",
          className:
            "rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm font-medium hover:bg-gray-50",
        },
        RU_STRINGS.nav.about
      ),
      h(
        "button",
        {
          key: "fmt",
          type: "button",
          className:
            "rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm font-medium hover:bg-gray-50",
          onClick: () => setCompactNumbers((v) => !v),
        },
        compactNumbers ? RU_STRINGS.nav.unitsKm : RU_STRINGS.nav.unitsFull
      ),
      h(
        "button",
        {
          key: "exp",
          type: "button",
          className:
            "rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm font-medium hover:bg-gray-50",
          onClick: () => {
            const md = makeExportMarkdown({ todayISO: todayISO(), output, selected: selectedScenario });
            downloadText(`scenario_planning_report_${todayISO()}.md`, md);
          },
        },
        RU_STRINGS.nav.exportMd
      ),
    ])
  );

  const kpis = h("div", { className: "kpiGrid grid grid-cols-1 gap-3 md:grid-cols-4" }, [
    h(KpiCard, {
      key: "rev",
      title: RU_STRINGS.kpi.revTitle,
      value: fmt.money(Math.max(0, annualize(selRevenue))),
      delta: deltaRevLine,
      sub:
        selectedScenario === "base"
          ? RU_STRINGS.kpi.baseScenario
          : `${RU_STRINGS.kpi.dRev}${fmtSigned(dRevAbs, fmt.money(dRevAbs))} (${fmtSigned(dRevPct, fmt.pct(dRevPct, 1))})`,
    }),
    h(KpiCard, {
      key: "eb",
      title: RU_STRINGS.kpi.ebitdaTitle,
      value: fmt.money(annualize(selEbitda)),
      delta: deltaEbitdaLine,
      sub:
        selectedScenario === "base"
          ? `${RU_STRINGS.kpi.ebitdaMargin}${fmt.pct(selRevenue > 0 ? selEbitda / selRevenue : 0, 1)}`
          : `${RU_STRINGS.kpi.dEbitda}${fmtSigned(dEbitdaAbs, fmt.money(dEbitdaAbs))} (${fmtSigned(dEbitdaPct, fmt.pct(dEbitdaPct, 1))})`,
    }),
    h(KpiCard, {
      key: "np",
      title: RU_STRINGS.kpi.netProfitTitle,
      value: fmt.money(annualize(selNetProfit)),
      delta: deltaNetProfitLine,
      sub:
        selectedScenario === "base"
          ? `${RU_STRINGS.kpi.netMargin}${fmt.pct(selNetMargin, 1)}`
          : `${RU_STRINGS.kpi.dNetProfit}${fmtSigned(dNpAbs, fmt.money(dNpAbs))} (${fmtSigned(dNpPct, fmt.pct(dNpPct, 1))})`,
    }),
    h(KpiCard, {
      key: "nm",
      title: RU_STRINGS.kpi.netMarginTitle,
      value: fmt.pct(selNetMargin, 1),
      delta: deltaNetMarginLine,
      sub:
        selectedScenario === "base"
          ? RU_STRINGS.kpi.baseScenario
          : `${RU_STRINGS.kpi.dNetMargin}${fmtSigned(dNetMarginAbs, `${(dNetMarginAbs * 100).toFixed(1)}pp`)} (${fmtSigned(dNetMarginPct, fmt.pct(dNetMarginPct, 1))})`,
    }),
  ]);

  const howToRead = h(
    "div",
    { className: "card p-5" },
    h("div", { className: "mb-2 text-sm font-semibold text-gray-900" }, RU_STRINGS.howToRead.title),
    h(
      "ul",
      { className: "list-disc space-y-1 pl-5 text-sm text-gray-700" },
      RU_STRINGS.howToRead.bullets.map((t, i) => h("li", { key: i }, t))
    )
  );

  const selectedPill = h(Pill, { text: `${RU_STRINGS.selected.label} ${scenarioLabel(selectedScenario)}`, tone: scenarioTone(selectedScenario) });
  const selectedRow = h(
    "div",
    { className: "flex flex-wrap items-center justify-between gap-3" },
    h("div", { className: "flex flex-wrap items-center gap-2" }, [selectedPill]),
    mkScenarioSwitch()
  );

  const kpiSticky = h(
    "div",
    { id: "kpiSticky", className: "kpiSticky" },
    h("div", { className: "kpiStickyInner space-y-3" }, [selectedRow, kpis])
  );
  const kpiSpacer = h("div", { id: "kpiSpacer", className: "kpiSpacer hidden" });

  const scaleCard = h(
    "div",
    { key: "scale", className: "card p-5" },
    h("div", { className: "mb-3 flex items-center justify-between gap-3" }, [
      h("div", { key: "t", className: "text-sm font-semibold text-gray-900" }, RU_STRINGS.scale.title),
      h(Pill, { key: "p", text: RU_STRINGS.scale.rarelyChanged, tone: "bg-gray-100 text-gray-900 border-gray-200" }),
    ]),
    h("div", { className: "space-y-4" }, [
      h(Field, {
        label: RU_STRINGS.scale.presetLabel,
        hint: RU_STRINGS.scale.presetHint,
        control: h(Select, {
          value: "large_fmcg_distributor",
          onChange: () => patch({ preset: "large_fmcg_distributor" }),
          options: [{ value: "large_fmcg_distributor", label: RU_STRINGS.scale.presetName }],
        }),
      }),
      h("div", { className: "rounded-xl border border-gray-200 bg-white p-3" }, [
        h("div", { className: "text-xs font-semibold text-gray-500" }, RU_STRINGS.scale.presetSummaryTitle),
        h("div", { className: "mt-2 text-sm text-gray-800" }, [
          h("div", { key: "a" }, RU_STRINGS.scale.presetSummaryLine1),
          h("div", { key: "b" }, RU_STRINGS.scale.presetSummaryLine2),
        ]),
      ]),
      h("div", { className: "rounded-xl border border-gray-200 bg-white p-3" }, [
        h("div", { className: "text-xs font-semibold text-gray-500" }, RU_STRINGS.scale.impliedAnnualRevenue),
        h("div", { className: "mt-1 mono text-sm font-semibold text-gray-900 text-right tabular-nums" }, fmt.money(output.inputs.implied_annual_revenue ?? 0)),
      ]),
      h(Field, {
        label: RU_STRINGS.scale.horizonLabel,
        hint: RU_STRINGS.scale.horizonHint,
        control: h(Select, {
          value: String(cfg.horizon),
          onChange: (v) => patch({ horizon: Number(v) }),
          options: [
            { value: "12", label: RU_STRINGS.scale.h12 },
            { value: "24", label: RU_STRINGS.scale.h24 },
            { value: "36", label: RU_STRINGS.scale.h36 },
          ],
        }),
      }),
    ])
  );

  const scenarioBuilder = h(
    "div",
    { className: "card p-5" },
    h("div", { className: "mb-3 flex items-center justify-between gap-3" }, [
      h("div", { key: "t", className: "text-sm font-semibold text-gray-900" }, RU_STRINGS.scenarios.title),
      h("div", { key: "c", className: "flex flex-wrap items-center gap-2" }, [Chip(RU_STRINGS.scenarios.chip)]),
    ]),
    h("div", { className: "space-y-3" }, [
      h(ScenarioCard, {
        key: "base",
        preset: { ...cfg.scenarios.base, title: RU_STRINGS.scenarios.base },
        onChange: (shocks) => patch({ scenarios: { ...cfg.scenarios, base: { ...cfg.scenarios.base, shocks } } }),
      }),
      h(ScenarioCard, {
        key: "opt",
        preset: { ...cfg.scenarios.optimistic, title: RU_STRINGS.scenarios.optimistic },
        onChange: (shocks) =>
          patch({ scenarios: { ...cfg.scenarios, optimistic: { ...cfg.scenarios.optimistic, shocks } } }),
      }),
      h(ScenarioCard, {
        key: "pess",
        preset: { ...cfg.scenarios.pessimistic, title: RU_STRINGS.scenarios.pessimistic },
        onChange: (shocks) =>
          patch({ scenarios: { ...cfg.scenarios, pessimistic: { ...cfg.scenarios.pessimistic, shocks } } }),
      }),
    ])
  );

  const charts = h("div", { className: "space-y-4" }, [
    h(
      "div",
      { key: "rev", className: "card p-5" },
      h("div", { className: "mb-3 flex items-center justify-between gap-3" }, [
        h("div", { key: "t", className: "text-sm font-semibold text-gray-900" }, RU_STRINGS.charts.revenue),
        h("div", { key: "l", className: "text-xs text-gray-500" }, `${cfg.horizon} ${RU_STRINGS.charts.horizonSuffix}`),
      ]),
      h("div", { className: "h-72" }, [
        h(
          ResponsiveContainer,
          { width: "100%", height: "100%" },
          h(
            LineChart,
            { data: chartRevenue },
            h(CartesianGrid, { stroke: PALETTE.GRID, strokeDasharray: "3 3", strokeOpacity: 0.22 }),
            h(XAxis, { dataKey: "period", tickFormatter: (v) => String(v), minTickGap: 16, tick: { fontSize: 11, fill: "#6B7280" } }),
            h(YAxis, { tickFormatter: (v) => fmtSuffixInt(Number(v)), tick: { fontSize: 11, fill: "#6B7280" } }),
            h(Tooltip, { formatter: (v) => fmt.money(Number(v), 0), labelFormatter: (l) => `${RU_STRINGS.charts.tooltipMonth} ${l}` }),
            h(Legend, null),
            h(Area, { type: "monotone", dataKey: "bandHigh", stroke: "none", fill: "#93C5FD", fillOpacity: 0.18, isAnimationActive: false, name: "Range" }),
            h(Area, { type: "monotone", dataKey: "bandLow", stroke: "none", fill: "#F9FAFB", fillOpacity: 1, isAnimationActive: false, name: "" }),
            h(Line, { type: "monotone", dataKey: "base", name: "Base", dot: false, stroke: PALETTE.BASE, strokeWidth: selectedScenario === "base" ? 3.5 : 2.25, strokeOpacity: selectedScenario === "base" ? 1 : 0.35 }),
            h(Line, { type: "monotone", dataKey: "optimistic", name: "Optimistic", dot: false, stroke: PALETTE.OPT, strokeWidth: selectedScenario === "optimistic" ? 3.5 : 2.25, strokeOpacity: selectedScenario === "optimistic" ? 1 : 0.35 }),
            h(Line, { type: "monotone", dataKey: "pessimistic", name: "Pessimistic", dot: false, stroke: PALETTE.PESS, strokeWidth: selectedScenario === "pessimistic" ? 3.5 : 2.25, strokeOpacity: selectedScenario === "pessimistic" ? 1 : 0.35 })
          )
        ),
      ])
    ),
    h(
      "div",
      { key: "eb", className: "card p-5" },
      h("div", { className: "mb-3 flex items-center justify-between gap-3" }, [
        h("div", { key: "t", className: "text-sm font-semibold text-gray-900" }, RU_STRINGS.charts.ebitda),
        h("div", { key: "l", className: "text-xs text-gray-500" }, RU_STRINGS.charts.monthly),
      ]),
      h("div", { className: "h-72" }, [
        h(
          ResponsiveContainer,
          { width: "100%", height: "100%" },
          h(
            LineChart,
            { data: chartEbitda },
            h(CartesianGrid, { stroke: PALETTE.GRID, strokeDasharray: "3 3", strokeOpacity: 0.22 }),
            h(XAxis, { dataKey: "period", tickFormatter: (v) => String(v), minTickGap: 16, tick: { fontSize: 11, fill: "#6B7280" } }),
            h(YAxis, { tickFormatter: (v) => fmtSuffixInt(Number(v)), tick: { fontSize: 11, fill: "#6B7280" } }),
            h(Tooltip, { formatter: (v) => fmt.money(Number(v), 0), labelFormatter: (l) => `${RU_STRINGS.charts.tooltipMonth} ${l}` }),
            h(Legend, null),
            h(Area, { type: "monotone", dataKey: "bandHigh", stroke: "none", fill: "#93C5FD", fillOpacity: 0.12, isAnimationActive: false, name: "Range" }),
            h(Area, { type: "monotone", dataKey: "bandLow", stroke: "none", fill: "#F9FAFB", fillOpacity: 1, isAnimationActive: false, name: "" }),
            h(Line, { type: "monotone", dataKey: "base", name: "Base", dot: false, stroke: PALETTE.BASE, strokeWidth: selectedScenario === "base" ? 3.5 : 2.25, strokeOpacity: selectedScenario === "base" ? 1 : 0.35 }),
            h(Line, { type: "monotone", dataKey: "optimistic", name: "Optimistic", dot: false, stroke: PALETTE.OPT, strokeWidth: selectedScenario === "optimistic" ? 3.5 : 2.25, strokeOpacity: selectedScenario === "optimistic" ? 1 : 0.35 }),
            h(Line, { type: "monotone", dataKey: "pessimistic", name: "Pessimistic", dot: false, stroke: PALETTE.PESS, strokeWidth: selectedScenario === "pessimistic" ? 3.5 : 2.25, strokeOpacity: selectedScenario === "pessimistic" ? 1 : 0.35 })
          )
        ),
      ])
    ),
    h(
      "div",
      { key: "np", className: "card p-5" },
      h("div", { className: "mb-3 flex items-center justify-between gap-3" }, [
        h("div", { key: "t", className: "text-sm font-semibold text-gray-900" }, RU_STRINGS.charts.netProfit),
        h("div", { key: "l", className: "text-xs text-gray-500" }, RU_STRINGS.charts.monthly),
      ]),
      h("div", { className: "h-56" }, [
        h(
          ResponsiveContainer,
          { width: "100%", height: "100%" },
          h(
            LineChart,
            { data: output.charts.net_profit ?? [] },
            h(CartesianGrid, { stroke: PALETTE.GRID, strokeDasharray: "3 3", strokeOpacity: 0.22 }),
            h(XAxis, { dataKey: "period", tickFormatter: (v) => String(v), minTickGap: 16, tick: { fontSize: 11, fill: "#6B7280" } }),
            h(YAxis, { tickFormatter: (v) => fmtSuffixInt(Number(v)), tick: { fontSize: 11, fill: "#6B7280" } }),
            h(Tooltip, { formatter: (v) => fmt.money(Number(v), 0), labelFormatter: (l) => `${RU_STRINGS.charts.tooltipMonth} ${l}` }),
            h(Legend, null),
            h(Line, { type: "monotone", dataKey: "base", name: "Base", dot: false, stroke: PALETTE.BASE, strokeWidth: selectedScenario === "base" ? 3.5 : 2.25, strokeOpacity: selectedScenario === "base" ? 1 : 0.35 }),
            h(Line, { type: "monotone", dataKey: "optimistic", name: "Optimistic", dot: false, stroke: PALETTE.OPT, strokeWidth: selectedScenario === "optimistic" ? 3.5 : 2.25, strokeOpacity: selectedScenario === "optimistic" ? 1 : 0.35 }),
            h(Line, { type: "monotone", dataKey: "pessimistic", name: "Pessimistic", dot: false, stroke: PALETTE.PESS, strokeWidth: selectedScenario === "pessimistic" ? 3.5 : 2.25, strokeOpacity: selectedScenario === "pessimistic" ? 1 : 0.35 })
          )
        ),
      ])
    ),
  ]);

  const rightPanel = h(
    "div",
    { className: "space-y-4" },
    h(
      "div",
      { className: "card p-5" },
      h("div", { className: "mb-3 flex items-center justify-between gap-3" }, [
        h("div", { className: "text-sm font-semibold text-gray-900" }, RU_STRINGS.right.title),
        h(Pill, { text: scenarioLabel(selectedScenario), tone: scenarioTone(selectedScenario) }),
      ]),
      h("div", { className: "space-y-2" }, [
        h("div", { key: "r", className: "rounded-xl border border-gray-200 bg-white p-3" }, [
          h("div", { className: "text-xs font-semibold text-gray-500" }, RU_STRINGS.right.annualizedSelected),
          h("div", { className: "mt-2 grid grid-cols-2 gap-2 text-xs text-gray-700" }, [
            h("div", { key: "rev", className: "flex items-center justify-between gap-2 rounded-lg border border-gray-100 bg-gray-50 px-2 py-1" }, [
              h("span", { className: "text-gray-600" }, RU_STRINGS.right.revenue),
              h("span", { className: "mono font-semibold text-gray-900 tabular-nums" }, fmt.money(Math.max(0, annualize(selRevenue)))),
            ]),
            h("div", { key: "eb", className: "flex items-center justify-between gap-2 rounded-lg border border-gray-100 bg-gray-50 px-2 py-1" }, [
              h("span", { className: "text-gray-600" }, RU_STRINGS.right.ebitda),
              h("span", { className: "mono font-semibold text-gray-900 tabular-nums" }, fmt.money(annualize(selEbitda))),
            ]),
            h("div", { key: "np", className: "flex items-center justify-between gap-2 rounded-lg border border-gray-100 bg-gray-50 px-2 py-1" }, [
              h("span", { className: "text-gray-600" }, RU_STRINGS.right.netProfit),
              h("span", { className: "mono font-semibold text-gray-900 tabular-nums" }, fmt.money(annualize(selNetProfit))),
            ]),
            h("div", { key: "nm", className: "flex items-center justify-between gap-2 rounded-lg border border-gray-100 bg-gray-50 px-2 py-1" }, [
              h("span", { className: "text-gray-600" }, RU_STRINGS.right.netMargin),
              h("span", { className: "mono font-semibold text-gray-900 tabular-nums" }, fmt.pct(selNetMargin, 1)),
            ]),
          ]),
        ]),
        h("div", { key: "d", className: "rounded-xl border border-gray-200 bg-white p-3" }, [
          h("div", { className: "text-xs font-semibold text-gray-500" }, RU_STRINGS.right.drivers),
          h("ul", { className: "mt-2 list-disc space-y-1 pl-5 text-xs text-gray-700" }, [
            h("li", { key: "1" }, RU_STRINGS.right.driver1),
            h("li", { key: "2" }, RU_STRINGS.right.driver2),
            h("li", { key: "3" }, RU_STRINGS.right.driver3),
            h("li", { key: "4" }, RU_STRINGS.right.driver4),
          ]),
        ]),
        h("div", { key: "s", className: "rounded-xl border border-gray-200 bg-white p-3" }, [
          h("div", { className: "text-xs font-semibold text-gray-500" }, RU_STRINGS.right.sensitivity),
          h("div", { className: "mt-2 text-xs text-gray-700" }, RU_STRINGS.right.sensitivityText),
        ]),
      ])
    )
  );

  return h(
    "div",
    { className: "min-h-screen bg-white text-gray-900 px-4 py-8" },
    h(
      "div",
      { className: "mx-auto max-w-7xl space-y-6" },
      nav,
      header,
      kpiSticky,
      kpiSpacer,
      howToRead,
      h("div", { className: "grid grid-cols-1 gap-6 lg:grid-cols-[360px_1fr_360px] items-start" }, [
        h("div", { key: "left", className: "space-y-4" }, [scaleCard, scenarioBuilder]),
        h("div", { key: "mid", className: "stickyCol space-y-4" }, charts),
        h("div", { key: "right", className: "stickyCol" }, h("div", { className: "stickyColInner space-y-4" }, rightPanel)),
      ]),
      h(
        "div",
        { className: "text-xs text-gray-500" },
        "Offline demo. Neutral case: international distributor / importer. Numbers are simulated for education and planning."
      )
    )
  );
}

const rootEl = document.getElementById("root");
rootEl.className = "min-h-screen";
createRoot(rootEl).render(h(React.StrictMode, null, h(ScenarioPlanningApp)));

