import React, { useState, useMemo, useEffect } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { localClients } from "@/lib/localStore";
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
      ? { ...settings, regional_production: pvgisData.annualKwhPerKwc, pvgisSource: pvgisData.pvgisSource }
      : settings;
    // Passer les pans tracés : l'étude doit refléter le PVGIS par pan
    // (orientation/inclinaison réelles), pas le mode simplifié Sud 30°.
    return calculateProfitability(data.panel_count, selectedPanel, settingsWithPVGIS, pans, pvgisData);
  }, [data.panel_count, selectedPanel, settings, pvgisData, pans]);

  const createMutation = useMutation({
    mutationFn: (clientData) => localClients.create(clientData),
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
      <div className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-4 mb-8 fade-in-up">
        <div className="flex items-center gap-4">
          <Link to="/"><Button variant="ghost" size="icon" className="hover:bg-secondary/60"><ArrowLeft className="w-5 h-5" /></Button></Link>
          <div>
            <p className="text-xs uppercase tracking-[0.2em] text-primary/80 font-semibold mb-1">Création</p>
            <h1 className="text-3xl md:text-4xl font-display font-bold tracking-tight">
              <span className="text-foreground">Nouveau</span>{' '}
              <span className="gradient-text">dossier</span>
            </h1>
            <p className="text-muted-foreground mt-1.5 flex items-center gap-2 text-sm flex-wrap">
              {pvgisLoading && <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-500/10 border border-amber-500/20 text-amber-400 text-[10px] animate-pulse">Chargement PVGIS…</span>}
              {pvgisData && <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-[10px]">🛰️ PVGIS</span>}
              {aidData && <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-primary/10 border border-primary/20 text-primary text-[10px]">{aidData.region}</span>}
            </p>
          </div>
        </div>
        <button onClick={handleSave} disabled={createMutation.isPending}
          className="btn-primary-glow inline-flex items-center gap-2 font-semibold px-5 py-2 rounded-lg text-sm disabled:opacity-60 self-start lg:self-auto">
          <Save className="w-4 h-4" />
          {createMutation.isPending ? "Enregistrement…" : "Enregistrer"}
        </button>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-[300px_1fr_300px] gap-6">

        {/* Gauche */}
        <div className="space-y-6">
          <div className="card-elevated p-6">
            <h2 className="text-lg font-semibold mb-4">Informations client</h2>
            <ClientForm data={data} onChange={setData} />
          </div>

          <div className="card-elevated p-6">
            <h2 className="text-lg font-semibold mb-4">Configuration panneaux</h2>
            {panelsLoading
              ? <div className="flex justify-center py-8"><div className="w-6 h-6 border-2 border-primary/30 border-t-primary rounded-full animate-spin" /></div>
              : <PanelConfigurator panels={panels} data={data} onChange={setData} />
            }
          </div>

          <div className="card-elevated p-6">
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
          <div className="card-elevated p-6">
            <h2 className="text-lg font-semibold mb-4">Vue satellite & Calepinage multi-pans</h2>
            <SatelliteMap
              address={data.address}
              panelCount={data.panel_count || 0}
              panel={selectedPanel}
              orientation={data.orientation || "portrait"}
              settings={pvgisData ? { ...settings, regional_production: pvgisData.annualKwhPerKwc } : settings}
              onRoofAreaChange={(brute, utile) => setData(d => ({ ...d, roof_area: brute, roof_area_usable: utile }))}
              onMaxPanelsChange={max => setData(d => ({ ...d, max_panels: max, panel_count: (d.panel_count > 0) ? Math.min(d.panel_count, max) : max }))}
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
