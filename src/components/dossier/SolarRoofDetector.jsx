import React, { useState, useRef, useEffect } from "react";
import { Sparkles, Loader2, CheckCircle, AlertCircle } from "lucide-react";
import { azimutToOrientation } from "./roofUtils";
import { base44 } from "@/api/base44Client";

async function analyzeRoofWithVision(imageBase64, coords) {
  const locationHint = coords
    ? `La maison est à lat=${coords.lat.toFixed(4)}, lon=${coords.lon.toFixed(4)} (France).`
    : "La maison est en France.";

  // Convertir data URL en Blob puis uploader
  const base64Data = imageBase64.replace(/^data:image\/\w+;base64,/, "");
  const byteArray = Uint8Array.from(atob(base64Data), c => c.charCodeAt(0));
  const blob = new Blob([byteArray], { type: "image/png" });
  const file = new File([blob], "satellite.png", { type: "image/png" });

  // Uploader via Base44
  const uploadedFile = await base44.integrations.Core.UploadFile({ file });
  const fileUrl = uploadedFile.file_url || uploadedFile.url;

  const result = await base44.integrations.Core.InvokeLLM({
    prompt: `Tu es un expert solaire. Analyse cette image satellite et détecte les pans de toiture.
${locationHint}
L'image est une vue satellite VERTICALE (vue du dessus, 0° d'inclinaison).
Trace des polygones PRÉCIS qui suivent exactement les bords du toit.
Un toit standard occupe 5 à 25% de la surface de l'image.
Ne couvre PAS le jardin, la rue ou les zones non-toiture.
Pour chaque pan : coordonnées en % de l'image (0-1), azimut, inclinaison, si exploitable.`,
    file_urls: [fileUrl],
    response_json_schema: {
      type: "object",
      properties: {
        pans: {
          type: "array",
          items: {
            type: "object",
            properties: {
              id:               { type: "number" },
              label:            { type: "string" },
              azimut:           { type: "number" },
              inclination:      { type: "number" },
              rendement_estime: { type: "number" },
              exploitable:      { type: "boolean" },
              commentaire:      { type: "string" },
              polygon_pct: {
                type: "array",
                items: {
                  type: "object",
                  properties: { x: { type: "number" }, y: { type: "number" } }
                }
              }
            }
          }
        },
        obstacles:                  { type: "array", items: { type: "string" } },
        surface_totale_estimee_m2:  { type: "number" },
        recommandation_generale:    { type: "string" },
        confiance:                  { type: "number" }
      }
    }
  });

  return result;
}

function pctToGPS(polygonPct, centerCoords, imageSizeMeters = 150) {
  if (!centerCoords || !polygonPct?.length) return null;
  const { lat, lon } = centerCoords;
  const mPerDegLat = 111320;
  const mPerDegLon = 111320 * Math.cos(lat * Math.PI / 180);
  const gpsPoints = polygonPct.map(({ x, y }) => [
    lon + ((x - 0.5) * imageSizeMeters) / mPerDegLon,
    lat + ((0.5 - y) * imageSizeMeters) / mPerDegLat,
  ]);
  gpsPoints.push(gpsPoints[0]);
  return [gpsPoints];
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

    // 1. Remettre la carte à plat (0° pitch, 0° bearing) pour meilleure détection
    if (window.__smActions?.changePitch) {
      window.__smActions.changePitch(0);
      window.__smActions.changeBearing(0);
      // Attendre que la carte finisse d'animer
      await new Promise(r => setTimeout(r, 1000));
    }

    // 2. Capturer automatiquement
    window.__smActions?.capture?.();
    await new Promise(r => setTimeout(r, 500));

    let imageToUse = imageRef.current;
    if (!imageToUse) {
      setError("Capture échouée. Réessayez.");
      setStep("error");
      return;
    }

    // 3. Analyser
    setLoading(true);
    setStep("analyzing");
    setResult(null);

    try {
      const analysis = await analyzeRoofWithVision(imageToUse, coords);

      const pansWithGPS = (analysis.pans || [])
        .filter(p => p.exploitable && p.polygon_pct?.length >= 3)
        .map((pan, idx) => ({
          id: `ai-pan-${Date.now()}-${idx}`,
          drawId: null,
          coords: pctToGPS(pan.polygon_pct, coords),
          area: 0,
          maxPanels: 0,
          orientation: azimutToOrientation(pan.azimut),
          azimut: pan.azimut,
          inclination: pan.inclination || 30,
          index: idx,
          label: pan.label,
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