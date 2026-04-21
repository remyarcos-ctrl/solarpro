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
  // Persistance : les 3 états lifted ici pour survivre aux reload
  const [excludedPanelIds, setExcludedPanelIds] = useState([]);
  const [rotationDelta,    setRotationDelta]    = useState(0);

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
    setRotationDelta(0);
    window.__smCoords = null;
    window.__smPans   = null;
  }, [clientId]);

  // Hydratation des données sauvegardées quand le dossier charge
  useEffect(() => {
    if (!data) return;
    if (Array.isArray(data.excluded_panel_ids)) setExcludedPanelIds(data.excluded_panel_ids);
    if (typeof data.rotation_delta === 'number') setRotationDelta(data.rotation_delta);
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
    }));
    updateMutation.mutate({
      ...data,
      saved_pans:          savedPans,
      excluded_panel_ids:  excludedPanelIds,
      rotation_delta:      rotationDelta,
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

      <div className="flex items-center justify-between mb-8">
        <div className="flex items-center gap-4">
          <Link to="/"><Button variant="ghost" size="icon"><ArrowLeft className="w-5 h-5" /></Button></Link>
          <div>
            <h1 className="text-3xl font-bold">{data.first_name} {data.last_name}</h1>
            <p className="text-muted-foreground mt-1 flex items-center gap-2">
              Dossier client
              {pvgisData && <span className="text-xs text-emerald-400">· 🛰️ Données réelles PVGIS</span>}
              {aidData && <span className="text-xs text-primary">· {aidData.region}</span>}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <ExportPdfButton client={data} panel={selectedPanel} profitability={profitability} settings={settingsWithPVGIS} pans={pans} pvgisData={pvgisData} />
          <Button variant="outline" size="sm" onClick={() => deleteMutation.mutate()}
            className="text-destructive border-destructive/30 hover:bg-destructive/10">
            <Trash2 className="w-4 h-4 mr-1" /> Supprimer
          </Button>
          <Button onClick={handleSave} disabled={updateMutation.isPending}
            className="bg-primary text-primary-foreground hover:bg-primary/90 gap-2 font-semibold">
            <Save className="w-4 h-4" />
            {updateMutation.isPending ? "Sauvegarde..." : "Sauvegarder"}
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-[300px_1fr_300px] gap-6">

        {/* Gauche */}
        <div className="space-y-6">
          <div className="rounded-xl bg-card border border-border p-6">
            <h2 className="text-lg font-semibold mb-4">Informations client</h2>
            <ClientForm data={data} onChange={setData} />
            {communePvStats && (
              <div className="mt-4 rounded-lg border border-emerald-500/30 bg-emerald-500/5 px-4 py-3 text-sm">
                <div className="font-semibold text-emerald-300 mb-1">
                  📊 {communePvStats.commune} — déjà {communePvStats.nbInstallations.toLocaleString('fr-FR')} installations photovoltaïques
                </div>
                <div className="text-xs text-muted-foreground">
                  Puissance totale déployée : <strong className="text-emerald-300">{communePvStats.puissanceTotaleKw.toLocaleString('fr-FR')} kWc</strong>
                  {' '}· moyenne par foyer : <strong>{communePvStats.puissanceMoyenneKwc} kWc</strong>
                  {' '}— <span className="italic">source ENEDIS (registre national)</span>
                </div>
              </div>
            )}
          </div>
          <div className="rounded-xl bg-card border border-border p-6">
            <h2 className="text-lg font-semibold mb-4">Configuration panneaux</h2>
            {panels.length > 0
              ? <PanelConfigurator panels={panels} data={data} onChange={setData} />
              : <div className="flex justify-center py-8"><div className="w-6 h-6 border-2 border-primary/30 border-t-primary rounded-full animate-spin" /></div>
            }
          </div>
          <ConsumptionConfigurator
            data={data}
            onChange={(patch) => setData(d => ({ ...d, ...patch }))}
            settings={settingsWithPVGIS}
            onSettingsChange={(patch) => setData(d => ({ ...d, ...patch }))}
            consoEstimate={consoEstimate}
            consoLoading={consoLoading}
          />
          <div className="rounded-xl bg-card border border-border p-6">
            <h2 className="text-lg font-semibold mb-4">Orientation panneaux</h2>
            <div className="grid grid-cols-2 gap-3">
              {["portrait", "paysage"].map(o => (
                <button key={o} onClick={() => setData(d => ({ ...d, orientation: o }))}
                  className={`p-4 rounded-lg border text-sm font-semibold transition-all ${(data.orientation||"portrait")===o ? "bg-primary/10 border-primary text-primary" : "bg-secondary/30 border-border text-muted-foreground hover:border-primary/50"}`}>
                  <div className="text-2xl mb-1">{o === "portrait" ? "▯" : "▭"}</div>
                  {o.charAt(0).toUpperCase() + o.slice(1)}
                </button>
              ))}
            </div>
          </div>
          {data.roof_area > 0 && (
            <div className="rounded-xl bg-card border border-border p-6">
              <h2 className="text-lg font-semibold mb-4">Surface toiture</h2>
              <div className="space-y-2 text-sm">
                {[
                  ["Surface brute", `${data.roof_area} m²`, "text-foreground"],
                  ["Marges (-15%)", `- ${Math.round(data.roof_area*0.15)} m²`, "text-foreground"],
                  ["Surface utile", `${data.roof_area_usable} m²`, "text-primary"],
                  ["Max panneaux", `${data.max_panels} pan.`, "text-primary"],
                ].map(([l,v,c]) => (
                  <div key={l} className="flex justify-between py-1.5 border-b border-border last:border-0">
                    <span className="text-muted-foreground">{l}</span>
                    <span className={`font-semibold ${c}`}>{v}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
          {aidData && (
            <div className="rounded-xl bg-emerald-500/8 border border-emerald-500/20 p-4">
              <h3 className="text-sm font-semibold text-emerald-400 mb-3">🎁 Aides — {aidData.region}</h3>
              <div className="space-y-2 text-xs">
                <div className="flex justify-between"><span className="text-muted-foreground">Prime autoconso.</span><strong className="text-emerald-400">{aidData.prime_autoconsommation_kwc} €/kWc</strong></div>
                <div className="flex justify-between"><span className="text-muted-foreground">TVA réduite</span><strong className="text-emerald-400">{aidData.tva_reduite}%</strong></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Éco-PTZ max</span><strong className="text-emerald-400">{aidData.eco_ptz_max?.toLocaleString("fr-FR")} €</strong></div>
                {aidData.edfPrice && <div className="flex justify-between border-t border-emerald-500/20 pt-1.5"><span className="text-muted-foreground">Prix EDF</span><strong className="text-primary">{aidData.edfPrice} €/kWh</strong></div>}
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
              settings={settingsWithPVGIS}
              pvgisData={pvgisData}
              onRoofAreaChange={(brute, utile) => setData(d => ({ ...d, roof_area: brute, roof_area_usable: utile }))}
              onMaxPanelsChange={max => setData(d => ({ ...d, max_panels: max, panel_count: (d.panel_count > 0) ? Math.min(d.panel_count, max) : max }))}
              onCaptureReady={img => setData(d => ({ ...d, roof_capture: img }))}
              onRoofDimensionsChange={(w, h) => setData(d => ({ ...d, roof_width: w, roof_height: h }))}
              initialPans={data.saved_pans}
              initialExcludedPanelIds={excludedPanelIds}
              onExcludedPanelsChange={setExcludedPanelIds}
              initialRotationDelta={rotationDelta}
              onRotationDeltaChange={setRotationDelta}
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
        <div className="space-y-6">
          <div>
            <h2 className="text-xl font-semibold mb-4">Étude de rentabilité</h2>
            <ProfitabilityStudy profitability={profitability} settings={settingsWithPVGIS} />
          </div>
        </div>

      </div>

      {/* Comparateur de scénarios — pleine largeur */}
      {selectedPanel && (
        <div className="mt-6">
          <h2 className="text-xl font-semibold mb-4">Comparateur de scénarios</h2>
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