import React, { useState, useMemo } from "react";
import { Plus, Copy, Trash2, Printer, ChevronDown, ChevronUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { calculateProfitability } from "@/lib/solarCalculations";

const SHADING_OPTIONS = [
  { value: "none",          label: "Aucun (100%)" },
  { value: "tree_far",      label: "Arbres éloignés (97%)" },
  { value: "tree_near",     label: "Arbres proches (90%)" },
  { value: "building_far",  label: "Bâtiment éloigné (95%)" },
  { value: "building_near", label: "Bâtiment proche (85%)" },
  { value: "chimney",       label: "Cheminée (97%)" },
  { value: "dormer",        label: "Lucarne (94%)" },
  { value: "heavy",         label: "Ombrage important (75%)" },
];

const INCL_OPTIONS = [0, 10, 15, 20, 30, 35, 40, 45];

let nextId = 1;
function newScenario(name = null, overrides = {}) {
  return {
    id: String(nextId++),
    name: name ?? `Scénario ${nextId - 1}`,
    overrides: {
      panelCount:          null,
      electricityPrice:    null,
      selfConsumptionRate: null,
      inflationRate:       null,
      globalInclination:   null,
      globalShading:       null,
      ...overrides,
    },
  };
}

function applyOverrides(scenario, pans, panelCount, settings) {
  const o = scenario.overrides;

  const effectivePanelCount = o.panelCount ?? panelCount ?? 0;

  const effectiveSettings = {
    ...settings,
    ...(o.electricityPrice    != null ? { electricity_price:     o.electricityPrice    } : {}),
    ...(o.selfConsumptionRate != null ? { self_consumption_rate: o.selfConsumptionRate } : {}),
    ...(o.inflationRate       != null ? { inflation_rate:        o.inflationRate       } : {}),
  };

  let effectivePans = pans;
  if ((o.globalInclination != null || o.globalShading != null) && pans?.length > 0) {
    effectivePans = pans.map(p => ({
      ...p,
      ...(o.globalInclination != null ? { inclination: o.globalInclination } : {}),
      ...(o.globalShading != null ? { shading: o.globalShading, shadingSource: 'manual', solarShadingFactor: null } : {}),
    }));
  }

  return { effectivePanelCount, effectiveSettings, effectivePans };
}

// Labels and metric extractors for comparison table
const METRICS = [
  { key: "annualProduction",    label: "Production annuelle",   unit: "kWh",  fmt: v => v?.toLocaleString("fr-FR"), best: "max" },
  { key: "totalPowerKwc",       label: "Puissance installée",   unit: "kWc",  fmt: v => v?.toFixed(2),             best: "max" },
  { key: "avgPR",               label: "Performance Ratio",     unit: "%",    fmt: v => v,                         best: "max" },
  { key: "totalAnnualBenefit",  label: "Bénéfice / an",         unit: "€",    fmt: v => v?.toLocaleString("fr-FR"), best: "max" },
  { key: "totalCost",           label: "Coût total",            unit: "€",    fmt: v => v?.toLocaleString("fr-FR"), best: "min" },
  { key: "resteACharge",        label: "Reste à charge",        unit: "€",    fmt: v => v?.toLocaleString("fr-FR"), best: "min" },
  { key: "roiYears",            label: "Retour sur invest.",     unit: "ans",  fmt: v => v,                         best: "min" },
  { key: "gain10",              label: "Gain cumulé 10 ans",    unit: "€",    fmt: v => v?.toLocaleString("fr-FR"), best: "max" },
  { key: "gain25",              label: "Gain cumulé 25 ans",    unit: "€",    fmt: v => v?.toLocaleString("fr-FR"), best: "max" },
  { key: "co2SavedKg",          label: "CO₂ évité (25 ans)",    unit: "kg",   fmt: v => v?.toLocaleString("fr-FR"), best: "max" },
];

function getResult(scenario, pans, panelCount, settings, panel, pvgisData) {
  const { effectivePanelCount, effectiveSettings, effectivePans } = applyOverrides(scenario, pans, panelCount, settings);
  const r = calculateProfitability(effectivePanelCount, panel, effectiveSettings, effectivePans, pvgisData);
  if (!r) return null;
  return {
    ...r,
    gain10: r.projections?.[9]?.cumulativeGains ?? null,
    gain25: r.projections?.[24]?.cumulativeGains ?? null,
  };
}

export default function ScenarioComparator({ pans, panel, settings, pvgisData, panelCount }) {
  const [scenarios, setScenarios] = useState(() => [newScenario("Scénario de base")]);
  const [collapsed,  setCollapsed] = useState(false);

  const results = useMemo(() =>
    scenarios.map(s => getResult(s, pans, panelCount, settings, panel, pvgisData)),
    [scenarios, pans, panelCount, settings, panel, pvgisData]
  );

  function addScenario() {
    if (scenarios.length >= 6) return;
    setScenarios(prev => [...prev, newScenario()]);
  }

  function duplicateScenario(id) {
    if (scenarios.length >= 6) return;
    const src = scenarios.find(s => s.id === id);
    if (!src) return;
    setScenarios(prev => [...prev, newScenario(`${src.name} (copie)`, src.overrides)]);
  }

  function deleteScenario(id) {
    setScenarios(prev => prev.filter(s => s.id !== id));
  }

  function updateScenario(id, patch) {
    setScenarios(prev => prev.map(s => s.id === id ? { ...s, ...patch } : s));
  }

  function updateOverride(id, key, value) {
    setScenarios(prev => prev.map(s =>
      s.id === id ? { ...s, overrides: { ...s.overrides, [key]: value } } : s
    ));
  }

  // Find best value per metric across scenarios
  function bestIdx(metricKey, direction) {
    const vals = results.map(r => r?.[metricKey] ?? null);
    const valid = vals.filter(v => v !== null);
    if (valid.length === 0) return -1;
    const target = direction === "max" ? Math.max(...valid) : Math.min(...valid);
    return vals.findIndex(v => v === target);
  }

  const sCount = scenarios.length;

  return (
    <div className="rounded-xl border border-border bg-card overflow-hidden print:border-0" id="scenario-comparator">
      <style>{`
        @media print {
          body > *:not(#scenario-comparator) { display: none !important; }
          #scenario-comparator { border: none; box-shadow: none; }
          .no-print { display: none !important; }
        }
      `}</style>

      {/* Header */}
      <div className="px-4 py-3 border-b border-border bg-secondary/30 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <h3 className="text-sm font-semibold text-foreground">Comparateur de scénarios</h3>
          <span className="text-xs text-muted-foreground">{sCount}/6</span>
        </div>
        <div className="flex items-center gap-2 no-print">
          <Button variant="ghost" size="sm" className="h-7 text-xs gap-1"
            onClick={() => setCollapsed(c => !c)}>
            {collapsed ? <ChevronDown className="w-3 h-3" /> : <ChevronUp className="w-3 h-3" />}
            {collapsed ? "Développer" : "Réduire"}
          </Button>
          <Button variant="ghost" size="sm" className="h-7 text-xs gap-1"
            onClick={() => window.print()}>
            <Printer className="w-3 h-3" /> Imprimer
          </Button>
          <Button variant="ghost" size="sm" className="h-7 text-xs gap-1 text-primary"
            onClick={addScenario} disabled={sCount >= 6}>
            <Plus className="w-3 h-3" /> Nouveau
          </Button>
        </div>
      </div>

      {!collapsed && (
        <>
          {/* Scénario cards */}
          <div className="p-4 grid gap-3" style={{ gridTemplateColumns: `repeat(${sCount}, minmax(0,1fr))` }}>
            {scenarios.map((sc, idx) => (
              <div key={sc.id} className="rounded-lg border border-border bg-secondary/20 p-3 space-y-2 text-xs no-print">
                {/* Name + actions */}
                <div className="flex items-center gap-1">
                  <Input
                    value={sc.name}
                    onChange={e => updateScenario(sc.id, { name: e.target.value })}
                    className="h-6 text-xs font-semibold bg-transparent border-0 border-b border-border rounded-none px-0 focus-visible:ring-0 flex-1"
                  />
                  <button onClick={() => duplicateScenario(sc.id)} disabled={sCount >= 6}
                    title="Dupliquer" className="text-muted-foreground hover:text-foreground disabled:opacity-30 ml-1">
                    <Copy className="w-3 h-3" />
                  </button>
                  {sCount > 1 && (
                    <button onClick={() => deleteScenario(sc.id)} title="Supprimer"
                      className="text-muted-foreground hover:text-destructive ml-0.5">
                      <Trash2 className="w-3 h-3" />
                    </button>
                  )}
                </div>

                {/* Overrides */}
                <div className="space-y-1.5">
                  <OverrideRow label="Nb panneaux"
                    value={sc.overrides.panelCount}
                    placeholder={String(panelCount ?? "—")}
                    type="number" min={1} step={1}
                    onChange={v => updateOverride(sc.id, "panelCount", v === "" ? null : Number(v))}
                  />
                  <OverrideRow label="Prix élec. (€/kWh)"
                    value={sc.overrides.electricityPrice}
                    placeholder={String(settings?.electricity_price ?? 0.2516)}
                    type="number" min={0.01} step={0.001}
                    onChange={v => updateOverride(sc.id, "electricityPrice", v === "" ? null : Number(v))}
                  />
                  <OverrideRow label="Autoconso. (%)"
                    value={sc.overrides.selfConsumptionRate}
                    placeholder={String(settings?.self_consumption_rate ?? 70)}
                    type="number" min={0} max={100} step={1}
                    onChange={v => updateOverride(sc.id, "selfConsumptionRate", v === "" ? null : Number(v))}
                  />
                  <OverrideRow label="Inflation (%/an)"
                    value={sc.overrides.inflationRate}
                    placeholder={String(settings?.inflation_rate ?? 5)}
                    type="number" min={0} max={20} step={0.5}
                    onChange={v => updateOverride(sc.id, "inflationRate", v === "" ? null : Number(v))}
                  />

                  {/* Inclinaison globale */}
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-muted-foreground shrink-0">Inclinaison</span>
                    <Select
                      value={sc.overrides.globalInclination != null ? String(sc.overrides.globalInclination) : "__default__"}
                      onValueChange={v => updateOverride(sc.id, "globalInclination", v === "__default__" ? null : Number(v))}
                    >
                      <SelectTrigger className="h-6 text-xs bg-secondary/40 border-border w-24">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="__default__">Détecté</SelectItem>
                        {INCL_OPTIONS.map(i => (
                          <SelectItem key={i} value={String(i)}>{i}°</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Ombrage global */}
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-muted-foreground shrink-0">Ombrage</span>
                    <Select
                      value={sc.overrides.globalShading ?? "__default__"}
                      onValueChange={v => updateOverride(sc.id, "globalShading", v === "__default__" ? null : v)}
                    >
                      <SelectTrigger className="h-6 text-xs bg-secondary/40 border-border w-36">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="__default__">Détecté / tracé</SelectItem>
                        {SHADING_OPTIONS.map(o => (
                          <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Comparison table */}
          <div className="overflow-x-auto border-t border-border">
            <table className="w-full text-xs">
              <thead>
                <tr className="bg-secondary/20 border-b border-border">
                  <th className="px-3 py-2 text-left text-muted-foreground font-medium w-40">Indicateur</th>
                  {scenarios.map((sc, idx) => (
                    <th key={sc.id} className="px-3 py-2 text-right text-muted-foreground font-medium">
                      {sc.name}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {METRICS.map(metric => {
                  const best = bestIdx(metric.key, metric.best);
                  return (
                    <tr key={metric.key} className="border-b border-border/40 hover:bg-secondary/10">
                      <td className="px-3 py-2 text-muted-foreground">{metric.label}</td>
                      {results.map((r, idx) => {
                        const raw = r?.[metric.key] ?? null;
                        const isBest = idx === best;
                        return (
                          <td key={scenarios[idx].id}
                            className={`px-3 py-2 text-right font-medium ${
                              raw === null ? "text-muted-foreground/40" :
                              isBest      ? "text-emerald-400 font-semibold" : "text-foreground"
                            }`}>
                            {raw === null ? "—" : `${metric.fmt(raw)} ${metric.unit}`}
                            {isBest && raw !== null && (
                              <span className="ml-1 text-[9px] text-emerald-400/70">▲</span>
                            )}
                          </td>
                        );
                      })}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}

function OverrideRow({ label, value, placeholder, type, min, max, step, onChange }) {
  return (
    <div className="flex items-center justify-between gap-2">
      <span className="text-muted-foreground shrink-0">{label}</span>
      <Input
        type={type}
        min={min} max={max} step={step}
        value={value ?? ""}
        placeholder={placeholder}
        onChange={e => onChange(e.target.value)}
        className="h-6 text-xs bg-secondary/40 border-border w-24 text-right"
      />
    </div>
  );
}
