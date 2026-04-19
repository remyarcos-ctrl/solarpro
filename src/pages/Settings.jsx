import React, { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Save, Settings as SettingsIcon, Building, Zap, TrendingUp, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { useSettings } from "@/lib/useSettings";

function SettingsSection({ icon: Icon, title, children }) {
  return (
    <div className="rounded-xl bg-card border border-border p-6">
      <h2 className="text-lg font-semibold text-foreground mb-6 flex items-center gap-2">
        <Icon className="w-5 h-5 text-primary" />
        {title}
      </h2>
      {children}
    </div>
  );
}

function SettingsField({ label, value, onChange, type = "text", suffix, step }) {
  return (
    <div className="space-y-2">
      <Label className="text-xs uppercase text-muted-foreground tracking-wider">{label}</Label>
      <div className="relative">
        <Input
          type={type}
          value={value || ""}
          onChange={(e) => onChange(type === "number" ? parseFloat(e.target.value) || 0 : e.target.value)}
          className="bg-secondary/50 border-border focus:border-primary"
          step={step}
        />
        {suffix && (
          <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">{suffix}</span>
        )}
      </div>
    </div>
  );
}

export default function Settings() {
  const { settings, isLoading, updateSettings } = useSettings();
  const [form, setForm] = useState(settings);

  useEffect(() => {
    if (settings) setForm(settings);
  }, [settings]);

  const update = (key, value) => setForm(prev => ({ ...prev, [key]: value }));

  const handleSave = () => {
    updateSettings.mutate(form, {
      onSuccess: () => toast.success("Paramètres sauvegardés"),
    });
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="w-8 h-8 border-4 border-primary/30 border-t-primary rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Paramètres</h1>
          <p className="text-muted-foreground mt-1">Configurez vos paramètres commerciaux</p>
        </div>
        <Button
          onClick={handleSave}
          disabled={updateSettings.isPending}
          className="bg-primary text-primary-foreground hover:bg-primary/90 gap-2 font-semibold"
        >
          {updateSettings.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
          Sauvegarder
        </Button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Tarification */}
        <SettingsSection icon={Zap} title="Tarification énergie">
          <div className="grid grid-cols-2 gap-4">
            <SettingsField label="Prix électricité" value={form.electricity_price} onChange={v => update("electricity_price", v)} type="number" suffix="€/kWh" step="0.01" />
            <SettingsField label="Tarif rachat" value={form.buyback_rate} onChange={v => update("buyback_rate", v)} type="number" suffix="€/kWh" step="0.01" />
            <SettingsField label="Production régionale" value={form.regional_production} onChange={v => update("regional_production", v)} type="number" suffix="kWh/kWc/an" />
            <SettingsField label="Autoconsommation" value={form.self_consumption_rate} onChange={v => update("self_consumption_rate", v)} type="number" suffix="%" />
          </div>
        </SettingsSection>

        {/* Paramètres financiers */}
        <SettingsSection icon={TrendingUp} title="Paramètres financiers">
          <div className="grid grid-cols-2 gap-4">
            <SettingsField label="Inflation annuelle" value={form.inflation_rate} onChange={v => update("inflation_rate", v)} type="number" suffix="%/an" step="0.1" />
            <SettingsField label="Dégradation panneaux" value={form.degradation_rate} onChange={v => update("degradation_rate", v)} type="number" suffix="%/an" step="0.1" />
            <SettingsField label="Prime autoconsommation" value={form.prime_per_kwc} onChange={v => update("prime_per_kwc", v)} type="number" suffix="€/kWc" />
            <SettingsField label="Coût installation" value={form.installation_cost_per_wc} onChange={v => update("installation_cost_per_wc", v)} type="number" suffix="€/Wc" step="0.1" />
          </div>
        </SettingsSection>

        {/* Entreprise */}
        <div className="lg:col-span-2">
          <SettingsSection icon={Building} title="Informations entreprise">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <SettingsField label="Nom entreprise" value={form.company_name} onChange={v => update("company_name", v)} />
              <SettingsField label="SIRET" value={form.company_siret} onChange={v => update("company_siret", v)} />
              <SettingsField label="Adresse" value={form.company_address} onChange={v => update("company_address", v)} />
              <SettingsField label="Téléphone" value={form.company_phone} onChange={v => update("company_phone", v)} />
              <SettingsField label="Email" value={form.company_email} onChange={v => update("company_email", v)} />
              <SettingsField label="URL Logo" value={form.company_logo_url} onChange={v => update("company_logo_url", v)} />
            </div>
          </SettingsSection>
        </div>
      </div>
    </div>
  );
}