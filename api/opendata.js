// Vercel Serverless Function — Proxy open data (CORS)
// data.enedis.fr et opendata.reseaux-energies.fr n'autorisent pas les appels
// navigateur depuis notre origine ; data.ademe.fr change ses chemins.
// Allowlist stricte d'hôtes — le client passe l'URL complète encodée.

const ALLOWED_HOSTS = new Set([
  'data.enedis.fr',
  'opendata.enedis.fr',
  'opendata.reseaux-energies.fr',
  'odre.opendatasoft.com',
  'data.ademe.fr',
]);

export default async function handler(req, res) {
  const { url } = req.query;
  if (!url) return res.status(400).json({ error: 'url requise' });

  let target;
  try {
    target = new URL(url);
  } catch {
    return res.status(400).json({ error: 'url invalide' });
  }
  if (target.protocol !== 'https:' || !ALLOWED_HOSTS.has(target.hostname)) {
    return res.status(403).json({ error: `hôte non autorisé : ${target.hostname}` });
  }

  try {
    const r = await fetch(target.toString(), {
      headers: { Accept: 'application/json' },
      signal: AbortSignal.timeout(12000),
    });
    const body = await r.text();
    res.setHeader('Content-Type', r.headers.get('content-type') || 'application/json');
    res.setHeader('Cache-Control', 's-maxage=3600'); // open data stable — cache 1h
    return res.status(r.status).send(body);
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
}
