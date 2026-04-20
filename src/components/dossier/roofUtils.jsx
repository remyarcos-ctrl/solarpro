import * as turf from "@turf/turf";

// ── Couleurs par pan ──────────────────────────────────────────────────────
export const PAN_COLORS = [
  "#E8A020", "#3B82F6", "#22C55E", "#EF4444",
  "#A855F7", "#06B6D4", "#F97316", "#EC4899",
];

// ── Orientations solaires ─────────────────────────────────────────────────
export const ORIENTATIONS = [
  { value: "S",  label: "Sud",        azimut: 180 },
  { value: "SE", label: "Sud-Est",    azimut: 135 },
  { value: "SW", label: "Sud-Ouest",  azimut: 225 },
  { value: "E",  label: "Est",        azimut: 90  },
  { value: "W",  label: "Ouest",      azimut: 270 },
  { value: "NE", label: "Nord-Est",   azimut: 45  },
  { value: "NW", label: "Nord-Ouest", azimut: 315 },
  { value: "N",  label: "Nord",       azimut: 0   },
];

export const INCLINATIONS = [0, 10, 15, 20, 30, 35, 40, 45];

// ── Coefficient de rendement solaire ─────────────────────────────────────
export function getSolarCoefficient(orientation, inclination) {
  const coeffTable = {
    S:  { 0: 0.870, 10: 0.930, 15: 0.960, 20: 0.980, 30: 1.000, 35: 1.000, 40: 0.995, 45: 0.975 },
    SE: { 0: 0.870, 10: 0.910, 15: 0.935, 20: 0.950, 30: 0.960, 35: 0.960, 40: 0.950, 45: 0.930 },
    SW: { 0: 0.870, 10: 0.910, 15: 0.935, 20: 0.950, 30: 0.960, 35: 0.960, 40: 0.950, 45: 0.930 },
    E:  { 0: 0.870, 10: 0.840, 15: 0.820, 20: 0.800, 30: 0.760, 35: 0.740, 40: 0.720, 45: 0.695 },
    W:  { 0: 0.870, 10: 0.840, 15: 0.820, 20: 0.800, 30: 0.760, 35: 0.740, 40: 0.720, 45: 0.695 },
    NE: { 0: 0.870, 10: 0.790, 15: 0.760, 20: 0.730, 30: 0.680, 35: 0.655, 40: 0.630, 45: 0.600 },
    NW: { 0: 0.870, 10: 0.790, 15: 0.760, 20: 0.730, 30: 0.680, 35: 0.655, 40: 0.630, 45: 0.600 },
    N:  { 0: 0.870, 10: 0.740, 15: 0.700, 20: 0.665, 30: 0.610, 35: 0.585, 40: 0.560, 45: 0.535 },
  };
  const row = coeffTable[orientation] || coeffTable["S"];
  const angles = Object.keys(row).map(Number).sort((a, b) => a - b);
  const inc = Math.max(0, Math.min(45, inclination || 0));
  const lower = angles.filter(a => a <= inc).pop() ?? angles[0];
  const upper = angles.filter(a => a >= inc)[0] ?? angles[angles.length - 1];
  if (lower === upper) return row[lower];
  const t = (inc - lower) / (upper - lower);
  return Math.round((row[lower] + t * (row[upper] - row[lower])) * 1000) / 1000;
}

export function getPanRecommendation(coef) {
  if (coef >= 0.95) return { label: "Optimal ✅",     icon: "✅", color: "text-emerald-400", bg: "bg-emerald-500/15" };
  if (coef >= 0.85) return { label: "Très bon ✅",    icon: "✅", color: "text-emerald-400", bg: "bg-emerald-500/10" };
  if (coef >= 0.72) return { label: "Acceptable ⚠️", icon: "⚠️", color: "text-amber-400",   bg: "bg-amber-500/15"  };
  if (coef >= 0.60) return { label: "Médiocre ⚠️",   icon: "⚠️", color: "text-orange-400",  bg: "bg-orange-500/15" };
  return                   { label: "Déconseillé ❌", icon: "❌", color: "text-red-400",     bg: "bg-red-500/15"    };
}

