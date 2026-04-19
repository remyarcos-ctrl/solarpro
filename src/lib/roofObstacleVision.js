// ── Détection d'obstacles par Claude Vision ───────────────────────────────
// Envoie une capture PNG de la zone du polygone à Claude claude-sonnet-4-6
// et retourne les obstacles détectés avec leurs positions GPS approx.

const ANTHROPIC_PROMPT = `Tu es un expert en analyse de toitures solaires.
Analyse cette image satellite d'une toiture et détecte TOUS les obstacles visibles :
velux, fenêtres de toit, cheminées, antennes TV/satellite, conduits de ventilation,
lucarnes, aérateurs, équipements techniques.

Pour chaque obstacle trouvé, retourne un JSON strict (sans markdown) :
{
  "obstacles": [
    {
      "type": "velux|cheminee|antenne|conduit|lucarne|autre",
      "label": "nom court en français",
      "cx": 0.45,
      "cy": 0.30,
      "w": 0.05,
      "h": 0.03
    }
  ]
}

cx, cy : centre de l'obstacle en fraction de l'image (0=gauche/haut, 1=droite/bas)
w, h   : largeur et hauteur en fraction de l'image
Si aucun obstacle visible, retourne {"obstacles": []}.
Réponds UNIQUEMENT avec le JSON, sans texte autour.`;

function apiUrl() {
  if (window.location.hostname === 'localhost') return '/anthropic/v1/messages';
  return '/api/anthropic'; // Vercel serverless function en production
}

export async function analyzeRoofObstacles(imageBase64, panBbox) {
  const url = apiUrl();
  const isDev = window.location.hostname === 'localhost';
  const apiKey = isDev ? import.meta.env.VITE_ANTHROPIC_API_KEY : 'server';
  if (!url || (isDev && !apiKey)) {
    console.warn('[Vision] VITE_ANTHROPIC_API_KEY manquant');
    return [];
  }

  const headers = { 'Content-Type': 'application/json', 'anthropic-version': '2023-06-01' };
  if (isDev && apiKey) headers['x-api-key'] = apiKey;

  const resp = await fetch(url, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      model: 'claude-sonnet-4-6',
      max_tokens: 512,
      messages: [{
        role: 'user',
        content: [
          { type: 'image', source: { type: 'base64', media_type: 'image/png', data: imageBase64 } },
          { type: 'text', text: ANTHROPIC_PROMPT },
        ],
      }],
    }),
  });

  if (!resp.ok) throw new Error(`Claude Vision HTTP ${resp.status}`);
  const data = await resp.json();
  const raw = data.content?.[0]?.text ?? '{"obstacles":[]}';

  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch {
    const m = raw.match(/\{[\s\S]*\}/);
    parsed = m ? JSON.parse(m[0]) : { obstacles: [] };
  }

  // Convertit les positions fractionnaires en coordonnées GPS
  const { minLng, minLat, maxLng, maxLat } = panBbox;
  const dLng = maxLng - minLng, dLat = maxLat - minLat;

  return (parsed.obstacles ?? []).map(o => ({
    type: o.type,
    label: o.label,
    // Attention : l'axe Y de l'image est inversé par rapport à la latitude
    coords: fractToPolygon(o.cx, o.cy, o.w, o.h, minLng, maxLat, dLng, dLat),
    areaM2: estimateAreaM2(o.w * dLng, o.h * dLat),
  }));
}

function fractToPolygon(cx, cy, fw, fh, minLng, maxLat, dLng, dLat) {
  // cy est en fraction image (Y croît vers le bas) → on inverse pour la latitude
  const lng = minLng + cx * dLng;
  const lat = maxLat - cy * dLat; // inversion axe Y
  const hw = (fw * dLng) / 2;
  const hh = (fh * dLat) / 2;
  return [[
    [lng - hw, lat - hh],
    [lng + hw, lat - hh],
    [lng + hw, lat + hh],
    [lng - hw, lat + hh],
    [lng - hw, lat - hh],
  ]];
}

function estimateAreaM2(dLngFrac, dLatFrac) {
  const mLng = dLngFrac * 111320 * Math.cos(46 * Math.PI / 180) * 111320;
  const mLat = dLatFrac * 111320;
  return Math.round(mLng * mLat * 10) / 10;
}
