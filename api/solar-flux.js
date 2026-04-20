// Vercel Serverless Function — Solar Flux Overlay
// 1. dataLayers:get view=IMAGERY_AND_ANNUAL_FLUX_LAYERS → annualFluxUrl + maskUrl
// 2. Téléchargement GeoTIFF (float32 pour flux, uint8 pour masque)
// 3. Composition RGBA : heatmap orange masqué par bâtiment
// 4. Encodage PNG + base64 → affichable comme Mapbox image source
// Env vars : GOOGLE_SOLAR_KEY

import { fromArrayBuffer } from 'geotiff';
import sharp from 'sharp';

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { lat, lon, radiusMeters = 50 } = req.body ?? {};
  if (!lat || !lon) return res.status(400).json({ error: 'lat et lon requis' });

  const KEY = process.env.GOOGLE_SOLAR_KEY;
  if (!KEY) return res.status(500).json({ error: 'GOOGLE_SOLAR_KEY non configuré' });

  try {
    // ── 1. Récupération des URLs GeoTIFF ──────────────────────────────────
    const lUrl = `https://solar.googleapis.com/v1/dataLayers:get?location.latitude=${lat}&location.longitude=${lon}&radiusMeters=${radiusMeters}&view=IMAGERY_AND_ANNUAL_FLUX_LAYERS&requiredQuality=HIGH&key=${KEY}`;
    const lRes = await fetch(lUrl, { signal: AbortSignal.timeout(15000) });
    if (!lRes.ok) {
      const b = await lRes.json().catch(() => ({}));
      throw new Error(`DataLayers ${lRes.status}: ${b.error?.message || JSON.stringify(b).slice(0,120)}`);
    }
    const layers = await lRes.json();
    const { annualFluxUrl, maskUrl, boundingBox } = layers;
    if (!annualFluxUrl) throw new Error('annualFluxUrl manquant dans la réponse DataLayers');
    if (!maskUrl)       throw new Error('maskUrl manquant dans la réponse DataLayers');

    // ── 2. Téléchargement parallèle des deux GeoTIFF ─────────────────────
    const [fRes, mRes] = await Promise.all([
      fetch(`${annualFluxUrl}&key=${KEY}`, { signal: AbortSignal.timeout(20000) }),
      fetch(`${maskUrl}&key=${KEY}`,        { signal: AbortSignal.timeout(20000) }),
    ]);
    if (!fRes.ok) throw new Error(`annualFlux GeoTIFF ${fRes.status}`);
    if (!mRes.ok) throw new Error(`mask GeoTIFF ${mRes.status}`);
    const fluxAb = await fRes.arrayBuffer();
    const maskAb = await mRes.arrayBuffer();

    // ── 3. Décodage GeoTIFF ──────────────────────────────────────────────
    const [fluxTiff, maskTiff] = await Promise.all([
      fromArrayBuffer(fluxAb),
      fromArrayBuffer(maskAb),
    ]);
    const [fluxImg, maskImg] = await Promise.all([
      fluxTiff.getImage(),
      maskTiff.getImage(),
    ]);
    const W = fluxImg.getWidth();
    const H = fluxImg.getHeight();

    const [fluxRaster, maskRaster] = await Promise.all([
      fluxImg.readRasters(),
      maskImg.readRasters(),
    ]);
    const fluxData = fluxRaster[0]; // Float32Array — kWh/kWp/an
    const maskData = maskRaster[0]; // Uint8Array

    // ── 4. Normalisation dynamique (min/max sur zone masquée) ────────────
    let minFlux = Infinity, maxFlux = -Infinity;
    for (let i = 0; i < fluxData.length; i++) {
      if (maskData[i] > 0 && Number.isFinite(fluxData[i])) {
        if (fluxData[i] < minFlux) minFlux = fluxData[i];
        if (fluxData[i] > maxFlux) maxFlux = fluxData[i];
      }
    }
    if (!Number.isFinite(minFlux) || !Number.isFinite(maxFlux) || maxFlux <= minFlux) {
      minFlux = 0; maxFlux = 2000;
    }

    // ── 5. Composition RGBA : heatmap noir → rouge → orange → jaune ──────
    // Outside mask OR flux=NaN → alpha=0 (transparent, jardin invisible)
    const rgba = Buffer.alloc(W * H * 4);
    const range = maxFlux - minFlux;
    for (let i = 0; i < W * H; i++) {
      const inMask = maskData[i] > 0;
      const flux   = fluxData[i];
      if (!inMask || !Number.isFinite(flux) || flux <= 0) {
        rgba[i * 4 + 3] = 0;
        continue;
      }
      const t = Math.max(0, Math.min(1, (flux - minFlux) / range));
      // Dégradé noir → rouge → orange → jaune
      // 0.00..0.33 : noir (0,0,0)      → rouge (200,0,0)
      // 0.33..0.66 : rouge (200,0,0)   → orange (255,140,0)
      // 0.66..1.00 : orange (255,140,0) → jaune (255,230,50)
      let r, g, b;
      if (t < 0.33) {
        const k = t / 0.33;
        r = Math.round(200 * k); g = 0; b = 0;
      } else if (t < 0.66) {
        const k = (t - 0.33) / 0.33;
        r = Math.round(200 + 55 * k); g = Math.round(140 * k); b = 0;
      } else {
        const k = (t - 0.66) / 0.34;
        r = 255; g = Math.round(140 + 90 * k); b = Math.round(50 * k);
      }
      rgba[i * 4    ] = r;
      rgba[i * 4 + 1] = g;
      rgba[i * 4 + 2] = b;
      rgba[i * 4 + 3] = 255;
    }

    // ── 6. Downscale (max 512 px long edge) + encodage PNG ───────────────
    // Évite le freeze client : payload ~150 KB au lieu de 2-4 MB.
    const MAX_SIDE = 512;
    const scale = Math.min(1, MAX_SIDE / Math.max(W, H));
    const outW  = Math.max(1, Math.round(W * scale));
    const outH  = Math.max(1, Math.round(H * scale));

    let pipeline = sharp(rgba, { raw: { width: W, height: H, channels: 4 } });
    if (scale < 1) pipeline = pipeline.resize(outW, outH, { kernel: 'nearest' });
    const pngBuf = await pipeline.png({ compressionLevel: 9 }).toBuffer();

    // ── 7. Réponse : PNG binaire + bounds en headers (pas de JSON base64) ─
    const { sw, ne } = boundingBox;
    res.setHeader('Content-Type', 'image/png');
    res.setHeader('Cache-Control', 'public, max-age=3600');
    res.setHeader('X-Bounds', `${sw.latitude},${sw.longitude},${ne.latitude},${ne.longitude}`);
    res.setHeader('X-Flux-Min', String(Math.round(minFlux)));
    res.setHeader('X-Flux-Max', String(Math.round(maxFlux)));
    res.setHeader('X-Width',  String(outW));
    res.setHeader('X-Height', String(outH));
    return res.status(200).send(pngBuf);

  } catch (e) {
    console.error('[solar-flux]', e.message, e.stack?.split('\n')[0]);
    return res.status(500).json({ error: e.message });
  }
}
