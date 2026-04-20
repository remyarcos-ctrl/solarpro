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

// ── Coefficient d'orientation précis (table complète) ────────────────────
export function getSolarCoefficient(orientation, inclination) {
  const coeffTable = {
    S:  { 0: 0.870, 10: 0.930, 15: 0.960, 20: 0.980, 30: 1.000, 35: 1.000, 40: 0.995, 45: 0.975 },
    SE: { 0: 0.870, 10: 0.910, 15: 0.935, 20: 0.950, 30: 0.960, 35: 0.960, 40: 0.950, 45: 0.930 },
    SW: { 0: 0.870, 10: 0.910, 15: 0.935, 20: 0.950, 30: 0.960, 35: 0.960, 40: 0.950, 45: 0.930 },
    E:  { 0: 0.870, 10: 0.840, 15: 0.820, 20: 0.800, 30: 0.760, 35: 0.740, 40: 0.720, 45: 0.695 },
    W:  { 0: 0.870, 10: 0.840, 15: 0.820, 20: 0.800, 30: 0.760, 35: 0.740, 40: 0.720, 45: 0.695 },
    NE: { 0: 0.870, 10: 0.790, 15: 0.760, 20: 0.730, 30: 0.680, 35: 0.655, 40: 0.630, 45: 0.600 },
    NW: { 0: 0.870, 10: 0.790, 15: 0.760, 20: 0.730, 30: 0.680, 35: 0.655, 40: 0.630, 45: 0.600 },
    N:  { 0: 0.870, 10: 0.740, 15: 0.700, 20: 0.665, 30: 0.610, 35: 0.585, 40: 0.560, 45: 0.535 },
  };
  const row = coeffTable[orientation] || coeffTable['S'];
  const angles = Object.keys(row).map(Number).sort((a, b) => a - b);
  const inc = Math.max(0, Math.min(45, inclination || 0));
  const lower = angles.filter(a => a <= inc).pop() || angles[0];
  const upper = angles.filter(a => a >= inc)[0] || angles[angles.length - 1];
  if (lower === upper) return row[lower];
  const t = (inc - lower) / (upper - lower);
  return row[lower] + t * (row[upper] - row[lower]);
}

// ── Facteur d'ombrage par catégorie ───────────────────────────────────────
export function getShadingFactor(obstacleType = 'none') {
  const factors = {
    none:          1.00,
    tree_far:      0.97,
    tree_near:     0.90,
    building_far:  0.95,
    building_near: 0.85,
    chimney:       0.97,
    dormer:        0.94,
    heavy:         0.75,
  };
  return factors[obstacleType] || 1.0;
}

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

// ── Aides nationales 2025 (hardcodées — mises à jour manuellement) ────────
export async function fetchRegionalAids(lat, lon, zipcode = null) {
  const regional = getRegionalIrradiance(lat, lon);
  let bonusRegional = 0;
  if (regional.zone === 'Méditerranée') bonusRegional = 50;
  else if (regional.zone === 'Midi-Pyrénées') bonusRegional = 30;
  else if (regional.zone === 'Aquitaine') bonusRegional = 20;

  return {
    prime_lt3_kwc:              380 + bonusRegional,
    prime_lt9_kwc:              290,
    prime_lt36_kwc:             180,
    prime_autoconsommation_kwc: 380 + bonusRegional,
    tarif_rachat_lt3:           0.1302,
    tva_reduite:                10,
    eco_ptz_max:                30000,
    maprimerenov:               0,
    region:                     regional.zone,
    city:                       regional.city,
    aidesLocales:               [],
    sources: [
      'Prime autoconsommation — Arrêté tarifaire EDF OA 2025',
      'TVA 10% (Art. 278-0 bis CGI)',
      'Éco-PTZ max 30 000€ (Art. 244 quater U CGI)',
    ],
    updated: '2025-01-01',
  };
}

// ── Prix EDF — tarif fixe CRE 2025 (mise à jour manuelle dans Paramètres) ──
export async function fetchEDFPrice() {
  return {
    price:      0.2516,
    price_hp:   0.2550,
    price_hc:   0.2060,
    tarif:      'Tarif Bleu Base EDF — Février 2025',
    evolution:  '+5.3% vs 2024',
    lastUpdate: '2025-02-01',
    source:     'CRE / EDF',
  };
}

export { getRegionalIrradiance, getRegionalTemp };
