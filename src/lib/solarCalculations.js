// ── Données par défaut ────────────────────────────────────────────────────
export const DEFAULT_SETTINGS = {
  electricity_price:        0.2516,
  buyback_rate:             0.1302,
  regional_production:      1100,
  self_consumption_rate:    70,
  inflation_rate:           5,
  degradation_rate:         0.4,
  prime_per_kwc:            380,
  installation_cost_per_wc: 2.5,
  company_name:             "SolarPro",
  company_address:          "",
  company_phone:            "",
  company_email:            "",
  company_siret:            "",
  company_logo_url:         "",
};

export const DEFAULT_PANELS = [
  { brand: "DualSun",        model_name: "Flash 410",      power_wc: 410, width_mm: 1722, height_mm: 1134, price: 280, efficiency: 21.3, is_default: true  },
  { brand: "Jinko",          model_name: "Tiger Neo 400",  power_wc: 400, width_mm: 1722, height_mm: 1134, price: 220, efficiency: 20.8, is_default: false },
  { brand: "SunPower",       model_name: "Maxeon 6 440",   power_wc: 440, width_mm: 1812, height_mm: 1046, price: 380, efficiency: 22.8, is_default: false },
  { brand: "Canadian Solar", model_name: "HiKu6 420",      power_wc: 420, width_mm: 1722, height_mm: 1134, price: 250, efficiency: 21.5, is_default: false },
  { brand: "LONGi",          model_name: "Hi-MO 6 430",    power_wc: 430, width_mm: 1722, height_mm: 1134, price: 260, efficiency: 22.0, is_default: false },
];

// ── Table de rendement solaire par orientation + inclinaison ──────────────
// Source : PVGIS France, latitude moyenne 46°
// Référence : Sud 30° = 1.000
const SOLAR_COEFF_TABLE = {
  S:  { 0: 0.870, 10: 0.930, 15: 0.960, 20: 0.980, 30: 1.000, 35: 1.000, 40: 0.995, 45: 0.975 },
  SE: { 0: 0.870, 10: 0.910, 15: 0.935, 20: 0.950, 30: 0.960, 35: 0.960, 40: 0.950, 45: 0.930 },
  SW: { 0: 0.870, 10: 0.910, 15: 0.935, 20: 0.950, 30: 0.960, 35: 0.960, 40: 0.950, 45: 0.930 },
  E:  { 0: 0.870, 10: 0.840, 15: 0.820, 20: 0.800, 30: 0.760, 35: 0.740, 40: 0.720, 45: 0.695 },
  W:  { 0: 0.870, 10: 0.840, 15: 0.820, 20: 0.800, 30: 0.760, 35: 0.740, 40: 0.720, 45: 0.695 },
  NE: { 0: 0.870, 10: 0.790, 15: 0.760, 20: 0.730, 30: 0.680, 35: 0.655, 40: 0.630, 45: 0.600 },
  NW: { 0: 0.870, 10: 0.790, 15: 0.760, 20: 0.730, 30: 0.680, 35: 0.655, 40: 0.630, 45: 0.600 },
  N:  { 0: 0.870, 10: 0.740, 15: 0.700, 20: 0.665, 30: 0.610, 35: 0.585, 40: 0.560, 45: 0.535 },
};

// Facteur d'ombrage par type d'obstacle
const SHADING_FACTORS = {
  none:          1.00,
  tree_far:      0.97,
  tree_near:     0.90,
  building_far:  0.95,
  building_near: 0.85,
  chimney:       0.97,
  dormer:        0.94,
  heavy:         0.75,
};

export function getSolarCoefficient(orientation, inclination) {
  const row = SOLAR_COEFF_TABLE[orientation] || SOLAR_COEFF_TABLE['S'];
  const angles = Object.keys(row).map(Number).sort((a, b) => a - b);
  const inc = Math.max(0, Math.min(45, inclination || 0));
  const lower = angles.filter(a => a <= inc).pop() ?? angles[0];
  const upper = angles.filter(a => a >= inc)[0] ?? angles[angles.length - 1];
  if (lower === upper) return row[lower];
  const t = (inc - lower) / (upper - lower);
  return row[lower] + t * (row[upper] - row[lower]);
}

export function getShadingFactor(shadingType) {
  return SHADING_FACTORS[shadingType] || 1.0;
}

// ── Facteur température ───────────────────────────────────────────────────
// Panneaux monocristallins perdent 0.4%/°C au-dessus de 25°C
// Température panneau ≈ T_ambiante + 30°C (NOCT)
function getTempFactor(avgAmbientTemp = 12) {
  const panelTemp = avgAmbientTemp + 30;
  return 1 + (-0.004) * (panelTemp - 25);
}

// ── Calcul du nombre max de panneaux ─────────────────────────────────────
export function calculateMaxPanels(roofWidth, roofHeight, panelWidthMm, panelHeightMm) {
  if (!roofWidth || !roofHeight || !panelWidthMm || !panelHeightMm) return 0;
  const cols = Math.floor(roofWidth / (panelWidthMm / 1000));
  const rows = Math.floor(roofHeight / (panelHeightMm / 1000));
  return cols * rows;
}

