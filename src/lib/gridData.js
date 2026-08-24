import { openDataUrl } from "./openData";
// ── Facteur CO₂ du mix électrique français (RTE eCO2mix) ─────────────────
// API publique, sans auth, CORS ouvert.
// https://opendata.reseaux-energies.fr — dataset eco2mix-national-tr
// Le champ `taux_co2` est en g CO2eq / kWh, publié toutes les 15 min.
// On prend la moyenne sur les 12 derniers mois pour un facteur annuel stable.
//
// Cache localStorage 7 jours pour éviter un fetch à chaque rendu.

const CACHE_KEY  = 'rte_co2_factor_v1';
const CACHE_TTL  = 7 * 24 * 3600 * 1000; // 7 jours

// Fallback : 52 g CO2/kWh (ADEME Base Carbone 2024, moyenne France)
const FALLBACK_G_PER_KWH = 52;

function readCache() {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    const { value, ts } = JSON.parse(raw);
    if (Date.now() - ts > CACHE_TTL) return null;
    return value;
  } catch { return null; }
}

function writeCache(value) {
  try { localStorage.setItem(CACHE_KEY, JSON.stringify({ value, ts: Date.now() })); } catch {}
}

// Moyenne annuelle via aggregate sur eco2mix-national-tr.
// L'API OpenDataSoft v2.1 supporte les fonctions d'agrégation avec ?select=avg(...)
export async function fetchCO2Factor() {
  const cached = readCache();
  if (cached) return cached;

  const since = new Date(Date.now() - 365 * 24 * 3600 * 1000).toISOString().slice(0, 10);
  const url = `https://opendata.reseaux-energies.fr/api/explore/v2.1/catalog/datasets/eco2mix-national-tr/records`
    + `?select=${encodeURIComponent('avg(taux_co2) as g_co2')}`
    + `&where=${encodeURIComponent(`date_heure >= date'${since}' and taux_co2 is not null`)}`
    + `&limit=1`;

  try {
    const r = await fetch(openDataUrl(url), { signal: AbortSignal.timeout(8000) });
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    const data = await r.json();
    const gPerKwh = data?.results?.[0]?.g_co2;
    if (!Number.isFinite(gPerKwh) || gPerKwh <= 0) throw new Error('réponse vide');
    const result = {
      kgPerKwh: Math.round(gPerKwh) / 1000,
      gPerKwh:  Math.round(gPerKwh),
      source:   'RTE eCO2mix (12 derniers mois)',
      ts:       Date.now(),
    };
    writeCache(result);
    return result;
  } catch (e) {
    console.warn('[RTE eCO2mix]', e.message);
    return {
      kgPerKwh: FALLBACK_G_PER_KWH / 1000,
      gPerKwh:  FALLBACK_G_PER_KWH,
      source:   'ADEME Base Carbone 2024 (fallback)',
      ts:       Date.now(),
    };
  }
}
