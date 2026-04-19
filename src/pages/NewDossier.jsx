import React, { useState, useMemo, useEffect } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { useNavigate, Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Save, ArrowLeft } from "lucide-react";
import { toast } from "sonner";
import { usePanelModels } from "@/lib/usePanelModels";
import { useSettings } from "@/lib/useSettings";
import { calculateProfitability } from "@/lib/solarCalculations";
import ClientForm from "@/components/dossier/ClientForm";
import SatelliteMap from "@/components/dossier/SatelliteMap";
import PanelConfigurator from "@/components/dossier/PanelConfigurator";
import ProfitabilityStudy from "@/components/dossier/ProfitabilityStudy";
import SolarAI from "@/components/dossier/SolarAI";
import { fetchPVGISData, fetchRegionalAids, fetchEDFPrice } from "@/lib/pvgisApi";

export default function NewDossier() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { panels, isLoading: panelsLoading } = usePanelModels();
  const { settings } = useSettings();

  const [data, setData] = useState({
    first_name: "", last_name: "", phone: "", email: "",
    address: "", property_type: "maison", status: "prospect", comment: "",
    panel_model_id: "", panel_count: 0, max_panels: 0,
    orientation: "portrait",
    roof_area: 0, roof_area_usable: 0, roof_capture: null,
    roof_width: 0, roof_height: 0,
    total_power_kwc: 0, installation_cost: 0, annual_savings: 0, roi_years: 0,
  });

  // Données PVGIS et aides
  const [pvgisData, setPvgisData]   = useState(null);
  const [aidData, setAidData]       = useState(null);
  const [pvgisLoading, setPvgisLoading] = useState(false);

  // Pans depuis SatelliteMap
  const [pans, setPans] = useState([]);
  const [coords, setCoords] = useState(null);

  useEffect(() => {
    if (panels.length > 0 && !data.panel_model_id) {
      setData(prev => ({ ...prev, panel_model_id: panels[0].id }));
    }
  }, [panels]);

  // Reset global coords at mount to avoid stale data from previous dossier
  useEffect(() => {
    window.__smCoords = null;
    window.__smPans   = null;
  }, []);

  // Polling pans depuis SatelliteMap
  useEffect(() => {
    const interval = setInterval(() => {
      if (window.__smPans) setPans([...window.__smPans]);
      if (window.__smCoords) setCoords(window.__smCoords);
    }, 800);
    return () => clearInterval(interval);
  }, []);

  // Charger PVGIS quand on a des coordonnées
  useEffect(() => {
    if (!coords || pvgisData) return;
    setPvgisLoading(true);
    Promise.all([
      fetchPVGISData(coords.lat, coords.lon),
      fetchRegionalAids(coords.lat, coords.lon, data.address?.match(/\b(\d{5})\b/)?.[1] ?? null),
      fetchEDFPrice(),
    ]).then(([pvgis, aids, edf]) => {
      setPvgisData(pvgis);
      setAidData({ ...aids, edfPrice: edf?.price });
      // Mettre à jour les paramètres avec les données réelles
      if (pvgis?.annualKwhPerKwc) {
        toast.success(`🛰️ Données solaires réelles chargées : ${pvgis.annualKwhPerKwc} kWh/kWc/an`);
      }
    }).finally(() => setPvgisLoading(false));
  }, [coords]);

  const selectedPanel = panels.find(p => p.id === data.panel_model_id) || panels[0] || null;

  const profitability = useMemo(() => {
    if (!data.panel_count || !selectedPanel || !settings) return null;
    // Utiliser les données PVGIS si disponibles
    const settingsWithPVGIS = pvgisData
      ? { ...settings, regional_production: pvgisData.annualKwhPerKwc }
      : settings;
    return calculateProfitability(data.panel_count, selectedPanel, settingsWithPVGIS);
  }, [data.panel_count, selectedPanel, settings, pvgisData]);

  const createMutation = useMutation({
    mutationFn: (clientData) => base44.entities.Client.create(clientData),
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ["clients"] });
      toast.success("Dossier créé avec succès");
      navigate(`/dossier/${result.id}`);
    },
  });

  const handleSave = () => {
    if (!data.first_name || !data.last_name) {
      toast.error("Veuillez renseigner le prénom et le nom");
      return;
    }
    createMutation.mutate({
      ...data,
      installation_cost: profitability?.resteACharge || 0,
      annual_savings: profitability?.totalAnnualBenefit || 0,
      roi_years: profitability?.roiYears || 0,
    });
  };

  const handleApplyAI = (recommandation) => {
    if (recommandation?.total_optimal) {
      setData(d => ({ ...d, panel_count: recommandation.total_optimal }));
      toast.success(`✨ ${recommandation.total_optimal} panneaux appliqués depuis l'analyse IA`);
    }
  };

  // Remplissage formulaire depuis assistant vocal
  const handleFillFromVoice = (suggestion) => {
    setData(d => ({
      ...d,
      first_name:     suggestion.first_name || d.first_name,
      last_name:      suggestion.last_name  || d.last_name,
      address:        suggestion.address    || d.address,
      property_type:  suggestion.property_type || d.property_type,
      comment:        suggestion.comment    || d.comment,
      status:         suggestion.status     || d.status,
      panel_count:    suggestion.panel_count_suggestion || d.panel_count,
      orientation:    suggestion.orientation_suggestion || d.orientation,
    }));
    toast.success("✨ Formulaire rempli depuis la description vocale !");
  };

  return (
    <div className="p-6 lg:p-8 max-w-[1900px] mx-auto">

      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div className="flex items-center gap-4">
          <Link to="/"><Button variant="ghost" size="icon"><ArrowLeft className="w-5 h-5" /></Button></Link>
          <div>
            <h1 className="text-3xl font-bold">Nouveau dossier</h1>
            <p className="text-muted-foreground mt-1 flex items-center gap-2">
              Étude solaire IA
              {pvgisLoading && <span className="text-xs text-amber-400 animate-pulse">· Chargement données solaires…</span>}
              {pvgisData && <span className="text-xs text-emerald-400">· 🛰️ Données PVGIS réelles</span>}
              {aidData && <span className="text-xs text-primary">· {aidData.region}</span>}
            </p>
          </div>
        </div>
        <Button onClick={handleSave} disabled={createMutation.isPending}
          className="bg-primary text-primary-foreground hover:bg-primary/90 gap-2 font-semibold">
          <Save className="w-4 h-4" />
          {createMutation.isPending ? "Enregistrement..." : "Enregistrer"}
        </Button>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-[300px_1fr_300px] gap-6">

        {/* Gauche */}
        <div className="space-y-6">
          <div className="rounded-xl bg-card border border-border p-6">
            <h2 className="text-lg font-semibold mb-4">Informations client</h2>
            <ClientForm data={data} onChange={setData} />
          </div>

          <div className="rounded-xl bg-card border border-border p-6">
            <h2 className="text-lg font-semibold mb-4">Configuration panneaux</h2>
            {panelsLoading
              ? <div className="flex justify-center py-8"><div className="w-6 h-6 border-2 border-primary/30 border-t-primary rounded-full animate-spin" /></div>
              : <PanelConfigurator panels={panels} data={data} onChange={setData} />
            }
          </div>

          <div className="rounded-xl bg-card border border-border p-6">
            <h2 className="text-lg font-semibold mb-4">Orientation panneaux</h2>
            <div className="grid grid-cols-2 gap-3">
              {["portrait", "paysage"].map(o => (
                <button key={o} onClick={() => setData(d => ({ ...d, orientation: o }))}
                  className={`p-4 rounded-lg border text-sm font-semibold transition-all ${data.orientation === o ? "bg-primary/10 border-primary text-primary" : "bg-secondary/30 border-border text-muted-foreground hover:border-primary/50"}`}>
                  <div className="text-2xl mb-1">{o === "portrait" ? "▯" : "▭"}</div>
                  {o.charAt(0).toUpperCase() + o.slice(1)}
                </button>
              ))}
            </div>
          </div>

          {/* Aides régionales */}
          {aidData && (
            <div className="rounded-xl bg-emerald-500/8 border border-emerald-500/20 p-4">
              <h3 className="text-sm font-semibold text-emerald-400 mb-3">🎁 Aides disponibles — {aidData.region}</h3>
              <div className="space-y-2 text-xs">
                <div className="flex justify-between"><span className="text-muted-foreground">Prime autoconsommation</span><strong className="text-emerald-400">{aidData.prime_autoconsommation_kwc} €/kWc</strong></div>
                <div className="flex justify-between"><span className="text-muted-foreground">TVA réduite</span><strong className="text-emerald-400">{aidData.tva_reduite}%</strong></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Éco-PTZ max</span><strong className="text-emerald-400">{aidData.eco_ptz_max?.toLocaleString("fr-FR")} €</strong></div>
                {aidData.edfPrice && <div className="flex justify-between border-t border-emerald-500/20 pt-2"><span className="text-muted-foreground">Prix EDF actuel</span><strong className="text-primary">{aidData.edfPrice} €/kWh</strong></div>}
              </div>
            </div>
          )}
        </div>

        {/* Centre */}
        <div className="space-y-6">
          <div className="rounded-xl bg-card border border-border p-6">
            <h2 className="text-lg font-semibold mb-4">Vue satellite & Calpinage multi-pans</h2>
            <SatelliteMap
              address={data.address}
              panelCount={data.panel_count || 0}
              panel={selectedPanel}
              orientation={data.orientation || "portrait"}
              settings={pvgisData ? { ...settings, regional_production: pvgisData.annualKwhPerKwc } : settings}
              onRoofAreaChange={(brute, utile) => setData(d => ({ ...d, roof_area: brute, roof_area_usable: utile }))}
              onMaxPanelsChange={max => setData(d => ({ ...d, max_panels: max }))}
              onCaptureReady={img => setData(d => ({ ...d, roof_capture: img }))}
              onRoofDimensionsChange={(w, h) => setData(d => ({ ...d, roof_width: w, roof_height: h }))}
            />
          </div>

          {/* Module IA */}
          <SolarAI
            pans={pans}
            panel={selectedPanel}
            settings={pvgisData ? { ...settings, regional_production: pvgisData.annualKwhPerKwc } : settings}
            address={data.address}
            totalPanels={data.max_panels || 0}
            pvgisData={pvgisData}
            aidData={aidData}
            clientName={`${data.first_name} ${data.last_name}`.trim()}
            onApplyRecommendation={handleApplyAI}
            onFillFormFromVoice={handleFillFromVoice}
          />
        </div>

        {/* Droite */}
        <div className="space-y-6">
          <div>
            <h2 className="text-xl font-semibold mb-4">Étude de rentabilité</h2>
            <ProfitabilityStudy profitability={profitability} settings={settings} />
          </div>
        </div>

      </div>
    </div>
  );
}
