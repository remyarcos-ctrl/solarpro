import React, { useState, useRef, useEffect } from "react";
import { Sparkles, Loader2, CheckCircle, AlertCircle } from "lucide-react";
import { azimutToOrientation } from "./roofUtils";
function visionEndpoint() {
  return window.location.hostname === 'localhost'
    ? '/api/roof-vision'   // Vercel dev ou vite proxy
    : '/api/roof-vision';
}

// Bounds exacts de l'image Mapbox Static (zoom 19, 800x600px)
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

async function analyzeRoofWithVision(coords) {
  const prompt = `Tu es un expert en détection de toiture solaire.
Regarde cette image satellite. L'image fait 800x600 pixels.
Pour chaque pan de toit visible (tuile rouge, ardoise grise, zinc), donne les coordonnées EXACTES en pixels des coins du polygone.
Coordonnées : x=colonne, y=ligne depuis le coin haut-gauche.

Retourne UNIQUEMENT ce JSON (sans markdown) :
{"pans":[{"id":1,"nom":"Pan Sud-Est","azimut":135,"exploitable":true,"coins":[{"x":420,"y":310},{"x":580,"y":290},{"x":600,"y":420},{"x":440,"y":445}]}],"obstacles":[],"recommandation_generale":"...","confiance":85}`;

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
      const analysis = await analyzeRoofWithVision(coords);

      const bounds = staticImageBounds(coords.lat, coords.lon);
      const exploitablePans = (analysis.pans || []).filter(p => p.exploitable && p.coins?.length >= 3);

      // Dessine chaque pan sur la carte via Mapbox Draw
      for (const pan of exploitablePans) {
        const polyCoords = pixelsToGPS(pan.coins, bounds);
        if (polyCoords) await window.__smActions?.addAIPan?.(polyCoords, { azimut: pan.azimut, inclination: 30 });
      }

      setResult({ ...analysis, exploitablePans });
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

  return (
    <div className="space-y-2">
      <button
        onClick={handleDetect}
        disabled={loading}
        className={`w-full flex items-center justify-center gap-2 py-3 px-4 rounded-xl font-semibold text-sm transition-all border ${
          step === "done"  ? "bg-emerald-500/15 border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/25"
          : step === "error" ? "bg-red-500/15 border-red-500/30 text-red-400 hover:bg-red-500/25"
          : loading          ? "bg-violet-500/20 border-violet-500/30 text-violet-300 cursor-wait"
          : "bg-gradient-to-r from-violet-600 to-purple-600 hover:from-violet-500 hover:to-purple-500 text-white border-violet-500/30 shadow-lg"
        }`}
      >
        {loading        ? <><Loader2 className="w-4 h-4 animate-spin" /> Claude analyse la toiture…</>
        : step === "capturing" ? <><Loader2 className="w-4 h-4 animate-spin" /> Capture en cours…</>
        : step === "done"      ? <><CheckCircle className="w-4 h-4" /> {result?.exploitablePans?.length} pan{result?.exploitablePans?.length > 1 ? "s" : ""} détecté{result?.exploitablePans?.length > 1 ? "s" : ""} · Relancer</>
        : step === "error"     ? <><AlertCircle className="w-4 h-4" /> Erreur · Réessayer</>
        : <><Sparkles className="w-4 h-4" /> 🤖 Détecter la toiture avec l'IA</>}
      </button>

      {!capturedImage && step === "idle" && (
        <p className="text-xs text-muted-foreground text-center">
          💡 Cliquez <strong className="text-foreground">📷 Capturer</strong> au-dessus de la carte, puis lancez la détection
        </p>
      )}

      {capturedImage && step === "idle" && (
        <p className="text-xs text-emerald-400 text-center">✓ Image prête — cliquez pour lancer l'analyse IA</p>
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
            <div className="flex items-center gap-2"><div className="w-1.5 h-1.5 bg-violet-400 rounded-full animate-pulse" /><span>Détection des contours de toiture</span></div>
            <div className="flex items-center gap-2"><div className="w-1.5 h-1.5 bg-violet-400/60 rounded-full animate-pulse" style={{animationDelay:"0.3s"}} /><span>Identification des obstacles</span></div>
            <div className="flex items-center gap-2"><div className="w-1.5 h-1.5 bg-violet-400/40 rounded-full animate-pulse" style={{animationDelay:"0.6s"}} /><span>Calcul des orientations solaires</span></div>
          </div>
        </div>
      )}

      {error && (
        <div className="bg-red-500/10 border border-red-500/20 rounded-lg px-4 py-3 text-xs text-red-400">❌ {error}</div>
      )}

      {result && step === "done" && (
        <div className="space-y-3">
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
            <div key={i} className="flex items-center justify-between text-xs px-3 py-1.5 bg-secondary/30 rounded-lg border border-border">
              <span className="font-medium text-foreground">{pan.nom || pan.label || `Pan ${i+1}`}</span>
              <span className="text-muted-foreground">Azimut {pan.azimut}°</span>
            </div>
          ))}

          {result.exploitablePans?.length > 0 && (
            <button
              onClick={() => {
                result.exploitablePans.forEach((pan, i) => {
                  setTimeout(() => {
                    window.__smAIHint = { inclination: 30, azimut: pan.azimut || pan.azimut || 180 };
                    window.__smActions?.startDraw?.();
                  }, i * 200);
                });
              }}
              className="w-full py-2 px-3 rounded-xl text-sm font-semibold bg-violet-500/15 border border-violet-500/30 text-violet-400 hover:bg-violet-500/25 transition-colors"
            >
              ✏️ Créer ces {result.exploitablePans.length} pan{result.exploitablePans.length > 1 ? 's' : ''} (tracé guidé)
            </button>
          )}

          {result.obstacles?.length > 0 && (
            <div className="bg-amber-500/8 border border-amber-500/20 rounded-lg px-3 py-2">
              <div className="text-xs font-semibold text-amber-400 mb-1">⚠️ Obstacles détectés</div>
              {result.obstacles.map((o, i) => <div key={i} className="text-xs text-muted-foreground">• {typeof o === 'string' ? o : o.type || o.commentaire || JSON.stringify(o)}</div>)}
            </div>
          )}

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