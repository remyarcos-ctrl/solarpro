// Routage des appels open data (Enedis, RTE, ADEME) :
// ces hôtes bloquent les appels navigateur (CORS absent ou origine fixe).
// Dev  : proxys Vite (/enedis, /rte, /ademe — voir vite.config.js)
// Prod : fonction serverless /api/opendata (allowlist d'hôtes)

const DEV_PREFIXES = {
  'data.enedis.fr':                '/enedis',
  'opendata.enedis.fr':            '/enedis-od',
  'opendata.reseaux-energies.fr':  '/rte',
  'odre.opendatasoft.com':         '/odre',
  'data.ademe.fr':                 '/ademe',
};

export function openDataUrl(fullUrl) {
  const u = new URL(fullUrl);
  if (import.meta.env.DEV) {
    const prefix = DEV_PREFIXES[u.hostname];
    if (prefix) return prefix + u.pathname + u.search;
  }
  return `/api/opendata?url=${encodeURIComponent(fullUrl)}`;
}
