import React, { useRef, useState, useEffect, useCallback } from "react";
import mapboxgl from "mapbox-gl";
import Map, { useMap } from "react-map-gl";
import MapboxDraw from "@mapbox/mapbox-gl-draw";
import "mapbox-gl/dist/mapbox-gl.css";
import "@mapbox/mapbox-gl-draw/dist/mapbox-gl-draw.css";
import { MapPin, Pencil, Trash2, RotateCcw, Layers, Plus, Flame } from "lucide-react";
import { Button } from "@/components/ui/button";
import * as turf from "@turf/turf";
import {
  geocode, geojsonArea, buildPanelGridRotated, detectPanOrientation,
  buildPanelsFromGoogleSolar, buildRoofGuideFeatures, isNorthFacingSegment,
  PAN_COLORS, getSolarCoefficient, getPanelColor, getBoundingBoxMeters,
  azimutToOrientation, snapToRings,
} from "./roofUtils";
import PanSummaryTable from "./PanSummaryTable";
import { analyzeRoofFromGPS } from "@/lib/ignRoofAnalysis";
import { fetchBuildingFromBDTOPO } from "@/lib/bdtopoBuilding";
import { fetchPVGISForPan } from "@/lib/pvgisApi";



const TOKEN = import.meta.env.VITE_MAPBOX_TOKEN;
const GOOGLE_SOLAR_KEY = import.meta.env.VITE_GOOGLE_SOLAR_KEY;

async function fetchGoogleSolarData(lat, lon) {
  try {
    // Clé VITE présente (dev) → appel direct ; sinon (prod Vercel) → proxy
    // serveur /api/solar qui porte GOOGLE_SOLAR_KEY, jamais exposée au client.
    const url = GOOGLE_SOLAR_KEY
      ? `https://solar.googleapis.com/v1/buildingInsights:findClosest?location.latitude=${lat}&location.longitude=${lon}&requiredQuality=HIGH&key=${GOOGLE_SOLAR_KEY}`
      : `/api/solar?lat=${lat}&lon=${lon}`;
    const r = await fetch(url);
    if (!r.ok) throw new Error(`Solar API ${r.status}`);
    const data = await r.json();
    return data;
  } catch (e) {
    console.warn("[Solar API] ❌", e.message);
    return null;
  }
}

const IGN_HR_TILES = [
  "https://data.geopf.fr/wmts?SERVICE=WMTS&REQUEST=GetTile&VERSION=1.0.0&LAYER=HR.ORTHOIMAGERY.ORTHOPHOTOS&STYLE=normal&FORMAT=image/jpeg&TILEMATRIXSET=PM&TILEMATRIX={z}&TILEROW={y}&TILECOL={x}"
];

const BASE_MAPSTYLE = {
  version: 8,
  sources: {
    "ign-sat": { type: "raster", tiles: IGN_HR_TILES, tileSize: 256, maxzoom: 19, attribution: "\u00a9 IGN G\u00e9oplateforme" }
  },
  layers: [{ id: "sat-layer", type: "raster", source: "ign-sat", minzoom: 0, maxzoom: 22 }],
  glyphs: "mapbox://fonts/mapbox/{fontstack}/{range}.pbf",
};

const LABELED_MAPSTYLE = {
  ...BASE_MAPSTYLE,
  sources: { ...BASE_MAPSTYLE.sources, "mapbox-labels": { type: "vector", url: "mapbox://mapbox.mapbox-streets-v8" } },
  layers: [
    ...BASE_MAPSTYLE.layers,
    { id: "road-label",  type: "symbol", source: "mapbox-labels", "source-layer": "road",        layout: { "text-field": ["get", "name"], "text-size": 11 }, paint: { "text-color": "#fff", "text-halo-color": "#000", "text-halo-width": 1   } },
    { id: "place-label", type: "symbol", source: "mapbox-labels", "source-layer": "place_label", layout: { "text-field": ["get", "name"], "text-size": 13 }, paint: { "text-color": "#fff", "text-halo-color": "#000", "text-halo-width": 1.5 } },
  ],
  sprite: "mapbox://sprites/mapbox/streets-v12",
};

const DIRS = [
  { label: "N",  az: 0   },
  { label: "NE", az: 45  },
  { label: "E",  az: 90  },
  { label: "SE", az: 135 },
  { label: "S",  az: 180 },
  { label: "SO", az: 225 },
  { label: "O",  az: 270 },
  { label: "NO", az: 315 },
];

function WindRose({ pan, onSelect, onClose }) {
  const closest = DIRS.reduce((a, b) =>
    Math.abs(((b.az - pan.azimut + 540) % 360) - 180) <
    Math.abs(((a.az - pan.azimut + 540) % 360) - 180) ? b : a
  );

  const R = 80; // rayon du cercle des directions (px)
  const SIZE = 220;
  const CENTER = SIZE / 2;

  return (
    <div
      className="absolute inset-0 z-40 flex items-center justify-center pointer-events-none"
    >
      <div
        className="pointer-events-auto relative flex flex-col items-center gap-2"
        style={{
          background: "rgba(0,0,0,0.82)",
          backdropFilter: "blur(12px)",
          border: "1px solid rgba(255,255,255,0.18)",
          borderRadius: 16,
          padding: "18px 18px 14px",
          boxShadow: "0 8px 32px rgba(0,0,0,0.6)",
          minWidth: SIZE + 36,
        }}
      >
        {/* En-tête */}
        <div className="flex items-center justify-between w-full mb-1">
          <span className="text-white/70 text-xs font-medium tracking-wide uppercase">
            Orientation du pan
          </span>
          <button
            onClick={onClose}
            className="text-white/50 hover:text-white text-base leading-none ml-4"
            style={{ lineHeight: 1 }}
          >
            ×
          </button>
        </div>

        {/* Disque */}
        <div
          style={{
            position: "relative",
            width: SIZE,
            height: SIZE,
          }}
        >
          {/* Cercle de fond */}
          <div
            style={{
              position: "absolute",
              inset: 0,
              borderRadius: "50%",
              border: "1px solid rgba(255,255,255,0.12)",
              background: "rgba(255,255,255,0.03)",
            }}
          />

          {/* Direction pré-sélectionnée au centre */}
          <div
            style={{
              position: "absolute",
              top: "50%",
              left: "50%",
              transform: "translate(-50%,-50%)",
              textAlign: "center",
              pointerEvents: "none",
            }}
          >
            <div className="text-primary font-bold" style={{ fontSize: 28, lineHeight: 1 }}>
              {closest.label}
            </div>
            <div className="text-white/40 text-xs mt-0.5">{pan.azimut}°</div>
          </div>

          {/* Boutons directionnels */}
          {DIRS.map((dir) => {
            const rad = (dir.az - 90) * (Math.PI / 180); // -90 pour commencer à 12h
            const x = CENTER + R * Math.cos(rad);
            const y = CENTER + R * Math.sin(rad);
            const isSelected = dir.label === closest.label;
            const btnSize = isSelected ? 46 : 36;

            return (
              <button
                key={dir.label}
                onClick={() => onSelect(dir)}
                style={{
                  position: "absolute",
                  left: x,
                  top: y,
                  transform: "translate(-50%,-50%)",
                  width: btnSize,
                  height: btnSize,
                  borderRadius: "50%",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontWeight: "bold",
                  fontSize: isSelected ? 14 : 11,
                  cursor: "pointer",
                  transition: "all 0.15s",
                  border: isSelected
                    ? "2px solid var(--color-primary, #f97316)"
                    : "1px solid rgba(255,255,255,0.25)",
                  background: isSelected
                    ? "rgba(249,115,22,0.25)"
                    : "rgba(255,255,255,0.08)",
                  color: isSelected ? "#f97316" : "rgba(255,255,255,0.75)",
                  boxShadow: isSelected
                    ? "0 0 0 3px rgba(249,115,22,0.18)"
                    : "none",
                  zIndex: isSelected ? 2 : 1,
                }}
              >
                {dir.label}
              </button>
            );
          })}
        </div>

        <p className="text-white/40 text-xs mt-1">
          Cliquez pour confirmer l'orientation
        </p>
      </div>
    </div>
  );
}

function makeDrawStyles(panIndex) {
  const c = PAN_COLORS[panIndex % PAN_COLORS.length];
  return [
    { id: "fill-i", type: "fill",   filter: ["all", ["==", "active", "false"], ["==", "$type", "Polygon"]],      paint: { "fill-color": c, "fill-opacity": 0.15 } },
    { id: "fill-a", type: "fill",   filter: ["all", ["==", "active", "true"],  ["==", "$type", "Polygon"]],      paint: { "fill-color": c, "fill-opacity": 0.25 } },
    { id: "line-i", type: "line",   filter: ["all", ["==", "active", "false"], ["==", "$type", "Polygon"]],      paint: { "line-color": c, "line-width": 2.5 } },
    { id: "line-a", type: "line",   filter: ["all", ["==", "active", "true"],  ["==", "$type", "Polygon"]],      paint: { "line-color": c, "line-width": 3, "line-dasharray": [2, 1] } },
    { id: "vtx",   type: "circle", filter: ["all", ["==", "$type", "Point"],  ["==", "meta", "vertex"]],         paint: { "circle-radius": 8, "circle-color": c, "circle-stroke-width": 2, "circle-stroke-color": "#fff" } },
    { id: "mid",   type: "circle", filter: ["all", ["==", "$type", "Point"],  ["==", "meta", "midpoint"]],       paint: { "circle-radius": 4, "circle-color": c } },
    { id: "la",    type: "line",   filter: ["all", ["==", "$type", "LineString"], ["==", "active", "true"]],     paint: { "line-color": c, "line-width": 2, "line-dasharray": [2, 1] } },
  ];
}

