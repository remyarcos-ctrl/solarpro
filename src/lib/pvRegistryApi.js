import { openDataUrl } from "./openData";
// ── Registre national des installations PV — ENEDIS Open Data ────────────
// Dataset public : registre-national-installation-production-stockage-electricite-agrege
// Agrégé par commune, par filière. Sans auth, CORS ouvert.
// https://data.enedis.fr/explore/dataset/registre-national-installation-production-stockage-electricite-agrege/
//
// Usage commercial : argument "X installations PV déjà dans votre commune,
// puissance totale Y kWc, soit Z foyers équipés".

const CACHE_KEY  = 'pv_registry_v1';
const CACHE_TTL  = 30 * 24 * 3600 * 1000; // 30 jours (données trimestrielles)

function cache(key) {
  try {
    const raw = localStorage.getItem(`${CACHE_KEY}_${key}`);
    if (!raw) return null;
    const { value, ts } = JSON.parse(raw);
    if (Date.now() - ts > CACHE_TTL) return null;
    return value;
  } catch { return null; }
}
function saveCache(key, value) {
  try { localStorage.setItem(`${CACHE_KEY}_${key}`, JSON.stringify({ value, ts: Date.now() })); } catch {}
}

function extractCommune(addr) {
  const m = (addr || '').match(/\b(\d{5})\s+([^,]+?)(?:\s*$|,)/);
  return m ? { code: m[1], nom: m[2].trim() } : null;
}

// Stats PV pour une commune (par code INSEE ou nom).
// Renvoie { nbInstallations, puissanceTotaleKw, puissanceMoyenneKwc, commune }
export async function fetchCommunePvStats(address) {
  const commune = extractCommune(address);
  if (!commune) return null;
  const cacheKey = commune.code;
  const cached = cache(cacheKey);
  if (cached) return cached;

  try {
    // filière "Solaire" dans le registre, agrégation par commune + code postal
    const url = `https://data.enedis.fr/api/explore/v2.1/catalog/datasets/registre-national-installation-production-stockage-electricite-agrege/records`
      + `?where=${encodeURIComponent(`code_commune = "${commune.code}" AND filiere = "Solaire"`)}`
      + `&limit=50`;
    const r = await fetch(openDataUrl(url), { signal: AbortSignal.timeout(10000) });
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    const data = await r.json();
    const records = data?.results || [];
    if (!records.length) return null;

    // Agrégation : somme sur les tranches de puissance (T1…T6) et tous
    // les énergies livrées (inj, consommation, etc.).
    let nbInstallations = 0;
    let puissanceTotaleKw = 0;
    for (const rec of records) {
      nbInstallations   += Number(rec.nb_installations || 0);
      puissanceTotaleKw += Number(rec.puissance_mw || 0) * 1000;
    }
    if (nbInstallations === 0) return null;

    const result = {
      nbInstallations,
      puissanceTotaleKw:   Math.round(puissanceTotaleKw),
      puissanceMoyenneKwc: Math.round((puissanceTotaleKw / nbInstallations) * 10) / 10,
      commune:             commune.nom,
      codeCommune:         commune.code,
    };
    saveCache(cacheKey, result);
    return result;
  } catch (e) {
    console.warn('[PV Registry]', e.message);
    return null;
  }
}
