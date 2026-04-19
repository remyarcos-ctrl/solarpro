import React, { useState, useRef, useEffect } from "react";
import { Sparkles, Loader2, CheckCircle, AlertCircle } from "lucide-react";
import { azimutToOrientation } from "./roofUtils";
function anthropicUrl() {
  return window.location.hostname === 'localhost'
    ? '/anthropic/v1/messages'
    : '/api/anthropic';
}

async function analyzeRoofWithVision(imageBase64, coords) {
  const locationHint = coords
    ? `La maison est à lat=${coords.lat.toFixed(4)}, lon=${coords.lon.toFixed(4)} (France).`
    : "La maison est en France.";

  const base64Data = imageBase64.replace(/^data:image\/\w+;base64,/, "");
  const isDev = window.location.hostname === 'localhost';
  const headers = {
    'Content-Type': 'application/json',
    'anthropic-version': '2023-06-01',
    ...(isDev && { 'x-api-key': import.meta.env.VITE_ANTHROPIC_API_KEY }),
  };

  const r = await fetch(anthropicUrl(), {
    method: 'POST',
    headers,
    body: JSON.stringify({
      model: 'claude-sonnet-4-6',
      max_tokens: 2048,
      messages: [{
        role: 'user',
        content: [
          { type: 'image', source: { type: 'base64', media_type: 'image/png', data: base64Data } },
          { type: 'text', text: `Tu vois une photo aérienne IGN d'un toit en France. ${locationHint}
Les pans de toit sont les surfaces inclinées de couleur rouge/tuile/ardoise/zinc visibles sur le bâtiment central.
Identifie CHAQUE pan visible séparément et donne ses coordonnées précises en % de l'image (valeurs entre 0 et 1).
Vue verticale du dessus — estime l'azimut d'après l'ombre portée et la forme du pan.
Ne trace PAS le jardin, la rue, les véhicules ou les zones non-toiture.

Réponds UNIQUEMENT avec un JSON valide (sans markdown) :
{"pans":[{"id":1,"label":"Pan Sud","azimut":180,"inclination":30,"rendement_estime":95,"exploitable":true,"commentaire":"...","polygon_pct":[{"x":0.3,"y":0.4},{"x":0.5,"y":0.4},{"x":0.5,"y":0.6},{"x":0.3,"y":0.6}]}],"obstacles":[],"surface_totale_estimee_m2":60,"recommandation_generale":"...","confiance":85}` },
        ],
      }],
    }),
  });

  if (!r.ok) throw new Error(`Anthropic HTTP ${r.status}`);
  const data = await r.json();
  const text = data.content?.[0]?.text || '';
  const match = text.match(/\{[\s\S]*\}/);
  if (!match) throw new Error('Réponse JSON introuvable');
  return JSON.parse(match[0]);
}

function pctToGPS(polygonPct, bounds) {
  if (!bounds || !polygonPct?.length) return null;
  const { west, east, north, south } = bounds;
  const ring = polygonPct.map(({ x, y }) => [
    west + x * (east - west),
    north - y * (north - south),
  ]);
  ring.push(ring[0]);
  return [ring];
}

export default function SolarRoofDetector({ capturedImage, coords, onDetected, onRequestCapture }) {
  const [loading, setLoading] = useState(false);
  const [result,  setResult]  = useState(null);
  const [error,   setError]   = useState(null);
  const [step,    setStep]    = useState("idle");
  const imageRef = useRef(capturedImage);

  useEffect(() => { imageRef.current = capturedImage; }, [capturedImage]);

  const handleDetect = async () => {
    setError(null);

    // 1. Zoom max + capture native Mapbox (preserveDrawingBuffer + triggerRepaint)
    if (!window.__smActions?.prepareCapture) {
      setError("Carte non disponible — attendez que la carte soit chargée.");
      setStep("error");
      return;
    }
    const imageToUse = await window.__smActions.prepareCapture();

    // 3. Analyser
    setLoading(true);
    setStep("analyzing");
    setResult(null);

    try {
      const analysis = await analyzeRoofWithVision(imageToUse, coords);

      const bounds = window.__smActions?.getBounds?.();
      const exploitablePans = (analysis.pans || [])
        .filter(p => p.exploitable && p.polygon_pct?.length >= 3);

      // Dessine chaque pan sur la carte via Mapbox Draw
      for (const pan of exploitablePans) {
        const polyCoords = pctToGPS(pan.polygon_pct, bounds);
        if (polyCoords) await window.__smActions?.addAIPan?.(polyCoords, pan);
      }

      const pansWithGPS = exploitablePans.map((pan, idx) => ({
        id: `ai-pan-${Date.now()}-${idx}`,
        drawId: null,
        coords: pctToGPS(pan.polygon_pct, bounds),
        area: 0, maxPanels: 0,
        orientation: azimutToOrientation(pan.azimut),
        azimut: pan.azimut,
        inclination: pan.inclination || 30,
        index: idx, label: pan.label,
        commentaire: pan.commentaire,
        rendement: pan.rendement_estime,
        fromAI: true,
      }));

      setResult({ ...analysis, pansWithGPS });
      setStep("done");
      if (pansWithGPS.length > 0) onDetected(pansWithGPS, analysis);
    } catch (e) {
      console.error("Full error:", JSON.stringify(e, null, 2));
      setError("Erreur : " + JSON.stringify(e?.message || e?.error || e, null, 2));
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
        : step === "done"      ? <><CheckCircle className="w-4 h-4" /> {result?.pansWithGPS?.length} pan{result?.pansWithGPS?.length > 1 ? "s" : ""} détecté{result?.pansWithGPS?.length > 1 ? "s" : ""} · Relancer</>
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

          {result.pans?.filter(p => p.exploitable).map((pan, i) => (
            <div key={i} className="bg-secondary/30 border border-border rounded-lg px-3 py-2 text-xs">
              <div className="flex items-center justify-between mb-1">
                <span className="font-semibold text-foreground">{pan.label || `Pan ${i+1}`}</span>
                <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${
                  pan.rendement_estime >= 90 ? "bg-emerald-500/15 text-emerald-400"
                  : pan.rendement_estime >= 70 ? "bg-amber-500/15 text-amber-400"
                  : "bg-red-500/15 text-red-400"
                }`}>{pan.rendement_estime}% rendement</span>
              </div>
              <div className="text-muted-foreground">Azimut {pan.azimut}° · Inclinaison {pan.inclination}°</div>
              {pan.commentaire && <div className="text-muted-foreground/70 mt-0.5 italic">{pan.commentaire}</div>}
            </div>
          ))}

          {result.obstacles?.length > 0 && (
            <div className="bg-amber-500/8 border border-amber-500/20 rounded-lg px-3 py-2">
              <div className="text-xs font-semibold text-amber-400 mb-1">⚠️ Obstacles détectés</div>
              {result.obstacles.map((o, i) => <div key={i} className="text-xs text-muted-foreground">• {o}</div>)}
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