// ── PVGIS v5.2 JRC — Données réelles par coordonnées GPS ──────────────────
// Source : https://re.jrc.ec.europa.eu/api/v5_2/PVcalc
// CORS : autorisé par le JRC (Access-Control-Allow-Origin: *)
//
// fetchPVGISData   : référence Sud 30° pour la localisation (overview)
// fetchPVGISForPan : calcul précis par pan (orientation + inclinaison réelles)

// ── Données d'irradiance réelles par région France (kWh/m²/an) ────────────
function getRegionalIrradiance(lat, lon) {
  if (lat < 43.5)
    return { irradiance: 1650, zone: "Méditerranée", city: "Marseille" };
  if (lat < 44.5 && lon > 3.5)
    return { irradiance: 1500, zone: "Provence-Alpes", city: "Avignon" };
  if (lat < 44.5)
    return { irradiance: 1480, zone: "Midi-Pyrénées", city: "Toulouse" };
  if (lat > 44.8 && lat < 46.2 && lon > 3.7 && lon < 4.6)
    return { irradiance: 1180, zone: "Loire - Massif Central", city: "Saint-Étienne" };
  if (lat < 46.5 && lon > 3.5)
    return { irradiance: 1350, zone: "Rhône-Alpes", city: "Lyon" };
  if (lat < 46.5 && lon > 1)
    return { irradiance: 1280, zone: "Auvergne", city: "Clermont-Ferrand" };
  if (lat < 46.5)
    return { irradiance: 1350, zone: "Aquitaine", city: "Bordeaux" };
  if (lat < 47.5 && lon > 4)
    return { irradiance: 1180, zone: "Bourgogne", city: "Dijon" };
  if (lat < 47.5 && lon < 1)
    return { irradiance: 1220, zone: "Pays de la Loire", city: "Nantes" };
  if (lat < 49 && lon > 2)
    return { irradiance: 1100, zone: "Île-de-France", city: "Paris" };
  if (lat < 49 && lon < 2)
    return { irradiance: 1050, zone: "Normandie", city: "Caen" };
  if (lon < 0)
    return { irradiance: 1000, zone: "Bretagne", city: "Brest" };
  return { irradiance: 980, zone: "Hauts-de-France", city: "Lille" };
}

// ── Température moyenne par région ────────────────────────────────────────
function getRegionalTemp(lat) {
  if (lat < 43.5) return 16;
  if (lat < 45)   return 13;
  if (lat < 47)   return 11;
  if (lat < 49)   return 10;
  return 9;
}

// ── Coefficient d'orientation + facteur d'ombrage ────────────────────────
// Source unique : src/lib/solarCalculations.js
export { getSolarCoefficient, getShadingFactor } from "./solarCalculations";

// ── Production mensuelle réaliste ─────────────────────────────────────────
export function getMonthlyProduction(annualKwh, lat = 46) {
  const coeff43 = [0.038, 0.055, 0.085, 0.108, 0.122, 0.128, 0.135, 0.122, 0.093, 0.065, 0.038, 0.031];
  const coeff50 = [0.030, 0.048, 0.080, 0.108, 0.128, 0.135, 0.138, 0.118, 0.085, 0.055, 0.030, 0.025];
  const t = Math.max(0, Math.min(1, (lat - 43) / 7));
  const coeffs = coeff43.map((c43, i) => c43 + t * (coeff50[i] - c43));
  const total = coeffs.reduce((s, c) => s + c, 0);
  return coeffs.map((c, i) => ({
    month: i + 1,
    kWh: Math.round((c / total) * annualKwh),
    monthName: ['Jan', 'Fév', 'Mar', 'Avr', 'Mai', 'Jun', 'Jul', 'Aoû', 'Sep', 'Oct', 'Nov', 'Déc'][i],
  }));
}

// Dev : proxy Vite /jrc → re.jrc.ec.europa.eu (voir vite.config.js)
// Prod : Vercel Function /api/pvgis → re.jrc.ec.europa.eu (évite CORS)
function pvgisUrl(params) {
  if (import.meta.env.DEV) return `/jrc/v5_2/PVcalc?${params}`;
  return `/api/pvgis?${params}`;
}

async function pvgisFetch(url) {
  const r = await fetch(url);
  if (!r.ok) throw new Error(`PVGIS HTTP ${r.status}`);
  const ct = r.headers.get('content-type') || '';
  if (!ct.includes('json')) {
    throw new Error(`PVGIS: réponse HTML — relancer le serveur Vite (npm run dev)`);
  }
  return r.json();
}

