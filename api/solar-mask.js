// Vercel Serverless Function — Solar Mask Polygons
// 1. buildingInsights:findClosest → solarPanels par segment
// 2. dataLayers:get → maskUrl (GeoTIFF binaire bâtiment)
// 3. sharp → pixels → contour du bâtiment + polygones par segment
// Env vars: GOOGLE_SOLAR_KEY

import sharp from 'sharp';
import { fromArrayBuffer } from 'geotiff';
import proj4 from 'proj4';

function convexHull(pts) {
  if (pts.length < 3) return pts;
  const s = [...pts].sort((a, b) => a[0] !== b[0] ? a[0] - b[0] : a[1] - b[1]);
  const cross = (O, A, B) => (A[0]-O[0])*(B[1]-O[1]) - (A[1]-O[1])*(B[0]-O[0]);
  const lo = [], hi = [];
  for (const p of s) {
    while (lo.length >= 2 && cross(lo[lo.length-2], lo[lo.length-1], p) <= 0) lo.pop();
    lo.push(p);
  }
  for (let i = s.length - 1; i >= 0; i--) {
    const p = s[i];
    while (hi.length >= 2 && cross(hi[hi.length-2], hi[hi.length-1], p) <= 0) hi.pop();
    hi.push(p);
  }
  hi.pop(); lo.pop();
  return [...lo, ...hi];
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { lat, lon } = req.body ?? {};
  if (!lat || !lon) return res.status(400).json({ error: 'lat et lon requis' });

  const KEY = process.env.GOOGLE_SOLAR_KEY;
  if (!KEY) return res.status(500).json({ error: 'GOOGLE_SOLAR_KEY non configuré' });

  try {
    // ── 1. Appels parallèles buildingInsights + dataLayers ────────────────
    const [iRes, lRes] = await Promise.all([
      fetch(`https://solar.googleapis.com/v1/buildingInsights:findClosest?location.latitude=${lat}&location.longitude=${lon}&requiredQuality=HIGH&key=${KEY}`,
        { signal: AbortSignal.timeout(15000) }),
      fetch(`https://solar.googleapis.com/v1/dataLayers:get?location.latitude=${lat}&location.longitude=${lon}&radiusMeters=50&view=IMAGERY_LAYERS&key=${KEY}`,
        { signal: AbortSignal.timeout(15000) }),
    ]);

    if (!iRes.ok) {
      const b = await iRes.json().catch(() => ({}));
      throw new Error(`BuildingInsights ${iRes.status}: ${b.error?.message || JSON.stringify(b).slice(0,100)}`);
    }
    if (!lRes.ok) {
      const b = await lRes.json().catch(() => ({}));
      throw new Error(`DataLayers ${lRes.status}: ${b.error?.message || JSON.stringify(b).slice(0,100)}`);
    }

    const [insights, layers] = await Promise.all([iRes.json(), lRes.json()]);

    const { maskUrl } = layers;
    const sp         = insights.solarPotential ?? {};
    const roofSegs   = sp.roofSegmentStats ?? [];
    const panels     = sp.solarPanels ?? [];
    const panelHm    = sp.panelHeightMeters ?? 1.65;
    const panelWm    = sp.panelWidthMeters  ?? 1.0;

    // ── 2. Téléchargement du masque GeoTIFF ────────────────────────────
    const mRes = await fetch(`${maskUrl}&key=${KEY}`, { signal: AbortSignal.timeout(20000) });
    if (!mRes.ok) throw new Error(`Mask GeoTIFF ${mRes.status}`);
    const maskBuf = Buffer.from(await mRes.arrayBuffer());

    // ── 3. Traitement sharp → pixels 8-bit grayscale ───────────────────
    const { data, info } = await sharp(maskBuf)
      .grayscale()
      .raw()
      .toBuffer({ resolveWithObject: true });
    const { width, height } = info;

    // Bounds WGS84 (GeoTIFF Google en UTM → reprojecté)
    const maskTiff = await fromArrayBuffer(new Uint8Array(maskBuf).buffer);
    const maskImg  = await maskTiff.getImage();
    let gk = {};
    try { gk = maskImg.getGeoKeys?.() || {}; } catch {}
    let epsg = gk.ProjectedCSTypeGeoKey || gk.GeographicTypeGeoKey || null;
    const [minX, minY, maxX, maxY] = maskImg.getBoundingBox();
    let sw, ne;
    if (epsg === 4326 || (Math.abs(minX) <= 180 && Math.abs(minY) <= 90)) {
      sw = { latitude: Math.min(minY, maxY), longitude: Math.min(minX, maxX) };
      ne = { latitude: Math.max(minY, maxY), longitude: Math.max(minX, maxX) };
    } else {
      let zone, isNorth;
      if (epsg && epsg >= 32601 && epsg <= 32660) { zone = epsg - 32600; isNorth = true; }
      else if (epsg && epsg >= 32701 && epsg <= 32760) { zone = epsg - 32700; isNorth = false; }
      else { zone = Math.floor((lon + 180) / 6) + 1; isNorth = lat >= 0; epsg = (isNorth ? 32600 : 32700) + zone; }
      const code = `EPSG:${epsg}`;
      if (!proj4.defs(code)) proj4.defs(code, `+proj=utm +zone=${zone}${isNorth ? '' : ' +south'} +datum=WGS84 +units=m +no_defs`);
      const [swLon, swLat] = proj4(code, 'WGS84', [Math.min(minX, maxX), Math.min(minY, maxY)]);
      const [neLon, neLat] = proj4(code, 'WGS84', [Math.max(minX, maxX), Math.max(minY, maxY)]);
      sw = { latitude: Math.min(swLat, neLat), longitude: Math.min(swLon, neLon) };
      ne = { latitude: Math.max(swLat, neLat), longitude: Math.max(swLon, neLon) };
    }
    const pxToGPS = (px, py) => [
      sw.longitude + (px / width)  * (ne.longitude - sw.longitude),
      ne.latitude  - (py / height) * (ne.latitude  - sw.latitude),
    ];

    // ── 4. Contour du bâtiment ─────────────────────────────────────────
    const isBldg = (x, y) =>
      x >= 0 && y >= 0 && x < width && y < height && data[y * width + x] > 127;

    const boundary = [];
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        if (!isBldg(x, y)) continue;
        if (!isBldg(x-1,y) || !isBldg(x+1,y) || !isBldg(x,y-1) || !isBldg(x,y+1)) {
          boundary.push([x, y]);
        }
      }
    }

    let buildingPolygon = null;
    if (boundary.length >= 3) {
      const hull = convexHull(boundary);
      const ring = hull.map(([px, py]) => pxToGPS(px, py));
      ring.push(ring[0]);
      buildingPolygon = [ring];
    }

    // ── 5. Polygones par segment (convex hull des corners de panneaux) ─
    const segGroups = {};
    for (const panel of panels) {
      const idx  = panel.segmentIndex ?? 0;
      const pLat = panel.center?.latitude;
      const pLon = panel.center?.longitude;
      if (pLat == null || pLon == null) continue;

      const mPerDegLon = 111320 * Math.cos(pLat * Math.PI / 180);
      const isLandscape = panel.orientation === 'LANDSCAPE';
      const hw = (isLandscape ? panelHm : panelWm) / 2;
      const hh = (isLandscape ? panelWm : panelHm) / 2;

      if (!segGroups[idx]) segGroups[idx] = [];
      segGroups[idx].push(
        [pLon - hw/mPerDegLon, pLat - hh/110540],
        [pLon + hw/mPerDegLon, pLat - hh/110540],
        [pLon + hw/mPerDegLon, pLat + hh/110540],
        [pLon - hw/mPerDegLon, pLat + hh/110540],
      );
    }

    const segments = roofSegs
      .map((seg, i) => {
        const area = seg.stats?.areaMeters2 ?? 0;
        if (area < 4 || (seg.pitchDegrees ?? 0) > 75) return null;

        const pts = segGroups[i] ?? [];
        let polygon;
        if (pts.length >= 3) {
          const hull = convexHull(pts);
          const ring = [...hull, hull[0]];
          polygon = [ring];
        } else {
          // Fallback : boundingBox GPS direct
          const sw2 = seg.boundingBox?.sw, ne2 = seg.boundingBox?.ne;
          if (!sw2 || !ne2) return null;
          polygon = [[
            [sw2.longitude, sw2.latitude],
            [ne2.longitude, sw2.latitude],
            [ne2.longitude, ne2.latitude],
            [sw2.longitude, ne2.latitude],
            [sw2.longitude, sw2.latitude],
          ]];
        }

        return {
          segmentIndex: i,
          polygon,
          azimut:        seg.azimuthDegrees        ?? 180,
          pitch:         seg.pitchDegrees          ?? 30,
          area,
          sunshineHours: seg.stats?.sunshineHoursPerYear ?? 0,
        };
      })
      .filter(Boolean);

    return res.json({ segments, buildingPolygon, pixelSizeMeters: layers.pixelSizeMeters });

  } catch (e) {
    console.error('[solar-mask]', e.message, e.stack?.split('\n')[0]);
    return res.status(500).json({ error: e.message });
  }
}
