import React, { useState } from "react";
import { Sparkles, Loader2, CheckCircle, AlertCircle } from "lucide-react";
import { azimutToOrientation } from "./roofUtils";

function visionEndpoint() { return '/api/roof-vision'; }
function maskEndpoint()   { return '/api/solar-mask';  }

// ── Fallback Vision-only : bounds pixel → GPS ────────────────────────────
function staticImageBounds(lat, lon, zoom = 19, w = 800, h = 600) {
  const mPerPx = 156543.03392 * Math.cos(lat * Math.PI / 180) / Math.pow(2, zoom);
  const halfW = (w / 2) * mPerPx;
  const halfH = (h / 2) * mPerPx;
  return {
    west:  lon - halfW / 111320,
    east:  lon + halfW / 111320,
    north: lat + halfH / 110540,
    south: lat - halfH / 110540,
  };
}

function pixelsToGPS(coins, bounds, w = 800, h = 600) {
  const ring = coins.map(({ x, y }) => [
    bounds.west + (x / w) * (bounds.east - bounds.west),
    bounds.north - (y / h) * (bounds.north - bounds.south),
  ]);
  ring.push(ring[0]);
  return [ring];
}

// ── Appel API Vision (prompt arbitraire) ────────────────────────────────
async function callVision(coords, prompt) {
  const r = await fetch(visionEndpoint(), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ lat: coords.lat, lon: coords.lon, prompt }),
  });
  if (!r.ok) {
    const b = await r.json().catch(() => ({}));
    throw new Error(`roof-vision HTTP ${r.status}: ${b.error || 'unknown'}`);
  }
  const data = await r.json();
  const text = data.content?.[0]?.text || '';
  const match = text.match(/\{[\s\S]*\}/);
  if (!match) throw new Error('Réponse JSON introuvable');
  return JSON.parse(match[0]);
}

// ── Appel API Solar Mask (polygones GPS exacts) ──────────────────────────
async function fetchSolarMask(coords) {
  const r = await fetch(maskEndpoint(), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ lat: coords.lat, lon: coords.lon }),
  });
  if (!r.ok) {
    const b = await r.json().catch(() => ({}));
    throw new Error(`solar-mask HTTP ${r.status}: ${b.error || 'unknown'}`);
  }
  return r.json();
}

// ── Vision : obstacles par segment (utilise les segments déjà en mémoire) ─
async function analyzeObstaclesPerSegment(coords, segments) {
  const segsForPrompt = segments.map((s, i) => ({
    id: i,
    azimut: Math.round(s.azimut ?? 180),
    inclinaison: Math.round(s.pitch ?? 30),
    surface_m2: Math.round(s.area ?? 0),
    soleil_h_an: Math.round(s.sunshineHours ?? 0),
  }));

  const prompt = `Tu es expert installateur solaire en France.
Voici les segments Solar API pour ce toit (${segsForPrompt.length} segments) :
${JSON.stringify(segsForPrompt)}

Et voici la photo satellite du même toit.

Pour chaque segment, identifie les obstacles visibles (velux, cheminées, antennes, conduits) et évalue si le pan vaut une installation.

Retourne UNIQUEMENT ce JSON (sans markdown) :
{"segments":[{"segment_id":0,"obstacles":["cheminée ~0.5m²"],"surface_exploitable_m2":25,"recommande":true,"nb_panneaux_optimal":10,"raison":"Pan Sud, peu d'obstacles"}],"recommandation_generale":"...","confiance":85}`;

  return callVision(coords, prompt);
}

// ── Vision seule : pans + obstacles en pixels ────────────────────────────
async function analyzeRoofWithVision(coords) {
  const prompt = `Tu es un expert en détection de toiture solaire.
Regarde cette image satellite. L'image fait 800x600 pixels.
Pour chaque pan de toit visible (tuile rouge, ardoise grise, zinc), donne les coordonnées EXACTES en pixels des coins du polygone.
Pour chaque obstacle visible (cheminée, lucarne, velux, antenne, conduit), donne aussi ses coins en pixels.
Coordonnées : x=colonne, y=ligne depuis le coin haut-gauche.

Retourne UNIQUEMENT ce JSON (sans markdown) :
{"pans":[{"id":1,"nom":"Pan Sud-Est","azimut":135,"exploitable":true,"coins":[{"x":420,"y":310},{"x":580,"y":290},{"x":600,"y":420},{"x":440,"y":445}]}],"obstacles":[{"type":"cheminée","coins":[{"x":500,"y":380},{"x":520,"y":380},{"x":520,"y":400},{"x":500,"y":400}]}],"recommandation_generale":"...","confiance":85}`;

  return callVision(coords, prompt);
}

