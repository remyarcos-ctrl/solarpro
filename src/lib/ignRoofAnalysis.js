// ── Analyse inclinaison de toiture via IGN Géoplateforme + LiDAR HD ──────────
//
// Méthode : différences finies sur 5 points en croix (±2m autour du centroïde)
// Source primaire  : ign_lidar_hd_mnx_mono_wld (MNS LiDAR HD 50cm, avec interpolation)
// Source de repli  : ign_rge_alti_par_territoires (RGE Alti 1m)
//
// Retourne : { pitch (°), azimut (°), resource }
// Retourne null si les deux sources échouent ou si aucune donnée valide.

const ALTI_URL = "https://data.geopf.fr/altimetrie/1.0/calcul/alti/rest/elevation.json";

async function fetchElevations(points, resource) {
  const lons = points.map(p => p.lon.toFixed(7)).join("|");
  const lats = points.map(p => p.lat.toFixed(7)).join("|");
  const r = await fetch(`${ALTI_URL}?lon=${lons}&lat=${lats}&resource=${resource}`);
  if (!r.ok) throw new Error(`IGN HTTP ${r.status}`);
  const data = await r.json();
  const elevs = data.elevations ?? [];
  return elevs.map(e => (typeof e === "number" ? e : e?.z ?? null));
}

export async function analyzeRoofFromGPS(lat, lon) {
  // Pas de ±2m en degrés selon la latitude
  const dLat = 2 / 111320;
  const dLon = 2 / (111320 * Math.cos(lat * Math.PI / 180));

  // Croix : centre, N, S, E, O
  const points = [
    { lat,             lon             },
    { lat: lat + dLat, lon             },
    { lat: lat - dLat, lon             },
    { lat,             lon: lon + dLon },
    { lat,             lon: lon - dLon },
  ];

  const NO_DATA = -9999;
  const isValid = zs => zs.length === 5 && zs.every(z => z != null && z > NO_DATA);

  let zs = null;
  let resource = "ign_lidar_hd_mnx_mono_wld";

  try {
    zs = await fetchElevations(points, resource);
    if (!isValid(zs)) throw new Error("no LiDAR data");
  } catch {
    try {
      resource = "ign_rge_alti_par_territoires";
      zs = await fetchElevations(points, resource);
      if (!isValid(zs)) return null;
    } catch {
      return null;
    }
  }

  const [zC, zN, zS, zE, zW] = zs;

  // Gradient (Δz/m) sur base 4m (2m de chaque côté)
  const dzdx = (zE - zW) / 4; // composante Est
  const dzdy = (zN - zS) / 4; // composante Nord

  // Inclinaison = arctan(‖∇z‖) en degrés
  const pitch = Math.round(Math.atan(Math.sqrt(dzdx ** 2 + dzdy ** 2)) * 180 / Math.PI);

  // Azimut de la pente descendante (0=N, 90=E, 180=S, 270=O)
  const azimut = Math.round(
    ((Math.atan2(-dzdx, -dzdy) * 180 / Math.PI) % 360 + 360) % 360
  );

  return {
    pitch:    Math.max(0, Math.min(75, pitch)),
    azimut,
    resource,
    elevCenter: Math.round(zC * 10) / 10,
  };
}
