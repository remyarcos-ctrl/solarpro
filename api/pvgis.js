// Vercel Serverless Function — Proxy PVGIS v5.2 JRC
// Contourne le CORS du navigateur en production
// re.jrc.ec.europa.eu autorise les requêtes serveur-à-serveur

export default async function handler(req, res) {
  const { lat, lon, peakpower = 1, loss = 14, aspect = 0, angle = 30, outputformat = 'json' } = req.query;

  if (!lat || !lon) {
    return res.status(400).json({ error: 'lat et lon requis' });
  }

  try {
    const url = `https://re.jrc.ec.europa.eu/api/v5_2/PVcalc?lat=${lat}&lon=${lon}&peakpower=${peakpower}&loss=${loss}&aspect=${aspect}&angle=${angle}&outputformat=${outputformat}`;
    const r = await fetch(url, {
      headers: { 'Accept': 'application/json' },
      signal: AbortSignal.timeout(15000),
    });

    if (!r.ok) {
      const text = await r.text();
      return res.status(r.status).json({ error: `PVGIS ${r.status}`, detail: text.slice(0, 200) });
    }

    const data = await r.json();
    res.setHeader('Cache-Control', 's-maxage=86400'); // Cache 24h (données stables)
    return res.status(200).json(data);
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
}