function buildSegmentPolygon(lat, lon, areaM2, azimuthDeg) {
  const aspect = 2.0;
  const hH = Math.sqrt(Math.max(areaM2, 1) / aspect) / 2;
  const hW = Math.sqrt(Math.max(areaM2, 1) * aspect) / 2;
  const latPerM = 1 / 111320;
  const lonPerM = 1 / (111320 * Math.cos(lat * Math.PI / 180));
  const az = azimuthDeg * Math.PI / 180;
  const ux = Math.sin(az), uy = Math.cos(az);
  const vx = Math.cos(az), vy = -Math.sin(az);
  const corners = [[-hW,-hH],[+hW,-hH],[+hW,+hH],[-hW,+hH]].map(([dv,du]) => [
    lon + (dv*vx + du*ux) * lonPerM,
    lat + (dv*vy + du*uy) * latPerM,
  ]);
  corners.push(corners[0]);
  return [corners];
}

// ── Mode MapboxDraw : snap BDTOPO + pans + prévisualisation chevauchements ─
function makeSnapPolygonMode(solarDataRef, snapMarkerRef, pansRef) {
  const base = MapboxDraw.modes.draw_polygon;
  let lastOverlapMs = 0;

  // Collecte rings pour le snap : BDTOPO footprint (contour bâtiment) + pans existants.
  // Les rectangles des panneaux individuels ne servent pas au snap (trop nombreux).
  function collectRings() {
    const rings = [];
    const bdRing = solarDataRef.current?.__bdtopo?.footprint?.[0];
    if (bdRing) rings.push(bdRing);
    for (const pan of (pansRef?.current ?? [])) {
      const r = pan.coords?.[0];
      if (r?.length >= 3) rings.push(r);
    }
    return rings;
  }

  function applySnap(e, map) {
    const snap = snapToRings({ lng: e.lngLat.lng, lat: e.lngLat.lat }, collectRings(), map);
    if (snap) e.lngLat = { lng: snap.lng, lat: snap.lat, toArray() { return [snap.lng, snap.lat]; } };
    const m = snapMarkerRef.current;
    if (m) {
      if (snap) { m.setLngLat([snap.lng, snap.lat]); m.getElement().style.display = 'block'; }
      else       { m.getElement().style.display = 'none'; }
    }
    return snap;
  }

  function updateOverlapPreview(state, map) {
    const now = Date.now();
    if (now - lastOverlapMs < 50) return; // throttle 20fps
    lastOverlapMs = now;
    const src = map.getSource('overlap-preview');
    if (!src) return;
    const ring = state.polygon.coordinates[0];
    if (ring.length < 4) { src.setData({ type: 'FeatureCollection', features: [] }); return; }
    try {
      const current = turf.polygon([ring]);
      const features = [];
      for (const pan of (pansRef?.current ?? [])) {
        if (!pan.coords?.[0]) continue;
        const inter = turf.intersect(turf.featureCollection([current, turf.polygon(pan.coords)]));
        if (inter) features.push(inter);
      }
      src.setData({ type: 'FeatureCollection', features });
    } catch { src.setData({ type: 'FeatureCollection', features: [] }); }
  }

  function clearOverlay(map) {
    map?.getSource?.('overlap-preview')?.setData({ type: 'FeatureCollection', features: [] });
    if (snapMarkerRef.current) snapMarkerRef.current.getElement().style.display = 'none';
  }

  return {
    ...base,
    onSetup(opts) { return base.onSetup.call(this, opts); },
    onMouseMove(state, e) {
      applySnap(e, this.map);
      base.onMouseMove.call(this, state, e);
      updateOverlapPreview(state, this.map);
    },
    onClick(state, e) {
      applySnap(e, this.map);
      base.onClick.call(this, state, e);
    },
    onTap(state, e) {
      applySnap(e, this.map);
      (base.onTap ?? base.onClick).call(this, state, e);
    },
    onStop(state) { clearOverlay(this.map); base.onStop?.call(this, state); },
    onTrash(state) { clearOverlay(this.map); base.onTrash?.call(this, state); },
  };
}

