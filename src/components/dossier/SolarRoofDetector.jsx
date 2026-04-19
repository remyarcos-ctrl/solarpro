import React, { useState } from "react";
import { Sparkles, Loader2, CheckCircle, AlertCircle } from "lucide-react";
import { azimutToOrientation } from "./roofUtils";

function visionEndpoint() {
  return '/api/roof-vision';
}

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

function buildBoundingBoxPolygon(seg) {
  const sw = seg.boundingBox?.sw;
  const ne = seg.boundingBox?.ne;
  if (!sw || !ne) return null;
  return [[
    [sw.longitude, sw.latitude],
    [ne.longitude, sw.latitude],
    [ne.longitude, ne.latitude],
    [sw.longitude, ne.latitude],
    [sw.longitude, sw.latitude],
  ]];
}

async function callVision(coords, prompt) {
  const r = await fetch(visionEndpoint(), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ lat: coords.lat, lon: coords.lon, prompt }),
  });
  if (!r.ok) {
    const body = await r.json().catch(() => ({}));
    throw new Error(`roof-vision HTTP ${r.status}: ${body.error || 'unknown'}`);
  }
  const data = await r.json();
  const text = data.content?.[0]?.text || '';
  const match = text.match(/\{[\s\S]*\}/);
  if (!match) throw new Error('Réponse JSON introuvable');
  return JSON.parse(match[0]);
}

async function analyzeWithSolarAndVision(coords, solarSegs) {
  const segsForPrompt = solarSegs
    .map((s, i) => ({
      id: i,
      azimut: Math.round(s.azimuthDegrees ?? 180),
      inclinaison: Math.round(s.pitchDegrees ?? 30),
      surface_m2: Math.round(s.stats?.areaMeters2 ?? 0),
      soleil_h_an: Math.round(s.stats?.sunshineHoursPerYear ?? 0),
    }))
    .filter(s => s.surface_m2 > 3 && (s.inclinaison ?? 90) < 70);

  const prompt = `Tu es expert installateur solaire en France.
Voici les données Google Solar API pour ce toit (${segsForPrompt.length} segments) :
${JSON.stringify(segsForPrompt)}

Et voici la photo satellite du même toit.

Pour chaque segment, identifie visuellement les obstacles présents sur le toit (velux, cheminées, antennes, conduits) et évalue chaque pan.

Retourne UNIQUEMENT ce JSON (sans markdown) :
{"segments":[{"segment_id":0,"obstacles":["cheminée ~0.5m²"],"surface_exploitable_m2":25,"recommande":true,"nb_panneaux_optimal":10,"raison":"Pan Sud optimal, peu d'obstacles"}],"recommandation_generale":"...","confiance":85}`;

  return callVision(coords, prompt);
}

async function analyzeRoofWithVision(coords) {
  const prompt = `Tu es un expert en détection de toiture solaire.
Regarde cette image satellite. L'image fait 800x600 pixels.
Pour chaque pan de toit visible (tuile rouge, ardoise grise, zinc), donne les coordonnées EXACTES en pixels des coins du polygone.
Pour chaque obstacle visible sur le toit (cheminée, lucarne, velux, antenne, conduit), donne aussi ses coins en pixels.
Coordonnées : x=colonne, y=ligne depuis le coin haut-gauche.

Retourne UNIQUEMENT ce JSON (sans markdown) :
{"pans":[{"id":1,"nom":"Pan Sud-Est","azimut":135,"exploitable":true,"coins":[{"x":420,"y":310},{"x":580,"y":290},{"x":600,"y":420},{"x":440,"y":445}]}],"obstacles":[{"type":"cheminée","coins":[{"x":500,"y":380},{"x":520,"y":380},{"x":520,"y":400},{"x":500,"y":400}]}],"recommandation_generale":"...","confiance":85}`;

  return callVision(coords, prompt);
}

