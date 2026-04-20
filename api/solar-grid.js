// Vercel Serverless Function — Solar Grid Interactive
// 1. dataLayers:get → annualFluxUrl + maskUrl (GeoTIFF Google Solar API)
// 2. Décode GeoTIFF et agrège en cellules (~1 m) filtrées par le masque toit
// 3. Renvoie JSON compact : une cellule = {id, lat, lng, flux}
// Env vars : GOOGLE_SOLAR_KEY

import { fromArrayBuffer } from 'geotiff';

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { lat, lon, radiusMeters = 50, cellSizeMeters = 1.0 } = req.body ?? {};
  if (!lat || !lon) return res.status(400).json({ error: 'lat et lon requis' });

  const KEY = process.env.GOOGLE_SOLAR_KEY;
  if (!KEY) return res.status(500).json({ error: 'GOOGLE_SOLAR_KEY non configuré' });

  try {
    // ── 1. URLs GeoTIFF ────────────────────────────────────────────────────
    const lUrl = `https://solar.googleapis.com/v1/dataLayers:get?location.latitude=${lat}&location.longitude=${lon}&radiusMeters=${radiusMeters}&view=IMAGERY_AND_ANNUAL_FLUX_LAYERS&requiredQuality=HIGH&key=${KEY}`;
    const lRes = await fetch(lUrl, { signal: AbortSignal.timeout(15000) });
    if (!lRes.ok) {
      const b = await lRes.json().catch(() => ({}));
      throw new Error(`DataLayers ${lRes.status}: ${b.error?.message || ''}`);
    }
    const layers = await lRes.json();
    const { annualFluxUrl, maskUrl } = layers;
    if (!annualFluxUrl) throw new Error('annualFluxUrl manquant');
    if (!maskUrl)       throw new Error('maskUrl manquant');

    // ── 2. Téléchargement parallèle ──────────────────────────────────────
    const [fRes, mRes] = await Promise.all([
      fetch(`${annualFluxUrl}&key=${KEY}`, { signal: AbortSignal.timeout(20000) }),
      fetch(`${maskUrl}&key=${KEY}`,        { signal: AbortSignal.timeout(20000) }),
    ]);
    if (!fRes.ok) throw new Error(`annualFlux ${fRes.status}`);
    if (!mRes.ok) throw new Error(`mask ${mRes.status}`);
    const fluxAb = await fRes.arrayBuffer();
    const maskAb = await mRes.arrayBuffer();

    // ── 3. Décodage ──────────────────────────────────────────────────────
    const [fluxTiff, maskTiff] = await Promise.all([
      fromArrayBuffer(fluxAb), fromArrayBuffer(maskAb),
    ]);
    const [fluxImg, maskImg] = await Promise.all([
      fluxTiff.getImage(), maskTiff.getImage(),
    ]);
    const W = fluxImg.getWidth();
    const H = fluxImg.getHeight();
    const [fluxRaster, maskRaster] = await Promise.all([
      fluxImg.readRasters(), maskImg.readRasters(),
    ]);
    const flux = fluxRaster[0];
    const mask = maskRaster[0];

    // ── 4. Agrégation cellules ───────────────────────────────────────────
    const pixelSize = layers.pixelSizeMeters ?? 0.1;
    const bin       = Math.max(1, Math.round(cellSizeMeters / pixelSize));
    const cellsW    = Math.floor(W / bin);
    const cellsH    = Math.floor(H / bin);
    const actualCellSize = bin * pixelSize;

    // Bounds : lus depuis la georeference GeoTIFF (pas dans la réponse DataLayers)
    const [minX, minY, maxX, maxY] = fluxImg.getBoundingBox();
    const sw = { latitude: Math.min(minY, maxY), longitude: Math.min(minX, maxX) };
    const ne = { latitude: Math.max(minY, maxY), longitude: Math.max(minX, maxX) };
    const latSpan = ne.latitude  - sw.latitude;
    const lngSpan = ne.longitude - sw.longitude;

    const cells = [];
    let minFlux = Infinity, maxFlux = -Infinity;

    for (let cj = 0; cj < cellsH; cj++) {
      for (let ci = 0; ci < cellsW; ci++) {
        let sum = 0, cnt = 0, mcnt = 0;
        const i0 = ci * bin, i1 = i0 + bin;
        const j0 = cj * bin, j1 = j0 + bin;
        for (let j = j0; j < j1; j++) {
          for (let i = i0; i < i1; i++) {
            const idx = j * W + i;
            if (mask[idx] > 0) {
              mcnt++;
              const f = flux[idx];
              if (Number.isFinite(f) && f > 0) { sum += f; cnt++; }
            }
          }
        }
        // ≥ 50 % de la cellule sur le toit, sinon on ignore
        if (mcnt < bin * bin * 0.5 || cnt === 0) continue;
        const fluxVal = sum / cnt;
        if (fluxVal < minFlux) minFlux = fluxVal;
        if (fluxVal > maxFlux) maxFlux = fluxVal;

        // Centre de la cellule en GPS (repère image : y=0 en haut = nord)
        const cx = (i0 + bin / 2) / W;
        const cy = (j0 + bin / 2) / H;
        const cLat = ne.latitude  - cy * latSpan;
        const cLng = sw.longitude + cx * lngSpan;

        cells.push({
          id: `${ci}-${cj}`,
          lat: cLat,
          lng: cLng,
          flux: Math.round(fluxVal),
        });
      }
    }

    if (!Number.isFinite(minFlux)) { minFlux = 0; maxFlux = 2000; }

    res.setHeader('Cache-Control', 'public, max-age=3600');
    return res.status(200).json({
      cells,
      cellSizeMeters: actualCellSize,
      bounds: { sw, ne },
      minFlux: Math.round(minFlux),
      maxFlux: Math.round(maxFlux),
      pixelSizeMeters: pixelSize,
      count: cells.length,
    });

  } catch (e) {
    console.error('[solar-grid]', e.message, e.stack?.split('\n')[0]);
    return res.status(500).json({ error: e.message });
  }
}
