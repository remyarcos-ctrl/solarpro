import React, { useState } from "react";
import { Trash2, ChevronDown, ChevronUp, Info } from "lucide-react";
import { ORIENTATIONS, getSolarCoefficient, getPanRecommendation, PAN_COLORS } from "./roofUtils";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

const SHADING_OPTIONS = [
  { value: "none",          label: "Aucun obstacle",      factor: 1.00 },
  { value: "tree_far",      label: "Arbres éloignés",     factor: 0.97 },
  { value: "tree_near",     label: "Arbres proches",      factor: 0.90 },
  { value: "building_far",  label: "Bâtiment éloigné",    factor: 0.95 },
  { value: "building_near", label: "Bâtiment proche",     factor: 0.85 },
  { value: "chimney",       label: "Cheminée sur toit",   factor: 0.97 },
  { value: "dormer",        label: "Lucarne / Velux",     factor: 0.94 },
  { value: "heavy",         label: "Ombrage important",   factor: 0.75 },
];

function getShadingFactor(shadingType) {
  return SHADING_OPTIONS.find(o => o.value === shadingType)?.factor || 1.0;
}

export default function PanSummaryTable({ pans, onUpdatePan, onDeletePan, panel, settings, pvgisData, solarSegments }) {
  const [expandedPan, setExpandedPan] = useState(null);

  if (pans.length === 0) return null;

  const globalProdPerKwc = pvgisData?.annualKwhPerKwc || settings?.regional_production || 1100;
  const elecPrice        = settings?.electricity_price || 0.2516;
  // pvgisSource présent → E_y inclut déjà pertes système + température
  const pvgisMode        = !!(pvgisData?.pvgisSource || settings?.pvgisSource);

  // Pertes système fixes (utilisées uniquement en mode fallback)
  const cableFactor    = 0.97;
  const inverterFactor = 0.96;
  const dirtFactor     = 0.97;
  const degradY1       = 0.98;
  const systemLoss     = cableFactor * inverterFactor * dirtFactor * degradY1;

  // Calcule production pour un pan donné
  function calcPanProd(pan) {
    const coef    = getSolarCoefficient(pan.orientation, pan.inclination);
    const shading = pan.shadingSource === 'solar_api' && pan.solarShadingFactor != null
      ? pan.solarShadingFactor
      : getShadingFactor(pan.shading || "none");
    const kwc     = ((pan.maxPanels || 0) * (panel?.power_wc || 0)) / 1000;
    if (pan.pvgisKwhPerKwc) {
      return { prod: Math.round(kwc * pan.pvgisKwhPerKwc * shading), PR: shading, coef, shading };
    } else if (pvgisMode) {
      const PR = coef * shading;
      return { prod: Math.round(kwc * globalProdPerKwc * PR), PR, coef, shading };
    }
    const PR = coef * shading * systemLoss;
    return { prod: Math.round(kwc * globalProdPerKwc * PR), PR, coef, shading };
  }

  const totalPanels = pans.reduce((s, p) => s + (p.maxPanels || 0), 0);
  const totalProd   = pans.reduce((s, p) => s + calcPanProd(p).prod, 0);

  const totalKwc    = (totalPanels * (panel?.power_wc || 0)) / 1000;
  const totalSavings= Math.round(totalProd * elecPrice * 0.7); // 70% autoconsommé

  return (
    <div className="rounded-xl border border-border bg-card overflow-hidden">
      {/* Header */}
      <div className="px-4 py-3 border-b border-border bg-secondary/30 flex items-center justify-between">
        <h3 className="text-sm font-semibold text-foreground">Récapitulatif des pans de toiture</h3>
        {pvgisData && (
          <span className="text-xs text-emerald-400 flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 inline-block" />
            Données {pvgisData.source?.split('—')[1]?.trim() || 'régionales'}
          </span>
        )}
      </div>

      {/* Tableau */}
      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b border-border bg-secondary/10">
              {["Pan", "Orientation", "Inclinaison", "Ombrage", "Pan. max", "PR", "Prod. annuelle", "Éco/an", "Avis", ""].map(h => (
                <th key={h} className="px-3 py-2 text-left text-muted-foreground font-medium whitespace-nowrap">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {pans.map((pan, idx) => {
              const { prod, PR, coef, shading } = calcPanProd(pan);
              const rec     = getPanRecommendation(coef);
              const kwc     = ((pan.maxPanels || 0) * (panel?.power_wc || 0)) / 1000;
              const savings = Math.round(prod * elecPrice * 0.7);
              const prodBase = pan.pvgisKwhPerKwc || globalProdPerKwc;
              const color   = PAN_COLORS[idx % PAN_COLORS.length];
              const oriLabel= ORIENTATIONS.find(o => o.value === pan.orientation)?.label || pan.orientation;
              const isExpanded = expandedPan === pan.id;

              return (
                <React.Fragment key={pan.id}>
                  <tr className="border-b border-border/50 hover:bg-secondary/20 transition-colors">
                    {/* Pan */}
                    <td className="px-3 py-2">
                      <div className="flex items-center gap-2">
                        <div className="w-3 h-3 rounded-full flex-shrink-0" style={{ background: color }} />
                        <span className="font-semibold text-foreground">Pan {idx + 1}</span>
                        <div className="flex flex-col leading-tight">
                          <span className="text-muted-foreground text-[10px]">tracé : {pan.area || 0} m²</span>
                          {pan.solarAreaM2 != null && (
                            <span className="text-yellow-400 text-[10px] font-semibold">☀️ Solar : {pan.solarAreaM2} m²</span>
                          )}
                        </div>
                      </div>
                    </td>

                    {/* Orientation */}
                    <td className="px-3 py-2">
                      <div className="flex items-center gap-1.5">
                        <Select
                          value={pan.orientation}
                          onValueChange={v => onUpdatePan(pan.id, {
                            orientation: v,
                            azimut: ORIENTATIONS.find(o => o.value === v)?.azimut
                          })}
                        >
                          <SelectTrigger className="h-7 text-xs bg-secondary/40 border-border w-28">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {ORIENTATIONS.map(o => (
                              <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        {pan.azimut != null && (
                          <span className="text-[10px] text-emerald-400 bg-emerald-400/10 border border-emerald-400/30 px-1.5 py-0.5 rounded-full font-mono">
                            {pan.azimut}°
                          </span>
                        )}
                      </div>
                    </td>

                    {/* Inclinaison */}
                    <td className="px-3 py-2">
                      <Select
                        value={String(pan.inclination ?? 30)}
                        onValueChange={v => onUpdatePan(pan.id, { inclination: parseInt(v) })}
                      >
                        <SelectTrigger className="h-7 text-xs bg-secondary/40 border-border w-20">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {[...new Set([0, 10, 15, 20, 30, 35, 40, 45, pan.inclination ?? 30])]
                            .filter(v => v != null)
                            .sort((a, b) => a - b)
                            .map(i => (
                              <SelectItem key={i} value={String(i)}>{i}°</SelectItem>
                            ))}
                        </SelectContent>
                      </Select>
                    </td>

                    {/* Ombrage */}
                    <td className="px-3 py-2">
                      <div className="flex items-center gap-1">
                        <Select
                          value={pan.shading || "none"}
                          onValueChange={v => onUpdatePan(pan.id, { shading: v, shadingSource: 'manual' })}
                        >
                          <SelectTrigger className="h-7 text-xs bg-secondary/40 border-border w-32">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {SHADING_OPTIONS.map(o => (
                              <SelectItem key={o.value} value={o.value}>
                                {o.label} ({Math.round(o.factor * 100)}%)
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        {pan.shadingSource === 'solar_api' && pan.solarShadingFactor != null && (
                          <span className="text-[10px] text-yellow-400 bg-yellow-400/10 border border-yellow-400/20 px-1.5 py-0.5 rounded-full whitespace-nowrap" title="Ombrage calculé par Google Solar API">
                            ☀️ {Math.round(pan.solarShadingFactor * 100)}%
                          </span>
                        )}
                      </div>
                    </td>

                    {/* Panneaux max */}
                    <td className="px-3 py-2 text-right">
                      <div className="flex flex-col items-end leading-tight gap-0.5">
                        <span className="font-semibold text-primary">{pan.maxPanels || 0}</span>
                        {pan.maxPanelsSolar != null && pan.maxPanelsTraced != null
                          && pan.maxPanelsSolar !== pan.maxPanelsTraced && (
                          <span className="text-[10px] text-muted-foreground line-through">{pan.maxPanelsTraced}</span>
                        )}
                      </div>
                    </td>

                    {/* PR (Performance Ratio) */}
                    <td className="px-3 py-2 text-right">
                      <span className={`font-semibold ${
                        PR >= 0.80 ? "text-emerald-400" :
                        PR >= 0.70 ? "text-amber-400" : "text-red-400"
                      }`}>
                        {Math.round(PR * 100)}%
                      </span>
                    </td>

                    {/* Production */}
                    <td className="px-3 py-2 text-right text-foreground font-medium">
                      {prod.toLocaleString("fr-FR")} kWh
                    </td>

                    {/* Économies */}
                    <td className="px-3 py-2 text-right text-emerald-400 font-medium">
                      {savings.toLocaleString("fr-FR")} €
                    </td>

                    {/* Recommandation */}
                    <td className="px-3 py-2">
                      <div className="flex items-center gap-1">
                        <span className={`${rec.color} font-medium text-xs whitespace-nowrap`}>
                          {rec.icon} {rec.label}
                        </span>
                        <button
                          onClick={() => setExpandedPan(isExpanded ? null : pan.id)}
                          className="text-muted-foreground hover:text-foreground ml-1"
                        >
                          {isExpanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                        </button>
                      </div>
                    </td>

                    {/* Supprimer */}
                    <td className="px-3 py-2">
                      <button onClick={() => onDeletePan(pan.id)} className="text-muted-foreground hover:text-destructive transition-colors">
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </td>
                  </tr>

                  {/* Détails expandables */}
                  {isExpanded && (
                    <tr className="border-b border-border bg-secondary/10">
                      <td colSpan={10} className="px-4 py-3">
                        <div className="grid grid-cols-4 gap-4 text-xs">
                          <div>
                            <div className="text-muted-foreground mb-1 font-semibold uppercase tracking-wider text-[10px]">Facteurs de production</div>
                            <div className="space-y-1">
                              <div className="flex justify-between">
                                <span className="text-muted-foreground">Orientation {oriLabel} {pan.inclination}°</span>
                                <span className={pan.pvgisKwhPerKwc ? "text-muted-foreground/50" : "text-foreground"}>
                                  {pan.pvgisKwhPerKwc ? "inclus PVGIS" : `${Math.round(coef * 100)}%`}
                                </span>
                              </div>
                              <div className="flex justify-between">
                                <span className="text-muted-foreground">
                                  Ombrage {pan.shadingSource === 'solar_api' ? "☀️ Solar API" : ""}
                                </span>
                                <span className="text-foreground">{Math.round(shading * 100)}%</span>
                              </div>
                              {!pan.pvgisKwhPerKwc && !pvgisMode && (<>
                                <div className="flex justify-between">
                                  <span className="text-muted-foreground">Câblage + onduleur</span>
                                  <span className="text-foreground">{Math.round(cableFactor * inverterFactor * 100)}%</span>
                                </div>
                                <div className="flex justify-between">
                                  <span className="text-muted-foreground">Salissures + dégradation</span>
                                  <span className="text-foreground">{Math.round(dirtFactor * degradY1 * 100)}%</span>
                                </div>
                              </>)}
                              {(pan.pvgisKwhPerKwc || pvgisMode) && (
                                <div className="flex justify-between text-emerald-400/70 text-[10px]">
                                  <span>Pertes système (PVGIS loss=14%)</span>
                                  <span>inclus</span>
                                </div>
                              )}
                              <div className="flex justify-between border-t border-border pt-1 font-semibold">
                                <span className="text-muted-foreground">PR effectif</span>
                                <span className={PR >= 0.80 ? "text-emerald-400" : "text-amber-400"}>{Math.round(PR * 100)}%</span>
                              </div>
                            </div>
                          </div>

                          <div>
                            <div className="text-muted-foreground mb-1 font-semibold uppercase tracking-wider text-[10px]">Surface & Production</div>
                            <div className="space-y-1">
                              <div className="flex justify-between">
                                <span className="text-muted-foreground">Surface tracée</span>
                                <span className="text-foreground">{pan.area || 0} m²</span>
                              </div>
                              {pan.solarAreaM2 != null && (
                                <div className="flex justify-between">
                                  <span className="text-muted-foreground">Surface Solar API ☀️</span>
                                  <span className="text-yellow-400 font-semibold">{pan.solarAreaM2} m²</span>
                                </div>
                              )}
                              {pan.maxPanelsSolar != null && pan.maxPanelsTraced != null && (
                                <div className="flex justify-between text-[10px] text-muted-foreground border-t border-border pt-1">
                                  <span>Max tracé / Solar</span>
                                  <span>{pan.maxPanelsTraced} → <strong className="text-primary">{pan.maxPanelsSolar}</strong> pan.</span>
                                </div>
                              )}
                              <div className="flex justify-between border-t border-border pt-1">
                                <span className="text-muted-foreground">Panneaux (Solar)</span>
                                <span className="text-foreground">{pan.maxPanels || 0} × {panel?.power_wc || 0} Wc</span>
                              </div>
                              <div className="flex justify-between">
                                <span className="text-muted-foreground">Puissance</span>
                                <span className="text-foreground">{kwc.toFixed(2)} kWc</span>
                              </div>
                              <div className="flex justify-between">
                                <span className="text-muted-foreground">
                                  {pan.pvgisKwhPerKwc
                                    ? `PVGIS v5.2 (${pan.pvgisKwhPerKwc > 0 ? pan.azimut??180 : 180}° / ${pan.inclination}°)`
                                    : pvgisMode ? "PVGIS v5.2 (réf. Sud 30°)" : "Base régionale"}
                                </span>
                                <span className={pan.pvgisKwhPerKwc ? "text-emerald-400" : "text-foreground"}>
                                  {pan.pvgisLoading ? "⏳…" : `${prodBase} kWh/kWc`}
                                </span>
                              </div>
                              <div className="flex justify-between font-semibold border-t border-border pt-1">
                                <span className="text-muted-foreground">Production nette</span>
                                <span className="text-primary">{prod.toLocaleString("fr-FR")} kWh/an</span>
                              </div>
                            </div>
                          </div>

                          <div>
                            <div className="text-muted-foreground mb-1 font-semibold uppercase tracking-wider text-[10px]">Économies annuelles</div>
                            <div className="space-y-1">
                              <div className="flex justify-between">
                                <span className="text-muted-foreground">Autoconsommé (70%)</span>
                                <span className="text-emerald-400">{Math.round(prod * 0.7).toLocaleString("fr-FR")} kWh</span>
                              </div>
                              <div className="flex justify-between">
                                <span className="text-muted-foreground">Économie facture</span>
                                <span className="text-emerald-400">{Math.round(prod * 0.7 * elecPrice).toLocaleString("fr-FR")} €</span>
                              </div>
                              <div className="flex justify-between">
                                <span className="text-muted-foreground">Surplus revendu</span>
                                <span className="text-blue-400">{Math.round(prod * 0.3 * 0.13).toLocaleString("fr-FR")} €</span>
                              </div>
                              <div className="flex justify-between font-semibold border-t border-border pt-1">
                                <span className="text-muted-foreground">Total</span>
                                <span className="text-primary">{savings.toLocaleString("fr-FR")} €/an</span>
                              </div>
                            </div>
                          </div>

                          <div>
                            <div className="text-muted-foreground mb-1 font-semibold uppercase tracking-wider text-[10px]">Conseil</div>
                            <div className={`rounded-lg p-2 text-xs ${rec.bg || "bg-secondary/30"}`}>
                              <div className={`font-semibold mb-1 ${rec.color}`}>{rec.icon} {rec.label}</div>
                              {coef >= 0.95 && <p className="text-muted-foreground">Configuration idéale. Maximisez le nombre de panneaux.</p>}
                              {coef >= 0.85 && coef < 0.95 && <p className="text-muted-foreground">Très bonne orientation. Production excellente.</p>}
                              {coef >= 0.72 && coef < 0.85 && <p className="text-muted-foreground">Acceptable. Envisagez de compenser avec plus de panneaux.</p>}
                              {coef < 0.72 && <p className="text-muted-foreground">Rendement faible. Priorisez les autres pans si possible.</p>}
                              {pan.inclination < 10 && <p className="text-amber-400 mt-1">⚠️ Inclinaison faible : risque d'encrassement plus élevé.</p>}
                              {pan.inclination > 40 && <p className="text-amber-400 mt-1">⚠️ Inclinaison forte : vérifier l'accessibilité pour maintenance.</p>}
                              {(pan.shading === 'tree_near' || pan.shading === 'building_near') && (
                                <p className="text-red-400 mt-1">❌ Ombrage proche : -10 à -15% de production. Élagage recommandé.</p>
                              )}
                            </div>
                          </div>
                        </div>
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              );
            })}
          </tbody>

          {/* Total */}
          <tfoot>
            <tr className="bg-secondary/40 font-semibold border-t border-border">
              <td className="px-3 py-3 text-foreground" colSpan={4}>
                <div className="flex items-center gap-2">
                  <span>Total installation</span>
                  <span className="text-xs text-muted-foreground font-normal">
                    {pans.length} pan{pans.length > 1 ? "s" : ""} · {totalKwc.toFixed(2)} kWc
                  </span>
                </div>
              </td>
              <td className="px-3 py-3 text-right text-primary">{totalPanels}</td>
              <td className="px-3 py-3 text-right text-muted-foreground">—</td>
              <td className="px-3 py-3 text-right text-primary">{totalProd.toLocaleString("fr-FR")} kWh</td>
              <td className="px-3 py-3 text-right text-emerald-400">{totalSavings.toLocaleString("fr-FR")} €</td>
              <td colSpan={2} />
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
}