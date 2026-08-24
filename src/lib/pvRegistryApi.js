import { openDataUrl } from "./openData";
// ── Registre national des installations PV — ENEDIS Open Data ────────────
// Dataset public : registre-national-installation-production-stockage-electricite-agrege
// Agrégé par commune, par filière. Sans auth, CORS ouvert.
// https://data.enedis.fr/explore/dataset/registre-national-installation-production-stockage-electricite-agrege/
//
// Usage commercial : argument "X installations PV déjà dans votre commune,
// puissance totale Y kWc, soit Z foyers équipés".

const CACHE_KEY  = 'pv_registry_v2';
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
    // 1. Code postal → code INSEE (le registre est indexé INSEE, pas postal —
    //    l'ancien filtre code postal ne matchait jamais rien).
    //    geo.api.gouv.fr : gratuite, CORS ouvert, appel direct.
    const geoR = await fetch(
      `https://geo.api.gouv.fr/communes?codePostal=${commune.code}&fields=code,nom&limit=1`,
      { signal: AbortSignal.timeout(6000) }
    );
    if (!geoR.ok) throw new Error(`geo.api HTTP ${geoR.status}`);
    const geo = await geoR.json();
    const insee = geo?.[0]?.code;
    if (!insee) return null;

    // 2. Registre national via ODRÉ (data.enedis.fr a migré, records en 404 ;
    //    le même dataset vit sur odre.opendatasoft.com)
    const url = `https://odre.opendatasoft.com/api/explore/v2.1/catalog/datasets/registre-national-installation-production-stockage-electricite-agrege/records`
      + `?where=${encodeURIComponent(`codeinseecommune = "${insee}" and filiere = "Solaire"`)}`
      + `&select=nbinstallations,puismaxinstallee&limit=100`;
    const r = await fetch(openDataUrl(url), { signal: AbortSignal.timeout(10000) });
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    const data = await r.json();
    const records = data?.results || [];
    if (!records.length) return null;

    let nbInstallations = 0;
    let puissanceTotaleKw = 0;
    for (const rec of records) {
      nbInstallations   += Number(rec.nbinstallations || 1);
      puissanceTotaleKw += Number(rec.puismaxinstallee || 0);
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
