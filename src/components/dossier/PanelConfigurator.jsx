import React from "react";
import { Slider } from "@/components/ui/slider";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Sun, Ruler, Zap } from "lucide-react";
import { calculateMaxPanels } from "@/lib/solarCalculations";

export default function PanelConfigurator({ panels, data, onChange }) {
  const selectedPanel = panels.find(p => p.id === data.panel_model_id) || panels[0];

  // BUG 3 fix: use max_panels from polygon grid as source of truth
  // Fallback to calculateMaxPanels only when no polygon drawn yet
  const maxPanels = (data.max_panels > 0)
    ? data.max_panels
    : calculateMaxPanels(data.roof_width, data.roof_height, selectedPanel?.width_mm, selectedPanel?.height_mm);

  const panelCount = data.panel_count || 0;
  const totalPower = selectedPanel ? (panelCount * selectedPanel.power_wc / 1000) : 0;

  const update = (field, value) => {
    const newData = { ...data, [field]: value };
    if (field === "panel_model_id") {
      const newPanel = panels.find(p => p.id === value);
      const newMax = data.max_panels > 0
        ? data.max_panels
        : calculateMaxPanels(data.roof_width, data.roof_height, newPanel?.width_mm, newPanel?.height_mm);
      newData.max_panels = newMax;
      if ((newData.panel_count || 0) > newMax) newData.panel_count = newMax;
      newData.total_power_kwc = Math.round(((newData.panel_count || 0) * (newPanel?.power_wc || 0) / 1000) * 100) / 100;
    }
    if (field === "panel_count") {
      newData.total_power_kwc = Math.round((value * (selectedPanel?.power_wc || 0) / 1000) * 100) / 100;
    }
    onChange(newData);
  };

  return (
    <div className="space-y-6">
      {/* Panel selection */}
      <div className="space-y-2">
        <label className="text-muted-foreground text-xs uppercase tracking-wider flex items-center gap-2">
          <Sun className="w-4 h-4 text-primary" />
          Modèle de panneau
        </label>
        <Select value={data.panel_model_id || ""} onValueChange={(v) => update("panel_model_id", v)}>
          <SelectTrigger className="bg-secondary/50 border-border">
            <SelectValue placeholder="Choisir un modèle" />
          </SelectTrigger>
          <SelectContent>
            {panels.map(p => (
              <SelectItem key={String(p.id)} value={String(p.id)}>
                {p.brand} {p.model_name} — {p.power_wc}Wc ({p.efficiency}%)
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* BUG 1 fix: dimensions en lecture seule, calculées depuis le polygone GPS */}
      {(data.roof_width > 0 || data.roof_height > 0) && (
        <div className="grid grid-cols-2 gap-3">
          <div className="bg-secondary/30 rounded-lg px-3 py-2">
            <div className="text-[10px] uppercase text-muted-foreground tracking-wider flex items-center gap-1 mb-0.5">
              <Ruler className="w-3 h-3" /> Largeur pan
            </div>
            <span className="text-sm font-semibold text-foreground">{(data.roof_width || 0).toFixed(1)} m</span>
          </div>
          <div className="bg-secondary/30 rounded-lg px-3 py-2">
            <div className="text-[10px] uppercase text-muted-foreground tracking-wider flex items-center gap-1 mb-0.5">
              <Ruler className="w-3 h-3" /> Hauteur pan
            </div>
            <span className="text-sm font-semibold text-foreground">{(data.roof_height || 0).toFixed(1)} m</span>
          </div>
        </div>
      )}

      {/* BUG 3 fix: capacité max depuis le polygone réel */}
      {maxPanels > 0 && (
        <div className="bg-primary/10 border border-primary/20 rounded-lg p-4">
          <p className="text-sm text-foreground">
            Capacité maximale : <span className="font-bold text-primary">{maxPanels} panneaux</span>
            {data.roof_area_usable > 0 && (
              <span className="text-xs text-muted-foreground ml-2">({data.roof_area_usable} m² utiles)</span>
            )}
          </p>
        </div>
      )}

      {/* BUG 4 fix: slider max = data.max_panels (depuis polygone), valeur auto-initialisée */}
      <div className="space-y-3">
        <label className="text-muted-foreground text-xs uppercase tracking-wider flex items-center gap-2">
          <Zap className="w-4 h-4 text-primary" />
          Nombre de panneaux : <span className="text-primary font-bold text-sm">{panelCount}</span>
        </label>
        <Slider
          value={[panelCount]}
          onValueChange={([v]) => update("panel_count", v)}
          max={maxPanels || 50}
          min={0}
          step={1}
          className="py-2"
        />
        <div className="flex justify-between text-xs text-muted-foreground">
          <span>0</span>
          <span>{maxPanels || 50}</span>
        </div>
      </div>

      {/* Summary */}
      {panelCount > 0 && selectedPanel && (
        <div className="grid grid-cols-2 gap-4">
          <div className="bg-secondary/50 rounded-lg p-4 text-center">
            <p className="text-2xl font-bold text-primary">{Math.round(totalPower * 100) / 100}</p>
            <p className="text-xs text-muted-foreground mt-1">kWc installés</p>
          </div>
          <div className="bg-secondary/50 rounded-lg p-4 text-center">
            <p className="text-2xl font-bold text-foreground">{panelCount}</p>
            <p className="text-xs text-muted-foreground mt-1">panneaux</p>
          </div>
        </div>
      )}
    </div>
  );
}