// ── CALCUL DE PROFITABILITÉ BASÉ SUR LES VRAIS PANS ──────────────────────
//
// Si des pans sont disponibles (tracés sur la carte), on calcule
// pan par pan avec orientation, inclinaison, ombrage et données PVGIS réelles.
//
// Si pas de pans (fallback), on utilise le mode simple avec panelCount.
//
export function calculateProfitability(panelCount, panel, settings, pans = [], pvgisData = null) {
  if (!panelCount || !panel || !settings) return null;

  const baseKwhPerKwc = pvgisData?.annualKwhPerKwc || settings.regional_production || 1100;
  const avgTemp       = pvgisData?.avgTemp || 12;
  const tempFactor    = getTempFactor(avgTemp);

  // Pertes système fixes (câblage, onduleur, salissures, dégradation an 1)
  const systemLoss = 0.97 * 0.96 * 0.97 * 0.98; // = ~0.883

  // ── Calcul production selon les pans disponibles ──
  let annualProduction = 0;
  let totalKwcFromPans = 0;
  let avgPR = 0;
  let panDetails = [];

  // pvgisSource=true → E_y inclut déjà orientation + temp + 14% pertes
  // → ne pas appliquer tempFactor ni systemLoss une deuxième fois
  const pvgisMode = !!pvgisData?.pvgisSource;

  if (pans && pans.length > 0) {
    // MODE PANS : calcul précis par pan
    panDetails = pans.map(pan => {
      const panPanels  = pan.maxPanels || 0;
      const kwc        = (panPanels * panel.power_wc) / 1000;
      const orientCoef = getSolarCoefficient(pan.orientation || 'S', pan.inclination || 30);
      // Ombrage : Solar API (sunshineHoursPerYear) prioritaire sur catégorie manuelle
      const shadingCoef = pan.shadingSource === 'solar_api' && pan.solarShadingFactor != null
        ? pan.solarShadingFactor
        : getShadingFactor(pan.shading || 'none');

      let prod, prValue;
      if (pan.pvgisKwhPerKwc) {
        // PVGIS par pan : orientation + temp + 14% pertes déjà dans E_y
        prod    = Math.round(kwc * pan.pvgisKwhPerKwc * shadingCoef);
        prValue = Math.round(shadingCoef * 100);
      } else if (pvgisMode) {
        // PVGIS global (réf. Sud 30°) : appliquer orientCoef mais pas systemLoss/tempFactor
        prod    = Math.round(kwc * baseKwhPerKwc * orientCoef * shadingCoef);
        prValue = Math.round(orientCoef * shadingCoef * 100);
      } else {
        // Fallback régional : formule complète
        const PR = orientCoef * shadingCoef * tempFactor * systemLoss;
        prod    = Math.round(kwc * baseKwhPerKwc * PR);
        prValue = Math.round(PR * 100);
      }

      return {
        panId:       pan.id,
        label:       `Pan ${(pan.index || 0) + 1}`,
        orientation: pan.orientation || 'S',
        inclination: pan.inclination || 30,
        shading:     pan.shading || 'none',
        panels:      panPanels,
        kwc:         Math.round(kwc * 100) / 100,
        orientCoef:  Math.round(orientCoef * 100),
        shadingCoef: Math.round(shadingCoef * 100),
        PR:          prValue,
        production:  prod,
        pvgisSource: !!pan.pvgisKwhPerKwc,
      };
    });

    annualProduction = panDetails.reduce((s, p) => s + p.production, 0);
    totalKwcFromPans = panDetails.reduce((s, p) => s + p.kwc, 0);
    avgPR = panDetails.length > 0
      ? Math.round(panDetails.reduce((s, p) => s + p.PR, 0) / panDetails.length)
      : 80;

    // Ajuster panelCount au total réel des pans si différent
    const totalPansMax = pans.reduce((s, p) => s + (p.maxPanels || 0), 0);
    if (totalPansMax > 0 && panelCount > totalPansMax) panelCount = totalPansMax;

  } else {
    // MODE SIMPLE : pas de pans tracés
    const totalKwc = (panelCount * panel.power_wc) / 1000;
    if (pvgisMode) {
      // PVGIS : E_y déjà avec pertes — pas de double application
      annualProduction = Math.round(totalKwc * baseKwhPerKwc);
      avgPR = 86; // ≈ 1 - 14% pertes PVGIS
    } else {
      annualProduction = Math.round(totalKwc * baseKwhPerKwc * systemLoss * tempFactor);
      avgPR = Math.round(systemLoss * tempFactor * 100);
    }
    totalKwcFromPans = totalKwc;
  }

  // ── Répartition autoconsommation / surplus ────────────────────────────
  const selfConsRate = (settings.self_consumption_rate || 70) / 100;
  const selfConsumed = Math.round(annualProduction * selfConsRate);
  const surplus      = Math.round(annualProduction * (1 - selfConsRate));

  // ── Revenus annuels ───────────────────────────────────────────────────
  const elecPrice    = settings.electricity_price    || 0.2516;
  const buybackRate  = settings.buyback_rate         || 0.1302;
  const annualSavings        = Math.round(selfConsumed * elecPrice);
  const annualBuybackRevenue = Math.round(surplus * buybackRate);
  const totalAnnualBenefit   = annualSavings + annualBuybackRevenue;

  // ── Coûts & financement ───────────────────────────────────────────────
  const totalKwc       = totalKwcFromPans || (panelCount * panel.power_wc) / 1000;
  const panelCost      = Math.round(panelCount * (panel.price || 0));
  const installCost    = Math.round(totalKwc * 1000 * (settings.installation_cost_per_wc || 2.5));
  const totalCost      = panelCost + installCost;

  // Prime selon puissance installée (barème 2025)
  const primePerKwc = totalKwc < 3  ? (settings.prime_per_kwc || 380)
                    : totalKwc < 9  ? 290
                    : totalKwc < 36 ? 180
                    : 90;
  const primeAutoConsommation = Math.round(primePerKwc * totalKwc);
  const resteACharge          = Math.max(0, totalCost - primeAutoConsommation);

  const roiYears = totalAnnualBenefit > 0
    ? Math.round((resteACharge / totalAnnualBenefit) * 10) / 10
    : null;

  // ── Projection 25 ans ─────────────────────────────────────────────────
  const inflationRate  = (settings.inflation_rate  || 5)   / 100;
  const degradationRate= (settings.degradation_rate|| 0.4) / 100;

  const projections = [];
  let cumulativeGains = -resteACharge;

  for (let year = 1; year <= 25; year++) {
    const degradFactor = Math.pow(1 - degradationRate, year - 1);
    const inflFactor   = Math.pow(1 + inflationRate, year - 1);

    const yearProd       = annualProduction * degradFactor;
    const yearAuto       = yearProd * selfConsRate;
    const yearSurplus    = yearProd * (1 - selfConsRate);
    const yearSavings    = Math.round(yearAuto * elecPrice * inflFactor);
    const yearBuyback    = Math.round(yearSurplus * buybackRate); // tarif fixe 20 ans
    const yearBenefit    = yearSavings + yearBuyback;
    cumulativeGains     += yearBenefit;

    projections.push({
      year,
      production:      Math.round(yearProd),
      savings:         yearSavings,
      buyback:         yearBuyback,
      totalBenefit:    yearBenefit,
      cumulativeGains: Math.round(cumulativeGains),
    });
  }

  // ── CO2 évité ─────────────────────────────────────────────────────────
  // Mix électrique France : ~52g CO2/kWh (2024, RTE)
  const co2SavedKg = Math.round(annualProduction * 25 * 0.052);

  return {
    // Production
    totalPowerWc:      Math.round(totalKwc * 1000),
    totalPowerKwc:     Math.round(totalKwc * 100) / 100,
    annualProduction:  Math.round(annualProduction),
    selfConsumed,
    surplus,
    avgPR,

    // Revenus
    annualSavings,
    annualBuybackRevenue,
    totalAnnualBenefit,

    // Coûts
    panelCost,
    installationCost: installCost,
    totalCost,
    primeAutoConsommation,
    resteACharge,
    roiYears,

    // Projection
    projections,
    co2SavedKg,

    // Détail pans (pour debug / affichage)
    panDetails,
    pvgisSource: pvgisData?.source || 'Données régionales',
    baseKwhPerKwc,
  };
}

