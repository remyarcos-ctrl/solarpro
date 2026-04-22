import React, { useState, useMemo, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { localClients } from "@/lib/localStore";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Save, ArrowLeft, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { usePanelModels } from "@/lib/usePanelModels";
import { useSettings } from "@/lib/useSettings";
import { calculateProfitability } from "@/lib/solarCalculations";
import ClientForm from "@/components/dossier/ClientForm";
import SatelliteMap from "@/components/dossier/SatelliteMap";
import PanelConfigurator from "@/components/dossier/PanelConfigurator";
import ConsumptionConfigurator from "@/components/dossier/ConsumptionConfigurator";
import ProfitabilityStudy from "@/components/dossier/ProfitabilityStudy";
import ExportPdfButton from "@/components/dossier/ExportPdfButton";
import SupplierMailDialog from "@/components/dossier/SupplierMailDialog";
import SolarAI from "@/components/dossier/SolarAI";
import { fetchPVGISData, fetchRegionalAids, fetchEDFPrice } from "@/lib/pvgisApi";
import { estimateConsumption } from "@/lib/consumptionEstimate";
import { fetchCO2Factor } from "@/lib/gridData";
import { fetchCommunePvStats } from "@/lib/pvRegistryApi";
import ScenarioComparator from "@/components/dossier/ScenarioComparator";

export default function DossierDetail() {
  const clientId = window.location.pathname.split("/").pop();
  const queryClient = useQueryClient();
  const { panels } = usePanelModels();
  const { settings } = useSettings();
  const [data, setData] = useState(null);

  const [pvgisData, setPvgisData] = useState(null);
  const [aidData, setAidData]     = useState(null);
  const [pans, setPans]           = useState([]);
  const [coords, setCoords]       = useState(null);
  const [consoEstimate, setConsoEstimate] = useState(null);
  const [consoLoading,  setConsoLoading]  = useState(false);
  const [co2Factor,     setCo2Factor]     = useState(null);
  const [communePvStats, setCommunePvStats] = useState(null);
  // Persistance : les 2 états lifted ici pour survivre aux reload
  const [excludedPanelIds, setExcludedPanelIds] = useState([]);

  const { isLoading } = useQuery({
    queryKey: ["client", clientId],
    queryFn: async () => {
      const clients = localClients.filter({ id: clientId });
      if (clients.length > 0) setData(clients[0]);
      return clients[0] || null;
    },
    enabled: !!clientId,
  });

  // Reset toutes les données géo quand on change de dossier
  useEffect(() => {
    setPvgisData(null);
    setAidData(null);
    setCoords(null);
    setPans([]);
    setConsoEstimate(null);
    setExcludedPanelIds([]);
    window.__smCoords = null;
    window.__smPans   = null;
  }, [clientId]);

  // Hydratation des données sauvegardées quand le dossier charge
  useEffect(() => {
    if (!data) return;
    if (Array.isArray(data.excluded_panel_ids)) setExcludedPanelIds(data.excluded_panel_ids);
  }, [data?.id]);

  // Facteur CO2 réel France (RTE eCO2mix, moyenne 12 mois) — cache 7j
  useEffect(() => {
    if (co2Factor) return;
    fetchCO2Factor().then(setCo2Factor);
  }, []);

  // Stats PV de la commune (ENEDIS registre national) — cache 30 jours
  useEffect(() => {
    if (!data?.address || communePvStats) return;
    fetchCommunePvStats(data.address).then(setCommunePvStats);
  }, [data?.address]);

  // Estimation auto de la conso à partir de l'adresse (ADEME DPE + ENEDIS)
  useEffect(() => {
    if (!data?.address || consoEstimate) return;
    setConsoLoading(true);
    estimateConsumption(data.address)
      .then(res => {
        setConsoEstimate(res);
        if (res.suggestion) toast.success(`🏠 Conso estimée : ${res.suggestion.value} kWh/an — ${res.suggestion.source}`);
      })
      .finally(() => setConsoLoading(false));
  }, [data?.address]);

  // Polling pans/coords depuis SatelliteMap
  useEffect(() => {
    const interval = setInterval(() => {
      if (window.__smPans)   setPans([...window.__smPans]);
      if (window.__smCoords) setCoords(window.__smCoords);
    }, 800);
    return () => clearInterval(interval);
  }, []);

  // PVGIS quand coords disponibles — ne se déclenche qu'une fois par dossier
  useEffect(() => {
    if (!coords || pvgisData) return;
    Promise.all([
      fetchPVGISData(coords.lat, coords.lon),
      fetchRegionalAids(coords.lat, coords.lon, data?.address?.match(/\b(\d{5})\b/)?.[1] ?? null),
      fetchEDFPrice(),
    ]).then(([pvgis, aids, edf]) => {
      setPvgisData(pvgis);
      setAidData({ ...aids, edfPrice: edf?.price });
      if (pvgis?.annualKwhPerKwc) toast.success(`🛰️ Données PVGIS : ${pvgis.annualKwhPerKwc} kWh/kWc/an`);
    });
  }, [coords]);

  const selectedPanel = data && panels.length > 0
    ? (panels.find(p => p.id === data.panel_model_id) || panels[0])
    : null;

  const settingsWithPVGIS = useMemo(() => {
    const base = pvgisData
      ? { ...settings, regional_production: pvgisData.annualKwhPerKwc, pvgisSource: pvgisData.pvgisSource }
      : { ...settings };
    if (data?.tariff_type) base.tariff_type = data.tariff_type;
    if (co2Factor?.kgPerKwh) base.co2_kg_per_kwh = co2Factor.kgPerKwh;
    return base;
  }, [settings, pvgisData, data?.tariff_type, co2Factor]);

  const profitability = useMemo(() => {
    if (!data?.panel_count || !selectedPanel || !settings) return null;
    return calculateProfitability(
      data.panel_count,
      selectedPanel,
      settingsWithPVGIS,
      pans,        // ← vrais pans tracés
      pvgisData,   // ← données météo réelles
      data,        // ← conso, profil, batterie (Top 1/3)
    );
  }, [data, selectedPanel, settingsWithPVGIS, pans, pvgisData]);

  const updateMutation = useMutation({
    mutationFn: (d) => localClients.update(clientId, d),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["client", clientId] });
      queryClient.invalidateQueries({ queryKey: ["clients"] });
      toast.success("Dossier mis à jour");
    },
  });

  const deleteMutation = useMutation({
    mutationFn: () => localClients.delete(clientId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["clients"] });
      toast.success("Dossier supprimé");
      window.location.href = "/";
    },
  });

  const handleSave = () => {
    // Sérialise les pans (sans drawId volatile, le reste est JSON-safe)
    const savedPans = (window.__smPans || []).map(p => ({
      id: p.id, coords: p.coords, area: p.area, index: p.index,
      orientation: p.orientation, azimut: p.azimut, inclination: p.inclination,
      maxPanels: p.maxPanels, maxPanelsTraced: p.maxPanelsTraced, maxPanelsSolar: p.maxPanelsSolar,
      solarAreaM2: p.solarAreaM2,
      solarSegmentIdx: p.solarSegmentIdx,
      solarShadingFactor: p.solarShadingFactor, shadingSource: p.shadingSource, shading: p.shading,
      inclinationSource: p.inclinationSource,
      pvgisKwhPerKwc: p.pvgisKwhPerKwc, pvgisPR: p.pvgisPR,
      lidarSource: p.lidarSource,
      rotationDelta: p.rotationDelta ?? 0,
    }));
    updateMutation.mutate({
      ...data,
      saved_pans:          savedPans,
      excluded_panel_ids:  excludedPanelIds,
      installation_cost: profitability?.resteACharge || data.installation_cost || 0,
      annual_savings:    profitability?.totalAnnualBenefit || data.annual_savings || 0,
      roi_years:         profitability?.roiYears || data.roi_years || 0,
    });
  };

  const handleApplyAI = (rec) => {
    if (rec?.total_optimal) {
      setData(d => ({ ...d, panel_count: rec.total_optimal }));
      toast.success(`✨ ${rec.total_optimal} panneaux appliqués depuis l'IA`);
    }
  };

  const handleFillFromVoice = (suggestion) => {
    setData(d => ({
      ...d,
      first_name:    suggestion.first_name || d.first_name,
      last_name:     suggestion.last_name  || d.last_name,
      address:       suggestion.address    || d.address,
      comment:       suggestion.comment    || d.comment,
      panel_count:   suggestion.panel_count_suggestion || d.panel_count,
    }));
    toast.success("✨ Formulaire mis à jour depuis la description vocale !");
  };

  if (isLoading || !data) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="w-8 h-8 border-4 border-primary/30 border-t-primary rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="p-6 lg:p-8 max-w-[1900px] mx-auto">

      <div className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-4 mb-8 fade-in-up">
        <div className="flex items-center gap-4">
          <Link to="/"><Button variant="ghost" size="icon" className="hover:bg-secondary/60"><ArrowLeft className="w-5 h-5" /></Button></Link>
          <div>
            <p className="text-xs uppercase tracking-[0.2em] text-primary/80 font-semibold mb-1">Dossier client</p>
            <h1 className="text-3xl md:text-4xl font-display font-bold tracking-tight">
              <span className="text-foreground">{data.first_name}</span>{' '}
              <span className="gradient-text">{data.last_name}</span>
            </h1>
            <p className="text-muted-foreground mt-1.5 flex items-center gap-2 text-sm">
              {pvgisData && <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-[10px]">🛰️ PVGIS</span>}
              {aidData && <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-primary/10 border border-primary/20 text-primary text-[10px]">{aidData.region}</span>}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3 flex-wrap">
          <ExportPdfButton client={data} panel={selectedPanel} profitability={profitability} settings={settingsWithPVGIS} pans={pans} pvgisData={pvgisData} />
          <SupplierMailDialog client={data} panel={selectedPanel} profitability={profitability} settings={settings} pans={pans} />
          <Button variant="outline" size="sm" onClick={() => deleteMutation.mutate()}
            className="text-destructive border-destructive/30 hover:bg-destructive/10">
            <Trash2 className="w-4 h-4 mr-1" /> Supprimer
          </Button>
          <button onClick={handleSave} disabled={updateMutation.isPending}
            className="btn-primary-glow inline-flex items-center gap-2 font-semibold px-5 py-2 rounded-lg text-sm disabled:opacity-60">
            <Save className="w-4 h-4" />
            {updateMutation.isPending ? "Sauvegarde…" : "Sauvegarder"}
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-[300px_1fr_300px] gap-6">

        {/* Gauche */}
        <div className="space-y-5">
          <div className="card-elevated p-6 fade-in-up">
            <h2 className="text-base font-display font-semibold tracking-tight mb-5 flex items-center gap-2">
              <span className="w-1 h-5 rounded-full bg-primary shadow-[0_0_6px_hsl(38_82%_55%/0.6)]" />
              Informations client
            </h2>
            <ClientForm data={data} onChange={setData} />
            {communePvStats && (
              <div className="mt-5 rounded-xl border border-emerald-500/30 bg-gradient-to-br from-emerald-500/10 to-emerald-500/5 px-4 py-3 text-sm">
                <div className="font-display font-semibold text-emerald-300 mb-1">
                  📊 {communePvStats.commune} — {communePvStats.nbInstallations.toLocaleString('fr-FR')} installations PV déjà
                </div>
                <div className="text-xs text-muted-foreground">
                  <strong className="text-emerald-300">{communePvStats.puissanceTotaleKw.toLocaleString('fr-FR')} kWc</strong> déployés
                  {' '}· moyenne <strong className="text-foreground">{communePvStats.puissanceMoyenneKwc} kWc</strong>/foyer
                  {' '}<span className="text-muted-foreground/60">— ENEDIS</span>
                </div>
              </div>
            )}
          </div>
          <div className="card-elevated p-6 fade-in-up" style={{ animationDelay: '80ms' }}>
            <h2 className="text-base font-display font-semibold tracking-tight mb-5 flex items-center gap-2">
              <span className="w-1 h-5 rounded-full bg-primary shadow-[0_0_6px_hsl(38_82%_55%/0.6)]" />
              Configuration panneaux
            </h2>
            {panels.length > 0
              ? <PanelConfigurator panels={panels} data={data} onChange={setData} />
              : <div className="flex justify-center py-8"><div className="w-6 h-6 border-2 border-primary/30 border-t-primary rounded-full animate-spin" /></div>
            }
          </div>
          <div className="fade-in-up" style={{ animationDelay: '160ms' }}>
            <ConsumptionConfigurator
              data={data}
              onChange={(patch) => setData(d => ({ ...d, ...patch }))}
              settings={settingsWithPVGIS}
              onSettingsChange={(patch) => setData(d => ({ ...d, ...patch }))}
              consoEstimate={consoEstimate}
              consoLoading={consoLoading}
            />
          </div>
          <div className="card-elevated p-6 fade-in-up" style={{ animationDelay: '240ms' }}>
            <h2 className="text-base font-display font-semibold tracking-tight mb-5 flex items-center gap-2">
              <span className="w-1 h-5 rounded-full bg-primary shadow-[0_0_6px_hsl(38_82%_55%/0.6)]" />
              Orientation panneaux
            </h2>
            <div className="grid grid-cols-2 gap-3">
              {["portrait", "paysage"].map(o => {
                const active = (data.orientation || "portrait") === o;
                return (
                  <button key={o} onClick={() => setData(d => ({ ...d, orientation: o }))}
                    className={`relative overflow-hidden p-5 rounded-xl border text-sm font-semibold transition-all duration-200
                      ${active
                        ? "bg-gradient-to-br from-primary/25 to-primary/5 border-primary/50 text-primary shadow-[0_0_20px_-5px_hsl(38_82%_55%/0.4)]"
                        : "bg-secondary/40 border-border text-muted-foreground hover:border-primary/40 hover:bg-secondary/60"
                      }`}>
                    <div className="text-3xl mb-1.5 leading-none">{o === "portrait" ? "▯" : "▭"}</div>
                    {o.charAt(0).toUpperCase() + o.slice(1)}
                  </button>
                );
              })}
            </div>
          </div>
          {data.roof_area > 0 && (
            <div className="card-elevated p-6 fade-in-up" style={{ animationDelay: '320ms' }}>
              <h2 className="text-base font-display font-semibold tracking-tight mb-5 flex items-center gap-2">
                <span className="w-1 h-5 rounded-full bg-primary shadow-[0_0_6px_hsl(38_82%_55%/0.6)]" />
                Surface toiture
              </h2>
              <div className="space-y-0 text-sm">
                {[
                  ["Surface brute", `${data.roof_area} m²`, "text-foreground"],
                  ["Marges (-15%)", `- ${Math.round(data.roof_area*0.15)} m²`, "text-muted-foreground"],
                  ["Surface utile", `${data.roof_area_usable} m²`, "text-primary font-display"],
                  ["Max panneaux", `${data.max_panels} pan.`, "text-primary font-display"],
                ].map(([l,v,c]) => (
                  <div key={l} className="flex justify-between py-2 border-b border-border/40 last:border-0">
                    <span className="text-muted-foreground">{l}</span>
                    <span className={`font-semibold ${c}`}>{v}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
          {aidData && (
            <div className="rounded-xl border border-emerald-500/30 bg-gradient-to-br from-emerald-500/10 to-emerald-500/5 p-5 fade-in-up" style={{ animationDelay: '400ms' }}>
              <h3 className="text-sm font-display font-semibold text-emerald-400 mb-3 flex items-center gap-2">
                <span className="text-base">🎁</span> Aides — {aidData.region}
              </h3>
              <div className="space-y-2 text-xs">
                <div className="flex justify-between"><span className="text-muted-foreground">Prime autoconso.</span><strong className="text-emerald-300 font-display">{aidData.prime_autoconsommation_kwc} €/kWc</strong></div>
                <div className="flex justify-between"><span className="text-muted-foreground">TVA réduite</span><strong className="text-emerald-300 font-display">{aidData.tva_reduite}%</strong></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Éco-PTZ max</span><strong className="text-emerald-300 font-display">{aidData.eco_ptz_max?.toLocaleString("fr-FR")} €</strong></div>
                {aidData.edfPrice && <div className="flex justify-between border-t border-emerald-500/20 pt-2 mt-1"><span className="text-muted-foreground">Prix EDF</span><strong className="text-primary font-display">{aidData.edfPrice} €/kWh</strong></div>}
              </div>
            </div>
          )}
        </div>

        {/* Centre */}
        <div className="space-y-5">
          <div className="card-elevated p-6 fade-in-up" style={{ animationDelay: '100ms' }}>
            <h2 className="text-base font-display font-semibold tracking-tight mb-5 flex items-center gap-2">
              <span className="w-1 h-5 rounded-full bg-primary shadow-[0_0_6px_hsl(38_82%_55%/0.6)]" />
              Vue satellite & calpinage
            </h2>
            <SatelliteMap
              address={data.address}
              panelCount={data.panel_count || 0}
              panel={selectedPanel}
              orientation={data.orientation || "portrait"}
              settings={settingsWithPVGIS}
              pvgisData={pvgisData}
              onRoofAreaChange={(brute, utile) => setData(d => ({ ...d, roof_area: brute, roof_area_usable: utile }))}
              onMaxPanelsChange={max => setData(d => ({ ...d, max_panels: max, panel_count: (d.panel_count > 0) ? Math.min(d.panel_count, max) : max }))}
              onCaptureReady={img => setData(d => ({ ...d, roof_capture: img }))}
              onRoofDimensionsChange={(w, h) => setData(d => ({ ...d, roof_width: w, roof_height: h }))}
              initialPans={data.saved_pans}
              initialExcludedPanelIds={excludedPanelIds}
              onExcludedPanelsChange={setExcludedPanelIds}
            />
          </div>

<SolarAI
            pans={pans}
            panel={selectedPanel}
            settings={settingsWithPVGIS}
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
        <div className="space-y-5">
          <div className="fade-in-up" style={{ animationDelay: '200ms' }}>
            <p className="text-xs uppercase tracking-[0.2em] text-primary/80 font-semibold mb-2">Simulation</p>
            <h2 className="text-2xl font-display font-bold tracking-tight mb-5">
              <span className="text-foreground">Étude de</span>{' '}
              <span className="gradient-text">rentabilité</span>
            </h2>
            <ProfitabilityStudy profitability={profitability} settings={settingsWithPVGIS} />
          </div>
        </div>

      </div>

      {/* Comparateur de scénarios — pleine largeur */}
      {selectedPanel && (
        <div className="mt-8 fade-in-up" style={{ animationDelay: '500ms' }}>
          <p className="text-xs uppercase tracking-[0.2em] text-primary/80 font-semibold mb-2">Outil avancé</p>
          <h2 className="text-2xl font-display font-bold tracking-tight mb-5">
            <span className="text-foreground">Comparateur de</span>{' '}
            <span className="gradient-text">scénarios</span>
          </h2>
          <ScenarioComparator
            pans={pans}
            panel={selectedPanel}
            settings={settingsWithPVGIS}
            pvgisData={pvgisData}
            panelCount={data.panel_count || 0}
          />
        </div>
      )}
    </div>
  );
}