export default function SolarRoofDetector({ capturedImage, coords, onDetected, onRequestCapture }) {
  const [loading, setLoading] = useState(false);
  const [result,  setResult]  = useState(null);
  const [error,   setError]   = useState(null);
  const [step,    setStep]    = useState("idle");

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

    try {
      const solarSegs = window.__smSolarSegments;

      if (solarSegs?.length > 0) {
        // ── Mode combiné : Solar API (GPS exact) + Vision (obstacles) ────
        const analysis = await analyzeWithSolarAndVision(coords, solarSegs);
        const validSegs = (analysis.segments || []).filter(s => s.recommande !== false);

        for (const s of validSegs) {
          const sourceSeg = solarSegs[s.segment_id];
          if (!sourceSeg) continue;
          const polyCoords = buildBoundingBoxPolygon(sourceSeg);
          if (!polyCoords) continue;
          await window.__smActions?.addAIPan?.(polyCoords, {
            azimut: sourceSeg.azimuthDegrees ?? 180,
            inclination: sourceSeg.pitchDegrees ?? 30,
            surface_estimee_m2: s.surface_exploitable_m2 ?? sourceSeg.stats?.areaMeters2,
            obstacles: [],
          });
        }

        setResult({
          mode: 'solar',
          exploitablePans: validSegs.map(s => {
            const src = solarSegs[s.segment_id] ?? {};
            return {
              nom: `Pan ${azimutToOrientation(src.azimuthDegrees ?? 180)} — ${Math.round(src.pitchDegrees ?? 0)}°`,
              azimut: src.azimuthDegrees ?? 180,
              obstacles: s.obstacles || [],
              surface_exploitable_m2: s.surface_exploitable_m2,
              nb_panneaux_optimal: s.nb_panneaux_optimal,
              raison: s.raison,
            };
          }),
          recommandation_generale: analysis.recommandation_generale,
          confiance: analysis.confiance,
        });

      } else {
        // ── Mode Vision seul (pixels → GPS) ───────────────────────────────
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

  const reset = () => { setResult(null); setError(null); setStep("idle"); };
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
          ? <><Loader2 className="w-4 h-4 animate-spin" /> Analyse IA en cours…</>
          : step === "done"
          ? <><CheckCircle className="w-4 h-4" /> {n} pan{n > 1 ? "s" : ""} détecté{n > 1 ? "s" : ""} · Relancer</>
          : step === "error"
          ? <><AlertCircle className="w-4 h-4" /> Erreur · Réessayer</>
          : <><Sparkles className="w-4 h-4" /> 🤖 Détecter la toiture avec l'IA</>}
      </button>

      {step === "idle" && (
        <p className="text-xs text-muted-foreground text-center">
          {window.__smSolarSegments?.length > 0
            ? `✓ ${window.__smSolarSegments.length} segments Solar API prêts — analyse combinée`
            : '💡 Lancez la détection pour analyser la toiture'}
        </p>
      )}

      {loading && (
        <div className="bg-violet-500/10 border border-violet-500/20 rounded-xl p-4">
          <div className="flex items-center gap-3 mb-3">
            <div className="flex gap-1">
              {[0,1,2].map(i => <div key={i} className="w-2 h-2 bg-violet-400 rounded-full animate-bounce" style={{animationDelay:`${i*0.15}s`}} />)}
            </div>
            <span className="text-sm text-violet-400 font-medium">Claude Vision analyse l'image satellite…</span>
          </div>
          <div className="space-y-1.5 text-xs text-muted-foreground">
            <div className="flex items-center gap-2"><div className="w-1.5 h-1.5 bg-violet-400 rounded-full animate-pulse" /><span>Lecture des segments Solar API</span></div>
            <div className="flex items-center gap-2"><div className="w-1.5 h-1.5 bg-violet-400/60 rounded-full animate-pulse" style={{animationDelay:"0.3s"}} /><span>Identification des obstacles sur l'image</span></div>
            <div className="flex items-center gap-2"><div className="w-1.5 h-1.5 bg-violet-400/40 rounded-full animate-pulse" style={{animationDelay:"0.6s"}} /><span>Placement automatique des panneaux</span></div>
          </div>
        </div>
      )}

      {error && (
        <div className="bg-red-500/10 border border-red-500/20 rounded-lg px-4 py-3 text-xs text-red-400">❌ {error}</div>
      )}

      {result && step === "done" && (
        <div className="space-y-3">
          {result.mode === 'solar' && (
            <div className="flex items-center gap-2 text-xs text-emerald-400">
              <span className="px-2 py-0.5 rounded-full bg-emerald-500/15 border border-emerald-500/30 font-semibold">Google Solar API</span>
              <span className="text-muted-foreground">+ Claude Vision</span>
            </div>
          )}

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
                <span className="text-muted-foreground">
                  {pan.azimut != null ? `${pan.azimut}°` : ''}
                  {pan.surface_exploitable_m2 ? ` · ${pan.surface_exploitable_m2}m²` : ''}
                  {pan.nb_panneaux_optimal ? ` · ${pan.nb_panneaux_optimal} panneaux` : ''}
                </span>
              </div>
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
