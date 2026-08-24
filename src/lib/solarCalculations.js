// ── Données par défaut ────────────────────────────────────────────────────
// Tarifs août 2026 :
// - Tarif Bleu EDF base 01/08/2026 : 0,2001 €/kWh TTC
// - Rachat surplus ≤100 kWc (arrêté 01/06/2026) : 0,011 €/kWh, indexé 2%/an
// - Prime autoconsommation : SUPPRIMÉE pour tout raccordement depuis le 04/06/2026
export const TARIFF_VERSION = '2026-08';

export const DEFAULT_SETTINGS = {
  electricity_price:            0.2001,
  electricity_price_hp:         0.2142,  // Tarif Bleu option HP (01/08/2026)
  electricity_price_hc:         0.1589,  // Tarif Bleu option HC (01/08/2026)
  tariff_type:                  'base',  // 'base' | 'hphc'
  electricity_price_updated_at: '2026-08-01',
  buyback_rate:             0.011,
  regional_production:      1100,
  self_consumption_rate:    50,     // utilisé uniquement si pas de conso client
  inflation_rate:           2,
  degradation_rate:         0.4,
  prime_per_kwc:            0,     // prime supprimée (arrêté 01/06/2026) — modifiable si droits antérieurs
  prime_per_kwc_9:          0,
  prime_per_kwc_36:         0,
  prime_per_kwc_100:        0,
  installation_cost_per_wc: 2.5,
  inverter_replacement_year: 13,   // remplacement onduleur attendu
  inverter_cost_per_kwc:    300,   // coût remplacement par kWc
  battery_cost_per_kwh:     700,    // ~€ / kWh de batterie (pose incl.)
  tariff_version:           TARIFF_VERSION,
  company_name:             "SolarPro",
  company_address:          "",
  company_phone:            "",
  company_email:            "",
  company_siret:            "",
  company_logo_url:         "",
};

