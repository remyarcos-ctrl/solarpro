// Vercel Serverless Function — Roof Vision
// 1. Fetch Mapbox Static image server-side
// 2. Convert to base64
// 3. Send to Claude Vision
// Env vars: ANTHROPIC_API_KEY, MAPBOX_TOKEN

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { lat, lon, prompt } = req.body;
  if (!lat || !lon) return res.status(400).json({ error: 'lat et lon requis' });

  const mapboxToken = process.env.MAPBOX_TOKEN;
  const anthropicKey = process.env.ANTHROPIC_API_KEY;
  if (!mapboxToken) return res.status(500).json({ error: 'MAPBOX_TOKEN non configuré' });
  if (!anthropicKey) return res.status(500).json({ error: 'ANTHROPIC_API_KEY non configuré' });

  try {
    // 1. Fetch image satellite depuis Mapbox Static API
    // Zoom 19 + 800×600 — centré sur l'adresse.
    // ⚠️ Ces constantes DOIVENT rester synchronisées avec SolarRoofDetector.jsx
    const imageUrl = `https://api.mapbox.com/styles/v1/mapbox/satellite-v9/static/${lon},${lat},19,0/800x600?access_token=${mapboxToken}`;
    const imageRes = await fetch(imageUrl, { signal: AbortSignal.timeout(10000) });
    if (!imageRes.ok) throw new Error(`Mapbox Static HTTP ${imageRes.status}`);
    const imageBuffer = await imageRes.arrayBuffer();
    const base64 = Buffer.from(imageBuffer).toString('base64');

    // 2. Envoie à Claude Vision en base64
    const upstream = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': anthropicKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-6',
        max_tokens: 2048,
        messages: [{
          role: 'user',
          content: [
            { type: 'image', source: { type: 'base64', media_type: 'image/jpeg', data: base64 } },
            { type: 'text', text: prompt },
          ],
        }],
      }),
      signal: AbortSignal.timeout(30000),
    });

    const data = await upstream.json();
    return res.status(upstream.status).json(data);
  } catch (e) {
    console.error('[roof-vision]', e.message, e.stack);
    return res.status(500).json({ error: e.message, stack: e.stack?.split('\n')[0] });
  }
}