export function getPanelColor(coef) {
  if (coef >= 0.95) return { fill: "#0a2540", line: "rgba(34,197,94,0.9)"    };
  if (coef >= 0.85) return { fill: "#0f2a50", line: "rgba(59,130,246,0.95)"  };
  if (coef >= 0.72) return { fill: "#1a3a50", line: "rgba(100,180,255,0.85)" };
  if (coef >= 0.60) return { fill: "#2a2a1a", line: "rgba(251,191,36,0.8)"   };
  return                   { fill: "#2a1a1a", line: "rgba(150,150,150,0.6)"  };
}

// ── Surface polygone GeoJSON en m² ────────────────────────────────────────
export function geojsonArea(coordinates) {
  if (!coordinates?.[0] || coordinates[0].length < 3) return 0;
  try {
    return turf.area(turf.polygon(coordinates));
  } catch { return 0; }
}

// ── Dimensions réelles en mètres (bounding box) ───────────────────────────
export function getBoundingBoxMeters(coordinates) {
  if (!coordinates?.[0] || coordinates[0].length < 3) return { width: 0, height: 0 };
  try {
    const poly = turf.polygon(coordinates);
    const [minLon, minLat, maxLon, maxLat] = turf.bbox(poly);
    const width  = turf.distance([minLon, minLat], [maxLon, minLat], { units: "meters" });
    const height = turf.distance([minLon, minLat], [minLon, maxLat], { units: "meters" });
    return {
      width:  Math.round(width  * 10) / 10,
      height: Math.round(height * 10) / 10,
    };
  } catch { return { width: 0, height: 0 }; }
}

// ── Azimut → orientation cardinale ────────────────────────────────────────
export function azimutToOrientation(azimut) {
  const a = ((azimut % 360) + 360) % 360;
  if (a >= 337.5 || a < 22.5) return "N";
  if (a < 67.5)  return "NE";
  if (a < 112.5) return "E";
  if (a < 157.5) return "SE";
  if (a < 202.5) return "S";
  if (a < 247.5) return "SW";
  if (a < 292.5) return "W";
  return "NW";
}

// ── Détection automatique de l'orientation d'un pan ──────────────────────
// Retourne l'azimut de la perpendiculaire extérieure à l'arête la plus longue.
export function detectPanOrientation(coordinates) {
  const pts = coordinates[0];
  if (!pts || pts.length < 3) return { azimut: 180, orientation: "S" };
  try {
    const poly     = turf.polygon(coordinates);
    const centroid = turf.centroid(poly);

    // Trouver l'arête la plus longue
    let maxLen = 0, p1Best = null, p2Best = null;
    for (let i = 0; i < pts.length - 1; i++) {
      const len = turf.distance(turf.point(pts[i]), turf.point(pts[i + 1]), { units: "meters" });
      if (len > maxLen) { maxLen = len; p1Best = pts[i]; p2Best = pts[i + 1]; }
    }
    if (!p1Best) return { azimut: 180, orientation: "S" };

    const edgeBearing = turf.bearing(turf.point(p1Best), turf.point(p2Best));

    // Deux perpendiculaires à l'arête
    const perpA = ((edgeBearing + 90)  % 360 + 360) % 360;
    const perpB = ((edgeBearing - 90)  % 360 + 360) % 360;

    // Direction du milieu de l'arête vers le centroïde
    const mid = turf.midpoint(turf.point(p1Best), turf.point(p2Best));
    const toCentBearing = turf.bearing(mid, centroid);

    // La perp. extérieure est celle la plus éloignée de toCentBearing (opposée au centroïde)
    const diffA = Math.abs(((perpA - toCentBearing + 540) % 360) - 180);
    const diffB = Math.abs(((perpB - toCentBearing + 540) % 360) - 180);
    const outward = diffA > diffB ? perpA : perpB;

    return { azimut: Math.round(outward), orientation: azimutToOrientation(outward) };
  } catch {
    return { azimut: 180, orientation: "S" };
  }
}

// Dimensions réelles d'un panneau (m) — panneau standard 1.13 × 1.72 m.
const GUIDE_PANEL_W_M = 1.13;
const GUIDE_PANEL_H_M = 1.72;

