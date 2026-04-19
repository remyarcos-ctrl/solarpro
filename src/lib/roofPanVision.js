// ── Détection automatique des pans de toit par Claude Vision ─────────────
// Envoie une capture PNG de la vue carte à Claude Sonnet et retourne
// les pans détectés avec leurs coordonnées % converties en GPS.

const PROMPT = `Tu es un expert en toiture solaire.
Analyse cette image satellite aérienne d'un bâtiment.
Identifie et délimite TOUS les pans de toit distincts du bâtiment principal.
Un pan = une face inclinée continue du toit.

Pour chaque pan, retourne un JSON strict (sans markdown) :
{
  "pans": [
    {
      "id": 1,
      "orientation": "Sud",
      "azimut": 180,
      "surface_estimee_m2": 45,
      "inclinaison_estimee": 30,
      "coordonnees_pourcentage": [
        {"x": 30, "y": 40},
        {"x": 50, "y": 40},
        {"x": 50, "y": 60},
        {"x": 30, "y": 60}
      ]
    }
  ]
}

x et y sont en pourcentage de l'image (0=gauche/haut, 100=droite/bas).
Minimum 4 points par polygone, sens horaire.
Si aucun pan visible ou bâtiment non identifiable, retourne {"pans": []}.
Réponds UNIQUEMENT avec le JSON, sans texte autour.`;

function apiUrl() {
  if (window.location.hostname === 'localhost') return '/anthropic/v1/messages';
  return null;
}

export async function detectRoofPans(imageBase64) {
  const url = apiUrl();
  const apiKey = import.meta.env.VITE_ANTHROPIC_API_KEY;
  if (!url || !apiKey) return [];

  const resp = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: 'claude-sonnet-4-6',
      max_tokens: 1024,
      messages: [{
        role: 'user',
        content: [
          { type: 'image', source: { type: 'base64', media_type: 'image/png', data: imageBase64 } },
          { type: 'text', text: PROMPT },
        ],
      }],
    }),
  });

  if (!resp.ok) throw new Error(`Claude Vision HTTP ${resp.status}`);
  const data = await resp.json();
  const raw = data.content?.[0]?.text ?? '{"pans":[]}';

  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch {
    const m = raw.match(/\{[\s\S]*\}/);
    parsed = m ? JSON.parse(m[0]) : { pans: [] };
  }

  return parsed.pans ?? [];
}
