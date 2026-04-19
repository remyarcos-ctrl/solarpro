// ── Récupération des contours de bâtiment via BDTOPO IGN WFS ──────────────
//
// Source : IGN Géoplateforme – BDTOPO V3 – couche batiment
// Méthode : requête BBOX ±0.0003° autour du point géocodé, puis
//           sélection du bâtiment dont le centroïde est le plus proche.
//
// Retourne : { footprint, hauteur, surface, usage, etages, distanceM }
// Retourne null si aucun bâtiment trouvé ou en cas d'erreur.

import * as turf from "@turf/turf";

const WFS_URL = "https://data.geopf.fr/wfs";
const DELTA   = 0.001; // ±0.001° ≈ ±111m — large enough for any building

// ── Test de connectivité BDTOPO (s'exécute une fois au chargement du module) ─
// BBOX format: lon_min,lat_min,lon_max,lat_max,CRS:84 (force lon/lat axis order)
fetch("https://data.geopf.fr/wfs?service=WFS&version=2.0.0&request=GetFeature&typeNames=BDTOPO_V3:batiment&outputFormat=application/json&count=5&srsName=CRS:84&BBOX=2.346,48.858,2.348,48.860,CRS:84")
  .then(r => r.json())
  .then(() => {})
  .catch(e => console.warn("[BDTOPO test] ❌ Erreur réseau:", e.message));

export async function fetchBuildingFromBDTOPO(lat, lon) {
  // CRS:84 = lon/lat axis order (WFS 2.0.0 default EPSG:4326 uses lat/lon — wrong for France)
  const bbox = `${lon - DELTA},${lat - DELTA},${lon + DELTA},${lat + DELTA},CRS:84`;
  const url =
    `${WFS_URL}?service=WFS&version=2.0.0&request=GetFeature` +
    `&typeNames=BDTOPO_V3:batiment&outputFormat=application/json&count=20` +
    `&srsName=CRS:84&BBOX=${bbox}`;

  const r = await fetch(url);
  if (!r.ok) throw new Error(`BDTOPO HTTP ${r.status}`);
  const data = await r.json();

  const features = data.features ?? [];
  if (!features.length) return null;

  const queryPt = turf.point([lon, lat]);

  // Trouver le bâtiment le plus proche du point géocodé
  let closest = null, minDist = Infinity;
  for (const feat of features) {
    try {
      const coords2d = extractPolygon2D(feat.geometry);
      if (!coords2d) continue;
      const poly = turf.polygon(coords2d);
      const dist = turf.distance(queryPt, turf.centroid(poly), { units: "meters" });
      if (dist < minDist) {
        minDist = dist;
        closest = { feat, coords: coords2d, poly };
      }
    } catch { continue; }
  }

  if (!closest) {
    return null;
  }

  const p = closest.feat.properties ?? {};
  const pitch = calcRoofPitch(closest.feat.geometry);
  const result = {
    footprint:  closest.coords,
    surface:    Math.round(turf.area(closest.poly)),
    hauteur:    typeof p.hauteur === "number" ? p.hauteur : null,
    usage:      p.usage_1 ?? null,
    etages:     typeof p.nombre_d_etages === "number" ? p.nombre_d_etages : null,
    distanceM:  Math.round(minDist),
    pitch,
  };
  return result;
}

// ── Calcule l'inclinaison du toit depuis les coordonnées Z 3D de la géométrie ─
// Principe : delta_Z entre le point le plus haut et le plus bas du toit,
// divisé par la distance horizontale entre ces deux points → angle en degrés.
function calcRoofPitch(geometry) {
  if (!geometry) return null;

  let ring3d = null;
  if (geometry.type === "Polygon") {
    ring3d = geometry.coordinates[0];
  } else if (geometry.type === "MultiPolygon") {
    let best = null, bestLen = 0;
    for (const poly of geometry.coordinates) {
      if (poly[0]?.length > bestLen) { bestLen = poly[0].length; best = poly[0]; }
    }
    ring3d = best;
  }

  if (!ring3d) return null;
  const z3d = ring3d.filter(c => c.length > 2);
  if (z3d.length < 3) return null;

  const zMin = Math.min(...z3d.map(c => c[2]));
  const zMax = Math.max(...z3d.map(c => c[2]));
  const deltaZ = zMax - zMin;
  if (deltaZ < 0.2) return 0; // toit plat

  const ptLow  = z3d.reduce((a, b) => b[2] < a[2] ? b : a);
  const ptHigh = z3d.reduce((a, b) => b[2] > a[2] ? b : a);
  const midLat = (ptLow[1] + ptHigh[1]) / 2;
  const dLon = (ptHigh[0] - ptLow[0]) * 111320 * Math.cos(midLat * Math.PI / 180);
  const dLat = (ptHigh[1] - ptLow[1]) * 111320;
  const horizDist = Math.sqrt(dLon * dLon + dLat * dLat);

  if (horizDist < 0.5) return null;
  return Math.max(0, Math.min(60, Math.round(Math.atan2(deltaZ, horizDist) * 180 / Math.PI)));
}

// ── Convertit une géométrie Polygon / MultiPolygon en anneau 2D ──────────
function extractPolygon2D(geometry) {
  if (!geometry) return null;

  let polygons = [];
  if (geometry.type === "Polygon") {
    polygons = [geometry.coordinates];
  } else if (geometry.type === "MultiPolygon") {
    polygons = geometry.coordinates;
  } else {
    return null;
  }

  let best = null, bestArea = 0;
  for (const poly of polygons) {
    try {
      const ring2d = poly.map(r => r.map(([lon, lat]) => [lon, lat]));
      const area = turf.area(turf.polygon(ring2d));
      if (area > bestArea) { bestArea = area; best = ring2d; }
    } catch { continue; }
  }
  return best;
}