// ────────────────────────────────────────────────────────────────────────
export default function SolarRoofDetector({ capturedImage, coords }) {
  const [loading, setLoading] = useState(false);
  const [result,  setResult]  = useState(null);
  const [error,   setError]   = useState(null);
  const [step,    setStep]    = useState("idle");
  const [mode,    setMode]    = useState(null);

  const handleDetect = async () => {
    setError(null);
    if (!coords) {
      setError("Adresse non géocodée — attendez que la carte soit chargée.");
      setStep("error");
      return;
    }
    setLoading(true);
    setStep("analyzing");
    setResult(null);
    setMode(null);

    try {
      // ── Mode Solar Mask + Vision ──────────────────────────────────────
      let maskOk = false;
      let maskData = null;

      try {
        // Lancer les deux en parallèle : polygones GPS + vision obstacles
        const maskPromise = fetchSolarMask(coords);
        // On utilise les segments déjà chargés pour le prompt Vision
        const solarSegs = window.__smSolarSegments;
        const visionPromise = solarSegs?.length > 0
          ? analyzeObstaclesPerSegment(coords, solarSegs.map(s => ({
              azimut: s.azimuthDegrees, pitch: s.pitchDegrees,
              area: s.stats?.areaMeters2, sunshineHours: s.stats?.sunshineHoursPerYear,
            })))
          : Promise.resolve(null);

        const [mask, vision] = await Promise.all([maskPromise, visionPromise]);
        maskData = mask;
        maskOk = true;

        // Indexer les résultats Vision par segment_id
        const visionMap = {};
        if (vision?.segments) {
          for (const s of vision.segments) visionMap[s.segment_id] = s;
        }

        const drawn = [];
        for (let i = 0; i < maskData.segments.length; i++) {
          const seg = maskData.segments[i];
          const vis = visionMap[i] ?? {};
          if (vis.recommande === false) continue;

          await window.__smActions?.addAIPan?.(seg.polygon, {
            azimut: seg.azimut,
            inclination: seg.pitch,
            surface_estimee_m2: vis.surface_exploitable_m2 ?? seg.area,
            obstacles: [],
          });

          drawn.push({
            nom: `Pan ${azimutToOrientation(seg.azimut)} — ${Math.round(seg.pitch)}°`,
            azimut: seg.azimut,
            area: Math.round(seg.area),
            sunshineHours: Math.round(seg.sunshineHours),
            obstacles: vis.obstacles ?? [],
            surface_exploitable_m2: vis.surface_exploitable_m2 ?? Math.round(seg.area),
            nb_panneaux_optimal: vis.nb_panneaux_optimal,
            raison: vis.raison,
          });
        }

        setMode('mask');
        setResult({
          exploitablePans: drawn,
          recommandation_generale: vision?.recommandation_generale,
          confiance: vision?.confiance ?? 90,
        });

      } catch (maskErr) {
        console.warn('[solar-mask] fallback Vision-only:', maskErr.message);

        // ── Fallback Vision seule (pixels → GPS) ─────────────────────
        const analysis = await analyzeRoofWithVision(coords);
        const bounds = staticImageBounds(coords.lat, coords.lon);
        const exploitablePans = (analysis.pans || []).filter(p => p.exploitable && p.coins?.length >= 3);
        const rawObstacles = (analysis.obstacles || []).filter(o => o.coins?.length >= 3);

        const obstaclesGPS = rawObstacles.map(o => ({
          type: o.type || 'obstacle',
          coords: pixelsToGPS(o.coins, bounds),
        }));
        if (obstaclesGPS.length > 0) window.__smActions?.showObstacles?.(obstaclesGPS);

        const obstacleCoords = obstaclesGPS.map(o => o.coords);
        for (const pan of exploitablePans) {
          const polyCoords = pixelsToGPS(pan.coins, bounds);
          if (polyCoords) await window.__smActions?.addAIPan?.(
            polyCoords,
            { azimut: pan.azimut, inclination: 30, obstacles: obstacleCoords }
          );
        }

        setMode('vision');
        setResult({ ...analysis, exploitablePans });
      }

      setStep("done");
    } catch (e) {
      console.error("Full error:", e?.message || e);
      setError("Erreur : " + (e?.message || String(e)));
      setStep("error");
    } finally {
      setLoading(false);
    }
  };

  const reset = () => { setResult(null); setError(null); setStep("idle"); setMode(null); };
  const n = result?.exploitablePans?.length ?? 0;

  return (
    <div className="space-y-2">
      <button
        onClick={handleDetect}
        disabled={loading}
        className={`w-full flex items-center justify-center gap-2 py-3 px-4 rounded-xl font-semibold text-sm transition-all border ${
          step === "done"    ? "bg-emerald-500/15 border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/25"
          : step === "error" ? "bg-red-500/15 border-red-500/30 text-red-400 hover:bg-red-500/25"
          : loading          ? "bg-violet-500/20 border-violet-500/30 text-violet-300 cursor-wait"
          : "bg-gradient-to-r from-violet-600 to-purple-600 hover:from-violet-500 hover:to-purple-500 text-white border-violet-500/30 shadow-lg"
        }`}
      >
        {loading
          ? <><Loader2 className="w-4 h-4 animate-spin" /> Analyse en cours…</>
          : step === "done"
          ? <><CheckCircle className="w-4 h-4" /> {n} pan{n > 1 ? "s" : ""} détecté{n > 1 ? "s" : ""} · Relancer</>
          : step === "error"
          ? <><AlertCircle className="w-4 h-4" /> Erreur · Réessayer</>
          : <><Sparkles className="w-4 h-4" /> 🤖 Détecter la toiture avec l'IA</>}
      </button>

      {step === "idle" && (
        <p className="text-xs text-muted-foreground text-center">
          {window.__smSolarSegments?.length > 0
            ? `✓ ${window.__smSolarSegments.length} segments Solar API chargés`
            : '💡 Lancez la détection IA de la toiture'}
        </p>
      )}

      {loading && (
        <div className="bg-violet-500/10 border border-violet-500/20 rounded-xl p-4">
          <div className="flex items-center gap-3 mb-3">
            <div className="flex gap-1">
              {[0,1,2].map(i => <div key={i} className="w-2 h-2 bg-violet-400 rounded-full animate-bounce" style={{animationDelay:`${i*0.15}s`}} />)}
            </div>
            <span className="text-sm text-violet-400 font-medium">Analyse en cours…</span>
          </div>
          <div className="space-y-1.5 text-xs text-muted-foreground">
            <div className="flex items-center gap-2"><div className="w-1.5 h-1.5 bg-violet-400 rounded-full animate-pulse" /><span>Téléchargement masque Solar API (GeoTIFF)</span></div>
            <div className="flex items-center gap-2"><div className="w-1.5 h-1.5 bg-violet-400/60 rounded-full animate-pulse" style={{animationDelay:"0.3s"}} /><span>Extraction contours par segment</span></div>
            <div className="flex items-center gap-2"><div className="w-1.5 h-1.5 bg-violet-400/40 rounded-full animate-pulse" style={{animationDelay:"0.6s"}} /><span>Détection obstacles (Claude Vision)</span></div>
          </div>
        </div>
      )}

      {error && (
        <div className="bg-red-500/10 border border-red-500/20 rounded-lg px-4 py-3 text-xs text-red-400">❌ {error}</div>
      )}

      {result && step === "done" && (
        <div className="space-y-3">
          <div className="flex items-center gap-2 text-xs">
            {mode === 'mask'
              ? <><span className="px-2 py-0.5 rounded-full bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 font-semibold">Solar Mask GPS</span><span className="text-muted-foreground">+ Claude Vision</span></>
              : <span className="px-2 py-0.5 rounded-full bg-violet-500/15 border border-violet-500/30 text-violet-400 font-semibold">Claude Vision</span>}
          </div>

          <div className="flex items-center justify-between">
            <span className="text-xs text-muted-foreground">Confiance IA</span>
            <div className="flex items-center gap-2">
              <div className="w-32 h-2 bg-secondary rounded-full overflow-hidden">
                <div className="h-full bg-violet-400 rounded-full" style={{width:`${result.confiance}%`}} />
              </div>
              <span className="text-xs font-semibold text-violet-400">{result.confiance}%</span>
            </div>
          </div>

          {result.exploitablePans?.map((pan, i) => (
            <div key={i} className="text-xs px-3 py-2 bg-secondary/30 rounded-lg border border-border space-y-1">
              <div className="flex items-center justify-between">
                <span className="font-medium text-foreground">{pan.nom || `Pan ${i+1}`}</span>
                <span className="text-muted-foreground text-[10px]">
                  {pan.azimut != null ? `${Math.round(pan.azimut)}°` : ''}
                  {pan.surface_exploitable_m2 ? ` · ${pan.surface_exploitable_m2}m²` : ''}
                  {pan.nb_panneaux_optimal ? ` · ~${pan.nb_panneaux_optimal} 🔆` : ''}
                </span>
              </div>
              {pan.sunshineHours > 0 && (
                <div className="text-amber-300 text-[10px]">☀️ {pan.sunshineHours} h/an</div>
              )}
              {pan.obstacles?.length > 0 && (
                <div className="text-amber-400">⚠️ {pan.obstacles.join(', ')}</div>
              )}
              {pan.raison && <div className="text-muted-foreground italic">{pan.raison}</div>}
            </div>
          ))}

          {result.recommandation_generale && (
            <div className="bg-violet-500/8 border border-violet-500/20 rounded-lg px-3 py-2 text-xs text-foreground">
              💡 {result.recommandation_generale}
            </div>
          )}

          <button onClick={reset} className="text-xs text-muted-foreground hover:text-foreground underline underline-offset-2">
            Recommencer la détection
          </button>
        </div>
      )}
    </div>
  );
}