function MapController({
  address, panel, orientation, pans, setPans,
  isDrawing, setIsDrawing, currentPanIndex,
  coords, setCoords, loading, setLoading,
  pitch, setPitch, bearing, setBearing,
  showLabels, setShowLabels,
  onRoofAreaChange, onMaxPanelsChange, onCaptureReady,
  onRoofDimensionsChange, solarDataRef, onDataReady, onSolarReady,
  onFluxReady, onFluxError, showFlux, fluxLoading, setFluxLoading,
  setExcludedCount, onPlaceFromGrid,
  initialPans, initialExcludedPanelIds, onExcludedPanelsChange,
}) {
  const { current: map } = useMap();
  const drawRef = useRef(null);
  const panelsSrcReady = useRef(false);
  const markersRef = useRef([]);
  const labelMarkersRef = useRef([]);
  const snapMarkerRef = useRef(null);
  const fluxLoadedRef = useRef(false);
  const fluxBlobUrlRef = useRef(null);
  const excludedPanelsRef = useRef(new Set(initialExcludedPanelIds || [])); // ids "s{segIdx}-p{panelIdx}"
  // Garde sync avec la prop parent (hydratation async)
  useEffect(() => {
    excludedPanelsRef.current = new Set(initialExcludedPanelIds || []);
  }, [initialExcludedPanelIds]);
  const generatingRef = useRef(false);
  const [gridVersion, setGridVersion] = useState(0);
  const initializedRef = useRef(false);
  const pansRef = useRef([]);
  const geocodeTimerRef = useRef(null);
  const updateDebounceRef = useRef(null);
  useEffect(() => { pansRef.current = pans; }, [pans]);

  const createPanFromCoordsRef = useRef(null);
  createPanFromCoordsRef.current = async (polyCoords, drawId, forcedSeg = null, forcedSegIdx = null) => {
    const a       = forcedSeg ? Math.round(forcedSeg.stats?.areaMeters2 ?? geojsonArea(polyCoords)) : Math.round(geojsonArea(polyCoords));
    const panId   = `pan-${Date.now()}`;
    const detected = detectPanOrientation(polyCoords);
    const pts  = polyCoords[0];
    const cLat = pts.reduce((s, p) => s + p[1], 0) / pts.length;
    const cLon = pts.reduce((s, p) => s + p[0], 0) / pts.length;

    // ── Sources d'inclinaison + orientation, par priorité ──────────────────
    // 1. Google Solar API : pitch + azimut par face de toit (le plus précis)
    // 2. BDTOPO 3D        : pitch depuis coordonnées Z (fallback si Solar 404)
    // 3. IGN LiDAR        : pitch async (écrasera la valeur initiale à l'arrivée)
    // 4. Défaut           : 20° orientation conservée depuis detectPanOrientation
    let inclination = 20;
    let orientation = detected.orientation;
    let azimut      = detected.azimut;
    let solarShadingFactor = null;

    let bestSolarSeg = forcedSeg || null;
    if (!forcedSeg) {
      const solarSegsLocal = solarDataRef.current?.solarPotential?.roofSegmentStats;
      if (solarSegsLocal?.length > 0) {
        const valid = solarSegsLocal.filter(s => (s.stats?.areaMeters2 ?? 0) > 3 && s.pitchDegrees < 70);
        bestSolarSeg = (valid.length > 0 ? valid : solarSegsLocal).reduce((a, b) => {
          const diffA = Math.abs(((a.azimuthDegrees - detected.azimut + 540) % 360) - 180);
          const diffB = Math.abs(((b.azimuthDegrees - detected.azimut + 540) % 360) - 180);
          return diffB < diffA ? b : a;
        });
      }
    }
    if (bestSolarSeg) {
      inclination = Math.round(bestSolarSeg.pitchDegrees);
      azimut      = Math.round(bestSolarSeg.azimuthDegrees);
      orientation = azimutToOrientation(azimut);
      solarShadingFactor = bestSolarSeg.stats?.sunshineHoursPerYear
        ? Math.min(1, bestSolarSeg.stats.sunshineHoursPerYear / 8760) : null;
    } else {
      const bdtopoPitch = solarDataRef.current?.__bdtopo?.pitch;
      if (bdtopoPitch != null) inclination = bdtopoPitch;
    }

    // Calculer maxPanels dès la création (même formule que updatePanelsOnMap)
    const panelW = (panel?.width_mm  > 0 ? panel.width_mm  : 1134) / 1000;
    const panelH = (panel?.height_mm > 0 ? panel.height_mm : 1722) / 1000;
    if (!panel) console.warn("[pan] panel non défini — utilisation dimensions par défaut 1134×1722mm");

    // Formule unifiée : surface rampant / 1.94 × 0.80 (panneau 1.13×1.72, remplissage 80%)
    // `a` est la surface PROJETÉE au sol (turf.area du tracé) → surface réelle
    // du rampant = a / cos(inclinaison), sinon on sous-compte les panneaux.
    const PANEL_AREA_M2 = 1.94;
    const FILL_FACTOR   = 0.80;
    const inclCos = Math.cos((Math.max(0, Math.min(60, inclination ?? 30)) * Math.PI) / 180);
    const maxPanelsTraced = Math.floor((a / inclCos / PANEL_AREA_M2) * FILL_FACTOR);

    const solarAreaM2   = bestSolarSeg?.stats?.areaMeters2
      ? Math.round(bestSolarSeg.stats.areaMeters2)
      : null;
    const maxPanelsSolar = solarAreaM2
      ? Math.floor((solarAreaM2 / PANEL_AREA_M2) * FILL_FACTOR)
      : null;

    // Nombre de panneaux EXACT depuis Google Solar API si le segment y figure
    let maxPanelsGoogle = null;
    if (forcedSegIdx != null) {
      const sp = solarDataRef.current?.solarPotential?.solarPanels;
      if (sp?.length > 0) {
        maxPanelsGoogle = sp.filter(p => p.segmentIndex === forcedSegIdx).length || null;
      }
    }

    const maxPanels = maxPanelsGoogle ?? maxPanelsSolar ?? maxPanelsTraced;

    const hasSolarInclination = !!(forcedSeg || solarDataRef.current?.solarPotential?.roofSegmentStats?.length > 0);
    setPans(prev => [...prev, {
      id: panId, drawId, coords: polyCoords, area: a,
      solarAreaM2, maxPanelsTraced, maxPanelsSolar,
      maxPanels, orientation, azimut, inclination, index: prev.length,
      lidarLoading: true, pvgisLoading: true,
      inclinationSource: hasSolarInclination ? 'solar_api' : null,
      solarShadingFactor,
      shadingSource: solarShadingFactor != null ? 'solar_api' : null,
      solarSegmentIdx: forcedSegIdx,
    }]);
    if (!forcedSeg) setIsDrawing(false);

    // PVGIS par pan — fire and forget (orientation + inclinaison réelles)
    fetchPVGISForPan(cLat, cLon, azimut, inclination).then(pvgis => {
      setPans(prev => prev.map(p => p.id === panId
        ? {
            ...p,
            pvgisKwhPerKwc: pvgis?.annualKwhPerKwc ?? null,
            pvgisPR:        pvgis?.pr ?? 0.80,
            pvgisLoading:   false,
          }
        : p
      ));
    }).catch(() => {
      setPans(prev => prev.map(p => p.id === panId ? { ...p, pvgisLoading: false } : p));
    });

    if (!forcedSeg) {
      try {
        const lidarTimeout = new Promise((_, reject) =>
          setTimeout(() => reject(new Error("LiDAR timeout 10s")), 10000)
        );
        const lidar = await Promise.race([analyzeRoofFromGPS(cLat, cLon), lidarTimeout]);
        if (lidar) {
          // maxPanels = surface / 1.94 × 0.80 — indépendant du pitch LiDAR
          setPans(prev => prev.map(p => {
            if (p.id !== panId) return p;
            if (p.inclinationSource === 'solar_api') {
              return { ...p, lidarSource: lidar.resource, lidarLoading: false };
            }
            return { ...p, inclination: lidar.pitch, inclinationSource: 'lidar', lidarSource: lidar.resource, lidarLoading: false };
          }));
        } else {
          setPans(prev => prev.map(p => p.id === panId ? { ...p, lidarLoading: false } : p));
        }
      } catch (err) {
        console.warn("[lidar] échec:", err?.message || err);
        setPans(prev => prev.map(p => p.id === panId ? { ...p, lidarLoading: false } : p));
      }
    } else {
      setPans(prev => prev.map(p => p.id === panId ? { ...p, lidarLoading: false } : p));
    }
    return panId;
  };

  useEffect(() => {
    if (!map || initializedRef.current) return;
    const mbMap = map.getMap();
    if (!mbMap.isStyleLoaded()) mbMap.once("load", () => initDraw(mbMap));
    else initDraw(mbMap);
  }, [map]);

  function initDraw(mbMap) {
    if (initializedRef.current) return;
    initializedRef.current = true;

    // Marqueur magnétique pour le snap
    const snapEl = document.createElement("div");
    snapEl.style.cssText = "width:18px;height:18px;background:rgba(232,160,32,0.92);border:2.5px solid #fff;border-radius:50%;pointer-events:none;display:none;box-shadow:0 0 0 4px rgba(232,160,32,0.28),0 2px 6px rgba(0,0,0,0.5);";
    snapMarkerRef.current = new mapboxgl.Marker({ element: snapEl, anchor: "center" }).setLngLat([0,0]).addTo(mbMap);

    const draw = new MapboxDraw({
      displayControlsDefault: false, controls: {},
      styles: makeDrawStyles(0),
      modes: { ...MapboxDraw.modes, snap_polygon: makeSnapPolygonMode(solarDataRef, snapMarkerRef, pansRef) },
    });
    mbMap.addControl(draw);
    drawRef.current = draw;
    if (!mbMap.getSource("panels-multi")) {
      mbMap.addSource("panels-multi", { type: "geojson", data: { type: "FeatureCollection", features: [] } });
      mbMap.addLayer({ id: "panels-fill", type: "fill", source: "panels-multi", paint: { "fill-color": ["get", "fillColor"], "fill-opacity": 0.92 } });
      mbMap.addLayer({ id: "panels-line", type: "line", source: "panels-multi", paint: { "line-color": ["get", "lineColor"], "line-width": 1.2 } });
    }
    // La source "solar-flux" est créée à la volée au 1er chargement réussi
    // (voir useEffect showFlux). Pas de placeholder dégénéré qui empêchait
    // Mapbox de peindre correctement après updateImage.
    if (!mbMap.getSource("bdtopo-guide")) {
      mbMap.addSource("bdtopo-guide", {
        type: "geojson",
        data: { type: "FeatureCollection", features: [] },
        promoteId: "id", // nécessaire pour feature-state par panneau
      });
      mbMap.addLayer({
        id: "bdtopo-guide-fill", type: "fill", source: "bdtopo-guide",
        paint: {
          "fill-color": [
            "case",
            ["boolean", ["feature-state", "excluded"], false], "#555555",
            "#E8A020",
          ],
          "fill-opacity": ["case", ["==", ["get", "kind"], "solar-panel"], 0.60, 0.08],
        },
      });
      // Panneaux Solar API : ligne fine orange continue
      mbMap.addLayer({
        id: "bdtopo-guide-line-panel", type: "line", source: "bdtopo-guide",
        filter: ["==", ["get", "kind"], "solar-panel"],
        paint: { "line-color": "#E8A020", "line-width": 0.8 },
      });
      // Fallback BDTOPO : ligne épaisse orange pointillée
      mbMap.addLayer({
        id: "bdtopo-guide-line-outline", type: "line", source: "bdtopo-guide",
        filter: ["!=", ["get", "kind"], "solar-panel"],
        paint: { "line-color": "#E8A020", "line-width": 2.5, "line-dasharray": [4, 2] },
      });
    }
    if (!mbMap.getSource("overlap-preview")) {
      mbMap.addSource("overlap-preview", { type: "geojson", data: { type: "FeatureCollection", features: [] } });
      mbMap.addLayer({ id: "overlap-preview-fill", type: "fill", source: "overlap-preview", paint: { "fill-color": "#EF4444", "fill-opacity": 0.50 } });
      mbMap.addLayer({ id: "overlap-preview-line", type: "line", source: "overlap-preview", paint: { "line-color": "#EF4444", "line-width": 2 } });
    }
    panelsSrcReady.current = true;

    let isAutoClipping = false;
    mbMap.on("draw.create", async (e) => {
      if (isAutoClipping) return;
      if (snapMarkerRef.current) snapMarkerRef.current.getElement().style.display = 'none';
      mbMap.getSource('overlap-preview')?.setData({ type: 'FeatureCollection', features: [] });

      // ── Anti-chevauchement : découpe les zones qui overlappent un pan existant ──
      let newPoly = turf.polygon(e.features[0].geometry.coordinates);
      let wasClipped = false;
      for (const pan of pansRef.current) {
        if (!pan.coords?.[0]) continue;
        try {
          if (!turf.booleanIntersects(newPoly, turf.polygon(pan.coords))) continue;
          const diff = turf.difference(turf.featureCollection([newPoly, turf.polygon(pan.coords)]));
          if (diff) { newPoly = diff; wasClipped = true; }
        } catch { /* garde le polygone tel quel */ }
      }

      let finalCoords = newPoly.geometry.coordinates;
      if (newPoly.geometry.type === 'MultiPolygon') {
        // Garde le plus grand fragment
        const biggest = newPoly.geometry.coordinates.reduce((best, coords) => {
          try { const a = turf.area(turf.polygon(coords)); return a > best.area ? { area: a, coords } : best; }
          catch { return best; }
        }, { area: 0, coords: newPoly.geometry.coordinates[0] });
        finalCoords = biggest.coords;
      }

      const usedCoords = (() => {
        if (!wasClipped) return e.features[0].geometry.coordinates;
        isAutoClipping = true;
        draw.delete(e.features[0].id);
        const ids = draw.add({ type: 'Feature', geometry: { type: 'Polygon', coordinates: finalCoords }, properties: {} });
        isAutoClipping = false;
        return finalCoords;
      })();
      await createPanFromCoordsRef.current(usedCoords, wasClipped ? draw.getAll().features.at(-1)?.id : e.features[0].id);
    });

    mbMap.on("draw.update", (e) => {
      const feat = e.features[0];
      const polyCoords = feat.geometry.coordinates;
      const a = Math.round(geojsonArea(polyCoords));
      const detected = detectPanOrientation(polyCoords);
      setPans(prev => prev.map(p => p.drawId === feat.id
        ? { ...p, coords: polyCoords, area: a, orientation: detected.orientation, azimut: detected.azimut }
        : p
      ));
    });

    mbMap.on("draw.delete", (e) => {
      const ids = e.features.map(f => f.id);
      setPans(prev => prev.filter(p => !ids.includes(p.drawId)));
    });

    mbMap.on("rotate", () => setBearing(Math.round(mbMap.getBearing())));
    mbMap.on("pitch",  () => setPitch(Math.round(mbMap.getPitch())));
  }

  useEffect(() => {
    // Require: >10 chars AND a French postal code (5 consecutive digits)
    const addr = address?.trim() ?? "";
    const isValidAddress = addr.length > 10 && /\d{5}/.test(addr);

    if (geocodeTimerRef.current) clearTimeout(geocodeTimerRef.current);
    if (!map || !isValidAddress) return;

    geocodeTimerRef.current = setTimeout(async () => {
      const mbMap = map.getMap();
      setLoading(true);
      setPans([]);
      drawRef.current?.deleteAll();
      mbMap.getSource("bdtopo-guide")?.setData({ type: "FeatureCollection", features: [] });
      markersRef.current.forEach(m => m.remove());
      markersRef.current = [];

      const c = await geocode(addr);
      setLoading(false);
      if (!c) return;

      // Only accept coordinates within metropolitan France bounds
      const inFrance = c.lat >= 41 && c.lat <= 51.5 && c.lon >= -5.5 && c.lon <= 10;
      if (!inFrance) {
        console.warn("[geocode] Résultat hors France ignoré:", c);
        return;
      }

      setCoords(c);
      window.__smCoords = c;
      const el = document.createElement("div");
      el.style.cssText = "width:14px;height:14px;background:#E8A020;border-radius:50%;border:3px solid white;box-shadow:0 0 0 4px rgba(232,160,32,0.3)";
      const mk = new mapboxgl.Marker({ element: el }).setLngLat([c.lon, c.lat]).addTo(mbMap);
      markersRef.current.push(mk);
      mbMap.flyTo({ center: [c.lon, c.lat], zoom: 20, pitch: 0, bearing: 0, duration: 2000 });

      // Chargement silencieux Solar + IGN en arrière-plan
      const [solarResult, ignResult] = await Promise.allSettled([
        fetchGoogleSolarData(c.lat, c.lon),
        analyzeRoofFromGPS(c.lat, c.lon),
      ]);
      if (solarResult.status === "fulfilled" && solarResult.value?.solarPotential?.roofSegmentStats?.length > 0) {
        solarDataRef.current = { ...solarResult.value, ...solarDataRef.current && { __bdtopo: solarDataRef.current.__bdtopo, __ignRoof: solarDataRef.current.__ignRoof } };
        window.__smSolarSegments = solarResult.value.solarPotential.roofSegmentStats;
        onSolarReady?.(solarResult.value.solarPotential.roofSegmentStats);
      }
      if (ignResult.status === "fulfilled" && ignResult.value) {
        solarDataRef.current = solarDataRef.current ?? {};
        solarDataRef.current.__ignRoof = ignResult.value;
      }
      // Contour orange = rectangles orientés des segments Solar API (fallback BDTOPO)
      const mbMapRef = map?.getMap();
      const guideFeats = buildRoofGuideFeatures(solarDataRef.current, buildRotBySegIdx());
      if (guideFeats.length > 0) {
        mbMapRef?.getSource("bdtopo-guide")?.setData({ type: "FeatureCollection", features: guideFeats });
        // Ré-applique les exclusions persistées (features-state)
        for (const id of excludedPanelsRef.current) {
          mbMapRef?.setFeatureState({ source: "bdtopo-guide", id }, { excluded: true });
        }
      }

      // Hydratation des pans sauvegardés (si dossier chargé avec saved_pans)
      if (Array.isArray(initialPans) && initialPans.length > 0 && pansRef.current.length === 0) {
        const hydrated = initialPans.map((p, i) => {
          if (!p.coords?.[0]?.length) return null;
          // Re-crée la feature MapboxDraw (drawId neuf à chaque session)
          let drawId = null;
          try {
            const ids = drawRef.current?.add({
              type: 'Feature',
              geometry: { type: 'Polygon', coordinates: p.coords },
              properties: {},
            });
            drawId = ids?.[0];
          } catch {}
          return { ...p, drawId, index: p.index ?? i };
        }).filter(Boolean);
        if (hydrated.length > 0) setPans(hydrated);
      }

      onDataReady?.();
    }, 1500);

    return () => {
      if (geocodeTimerRef.current) clearTimeout(geocodeTimerRef.current);
    };
  }, [address, map]);

  const updatePanelsOnMap = useCallback(() => {
    if (!map || !panelsSrcReady.current || !panel) return;
    const mbMap = map.getMap();
    const src = mbMap.getSource("panels-multi");
    if (!src) return;
    labelMarkersRef.current.forEach(m => m.remove());
    labelMarkersRef.current = [];
    const allFeatures = [];
    const currentPans = pansRef.current;
    let totalMax = 0;

    const googleSolar = solarDataRef?.current?.solarPotential;
    const excludedPanelIds = excludedPanelsRef.current;
    let totalYearlyKwh = 0;

    currentPans.forEach(pan => {
      const coef   = getSolarCoefficient(pan.orientation, pan.inclination);
      const colors = getPanelColor(coef);
      const panelW = (panel.width_mm  > 0 ? panel.width_mm  : 1134) / 1000;
      const panelH = (panel.height_mm > 0 ? panel.height_mm : 1722) / 1000;
      const pts    = pan.coords[0] || [];
      const cLat   = pts.reduce((s, p) => s + p[1], 0) / (pts.length || 1);

      // ── Priorité : panneaux EXACTS de Google Solar API (buildingInsights.solarPanels) ──
      let grid, max;
      const hasGooglePanels = pan.solarSegmentIdx != null
        && googleSolar?.solarPanels?.length > 0;

      if (hasGooglePanels) {
        const gWm = googleSolar.panelWidthMeters  || 1.0;
        const gHm = googleSolar.panelHeightMeters || 1.65;
        const g = buildPanelsFromGoogleSolar(
          googleSolar.solarPanels, pan.solarSegmentIdx,
          (pan.azimut ?? 180) + (pan.rotationDelta ?? 0), gWm, gHm,
        );
        // Filtre : retire les panneaux exclus (ordre identique à buildRoofGuideFeatures)
        const keptPanels = [];
        for (let j = 0; j < g.panels.length; j++) {
          if (excludedPanelIds.has(`s${pan.solarSegmentIdx}-p${j}`)) continue;
          keptPanels.push(g.panels[j]);
          totalYearlyKwh += g.yearlyKwh[j] || 0;
        }
        grid = keptPanels;
        max  = keptPanels.length;
      } else {
        const g = buildPanelGridRotated(
          pan.coords, panelW, panelH, 9999, orientation,
          pan.azimut ?? 180, 0.20, 0.02,
          pan.inclination ?? 30, cLat || 46, pan.obstacles || [],
          pan.rotationDelta ?? 0,
        );
        grid = g.panels;
        max  = g.max;
      }
      totalMax += max;

      if (pts.length > 0) {
        const minLng = Math.min(...pts.map(p => p[0]));
        const maxLat = Math.max(...pts.map(p => p[1]));
        const el = document.createElement("div");
        el.style.cssText = `width:24px;height:24px;background:rgba(10,12,18,0.78);border:1.5px solid rgba(232,160,32,0.88);border-radius:50%;display:flex;align-items:center;justify-content:center;color:#E8A020;font-weight:bold;font-size:11px;font-family:sans-serif;pointer-events:none;box-shadow:0 1px 5px rgba(0,0,0,0.65);`;
        el.textContent = String(pan.index + 1);
        const mk = new mapboxgl.Marker({ element: el, anchor: "top-left" }).setLngLat([minLng, maxLat]).addTo(mbMap);
        labelMarkersRef.current.push(mk);
      }
      grid.forEach((c, i) => allFeatures.push({
        type: "Feature", id: `${pan.id}-${i}`,
        geometry: { type: "Polygon", coordinates: [c] },
        properties: { panId: pan.id, fillColor: colors.fill, lineColor: colors.line },
      }));
    });

    const totalArea = currentPans.reduce((s, p) => s + (p.area || 0), 0);
    window.__smTotalYearlyKwh = Math.round(totalYearlyKwh);
    setTimeout(() => {
      onMaxPanelsChange?.(totalMax);
      onRoofAreaChange?.(totalArea, Math.round(totalArea * 0.85));
      onPlaceFromGrid?.({ totalPanels: totalMax, totalYearlyKwh: Math.round(totalYearlyKwh) });
    }, 0);

    if (currentPans.length > 0 && onRoofDimensionsChange) {
      const mainPan = currentPans.reduce((a, b) => (a.area || 0) > (b.area || 0) ? a : b);
      const dims = getBoundingBoxMeters(mainPan.coords);
      onRoofDimensionsChange(Math.round(dims.width * 10) / 10, Math.round(dims.height * 10) / 10);
    }
    src.setData({ type: "FeatureCollection", features: allFeatures });
    window.__smPans = currentPans;
  }, [map, panel, orientation, onRoofDimensionsChange, onMaxPanelsChange, onRoofAreaChange]);

  useEffect(() => {
    if (updateDebounceRef.current) clearTimeout(updateDebounceRef.current);
    updateDebounceRef.current = setTimeout(() => updatePanelsOnMap(), 80);
  }, [pans, panel, orientation, gridVersion]);

  // Helper : construit { segIdx → rotationDelta } depuis les pans courants
  function buildRotBySegIdx() {
    const m = {};
    for (const pan of pansRef.current) {
      if (pan.solarSegmentIdx != null && pan.rotationDelta) {
        m[pan.solarSegmentIdx] = pan.rotationDelta;
      }
    }
    return m;
  }

  // Guide orange : re-feed avec rotation par segment + ré-applique les exclusions
  useEffect(() => {
    if (!map || !solarDataRef.current) return;
    const mbMap = map.getMap();
    const src = mbMap.getSource("bdtopo-guide");
    if (!src) return;
    const feats = buildRoofGuideFeatures(solarDataRef.current, buildRotBySegIdx());
    if (feats.length > 0) {
      src.setData({ type: "FeatureCollection", features: feats });
      for (const id of excludedPanelsRef.current) {
        mbMap.setFeatureState({ source: "bdtopo-guide", id }, { excluded: true });
      }
    }
  }, [map, pans, gridVersion]);
  useEffect(() => { if (drawRef.current) drawRef.current.options.styles = makeDrawStyles(currentPanIndex); }, [currentPanIndex]);

  // Reset exclusions au changement d'adresse
  useEffect(() => {
    fluxLoadedRef.current = false;
    excludedPanelsRef.current = new Set();
    if (fluxBlobUrlRef.current) {
      URL.revokeObjectURL(fluxBlobUrlRef.current);
      fluxBlobUrlRef.current = null;
    }
  }, [address]);

  // Toggle "Flux solaire" — source image créée à la volée au 1er chargement
  useEffect(() => {
    if (!map || !coords) return;
    const mbMap = map.getMap();
    const layerId = "solar-flux-layer";

    // Toggle visibilité si déjà chargé
    if (mbMap.getLayer(layerId)) {
      mbMap.setLayoutProperty(layerId, "visibility", showFlux ? "visible" : "none");
    }
    if (!showFlux || fluxLoadedRef.current) return;

    fluxLoadedRef.current = true;
    setFluxLoading?.(true);
    onFluxError?.(null);

    (async () => {
      try {
        console.log("[flux] fetch /api/solar-flux", coords);
        const r = await fetch("/api/solar-flux", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ lat: coords.lat, lon: coords.lon, radiusMeters: 50 }),
        });
        if (!r.ok) {
          let msg = `HTTP ${r.status}`;
          try {
            const b = await r.clone().json();
            if (b?.error) msg += " — " + b.error;
          } catch {
            try { msg += " — " + (await r.clone().text()).slice(0, 120); } catch {}
          }
          throw new Error(msg);
        }
        const boundsHdr = r.headers.get("X-Bounds");
        if (!boundsHdr) throw new Error("Headers X-Bounds manquant (response malformée)");
        const [swLat, swLon, neLat, neLon] = boundsHdr.split(",").map(Number);
        if (![swLat, swLon, neLat, neLon].every(Number.isFinite)) {
          throw new Error(`X-Bounds invalide: ${boundsHdr}`);
        }
        const blob = await r.blob();
        if (blob.size < 100) throw new Error(`Image vide (${blob.size} bytes)`);
        const url = URL.createObjectURL(blob);
        if (fluxBlobUrlRef.current) URL.revokeObjectURL(fluxBlobUrlRef.current);
        fluxBlobUrlRef.current = url;

        const coordsArr = [
          [swLon, neLat], [neLon, neLat],
          [neLon, swLat], [swLon, swLat],
        ];
        console.log("[flux] image reçue", { size: blob.size, bounds: { swLat, swLon, neLat, neLon } });

        // Création à la volée (pas de placeholder dégénéré)
        if (!mbMap.getSource("solar-flux")) {
          mbMap.addSource("solar-flux", { type: "image", url, coordinates: coordsArr });
          mbMap.addLayer({
            id: layerId, type: "raster", source: "solar-flux",
            paint: { "raster-opacity": 0.65, "raster-fade-duration": 0 },
          });
        } else {
          mbMap.getSource("solar-flux").updateImage({ url, coordinates: coordsArr });
          mbMap.setLayoutProperty(layerId, "visibility", "visible");
        }
        onFluxReady?.();
      } catch (e) {
        console.error("[solar-flux]", e.message);
        onFluxError?.(e.message);
        fluxLoadedRef.current = false;
      } finally {
        setFluxLoading?.(false);
      }
    })();
  }, [map, coords, showFlux]);

  // Click sur un panneau guide → toggle exclusion individuelle
  useEffect(() => {
    if (!map) return;
    const mbMap = map.getMap();
    const onClick = (e) => {
      const feats = mbMap.queryRenderedFeatures(e.point, { layers: ["bdtopo-guide-fill"] });
      if (!feats?.length) return;
      // Ne réagit qu'aux panneaux Solar (pas au footprint BDTOPO)
      const f = feats.find(x => x.properties?.kind === "solar-panel");
      if (!f) return;
      const id = f.properties.id;
      if (!id) return;
      const excluded = excludedPanelsRef.current.has(id);
      if (excluded) excludedPanelsRef.current.delete(id);
      else          excludedPanelsRef.current.add(id);
      mbMap.setFeatureState({ source: "bdtopo-guide", id }, { excluded: !excluded });
      setExcludedCount?.(excludedPanelsRef.current.size);
      onExcludedPanelsChange?.([...excludedPanelsRef.current]); // persist
      setGridVersion(v => v + 1);
    };
    mbMap.on("click", "bdtopo-guide-fill", onClick);
    // Curseur pointer sur les panneaux
    const onEnter = () => { mbMap.getCanvas().style.cursor = "pointer"; };
    const onLeave = () => { mbMap.getCanvas().style.cursor = ""; };
    mbMap.on("mouseenter", "bdtopo-guide-fill", onEnter);
    mbMap.on("mouseleave", "bdtopo-guide-fill", onLeave);
    return () => {
      mbMap.off("click",      "bdtopo-guide-fill", onClick);
      mbMap.off("mouseenter", "bdtopo-guide-fill", onEnter);
      mbMap.off("mouseleave", "bdtopo-guide-fill", onLeave);
    };
  }, [map]);

  useEffect(() => {
    if (!map) return;
    const mbMap = map.getMap();
    window.__smActions = {
      updatePansOrientation: () => {
        const segs = window.__smSolarSegments;
        if (!segs) return;
        setPans(prev => prev.map((pan, idx) => {
          const seg = segs[idx] || segs[0];
          if (!seg) return pan;
          return { ...pan, inclination: Math.round(seg.pitchDegrees || 30) };
        }));
      },
      autoTrace: async () => {
        // 1. Contour orange : rectangles Solar API (ou footprint BDTOPO en fallback)
        const feats = buildRoofGuideFeatures(solarDataRef.current, buildRotBySegIdx());
        if (feats.length === 0) return;
        mbMap.getSource("bdtopo-guide")?.setData({ type: "FeatureCollection", features: feats });
        // 2. Vue top-down Nord en haut
        mbMap.easeTo({ pitch: 0, bearing: 0, duration: 400 });
        setPitch(0); setBearing(0);
        // 3. Activer le tracé manuel avec snap
        await new Promise(r => setTimeout(r, 450));
        drawRef.current?.changeMode("snap_polygon");
        setIsDrawing(true);
      },
      startDraw: async () => {
        // Contour orange : rectangles Solar API (ou BDTOPO en fallback)
        const feats = buildRoofGuideFeatures(solarDataRef.current, buildRotBySegIdx());
        const hasGuide = feats.length > 0;
        if (hasGuide) {
          mbMap.getSource("bdtopo-guide")?.setData({ type: "FeatureCollection", features: feats });
          // Zoom sur l'ensemble des rectangles
          try {
            const allCoords = feats.flatMap(f => f.geometry.coordinates[0]);
            const bbox = [
              Math.min(...allCoords.map(c => c[0])),
              Math.min(...allCoords.map(c => c[1])),
              Math.max(...allCoords.map(c => c[0])),
              Math.max(...allCoords.map(c => c[1])),
            ];
            mbMap.fitBounds(bbox, { padding: 80, pitch: 0, bearing: 0, duration: 600, maxZoom: 21 });
          } catch {
            mbMap.easeTo({ pitch: 0, bearing: 0, duration: 400 });
          }
        } else {
          mbMap.easeTo({ pitch: 0, bearing: 0, duration: 400 });
        }
        setPitch(0); setBearing(0);
        await new Promise(r => setTimeout(r, 650));
        drawRef.current?.changeMode(hasGuide ? "snap_polygon" : "draw_polygon");
        setIsDrawing(true);
      },
      cancelDraw: () => {
        drawRef.current?.changeMode("simple_select");
        setIsDrawing(false);
        if (snapMarkerRef.current) snapMarkerRef.current.getElement().style.display = 'none';
      },
      clearAll: () => {
        drawRef.current?.deleteAll();
        drawRef.current?.changeMode("simple_select");
        setIsDrawing(false); setPans([]);
        labelMarkersRef.current.forEach(m => m.remove());
        labelMarkersRef.current = [];
        mbMap.getSource("panels-multi")?.setData({ type: "FeatureCollection", features: [] });
        mbMap.getSource("bdtopo-guide")?.setData({ type: "FeatureCollection", features: [] });
        onRoofAreaChange?.(0, 0); onMaxPanelsChange?.(0);
      },
      deletePan: (panId) => {
        setPans(prev => {
          const pan = prev.find(p => p.id === panId);
          if (pan?.drawId) drawRef.current?.delete(pan.drawId);
          return prev.filter(p => p.id !== panId);
        });
      },
      addSolarPan: async (seg, segIdx) => {
        // Priorité : centroïde BDTOPO (données locales précises) > seg.center (Solar API) > adresse géocodée
        let lat, lon;
        const bdFootprint = solarDataRef.current?.__bdtopo?.footprint;
        if (bdFootprint?.[0]?.length >= 3) {
          const ring = bdFootprint[0];
          lon = ring.reduce((s, c) => s + c[0], 0) / ring.length;
          lat = ring.reduce((s, c) => s + c[1], 0) / ring.length;
        } else {
          lat = seg.center?.latitude  ?? window.__smCoords?.lat;
          lon = seg.center?.longitude ?? window.__smCoords?.lon;
        }
        if (!lat || !lon) return;
        const polyCoords = buildSegmentPolygon(lat, lon, seg.stats?.areaMeters2 ?? 25, seg.azimuthDegrees ?? 180);
        const ids = drawRef.current?.add({
          type: 'Feature', geometry: { type: 'Polygon', coordinates: polyCoords }, properties: {}
        });
        const drawId = ids?.[0];
        await createPanFromCoordsRef.current(polyCoords, drawId, seg, segIdx);
      },
      removeSolarPan: (segIdx) => {
        setPans(prev => {
          const pan = prev.find(p => p.solarSegmentIdx === segIdx);
          if (pan?.drawId) drawRef.current?.delete(pan.drawId);
          return prev.filter(p => p.solarSegmentIdx !== segIdx);
        });
      },
      // Génère un pan par segment Solar API non-Nord — idempotent.
      // Supprime d'abord les pans Solar déjà placés pour éviter les doublons.
      generatePanels: async () => {
        if (generatingRef.current) return; // anti double-clic
        const segs = solarDataRef.current?.solarPotential?.roofSegmentStats;
        if (!segs?.length) return;
        generatingRef.current = true;
        try {
          // 1. Clear des pans Solar existants (évite l'empilement)
          setPans(prev => {
            for (const p of prev) {
              if (p.solarSegmentIdx != null && p.drawId) drawRef.current?.delete(p.drawId);
            }
            return prev.filter(p => p.solarSegmentIdx == null);
          });
          // 2. Laisser React flusher le setPans avant d'ajouter
          await new Promise(r => setTimeout(r, 50));
          // 3. Ajout séquentiel (createPanFromCoordsRef est async et stateful)
          for (let i = 0; i < segs.length; i++) {
            const seg = segs[i];
            if (isNorthFacingSegment(seg)) continue;
            await window.__smActions?.addSolarPan?.(seg, i);
          }
          setGridVersion(v => v + 1);
        } finally {
          generatingRef.current = false;
        }
      },
      resetView:     (c) => { if (c) mbMap.flyTo({ center: [c.lon, c.lat], zoom: 20, pitch: 0, bearing: 0, duration: 800 }); },
      changePitch:   (p) => mbMap.easeTo({ pitch: p, duration: 500 }),
      changeBearing: (b) => mbMap.easeTo({ bearing: b, duration: 400 }),
      getBounds: () => {
        const b = mbMap.getBounds();
        return { west: b.getWest(), east: b.getEast(), north: b.getNorth(), south: b.getSouth() };
      },
      clearAllPans: () => {
        drawRef.current?.deleteAll();
        setPans([]);
        mbMap.getSource('panels-multi')?.setData({ type: 'FeatureCollection', features: [] });
      },
      prepareCapture: () => new Promise(resolve => {
        const c = window.__smCoords;
        mbMap.flyTo({ center: c ? [c.lon, c.lat] : mbMap.getCenter(), zoom: 20, pitch: 0, bearing: 0, duration: 1500 });
        const capture = () => {
          mbMap.once('render', () => resolve(mbMap.getCanvas().toDataURL('image/png')));
          mbMap.triggerRepaint();
        };
        const timeout = setTimeout(capture, 5000);
        mbMap.once('idle', () => { clearTimeout(timeout); setTimeout(capture, 300); });
      }),
      capture: () => {
        try { onCaptureReady?.(mbMap.getCanvas().toDataURL("image/png")); }
        catch(e) { console.error("Capture:", e); }
      },
      toggleLabels: (show) => {
        mbMap.setStyle(show ? LABELED_MAPSTYLE : BASE_MAPSTYLE);
        mbMap.once("style.load", () => {
          if (!mbMap.getSource("panels-multi")) {
            mbMap.addSource("panels-multi", { type: "geojson", data: { type: "FeatureCollection", features: [] } });
            mbMap.addLayer({ id: "panels-fill", type: "fill", source: "panels-multi", paint: { "fill-color": ["get", "fillColor"], "fill-opacity": 0.92 } });
            mbMap.addLayer({ id: "panels-line", type: "line", source: "panels-multi", paint: { "line-color": ["get", "lineColor"], "line-width": 1.2 } });
          }
          panelsSrcReady.current = true;
          updatePanelsOnMap?.();
        });
        setShowLabels(show);
      },
    };
    return () => { delete window.__smActions; };
  }, [map, updatePanelsOnMap, onRoofAreaChange, onMaxPanelsChange, onCaptureReady]);

  return null;
}