// Un pan est "orienté Nord" s'il fait partie des secteurs NW, N ou NE
// (azimut ∈ [292.5°, 67.5°[ en traversant 0°). Inutilisable en solaire.
// Cohérent avec azimutToOrientation : NW=292.5-337.5, N=337.5-22.5, NE=22.5-67.5.
export function isNorthFacingSegment(seg) {
  const az = (((seg?.azimuthDegrees ?? 180) % 360) + 360) % 360;
  return az >= 292.5 || az < 67.5;
}

// Génère les features GeoJSON pour le layer "roof-guide" (orange).
// Renvoie UN rectangle 1.13×1.72 m par panneau buildingInsights.solarPanels[],
// chacun orienté selon l'azimut de son segment d'origine — exactement comme
// la démo Google. Aucun recouvrement entre pans puisque les panneaux sont
// des positions GPS distinctes.
// Fallback : footprint BDTOPO si Solar API indisponible.
export function buildRoofGuideFeatures(solarData, rotationDelta = 0) {
  const sp     = solarData?.solarPotential;
  const panels = sp?.solarPanels;
  const segs   = sp?.roofSegmentStats;

  if (panels?.length > 0 && segs?.length > 0) {
    const features = [];
    for (let i = 0; i < segs.length; i++) {
      if (isNorthFacingSegment(segs[i])) continue; // pan Nord → exclu
      const az = (segs[i].azimuthDegrees ?? 180) + rotationDelta;
      const { panels: rects } = buildPanelsFromGoogleSolar(
        panels, i, az, GUIDE_PANEL_W_M, GUIDE_PANEL_H_M,
      );
      for (let j = 0; j < rects.length; j++) {
        const id = `s${i}-p${j}`;
        features.push({
          type: "Feature",
          id, // accessible via promoteId pour feature-state
          properties: { id, kind: "solar-panel", segIdx: i, panelIdx: j },
          geometry: { type: "Polygon", coordinates: [rects[j]] },
        });
      }
    }
    return features;
  }

  const bdtopo = solarData?.__bdtopo;
  if (bdtopo?.footprint) {
    return [{
      type: "Feature",
      properties: { kind: "bdtopo" },
      geometry: { type: "Polygon", coordinates: bdtopo.footprint },
    }];
  }
  return [];
}

// ── Panneaux exacts depuis Google Solar API (buildingInsights.solarPanels) ─
//
// Chaque panneau retourné par Google a :
//   - center : { latitude, longitude }  (GPS exact du centre)
//   - orientation : "LANDSCAPE" | "PORTRAIT"
//   - segmentIndex : index dans roofSegmentStats
//   - yearlyEnergyDcKwh : production annuelle estimée
//
// On reconstruit les 4 coins en projetant le centre le long de deux axes :
//   - ridge  : perpendiculaire à l'azimut du segment (parallèle au faîtage)
//   - slope  : dans la direction de l'azimut (ligne de plus grande pente)
//
// Conventions :
//   - azimut : degrés depuis le Nord, sens horaire (0=N, 90=E, 180=S, 270=O)
//   - LANDSCAPE : long côté (panelHeightMeters) parallèle au faîtage
//   - PORTRAIT  : long côté (panelHeightMeters) dans le sens de la pente
//
export function buildPanelsFromGoogleSolar(
  solarPanels,
  segmentIdx,
  segmentAzimuthDeg,
  panelWm = 1.0,
  panelHm = 1.65,
) {
  if (!solarPanels?.length) return { panels: [], max: 0, yearlyKwh: [] };
  const segPanels = segmentIdx == null
    ? solarPanels
    : solarPanels.filter(p => p.segmentIndex === segmentIdx);
  if (!segPanels.length) return { panels: [], max: 0, yearlyKwh: [] };

  const azRad   = ((segmentAzimuthDeg ?? 180) * Math.PI) / 180;
  const slopeE  = Math.sin(azRad),  slopeN =  Math.cos(azRad);
  const ridgeE  = Math.cos(azRad),  ridgeN = -Math.sin(azRad);

  const mPerDegLat = 110540;
  const signs = [[-1, -1], [1, -1], [1, 1], [-1, 1], [-1, -1]];

  const panels = [];
  const yearlyKwh = [];
  for (const p of segPanels) {
    const lat = p.center?.latitude;
    const lng = p.center?.longitude;
    if (lat == null || lng == null) continue;

    const mPerDegLng = 111320 * Math.cos((lat * Math.PI) / 180);
    const sideRidge  = p.orientation === "PORTRAIT" ? panelWm : panelHm;
    const sideSlope  = p.orientation === "PORTRAIT" ? panelHm : panelWm;

    const corners = [];
    for (const [sr, ss] of signs) {
      const dR = (sr * sideRidge) / 2;
      const dS = (ss * sideSlope) / 2;
      const e  = ridgeE * dR + slopeE * dS;
      const n  = ridgeN * dR + slopeN * dS;
      corners.push([
        lng + e / mPerDegLng,
        lat + n / mPerDegLat,
      ]);
    }
    panels.push(corners);
    yearlyKwh.push(p.yearlyEnergyDcKwh ?? 0);
  }

  return { panels, max: panels.length, yearlyKwh };
}

