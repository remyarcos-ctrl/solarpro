import { openDataUrl } from "./openData";
// ── Estimation de la conso électrique annuelle depuis APIs publiques ──────
// 1. ADEME DPE : si le logement a un DPE, on a sa vraie conso finale
// 2. ENEDIS Open Data : conso moyenne résidentielle par adresse (médiane)
//
// Les deux APIs sont publiques, sans auth, CORS ouvert → fetch côté client.

function cleanAddress(addr) {
  return (addr || '').replace(/\s+\d{5}.*$/, '').trim();
}

function extractCommune(addr) {
  const m = (addr || '').match(/\d{5}\s+([^,]+?)(?:\s*$|,)/);
  return m ? m[1].trim() : '';
}

// ── ADEME DPE ─────────────────────────────────────────────────────────────
// https://data.ademe.fr — dataset dpe03existant (remplace l'ancien
// dpe-v2-logements-existants, supprimé — 404 depuis 2026)
// Renvoie la conso énergie finale 5 usages en kWh/an pour le logement du DPE
export async function fetchAdemeDPE(address) {
  if (!address) return null;
  try {
    const q = cleanAddress(address);
    const url = `https://data.ademe.fr/data-fair/api/v1/datasets/dpe03existant/lines`
      + `?q=${encodeURIComponent(q)}&q_mode=simple&size=5`
      + `&select=adresse_ban,etiquette_dpe,surface_habitable_logement`
      + `,conso_5_usages_ef,type_energie_principale_chauffage,date_etablissement_dpe`;
    const r = await fetch(openDataUrl(url), { signal: AbortSignal.timeout(10000) });
    if (!r.ok) return null;
    const data = await r.json();
    const hits = data?.results || data?.rows || [];
    if (!hits.length) return null;
    // Le plus récent en priorité
    const best = hits.sort((a, b) => (b.date_etablissement_dpe || '').localeCompare(a.date_etablissement_dpe || ''))[0];

    const consoFinalKwh = Math.round(Number(best.conso_5_usages_ef) || 0);
    const energieChauff = (best.type_energie_principale_chauffage || '').toLowerCase();
    const chauffElec = /électricité|electricite|elec/.test(energieChauff);
    // Part électrique : 100 % si chauffage élec, ~30 % sinon (base équipements + ECS)
    const consoElecEstKwh = chauffElec
      ? consoFinalKwh
      : Math.round(Math.max(consoFinalKwh * 0.30, 2500));

    return {
      source:             'ADEME DPE',
      adresse:            best.adresse_ban,
      etiquette:          best.etiquette_dpe,
      surface:            best.surface_habitable_logement,
      consoTotaleKwh:     consoFinalKwh,
      consoElecEstKwh,
      chauffage:          best.type_energie_principale_chauffage,
      chauffageElec:      chauffElec,
      date:               best.date_etablissement_dpe,
    };
  } catch (e) {
    console.warn('[ADEME DPE]', e.message);
    return null;
  }
}

// ── ENEDIS Open Data ──────────────────────────────────────────────────────
// https://opendata.enedis.fr — dataset consommation-annuelle-residentielle-par-adresse
// (data.enedis.fr a migré : ancien hôte = redirections cassées, et les
// anciens noms de champs conso_moyenne_mwh n'ont jamais existé ici)
// Renvoie la conso moyenne par site à cette adresse (kWh/an)
export async function fetchEnedisConsumption(address) {
  if (!address) return null;
  try {
    const q = cleanAddress(address);
    const commune = extractCommune(address);
    const where = [`search(adresse, "${q.replace(/[",]/g, '').trim()}")`];
    if (commune) where.push(`nom_commune like "${commune.replace(/"/g, '')}"`);
    const url = `https://opendata.enedis.fr/api/explore/v2.1/catalog/datasets/consommation-annuelle-residentielle-par-adresse/records`
      + `?where=${encodeURIComponent(where.join(' and '))}`
      + `&order_by=${encodeURIComponent('annee desc')}&limit=3`;
    const r = await fetch(openDataUrl(url), { signal: AbortSignal.timeout(8000) });
    if (!r.ok) return null;
    const data = await r.json();
    const recs = data?.results || [];
    if (!recs.length) return null;
    const best = recs[0];
    const consoMwh = Number(best.consommation_annuelle_moyenne_par_site_de_ladresse_mwh) || 0;
    if (!consoMwh) return null;
    return {
      source:       'ENEDIS Open Data',
      adresse:      `${best.adresse || ''}, ${best.nom_commune || ''}`.replace(/\s+/g, ' ').trim(),
      consoMoyKwh:  Math.round(consoMwh * 1000),
      nbLogements:  best.nombre_de_logements || null,
      annee:        best.annee || null,
    };
  } catch (e) {
    console.warn('[ENEDIS]', e.message);
    return null;
  }
}

// ── Estimation combinée — priorité DPE (maison précise) > ENEDIS (quartier) ─
export async function estimateConsumption(address) {
  if (!address) return { dpe: null, enedis: null, suggestion: null };
  const [dpeRes, enedisRes] = await Promise.allSettled([
    fetchAdemeDPE(address),
    fetchEnedisConsumption(address),
  ]);
  const dpe    = dpeRes.status    === 'fulfilled' ? dpeRes.value    : null;
  const enedis = enedisRes.status === 'fulfilled' ? enedisRes.value : null;

  let suggestion = null;
  if (dpe?.consoElecEstKwh) {
    suggestion = {
      value:  dpe.consoElecEstKwh,
      source: `DPE ${dpe.etiquette || ''} (${dpe.chauffageElec ? 'chauffage élec' : 'chauffage non-élec → estim.'})`,
      detail: dpe,
    };
  } else if (enedis?.consoMoyKwh) {
    suggestion = {
      value:  enedis.consoMoyKwh,
      source: `Moyenne quartier (ENEDIS)`,
      detail: enedis,
    };
  }
  return { dpe, enedis, suggestion };
}