export default function SatelliteMap({
  address, panelCount = 0, panel = null, orientation = "portrait",
  onRoofAreaChange, onMaxPanelsChange, onCaptureReady, onRoofDimensionsChange, settings, pvgisData,
  // Persistance : hydratation + callbacks vers le parent
  initialPans, initialExcludedPanelIds, onExcludedPanelsChange,
}) {
  const [ready,      setReady]      = useState(false);
  const [isDrawing,  setIsDrawing]  = useState(false);
  const [pans,       setPans]       = useState([]);
  const [coords,     setCoords]     = useState(null);
  const [pitch,      setPitch]      = useState(0);
  const [bearing,    setBearing]    = useState(0);
  const [showLabels, setShowLabels] = useState(false);
  const [loading,    setLoading]    = useState(false);
  const [dataReady,      setDataReady]      = useState(false);
  const [solarReady,     setSolarReady]     = useState(false);
  const [solarSegments,  setSolarSegments]  = useState([]);
  const [showSolarSegs,  setShowSolarSegs]  = useState(false);
  const [bdtopoBuilding, setBdtopoBuilding] = useState(null);
  const [roseForPan,      setRoseForPan]      = useState(null);
  const [selectedSolarSegs, setSelectedSolarSegs] = useState(new Set());
  const [fluxReady,   setFluxReady]   = useState(false);
  const [showFlux,    setShowFlux]    = useState(false);
  const [fluxLoading, setFluxLoading] = useState(false);
  const [fluxError,   setFluxError]   = useState(null);
  const [excludedCount, setExcludedCount] = useState(0);
  const [placementStats, setPlacementStats] = useState({ totalPanels: 0, totalYearlyKwh: 0 });
  const solarDataRef = useRef(null);
  const prevPansRef  = useRef([]);

  // Réinitialiser quand l'adresse change
  useEffect(() => {
    setDataReady(false);
    setSolarReady(false);
    setSolarSegments([]);
    setShowSolarSegs(false);
    setBdtopoBuilding(null);
    solarDataRef.current = null;
    setSelectedSolarSegs(new Set());
    setFluxReady(false);
    setShowFlux(false);
    setFluxLoading(false);
    setFluxError(null);
    setExcludedCount(0);
    setPlacementStats({ totalPanels: 0, totalYearlyKwh: 0 });
  }, [address]);

  useEffect(() => {
    if (!coords) return;
    fetchBuildingFromBDTOPO(coords.lat, coords.lon)
      .then(result => {
        solarDataRef.current = solarDataRef.current ?? {};
        solarDataRef.current.__bdtopo = result;
        setBdtopoBuilding(result);
      })
      .catch(err => {
        console.error("[SatelliteMap] BDTOPO erreur:", err);
        setBdtopoBuilding(null);
      });
  }, [coords]);

  const [totalPanels, setTotalPanels] = useState(0);
  const handleMaxPanelsChange = useCallback((n) => {
    setTotalPanels(n);
    onMaxPanelsChange?.(n);
  }, [onMaxPanelsChange]);

  const currentPanIndex = pans.length;
  const totalArea = pans.reduce((s, p) => s + (p.area || 0), 0);
  const act = (fn, ...args) => window.__smActions?.[fn]?.(...args);
  const handleUpdatePan = (panId, updates) => setPans(prev => prev.map(p => p.id === panId ? { ...p, ...updates } : p));
  const handleDeletePan = (panId) => act("deletePan", panId);

  // Ouvrir la rose des vents quand lidarLoading passe à false sur un pan
  useEffect(() => {
    const prev = prevPansRef.current;
    pans.forEach(pan => {
      const wasLoading = prev.find(p => p.id === pan.id)?.lidarLoading;
      if (wasLoading === true && pan.lidarLoading === false) {
        setRoseForPan(pan.id);
      }
    });
    prevPansRef.current = pans;
  }, [pans]);

  if (!address || address.trim().length < 5) {
    return (
      <div className="w-full h-[520px] rounded-xl bg-secondary/30 border border-border flex flex-col items-center justify-center gap-3">
        <MapPin className="w-10 h-10 text-muted-foreground" />
        <p className="text-muted-foreground text-sm text-center">Saisissez une adresse pour<br />afficher la vue satellite</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Toolbar — glass pour un rendu premium */}
      <div className="glass rounded-xl p-2 flex items-center gap-2 flex-wrap">
        {isDrawing ? (
          <Button size="sm" onClick={() => act("cancelDraw")} className="bg-amber-500 hover:bg-amber-600 text-black font-semibold">
            <Pencil className="w-4 h-4 mr-1" /> Annuler
          </Button>
        ) : (
          <Button size="sm" variant="outline" onClick={() => act("startDraw")}
            style={{ borderColor: PAN_COLORS[currentPanIndex % PAN_COLORS.length] + "80" }}>
            <Plus className="w-4 h-4 mr-1" />
            <span style={{ color: PAN_COLORS[currentPanIndex % PAN_COLORS.length] }}>Tracer Pan {currentPanIndex + 1}</span>
          </Button>
        )}
        {pans.length > 0 && !isDrawing && (
          <Button size="sm" variant="outline" onClick={() => act("clearAll")} className="text-destructive border-destructive/30">
            <Trash2 className="w-4 h-4 mr-1" /> Tout effacer
          </Button>
        )}
        {coords && <Button size="sm" variant="outline" onClick={() => act("resetView", coords)} title="Recentrer"><RotateCcw className="w-4 h-4" /></Button>}
        <Button size="sm" variant="outline" onClick={() => act("toggleLabels", !showLabels)}>
          <Layers className="w-4 h-4 mr-1" />{showLabels ? "Sans labels" : "+ Labels rues"}
        </Button>
        {solarReady && (
          <button
            onClick={() => setShowSolarSegs(v => !v)}
            className="text-xs px-2.5 py-1 rounded-full bg-yellow-500/15 border border-yellow-500/30 text-yellow-300 font-medium hover:bg-yellow-500/25 transition-colors"
            title="Afficher les segments de toit Google Solar API"
          >
            ☀️ Solar API actif {showSolarSegs ? "▲" : "▼"}
          </button>
        )}
        {solarReady && (
          <>
            <Button size="sm" variant="outline"
              onClick={() => act("generatePanels")}
              className="border-emerald-500/50 text-emerald-400 hover:bg-emerald-500/15"
              title="Crée (ou recrée) les pans pour tous les segments non-Nord — les panneaux exclus sont ignorés"
            >
              <Plus className="w-4 h-4 mr-1" />
              {pans.some(p => p.solarSegmentIdx != null) ? "Régénérer les panneaux" : "Générer les panneaux"}
            </Button>
            <Button size="sm" variant="outline"
              onClick={() => setShowFlux(v => !v)}
              disabled={fluxLoading && !fluxReady}
              className={showFlux
                ? "border-orange-500/50 text-orange-400 bg-orange-500/10 hover:bg-orange-500/20"
                : "border-orange-500/30 text-orange-300/80 hover:bg-orange-500/10"}
              title="Superpose la heatmap d'ensoleillement annuel (Google Solar API)"
            >
              <Flame className="w-4 h-4 mr-1" />
              {fluxLoading && !fluxReady ? "Chargement flux…" : (showFlux ? "Flux solaire ●" : "Flux solaire")}
            </Button>
            {excludedCount > 0 && (
              <span className="text-xs px-2.5 py-1 rounded-full bg-gray-500/10 border border-gray-500/30 text-gray-300">
                {excludedCount} panneau{excludedCount > 1 ? "x exclus" : " exclu"}
              </span>
            )}
            {fluxError && (
              <span className="text-xs px-2.5 py-1 rounded-full bg-red-500/15 border border-red-500/30 text-red-300 max-w-xs truncate" title={fluxError}>
                ⚠️ Flux : {fluxError}
              </span>
            )}
            {placementStats.totalPanels > 0 && (
              <span className="text-xs px-2.5 py-1 rounded-full bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 font-mono">
                {placementStats.totalPanels} panneaux · {Math.round(placementStats.totalPanels * (panel?.power_wc || 410) / 10) / 100} kWc · {placementStats.totalYearlyKwh} kWh/an
              </span>
            )}
          </>
        )}
        {!solarReady && bdtopoBuilding && (
          <span className="text-xs px-2.5 py-1 rounded-full bg-sky-500/15 border border-sky-500/30 text-sky-300 font-medium" title="BDTOPO IGN — inclinaison depuis coordonnées 3D">
            &#127759; BDTOPO actif
          </span>
        )}
        {dataReady && !solarReady && !bdtopoBuilding && (
          <span className="text-xs px-2.5 py-1 rounded-full bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 font-medium">
            &#128225; Donn&#233;es charg&#233;es
          </span>
        )}
        {totalArea > 0 && (
          <div className="ml-auto flex items-center gap-3 text-xs text-muted-foreground">
            <span>{pans.length} pan{pans.length > 1 ? "s" : ""}</span>
            <span>Surface&#160;: <strong className="text-foreground">{totalArea}&#160;m&#178;</strong></span>
            <span>Max&#160;: <strong className="text-primary">{totalPanels}&#160;pan.</strong></span>
          </div>
        )}
      </div>

      {/* Contr&#244;les vue */}
      <div className="flex items-center gap-3 flex-wrap text-xs">
        <div className="flex items-center gap-1.5">
          <span className="text-muted-foreground">Vue&#160;:</span>
          {[0, 30, 45, 60].map(p => (
            <button key={p} onClick={() => act("changePitch", p)}
              className={`px-2 py-1 rounded border transition-all ${Math.abs(pitch-p)<5?"border-primary text-primary bg-primary/10":"border-border text-muted-foreground bg-secondary/30 hover:border-primary/50"}`}>
              {p}&#176;
            </button>
          ))}
        </div>
        <div className="flex items-center gap-1.5">
          <span className="text-muted-foreground">Rotation&#160;:</span>
          {[0, 90, 180, 270].map(b => (
            <button key={b} onClick={() => act("changeBearing", b)}
              className={`px-2 py-1 rounded border transition-all ${Math.abs(bearing-b)<5?"border-primary text-primary bg-primary/10":"border-border text-muted-foreground bg-secondary/30 hover:border-primary/50"}`}>
              {b}&#176;
            </button>
          ))}
        </div>
        <span className="text-muted-foreground hidden sm:inline">&#128432; Clic droit + glisser = rotation libre</span>
      </div>


      {/* Instruction trac&#233; */}
      {isDrawing && (
        <div className="bg-amber-500/10 border border-amber-500/30 rounded-lg px-4 py-2 text-xs text-amber-400 flex items-center gap-2">
          <Pencil className="w-3 h-3 flex-shrink-0" />
          Vue &#224; plat &#8212; Tracez le <strong className="ml-1">Pan {currentPanIndex + 1}</strong> en cliquant chaque angle. <strong>Double-cliquez</strong> pour terminer.
        </div>
      )}

      {/* Badges pans */}
      {pans.length > 0 && !isDrawing && (
        <div className="flex items-center gap-2 flex-wrap">
          {pans.map((pan, idx) => (
            <div key={pan.id} className="flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full border"
              style={{ borderColor: PAN_COLORS[idx%PAN_COLORS.length]+"60", background: PAN_COLORS[idx%PAN_COLORS.length]+"15" }}>
              <div className="w-2 h-2 rounded-full" style={{ background: PAN_COLORS[idx%PAN_COLORS.length] }} />
              <span style={{ color: PAN_COLORS[idx%PAN_COLORS.length] }} className="font-semibold">Pan {idx+1}</span>
              <span className="text-muted-foreground">{pan.area}&#160;m&#178;</span>
              <button onClick={() => handleDeletePan(pan.id)} className="text-muted-foreground hover:text-destructive ml-1">&#10005;</button>
            </div>
          ))}
        </div>
      )}

      {/* ── Segments Solar API ── */}
      {solarSegments.length > 0 && (
        <div className="rounded-lg border border-yellow-500/30 bg-yellow-500/5 overflow-hidden">
          <div className="flex items-center justify-between px-3 py-2">
            <button
              className="flex items-center gap-2 text-xs font-semibold text-yellow-300 hover:text-yellow-200"
              onClick={() => setShowSolarSegs(v => !v)}
            >
              ☀️ Solar API — {solarSegments.length} segments · {selectedSolarSegs.size} sélectionné(s)
              <span>{showSolarSegs ? "▲" : "▼"}</span>
            </button>
            {showSolarSegs && (
              <div className="flex gap-2">
                <button
                  className="text-[10px] px-2 py-1 rounded border border-yellow-500/40 text-yellow-300 hover:bg-yellow-500/20"
                  onClick={() => {
                    // Exclure les pans orientés Nord — inutilisables en solaire
                    const newSel = new Set();
                    solarSegments.forEach((seg, i) => {
                      if (isNorthFacingSegment(seg)) return;
                      newSel.add(i);
                      if (!selectedSolarSegs.has(i)) window.__smActions?.addSolarPan(seg, i);
                    });
                    setSelectedSolarSegs(newSel);
                  }}
                >Tout sélectionner</button>
                <button
                  className="text-[10px] px-2 py-1 rounded border border-border text-muted-foreground hover:bg-secondary/50"
                  onClick={() => {
                    solarSegments.forEach((_, i) => window.__smActions?.removeSolarPan(i));
                    setSelectedSolarSegs(new Set());
                  }}
                >Désélectionner</button>
              </div>
            )}
          </div>
          {showSolarSegs && (
            <div className="overflow-x-auto border-t border-yellow-500/20">
              <table className="w-full text-xs">
                <thead>
                  <tr className="bg-yellow-500/10 text-muted-foreground">
                    <th className="px-2 py-1.5 w-8"></th>
                    {["#", "Orientation", "Incl.", "Surface réelle", "Ensoleillement", "Max pan."].map(h => (
                      <th key={h} className="px-3 py-1.5 text-left font-medium whitespace-nowrap">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {[...solarSegments]
                    .map((seg, i) => ({ seg, i }))
                    .sort((a, b) => (b.seg.stats?.areaMeters2 ?? 0) - (a.seg.stats?.areaMeters2 ?? 0))
                    .map(({ seg, i }) => {
                      const az   = Math.round(seg.azimuthDegrees ?? 0);
                      const inc  = Math.round(seg.pitchDegrees ?? 0);
                      const area = Math.round(seg.stats?.areaMeters2 ?? 0);
                      const sun  = Math.round(seg.stats?.sunshineHoursPerYear ?? 0);
                      const googlePanelsForSeg = solarDataRef?.current?.solarPotential?.solarPanels
                        ?.filter(p => p.segmentIndex === i).length ?? null;
                      const maxP  = googlePanelsForSeg ?? (area > 0 ? Math.floor((area / 1.94) * 0.80) : 0);
                      const ori   = azimutToOrientation(az);
                      const isSel = selectedSolarSegs.has(i);
                      const isNorth = isNorthFacingSegment(seg);
                      return (
                        <tr
                          key={i}
                          className={`border-t border-yellow-500/10 transition-colors ${
                            isNorth ? 'opacity-40 cursor-not-allowed'
                            : isSel ? 'bg-yellow-500/20 cursor-pointer'
                            : 'hover:bg-yellow-500/5 cursor-pointer'
                          }`}
                          onClick={() => {
                            if (isNorth) return; // pan Nord — non exploitable
                            if (isSel) {
                              window.__smActions?.removeSolarPan(i);
                              setSelectedSolarSegs(prev => { const s = new Set(prev); s.delete(i); return s; });
                            } else {
                              window.__smActions?.addSolarPan(seg, i);
                              setSelectedSolarSegs(prev => new Set([...prev, i]));
                            }
                          }}
                          title={isNorth ? "Pan orienté Nord — non exploitable en solaire" : undefined}
                        >
                          <td className="px-2 py-1.5 text-center">
                            <input type="checkbox" readOnly checked={isSel} disabled={isNorth} className="w-3 h-3 accent-yellow-400 cursor-pointer" />
                          </td>
                          <td className="px-3 py-1.5 text-yellow-400 font-semibold">{i + 1}</td>
                          <td className="px-3 py-1.5 text-foreground">
                            {ori} <span className="text-muted-foreground">{az}°</span>
                            {isNorth && <span className="ml-1 text-[10px] text-red-400">⛔ Nord</span>}
                          </td>
                          <td className="px-3 py-1.5 text-foreground">{inc}°</td>
                          <td className="px-3 py-1.5 font-semibold text-yellow-300">{area} m²</td>
                          <td className="px-3 py-1.5 text-foreground">{sun > 0 ? `${sun} h/an` : "—"}</td>
                          <td className="px-3 py-1.5 text-primary font-semibold">{maxP > 0 && !isNorth ? maxP : "—"}</td>
                        </tr>
                      );
                    })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Carte */}
      <div className="relative w-full rounded-xl overflow-hidden border border-border" style={{ height: 540 }}>
        {(!ready || loading) && (
          <div className="absolute inset-0 z-30 bg-card flex flex-col items-center justify-center gap-3">
            <div className="w-10 h-10 border-4 border-primary/20 border-t-primary rounded-full animate-spin" />
            <p className="text-muted-foreground text-sm">{loading ? "Localisation en cours…" : "Chargement de la carte…"}</p>
          </div>
        )}
        <Map id="satelliteMap" mapboxAccessToken={TOKEN}
          initialViewState={{ longitude: 2.3, latitude: 46.8, zoom: 5, pitch: 0, bearing: 0 }}
          style={{ width: "100%", height: "100%" }} mapStyle={BASE_MAPSTYLE} maxZoom={22}
          preserveDrawingBuffer={true}
          onLoad={() => setReady(true)}>
          <MapController
            address={address} panel={panel} orientation={orientation}
            pans={pans} setPans={setPans} isDrawing={isDrawing} setIsDrawing={setIsDrawing}
            currentPanIndex={currentPanIndex} coords={coords} setCoords={setCoords}
            loading={loading} setLoading={setLoading} pitch={pitch} setPitch={setPitch}
            bearing={bearing} setBearing={setBearing} showLabels={showLabels} setShowLabels={setShowLabels}
            onRoofAreaChange={onRoofAreaChange} onMaxPanelsChange={handleMaxPanelsChange}
            onCaptureReady={onCaptureReady} onRoofDimensionsChange={onRoofDimensionsChange}
            solarDataRef={solarDataRef} onDataReady={() => setDataReady(true)}
            onSolarReady={(segs) => { setSolarReady(true); setSolarSegments(segs || []); }}
            onFluxReady={() => setFluxReady(true)}
            onFluxError={setFluxError}
            showFlux={showFlux} fluxLoading={fluxLoading} setFluxLoading={setFluxLoading}
            setExcludedCount={setExcludedCount}
            onPlaceFromGrid={setPlacementStats}
            initialPans={initialPans}
            initialExcludedPanelIds={initialExcludedPanelIds}
            onExcludedPanelsChange={onExcludedPanelsChange}
          />
        </Map>

        {isDrawing && (
          <div className="absolute top-3 left-1/2 -translate-x-1/2 z-20 text-black text-xs font-bold px-4 py-1.5 rounded-full shadow-lg pointer-events-none whitespace-nowrap"
            style={{ background: PAN_COLORS[currentPanIndex % PAN_COLORS.length] }}>
            &#9999;&#65039; PAN {currentPanIndex + 1} &#8212; Double-cliquez pour terminer
          </div>
        )}

        {ready && (
          <div className="absolute top-3 right-3 z-20 flex flex-col items-center gap-1 pointer-events-none">
            <div className="relative w-14 h-14 bg-black/70 backdrop-blur-sm rounded-full border border-white/20 flex items-center justify-center shadow-lg">
              <div className="absolute inset-0 flex items-center justify-center">
                {["N","E","S","O"].map((d, i) => {
                  const angle = i*90-bearing, rad = angle*Math.PI/180, r = 20;
                  return (
                    <span key={d} className="absolute text-[8px] font-bold"
                      style={{ left:`${50+r*Math.sin(rad)}%`, top:`${50-r*Math.cos(rad)}%`, transform:"translate(-50%,-50%)", color:d==="S"?"#f97316":"rgba(255,255,255,0.6)" }}>
                      {d}
                    </span>
                  );
                })}
              </div>
              <div className="absolute inset-0 flex items-center justify-center" style={{ transform:`rotate(${-bearing}deg)` }}>
                <div className="absolute" style={{ width:0,height:0,borderLeft:"3px solid transparent",borderRight:"3px solid transparent",borderBottom:"14px solid rgba(255,255,255,0.5)",top:"10px" }} />
                <div className="absolute" style={{ width:0,height:0,borderLeft:"3px solid transparent",borderRight:"3px solid transparent",borderTop:"14px solid #f97316",bottom:"10px" }} />
                <div className="w-2 h-2 rounded-full bg-white/80 z-10" />
              </div>
            </div>
            <span className="text-[10px] text-orange-400 font-bold bg-black/60 px-1.5 py-0.5 rounded">&#8593; Sud</span>
          </div>
        )}

        {totalPanels > 0 && !isDrawing && panel && (
          <div className="absolute bottom-8 left-3 z-20 bg-black/75 backdrop-blur-sm text-white text-xs px-3 py-1.5 rounded-full pointer-events-none">
            &#9728; {totalPanels} panneaux &#183; {((totalPanels*(panel?.power_wc||0))/1000).toFixed(2)} kWc
          </div>
        )}

        {ready && !isDrawing && pans.length === 0 && !loading && (
          <div className="absolute bottom-8 right-12 z-20 bg-black/60 backdrop-blur-sm text-white/70 text-xs px-3 py-1.5 rounded-lg pointer-events-none">
            Passez en vue 0&#176; puis tracez un pan
          </div>
        )}

        {roseForPan && (() => {
          const activePan = pans.find(p => p.id === roseForPan);
          if (!activePan) return null;
          return (
            <WindRose
              pan={activePan}
              onSelect={(dir) => {
                handleUpdatePan(activePan.id, {
                  azimut: dir.az,
                  orientation: azimutToOrientation(dir.az),
                });
                setRoseForPan(null);
              }}
              onClose={() => setRoseForPan(null)}
            />
          );
        })()}
      </div>

      <PanSummaryTable pans={pans} onUpdatePan={handleUpdatePan} onDeletePan={handleDeletePan} panel={panel} settings={settings} pvgisData={pvgisData} solarSegments={solarSegments} />
    </div>
  );
}