// ── Grille de panneaux — strip packing en coordonnées métriques locales ───
//
// Algorithme :
// 1. Convertit le polygone GPS en coordonnées métriques locales (m) centrées
//    sur le centroïde et alignées sur la plus longue arête (→ axe X).
// 2. Place la grille en mètres avec une vérification PIP par lancer de rayon.
// 3. Essaie 16 décalages de phase (4 × 4) et retient le meilleur.
// 4. Essaie portrait ET paysage, retient le plus dense.
// 5. Reconvertit les coins des panneaux retenus en GPS.
//
// Avantage vs l'ancienne approche : travaille en espace euclidien (pas de
// précision GPS) → booleanWithin n'est plus utilisé.
//
export function buildPanelGridRotated(
  polyCoords,
  wm,                   // largeur panneau (m)
  hm,                   // hauteur panneau (m)
  maxN       = 9999,
  orient     = "auto",  // "portrait" | "paysage" | "auto"
  azimut     = 180,
  margin     = 0.20,    // marge bord (m)
  gapCol     = 0.02,    // espace inter-panneaux (m)
  _inclination = 30,
  _lat       = 46,
  _obstacles = [],
) {
  const pts = polyCoords[0];
  if (!pts || pts.length < 3) return { panels: [], max: 0 };

  const safeW = wm > 0.3 ? wm : 1.134;
  const safeH = hm > 0.3 ? hm : 1.722;

  try {
    const polygon  = turf.polygon(polyCoords);
    const centroid = turf.centroid(polygon);
    const [cLon, cLat] = centroid.geometry.coordinates;

    // ── 1. Plus longue arête → angle d'alignement ───────────────────────
    const mPerDegLat = 111320;
    const mPerDegLon = 111320 * Math.cos(cLat * Math.PI / 180);
    let maxLen = 0, edgeAngleRad = 0;
    for (let i = 0; i < pts.length - 1; i++) {
      const dx = (pts[i+1][0] - pts[i][0]) * mPerDegLon;
      const dy = (pts[i+1][1] - pts[i][1]) * mPerDegLat;
      const len = Math.hypot(dx, dy);
      if (len > maxLen) { maxLen = len; edgeAngleRad = Math.atan2(dy, dx); }
    }
    const cosA = Math.cos(-edgeAngleRad), sinA = Math.sin(-edgeAngleRad);

    // ── 2. Conversion GPS ↔ mètres locaux (rotation alignée sur l'arête) ─
    function toLocal(lon, lat) {
      const dx = (lon - cLon) * mPerDegLon;
      const dy = (lat - cLat) * mPerDegLat;
      return [dx * cosA - dy * sinA, dx * sinA + dy * cosA];
    }
    function toGPS(x, y) {
      const cosB = cosA, sinB = -sinA; // inverse rotation
      const dx = x * cosB - y * sinB;
      const dy = x * sinB + y * cosB;
      return [cLon + dx / mPerDegLon, cLat + dy / mPerDegLat];
    }

    const localRing = pts.map(p => toLocal(p[0], p[1]));

    // Convert obstacle GPS polygons to local metric rings
    const localObstacles = (_obstacles || []).map(obs => {
      const ring = Array.isArray(obs[0]?.[0]) ? obs[0] : obs;
      return ring.map(pt => toLocal(pt[0], pt[1]));
    }).filter(r => r.length >= 3);

    // ── 3. PIP par lancer de rayon (espace métrique, rapide et précis) ───
    function pip(x, y) {
      let inside = false;
      const n = localRing.length;
      for (let i = 0, j = n - 1; i < n; j = i++) {
        const xi = localRing[i][0], yi = localRing[i][1];
        const xj = localRing[j][0], yj = localRing[j][1];
        if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) {
          inside = !inside;
        }
      }
      return inside;
    }

    function pipRing(ring, x, y) {
      let inside = false;
      const n = ring.length;
      for (let i = 0, j = n - 1; i < n; j = i++) {
        const xi = ring[i][0], yi = ring[i][1];
        const xj = ring[j][0], yj = ring[j][1];
        if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) {
          inside = !inside;
        }
      }
      return inside;
    }

    function panelHitsObstacle(x, y, pw, ph) {
      if (!localObstacles.length) return false;
      const cx = x + pw / 2, cy = y + ph / 2;
      return localObstacles.some(ring =>
        pipRing(ring, cx, cy) || pipRing(ring, x, y) ||
        pipRing(ring, x + pw, y) || pipRing(ring, x + pw, y + ph) || pipRing(ring, x, y + ph)
      );
    }

    // Panneau entièrement à l'intérieur et hors obstacles.
    // ÉROSION 10 cm : on teste les coins rétrécis vers l'intérieur + 4 mi-arêtes
    // pour rejeter les panneaux qui touchent le bord (sinon débordement visuel).
    const INSET = 0.10;
    function panelInside(x, y, pw, ph) {
      const xi0 = x + INSET,      yi0 = y + INSET;
      const xi1 = x + pw - INSET, yi1 = y + ph - INSET;
      const xm  = x + pw / 2,     ym  = y + ph / 2;
      return pip(xi0, yi0) && pip(xi1, yi0) &&
             pip(xi1, yi1) && pip(xi0, yi1) &&
             pip(xm,  yi0) && pip(xm,  yi1) &&
             pip(xi0, ym ) && pip(xi1, ym ) &&
             pip(xm,  ym ) &&
             !panelHitsObstacle(x, y, pw, ph);
    }

    // ── 4. Bbox locale ───────────────────────────────────────────────────
    const xs = localRing.map(p => p[0]), ys = localRing.map(p => p[1]);
    const xMin = Math.min(...xs), xMax = Math.max(...xs);
    const yMin = Math.min(...ys), yMax = Math.max(...ys);

    // ── 5. Grille avec scan de phase ─────────────────────────────────────
    function buildGridLocal(pw, ph) {
      const stepX = pw + gapCol, stepY = ph + gapCol;
      let best = [];
      // 4 × 4 offsets de phase
      for (let kx = 0; kx < 4; kx++) {
        for (let ky = 0; ky < 4; ky++) {
          const offX = (kx / 4) * pw, offY = (ky / 4) * ph;
          const panels = [];
          let y = yMin + margin + offY;
          while (y + ph <= yMax - margin) {
            let x = xMin + margin + offX;
            while (x + pw <= xMax - margin) {
              if (panelInside(x, y, pw, ph)) panels.push([x, y]);
              x += stepX;
            }
            y += stepY;
          }
          if (panels.length > best.length) best = panels;
        }
      }
      return best;
    }

    const pwP = Math.min(safeW, safeH), phP = Math.max(safeW, safeH); // portrait
    const pwL = Math.max(safeW, safeH), phL = Math.min(safeW, safeH); // paysage

    const portrait = orient !== "paysage" ? buildGridLocal(pwP, phP) : [];
    const paysage  = orient !== "portrait" ? buildGridLocal(pwL, phL) : [];

    const areaM2 = turf.area(polygon);
    console.warn(`[Grid] ${Math.round(areaM2)}m² · portrait=${portrait.length} · paysage=${paysage.length} · théorique≈${Math.floor(areaM2 / (pwP * phP))}`);

    let panels, bestPw, bestPh, bestOrient;
    if (orient === "portrait" || portrait.length >= paysage.length) {
      panels = portrait; bestPw = pwP; bestPh = phP; bestOrient = "portrait";
    } else {
      panels = paysage; bestPw = pwL; bestPh = phL; bestOrient = "paysage";
    }
    if (orient === "paysage") { panels = paysage; bestPw = pwL; bestPh = phL; bestOrient = "paysage"; }

    // ── 6. Reconversion GPS + filtre ratio d'aire ≥ 99.5% ────────────────
    // booleanContains renvoie false quand le panneau touche un bord (cas fréquent
    // avec le scan de phase). On utilise turf.intersect + ratio d'aire : robuste
    // aux cas limites de précision GPS.
    const gpsGridsRaw = panels.slice(0, maxN).map(([x, y]) => [
      toGPS(x,          y         ),
      toGPS(x + bestPw, y         ),
      toGPS(x + bestPw, y + bestPh),
      toGPS(x,          y + bestPh),
      toGPS(x,          y         ),
    ]);

    const gpsGrids = gpsGridsRaw.filter(corners => {
      try {
        const panelPoly = turf.polygon([corners]);
        const panelArea = turf.area(panelPoly);
        const inter = turf.intersect(turf.featureCollection([polygon, panelPoly]));
        if (!inter) return false;
        return turf.area(inter) / panelArea >= 0.995;
      } catch {
        return false;
      }
    });

    return { panels: gpsGrids, max: gpsGrids.length, orient: bestOrient, panelW: bestPw, panelH: bestPh };
  } catch (e) {
    console.error("buildPanelGridRotated:", e);
    return { panels: [], max: 0 };
  }
}