// ── PVGIS v5.2 — référence localisation (Sud 30°, loss=14%) ──────────────
// E_y inclut : orientation + inclinaison + température + 14% pertes système.
export async function fetchPVGISData(lat, lon) {
  try {
    const url = pvgisUrl(`lat=${lat}&lon=${lon}&peakpower=1&loss=14&aspect=0&angle=30&outputformat=json`);
    const d = await pvgisFetch(url);

    const totals = d?.outputs?.totals?.fixed;
    if (!totals?.E_y) throw new Error('PVGIS: E_y absent');

    const avgTemp = getRegionalTemp(lat);
    const monthlyRaw = d.outputs?.monthly?.fixed || [];
    const monthlyProduction = monthlyRaw.map((m, i) => ({
      month: i + 1,
      kWhPerKwc: Math.round(m.E_m || 0),
      monthName: ['Jan','Fév','Mar','Avr','Mai','Jun','Jul','Aoû','Sep','Oct','Nov','Déc'][i],
    }));

    // PR (Performance Ratio) PVGIS = E_y / H(i)_y  (kWh/kWp/an sur kWh/m²/an, G_STC=1 kW/m²)
    // Typiquement 0.77–0.85 en France avec loss=14%. Fallback 0.80 si H indispo.
    const H_iy = totals['H(i)_y'];
    const pr   = (H_iy && H_iy > 0) ? (totals.E_y / H_iy) : 0.80;

    return {
      annualKwhPerKwc:  Math.round(totals.E_y),
      annualIrradiance: Math.round(H_iy || 0),
      pr:               Math.round(pr * 1000) / 1000,
      monthlyProduction,
      optimalAngle: Math.max(15, Math.min(45, Math.round(lat * 0.76 - 3.1))),
      avgTemp,
      tempFactor: Math.round((1 + (-0.004) * ((avgTemp + 30) - 25)) * 100),
      lat, lon,
      source:     'PVGIS v5.2 JRC — Données réelles',
      pvgisSource: 'PVGIS v5.2',
      zone:        getRegionalIrradiance(lat, lon).zone,
    };
  } catch (e) {
    console.warn('[PVGIS v5.2] indisponible:', e.message);
    return getRegionalFallbackPVGIS(lat, lon);
  }
}

// ── PVGIS v5.2 — calcul précis par pan ───────────────────────────────────
// Orientation + inclinaison réelles → E_y intègre tout (orient + temp + 14% pertes).
// Usage : production = kWc × E_y × shadingFactor (rien d'autre)
export async function fetchPVGISForPan(lat, lon, azimut, inclination) {
  try {
    const aspect = Math.round(azimut - 180); // PVGIS : 0=Sud, +90=Ouest, -90=Est
    const angle  = Math.max(0, Math.min(60, Math.round(inclination || 0)));
    const url = pvgisUrl(`lat=${lat}&lon=${lon}&peakpower=1&loss=14&aspect=${aspect}&angle=${angle}&outputformat=json`);
    const d = await pvgisFetch(url);
    const totals = d?.outputs?.totals?.fixed;
    const E_y  = totals?.E_y;
    if (!E_y) throw new Error('E_y absent');
    const H_iy = totals['H(i)_y'];
    const pr   = (H_iy && H_iy > 0) ? (E_y / H_iy) : 0.80;
    return {
      annualKwhPerKwc:  Math.round(E_y),
      annualIrradiance: Math.round(H_iy || 0),
      pr:               Math.round(pr * 1000) / 1000,
      source:           'PVGIS v5.2',
    };
  } catch (e) {
    console.warn('[PVGIS pan]', e.message);
    return null;
  }
}

function getRegionalFallbackPVGIS(lat, lon) {
  const zones = [
    { maxLat: 43.5, kwc: 1200 },
    { maxLat: 44.5, kwc: 1090 },
    { maxLat: 46.5, kwc:  980 },
    { maxLat: 47.5, kwc:  870 },
    { maxLat: 49.0, kwc:  810 },
    { maxLat: 99.0, kwc:  720 },
  ];
  const kwc = (zones.find(z => lat < z.maxLat) || zones[zones.length - 1]).kwc;
  const regional = getRegionalIrradiance(lat, lon);
  return {
    annualKwhPerKwc: kwc,
    monthlyProduction: [],
    optimalAngle: Math.round(lat * 0.76 - 3.1),
    avgTemp: getRegionalTemp(lat),
    zone: regional.zone,
    source: `Données régionales (fallback) — ${regional.city}`,
    pvgisSource: null,
    lat, lon,
  };
}

// ── Aides nationales août 2026 (hardcodées — mises à jour manuelles) ──────
// Arrêté du 01/06/2026 : prime autoconsommation SUPPRIMÉE pour tout
// raccordement demandé depuis le 04/06/2026 ; rachat surplus unifié à
// 0,011 €/kWh (≤100 kWc), indexé +2%/an sur 20 ans.
export async function fetchRegionalAids(lat, lon, zipcode = null) {
  const regional = getRegionalIrradiance(lat, lon);
  return {
    prime_lt3_kwc:              0,
    prime_lt9_kwc:              0,
    prime_lt36_kwc:             0,
    prime_autoconsommation_kwc: 0,
    tarif_rachat_lt3:           0.011,
    tva_reduite:                5.5,
    eco_ptz_max:                30000,
    maprimerenov:               0,
    region:                     regional.zone,
    city:                       regional.city,
    aidesLocales:               [],
    sources: [
      'Prime autoconsommation supprimée — Arrêté du 01/06/2026 (raccordements dès le 04/06/2026)',
      'Rachat surplus 0,011 €/kWh ≤100 kWc, indexé 2%/an — Arrêté du 01/06/2026',
      'TVA 5,5% installations ≤9 kWc (depuis oct. 2025)',
      'Éco-PTZ max 30 000€ (Art. 244 quater U CGI)',
    ],
    updated: '2026-08-01',
  };
}

// ── Prix EDF — Tarif Bleu (mise à jour manuelle dans Paramètres) ──────────
export async function fetchEDFPrice() {
  return {
    price:      0.2001,
    price_hp:   0.2142,
    price_hc:   0.1589,
    tarif:      'Tarif Bleu Base EDF — Août 2026',
    evolution:  '+2.5% vs 2025',
    lastUpdate: '2026-08-01',
    source:     'CRE / EDF',
  };
}

export { getRegionalIrradiance, getRegionalTemp };