// ── Formatage ─────────────────────────────────────────────────────────────
export function formatCurrency(value) {
  if (value === null || value === undefined) return "—";
  return new Intl.NumberFormat("fr-FR", {
    style:              "currency",
    currency:           "EUR",
    maximumFractionDigits: 0,
  }).format(value);
}

export function formatNumber(value) {
  if (value === null || value === undefined) return "—";
  return new Intl.NumberFormat("fr-FR").format(value);
}

export const STATUS_LABELS = {
  prospect:         "Prospect",
  visite_planifiee: "Visite planifiée",
  etude_envoyee:    "Étude envoyée",
  signe:            "Signé",
  installe:         "Installé",
  annule:           "Annulé",
};

export const STATUS_COLORS = {
  prospect:         "bg-blue-500/20 text-blue-400 border-blue-500/30",
  visite_planifiee: "bg-amber-500/20 text-amber-400 border-amber-500/30",
  etude_envoyee:    "bg-purple-500/20 text-purple-400 border-purple-500/30",
  signe:            "bg-emerald-500/20 text-emerald-400 border-emerald-500/30",
  installe:         "bg-primary/20 text-primary border-primary/30",
  annule:           "bg-red-500/20 text-red-400 border-red-500/30",
};

export const PROPERTY_LABELS = {
  maison:              "Maison",
  immeuble:            "Immeuble",
  batiment_commercial: "Bâtiment commercial",
  hangar:              "Hangar",
};
