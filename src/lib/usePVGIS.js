// ── Hook pour récupérer les données PVGIS au géocodage ───────────────────
import { useState, useEffect } from "react";
import { fetchPVGISData } from "./pvgisApi";

/**
 * coords : { lat, lon } — fournies par SatelliteMap via onCoordsChange
 * Retourne { pvgisData, pvgisLoading }
 * pvgisData.annualKwhPerKwc remplace settings.regional_production dans les calculs
 */
export function usePVGIS(coords) {
  const [pvgisData, setPvgisData] = useState(null);
  const [pvgisLoading, setPvgisLoading] = useState(false);

  useEffect(() => {
    if (!coords?.lat || !coords?.lon) return;
    let cancelled = false;
    setPvgisLoading(true);
    fetchPVGISData(coords.lat, coords.lon).then(data => {
      if (!cancelled) {
        setPvgisData(data);
        setPvgisLoading(false);
      }
    });
    return () => { cancelled = true; };
  }, [coords?.lat, coords?.lon]);

  return { pvgisData, pvgisLoading };
}