// Vercel Serverless Function — Proxy Google Solar API buildingInsights
// La clé GOOGLE_SOLAR_KEY vit côté serveur (jamais exposée au client).
// Le client appelle /api/solar?lat=..&lon=.. quand VITE_GOOGLE_SOLAR_KEY
// est absente du build (cas de la prod Vercel).

export default async function handler(req, res) {
  const { lat, lon, quality = 'HIGH' } = req.query;

  if (!lat || !lon) {
    return res.status(400).json({ error: 'lat et lon requis' });
  }
  const KEY = process.env.GOOGLE_SOLAR_KEY;
  if (!KEY) {
    return res.status(500).json({ error: 'GOOGLE_SOLAR_KEY absente des variables Vercel' });
  }

  try {
    const url = `https://solar.googleapis.com/v1/buildingInsights:findClosest?location.latitude=${lat}&location.longitude=${lon}&requiredQuality=${quality}&key=${KEY}`;
    const r = await fetch(url, { signal: AbortSignal.timeout(15000) });
    const data = await r.json();
    if (!r.ok) {
      return res.status(r.status).json({ error: `Solar API ${r.status}`, detail: data?.error?.message });
    }
    res.setHeader('Cache-Control', 's-maxage=86400'); // toiture stable — cache 24h
    return res.status(200).json(data);
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
}
