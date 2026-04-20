import React from "react";
import { CONSUMPTION_PROFILES } from "@/lib/solarCalculations";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Zap, Home, Battery } from "lucide-react";

// Édite la conso annuelle, le profil, le tarif EDF et l'option batterie.
// Ces données pilotent l'autoconso mensuelle réelle (au lieu du 70 % fixe).
export default function ConsumptionConfigurator({ data, onChange, settings, onSettingsChange }) {
  const consumption = data?.annual_consumption_kwh ?? "";
  const profile     = data?.consumption_profile    ?? "standard";
  const hasBattery  = !!data?.has_battery;
  const batteryKwh  = data?.battery_kwh ?? 10;
  const tariff      = settings?.tariff_type ?? "base";

  return (
    <div className="rounded-xl border border-border bg-card p-4 space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
          <Home className="w-4 h-4 text-emerald-400" />
          Consommation du foyer
        </h3>
        <span className="text-xs text-muted-foreground">Pilote le calcul d'autoconsommation réelle</span>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <div>
          <Label className="text-xs text-muted-foreground">Conso annuelle (kWh/an)</Label>
          <Input
            type="number" min="0" step="100" placeholder="ex: 5000"
            value={consumption}
            onChange={(e) => onChange({ annual_consumption_kwh: Number(e.target.value) || 0 })}
            className="mt-1"
          />
          <div className="text-[10px] text-muted-foreground mt-1">
            💡 Se trouve sur la facture EDF annuelle du client
          </div>
        </div>
        <div>
          <Label className="text-xs text-muted-foreground">Profil de consommation</Label>
          <Select value={profile} onValueChange={(v) => onChange({ consumption_profile: v })}>
            <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
            <SelectContent>
              {Object.entries(CONSUMPTION_PROFILES).map(([k, p]) => (
                <SelectItem key={k} value={k}>{p.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-2 border-t border-border">
        <div>
          <Label className="text-xs text-muted-foreground flex items-center gap-1">
            <Zap className="w-3 h-3" /> Tarif EDF
          </Label>
          <Select value={tariff} onValueChange={(v) => onSettingsChange?.({ tariff_type: v })}>
            <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="base">Tarif Bleu Base ({(settings?.electricity_price ?? 0.2516).toFixed(4).replace('.', ',')} €/kWh)</SelectItem>
              <SelectItem value="hphc">HP / HC ({(settings?.electricity_price_hp ?? 0.2550).toFixed(4).replace('.', ',')} HP / {(settings?.electricity_price_hc ?? 0.2060).toFixed(4).replace('.', ',')} HC)</SelectItem>
            </SelectContent>
          </Select>
          {tariff === "hphc" && (
            <div className="text-[10px] text-emerald-400 mt-1">
              ⚡ Solaire = prod mi-journée → 100 % en HP (plus rentable)
            </div>
          )}
        </div>
        <div className="flex flex-col gap-2">
          <div className="flex items-center justify-between">
            <Label className="text-xs text-muted-foreground flex items-center gap-1">
              <Battery className="w-3 h-3" /> Batterie de stockage
            </Label>
            <Switch checked={hasBattery} onCheckedChange={(v) => onChange({ has_battery: v })} />
          </div>
          {hasBattery && (
            <div className="flex items-center gap-2">
              <Input
                type="number" min="1" max="50" step="1"
                value={batteryKwh}
                onChange={(e) => onChange({ battery_kwh: Number(e.target.value) || 0 })}
                className="w-24"
              />
              <span className="text-xs text-muted-foreground">kWh utile</span>
              <span className="text-xs text-muted-foreground ml-auto">
                ≈ {((batteryKwh * (settings?.battery_cost_per_kwh ?? 700)) / 1000).toFixed(1)}&nbsp;k€
              </span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