// ── Profils de consommation (répartition mensuelle + ratio jour) ──────────
// monthlyShare : % de la conso annuelle par mois (Jan → Déc, somme = 1)
// daytimeRatio : % de la conso journalière entre ~10h et ~18h (plage solaire)
export const CONSUMPTION_PROFILES = {
  standard: {
    label: "Résidence principale standard",
    monthlyShare: [0.108, 0.094, 0.084, 0.074, 0.063, 0.058, 0.058, 0.058, 0.074, 0.094, 0.115, 0.120],
    daytimeRatio: 0.40,
  },
  electric_heating: {
    label: "Chauffage électrique",
    monthlyShare: [0.150, 0.130, 0.095, 0.060, 0.040, 0.030, 0.030, 0.030, 0.050, 0.085, 0.135, 0.165],
    daytimeRatio: 0.40,
  },
  heat_pump: {
    label: "Pompe à chaleur",
    monthlyShare: [0.135, 0.115, 0.090, 0.065, 0.050, 0.045, 0.045, 0.045, 0.060, 0.090, 0.120, 0.140],
    daytimeRatio: 0.45,
  },
  secondary: {
    label: "Résidence secondaire / week-end",
    monthlyShare: [0.050, 0.050, 0.070, 0.090, 0.110, 0.120, 0.140, 0.140, 0.110, 0.070, 0.050, 0.040],
    daytimeRatio: 0.55,
  },
  teletravail: {
    label: "Télétravail à domicile",
    monthlyShare: [0.095, 0.085, 0.080, 0.075, 0.070, 0.070, 0.070, 0.070, 0.085, 0.090, 0.105, 0.105],
    daytimeRatio: 0.55,
  },
  business: {
    label: "Bâtiment tertiaire / commerce",
    monthlyShare: [0.085, 0.085, 0.085, 0.080, 0.080, 0.080, 0.080, 0.080, 0.085, 0.085, 0.090, 0.085],
    daytimeRatio: 0.80,
  },
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
// ⚠️ SOURCE UNIQUE — ne pas dupliquer (historique : 3 copies identiques retirées)
export const SOLAR_COEFF_TABLE = {
  S:  { 0: 0.870, 10: 0.930, 15: 0.960, 20: 0.980, 30: 1.000, 35: 1.000, 40: 0.995, 45: 0.975 },
  SE: { 0: 0.870, 10: 0.910, 15: 0.935, 20: 0.950, 30: 0.960, 35: 0.960, 40: 0.950, 45: 0.930 },
  SW: { 0: 0.870, 10: 0.910, 15: 0.935, 20: 0.950, 30: 0.960, 35: 0.960, 40: 0.950, 45: 0.930 },
  E:  { 0: 0.870, 10: 0.840, 15: 0.820, 20: 0.800, 30: 0.760, 35: 0.740, 40: 0.720, 45: 0.695 },
  W:  { 0: 0.870, 10: 0.840, 15: 0.820, 20: 0.800, 30: 0.760, 35: 0.740, 40: 0.720, 45: 0.695 },
  NE: { 0: 0.870, 10: 0.790, 15: 0.760, 20: 0.730, 30: 0.680, 35: 0.655, 40: 0.630, 45: 0.600 },
  NW: { 0: 0.870, 10: 0.790, 15: 0.760, 20: 0.730, 30: 0.680, 35: 0.655, 40: 0.630, 45: 0.600 },
  N:  { 0: 0.870, 10: 0.740, 15: 0.700, 20: 0.665, 30: 0.610, 35: 0.585, 40: 0.560, 45: 0.535 },
};

// Options d'ombrage (factor + label pour UI Select). Source unique.
export const SHADING_OPTIONS = [
  { value: "none",          label: "Aucun obstacle",      factor: 1.00 },
  { value: "tree_far",      label: "Arbres éloignés",     factor: 0.97 },
  { value: "tree_near",     label: "Arbres proches",      factor: 0.90 },
  { value: "building_far",  label: "Bâtiment éloigné",    factor: 0.95 },
  { value: "building_near", label: "Bâtiment proche",     factor: 0.85 },
  { value: "chimney",       label: "Cheminée sur toit",   factor: 0.97 },
  { value: "dormer",        label: "Lucarne / Velux",     factor: 0.94 },
  { value: "heavy",         label: "Ombrage important",   factor: 0.75 },
];

// Facteur d'ombrage par type d'obstacle (derivé de SHADING_OPTIONS)
export const SHADING_FACTORS = Object.fromEntries(
  SHADING_OPTIONS.map(o => [o.value, o.factor])
);

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

// ── Autoconso mensuelle réelle ────────────────────────────────────────────
// Combine la production mensuelle (PVGIS) et la conso mensuelle du foyer
// (conso annuelle × profil). Optionnellement : batterie pour reporter le
// surplus jour → consommation nuit.
//
// Retourne { autoAnnual, surplusAnnual, selfConsRate }.
//
// monthlyProdPerKwc : [{ month, kWhPerKwc }] issu de PVGIS (12 items)
// totalKwc          : puissance totale installée (kWc)
// annualConsKwh     : conso annuelle du foyer (kWh)
// profileKey        : clé de CONSUMPTION_PROFILES
// batteryKwh        : capacité utile batterie (kWh, 0 si pas de batterie)
//
function computeMonthlySelfConsumption(monthlyProdPerKwc, totalKwc, annualConsKwh, profileKey, batteryKwh = 0) {
  const prof = CONSUMPTION_PROFILES[profileKey] || CONSUMPTION_PROFILES.standard;
  // Capacité batterie mensuelle : ~30 cycles × 90 % de rendement utile.
  const batteryMonthlyCap = batteryKwh * 30 * 0.90;

  let autoAnnual = 0, surplusAnnual = 0, prodAnnual = 0;
  for (let m = 0; m < 12; m++) {
    const prodMois = (monthlyProdPerKwc?.[m]?.kWhPerKwc || 0) * totalKwc;
    prodAnnual    += prodMois;
    const consMois = annualConsKwh * prof.monthlyShare[m];
    const consDay  = consMois * prof.daytimeRatio;
    const consNight= consMois * (1 - prof.daytimeRatio);

    // 1) Autoconso directe en plein jour
    const directAuto = Math.min(prodMois, consDay);
    let surplusMois  = prodMois - directAuto;

    // 2) Batterie : stocke le surplus jour, restitue la nuit (limitée par capacité ET conso nuit)
    const battUsed = Math.min(surplusMois, consNight, batteryMonthlyCap);
    surplusMois   -= battUsed;

    autoAnnual    += directAuto + battUsed;
    surplusAnnual += surplusMois;
  }
  const selfConsRate = prodAnnual > 0 ? autoAnnual / prodAnnual : 0;
  return { autoAnnual, surplusAnnual, selfConsRate };
}

// ── CALCUL DE PROFITABILITÉ BASÉ SUR LES VRAIS PANS ──────────────────────
//
// Si des pans sont disponibles (tracés sur la carte), on calcule
// pan par pan avec orientation, inclinaison, ombrage et données PVGIS réelles.
// Sinon : mode simple avec panelCount.
//
// dossier (optionnel) : {
//   annual_consumption_kwh : conso annuelle du foyer
//   consumption_profile    : 'standard' | 'electric_heating' | ...
//   has_battery, battery_kwh : option batterie
// }
//
export function calculateProfitability(panelCount, panel, settings, pans = [], pvgisData = null, dossier = {}) {
  if (!panelCount || !panel || !settings) return null;

  const baseKwhPerKwc = pvgisData?.annualKwhPerKwc || settings.regional_production || 1100;
  const avgTemp       = pvgisData?.avgTemp || 12;
  const tempFactor    = getTempFactor(avgTemp);

  // PR global PVGIS (E_y / H(i)_y), fallback 0.80 si indispo.
  // Un système PV en France fait typiquement 75-85 % de PR réel.
  const DEFAULT_PR     = 0.80;
  const globalPvgisPR  = pvgisData?.pr ?? DEFAULT_PR;

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
        // PVGIS par pan : orient + pitch + temp + 14 % pertes déjà dans E_y.
        // Le PR RÉEL de ce pan = PR PVGIS (E_y/H(i)_y) × shadingCoef local.
        const panPR = pan.pvgisPR ?? DEFAULT_PR;
        prod    = Math.round(kwc * pan.pvgisKwhPerKwc * shadingCoef);
        prValue = Math.round(panPR * shadingCoef * 100);
      } else if (pvgisMode) {
        // PVGIS global (réf. Sud 30°) : orientCoef corrige vers orientation réelle.
        // PR réel = PR PVGIS × orientCoef × shadingCoef.
        prod    = Math.round(kwc * baseKwhPerKwc * orientCoef * shadingCoef);
        prValue = Math.round(globalPvgisPR * orientCoef * shadingCoef * 100);
      } else {
        // Fallback régional : formule complète avec pertes système.
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
      // PVGIS : E_y déjà avec pertes — PR = E_y / H(i)_y (réel, pas 86 % codé en dur)
      annualProduction = Math.round(totalKwc * baseKwhPerKwc);
      avgPR = Math.round(globalPvgisPR * 100);
    } else {
      annualProduction = Math.round(totalKwc * baseKwhPerKwc * systemLoss * tempFactor);
      avgPR = Math.round(systemLoss * tempFactor * 100);
    }
    totalKwcFromPans = totalKwc;
  }

  // ── Répartition autoconsommation / surplus ────────────────────────────
  // Priorité : calcul mensuel (conso client + profil + batterie).
  // Sinon : fallback taux fixe des réglages.
  const totalKwc      = totalKwcFromPans || (panelCount * panel.power_wc) / 1000;
  const annualConsKwh = Number(dossier?.annual_consumption_kwh) || 0;
  const profileKey    = dossier?.consumption_profile || 'standard';
  const batteryKwh    = dossier?.has_battery ? (Number(dossier?.battery_kwh) || 0) : 0;

  let selfConsumed, surplus, selfConsRate, consMode;
  if (annualConsKwh > 0 && pvgisData?.monthlyProduction?.length === 12) {
    const r = computeMonthlySelfConsumption(
      pvgisData.monthlyProduction, totalKwc, annualConsKwh, profileKey, batteryKwh
    );
    selfConsumed = Math.round(r.autoAnnual);
    surplus      = Math.round(r.surplusAnnual);
    selfConsRate = r.selfConsRate;
    consMode     = batteryKwh > 0 ? 'monthly+battery' : 'monthly';
  } else {
    const rate = (settings.self_consumption_rate || 50) / 100;
    selfConsumed = Math.round(annualProduction * rate);
    surplus      = Math.round(annualProduction * (1 - rate));
    selfConsRate = rate;
    consMode     = 'flat-rate';
  }

  // ── Revenus annuels (avec HP/HC optionnel) — Tarif Bleu 01/08/2026 ────
  const tariff      = settings.tariff_type || 'base';
  const elecPrice   = settings.electricity_price   || 0.2001;
  const elecPriceHP = settings.electricity_price_hp || 0.2142;
  const elecPriceHC = settings.electricity_price_hc || 0.1589;
  const buybackRate = settings.buyback_rate ?? 0.011;

  // Solaire ≈ 100 % en heures pleines (production mi-journée = HP).
  // Donc en tarif HP/HC, l'autoconso économise au prix HP (plus avantageux).
  const autoElecPrice = tariff === 'hphc' ? elecPriceHP : elecPrice;
  const annualSavings        = Math.round(selfConsumed * autoElecPrice);
  const annualBuybackRevenue = Math.round(surplus * buybackRate);
  const totalAnnualBenefit   = annualSavings + annualBuybackRevenue;

  // ── Coûts & financement ───────────────────────────────────────────────
  const panelCost     = Math.round(panelCount * (panel.price || 0));
  const installCost   = Math.round(totalKwc * 1000 * (settings.installation_cost_per_wc || 2.5));
  const batteryCost   = Math.round(batteryKwh * (settings.battery_cost_per_kwh || 700));
  const totalCost     = panelCost + installCost + batteryCost;

  // Prime autoconsommation supprimée depuis le 04/06/2026 (arrêté du 01/06/2026).
  // Les paliers restent paramétrables dans Settings pour les dossiers dont la
  // demande de raccordement est antérieure au 04/06/2026 (droits conservés).
  const primePerKwc = totalKwc < 3  ? (settings.prime_per_kwc     ?? 0)
                    : totalKwc < 9  ? (settings.prime_per_kwc_9   ?? 0)
                    : totalKwc < 36 ? (settings.prime_per_kwc_36  ?? 0)
                    :                 (settings.prime_per_kwc_100 ?? 0);
  const primeAutoConsommation = Math.round(primePerKwc * totalKwc);
  const resteACharge          = Math.max(0, totalCost - primeAutoConsommation);

  const roiYears = totalAnnualBenefit > 0
    ? Math.round((resteACharge / totalAnnualBenefit) * 10) / 10
    : null;

  // ── Projection 25 ans ─────────────────────────────────────────────────
  const inflationRate  = (settings.inflation_rate  || 2)   / 100;
  const degradationRate= (settings.degradation_rate|| 0.4) / 100;

  const projections = [];
  let cumulativeGains = -resteACharge;

  // Remplacement onduleur à l'année N (paramétrable)
  const inverterReplacementYear = settings.inverter_replacement_year ?? 13;
  const inverterReplacementCost = Math.round(totalKwc * (settings.inverter_cost_per_kwc ?? 300));

  for (let year = 1; year <= 25; year++) {
    const degradFactor = Math.pow(1 - degradationRate, year - 1);
    const inflFactor   = Math.pow(1 + inflationRate, year - 1);

    const yearProd       = annualProduction * degradFactor;
    const yearAuto       = yearProd * selfConsRate;
    const yearSurplus    = yearProd * (1 - selfConsRate);
    const yearSavings    = Math.round(yearAuto * autoElecPrice * inflFactor);
    // Contrat EDF OA : 20 ans, tarif indexé +2%/an (arrêté 01/06/2026) ; rien après
    const buybackIndexed = buybackRate * Math.pow(1.02, year - 1);
    const yearBuyback    = year <= 20 ? Math.round(yearSurplus * buybackIndexed) : 0;
    let   yearBenefit    = yearSavings + yearBuyback;
    if (year === inverterReplacementYear) yearBenefit -= inverterReplacementCost;
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
  // Facteur réel France depuis RTE eCO2mix (fallback 52 g CO2/kWh ADEME 2024)
  const co2KgPerKwh = settings.co2_kg_per_kwh ?? 0.052;
  const co2SavedKg  = Math.round(annualProduction * 25 * co2KgPerKwh);

  return {
    // Production
    totalPowerWc:      Math.round(totalKwc * 1000),
    totalPowerKwc:     Math.round(totalKwc * 100) / 100,
    annualProduction:  Math.round(annualProduction),
    selfConsumed,
    surplus,
    selfConsRate:      Math.round(selfConsRate * 100),
    consMode,
    annualConsKwh,
    profileKey,
    batteryKwh,
    tariff,
    avgPR,

    // Revenus
    annualSavings,
    annualBuybackRevenue,
    totalAnnualBenefit,
    autoElecPrice,

    // Coûts
    panelCost,
    installationCost: installCost,
    batteryCost,
    totalCost,
    primeAutoConsommation,
    resteACharge,
    roiYears,
    inverterReplacementCost,
    inverterReplacementYear,

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