// ── Snap sur un ensemble d'arêtes ────────────────────────────────────────
// rings : tableau de tableaux [lon,lat] (chaque ring est le contour d'un polygone)
// Retourne { lng, lat } si le curseur est à < 15px d'un sommet/arête, sinon null.
export function snapToRings(lngLat, rings, mapInstance) {
  if (!rings?.length || !mapInstance) return null;
  try {
    const center = mapInstance.getCenter();
    const cp = mapInstance.project(center);
    const g1 = mapInstance.unproject({ x: cp.x,      y: cp.y });
    const g2 = mapInstance.unproject({ x: cp.x + 15, y: cp.y });
    const thresholdM = turf.distance([g1.lng, g1.lat], [g2.lng, g2.lat], { units: 'meters' });

    const queryPt = turf.point([lngLat.lng, lngLat.lat]);
    let bestDist = Infinity, bestLng = null, bestLat = null;

    for (const ring of rings) {
      if (!ring?.length) continue;
      for (const v of ring) {
        const d = turf.distance(queryPt, turf.point(v), { units: 'meters' });
        if (d < thresholdM && d < bestDist) { bestDist = d; bestLng = v[0]; bestLat = v[1]; }
      }
      for (let i = 0; i < ring.length - 1; i++) {
        const seg = turf.lineString([ring[i], ring[i + 1]]);
        const np  = turf.nearestPointOnLine(seg, queryPt, { units: 'meters' });
        const d   = np.properties.dist;
        if (d < thresholdM && d < bestDist) {
          bestDist = d; bestLng = np.geometry.coordinates[0]; bestLat = np.geometry.coordinates[1];
        }
      }
    }
    return bestLng !== null ? { lng: bestLng, lat: bestLat } : null;
  } catch { return null; }
}

// Rétro-compatibilité
export function snapToBdtopo(lngLat, footprint, mapInstance) {
  return snapToRings(lngLat, footprint ? [footprint[0]] : [], mapInstance);
}

// ── Géocodage — API Adresse (data.gouv.fr) ───────────────────────────────
export async function geocode(address) {
  try {
    const r = await fetch(`https://api-adresse.data.gouv.fr/search/?q=${encodeURIComponent(address)}&limit=1`);
    const d = await r.json();
    if (d.features?.length > 0) {
      const [lon, lat] = d.features[0].geometry.coordinates;
      return { lat, lon };
    }
  } catch (_) {}
  return null;
}
