import React from "react";
import { Slider } from "@/components/ui/slider";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Sun, Ruler, Zap } from "lucide-react";
import { calculateMaxPanels } from "@/lib/solarCalculations";

export default function PanelConfigurator({ panels, data, onChange }) {
  const selectedPanel = panels.find(p => p.id === data.panel_model_id) || panels[0];
  const maxPanels = calculateMaxPanels(data.roof_width, data.roof_height, selectedPanel?.width_mm, selectedPanel?.height_mm);
  const panelCount = data.panel_count || 0;
  const totalPower = selectedPanel ? (panelCount * selectedPanel.power_wc / 1000) : 0;

  const update = (field, value) => {
    const newData = { ...data, [field]: value };
    // Recalculate max panels and total power when relevant fields change
    if (field === "panel_model_id" || field === "roof_width" || field === "roof_height") {
      const panel = field === "panel_model_id" ? panels.find(p => p.id === value) : selectedPanel;
      const rw = field === "roof_width" ? value : data.roof_width;
      const rh = field === "roof_height" ? value : data.roof_height;
      const newMax = calculateMaxPanels(rw, rh, panel?.width_mm, panel?.height_mm);
      newData.max_panels = newMax;
      if ((newData.panel_count || 0) > newMax) {
        newData.panel_count = newMax;
      }
      newData.total_power_kwc = Math.round(((newData.panel_count || 0) * (panel?.power_wc || 0) / 1000) * 100) / 100;
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
        <Label className="text-muted-foreground text-xs uppercase tracking-wider flex items-center gap-2">
          <Sun className="w-4 h-4 text-primary" />
          Modèle de panneau
        </Label>
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

      {/* Roof dimensions */}
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label className="text-muted-foreground text-xs uppercase tracking-wider flex items-center gap-2">
            <Ruler className="w-4 h-4 text-primary" />
            Largeur toiture (m)
          </Label>
          <Input
            type="number"
            value={data.roof_width || ""}
            onChange={(e) => update("roof_width", parseFloat(e.target.value) || 0)}
            className="bg-secondary/50 border-border focus:border-primary"
            placeholder="10"
            min={0}
            step={0.5}
          />
        </div>
        <div className="space-y-2">
          <Label className="text-muted-foreground text-xs uppercase tracking-wider flex items-center gap-2">
            <Ruler className="w-4 h-4 text-primary" />
            Hauteur toiture (m)
          </Label>
          <Input
            type="number"
            value={data.roof_height || ""}
            onChange={(e) => update("roof_height", parseFloat(e.target.value) || 0)}
            className="bg-secondary/50 border-border focus:border-primary"
            placeholder="6"
            min={0}
            step={0.5}
          />
        </div>
      </div>

      {/* Max panels info */}
      {maxPanels > 0 && (
        <div className="bg-primary/10 border border-primary/20 rounded-lg p-4">
          <p className="text-sm text-foreground">
            Capacité maximale : <span className="font-bold text-primary">{maxPanels} panneaux</span>
          </p>
        </div>
      )}

      {/* Panel count slider */}
      <div className="space-y-3">
        <Label className="text-muted-foreground text-xs uppercase tracking-wider flex items-center gap-2">
          <Zap className="w-4 h-4 text-primary" />
          Nombre de panneaux : <span className="text-primary font-bold text-sm">{panelCount}</span>
        </Label>
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