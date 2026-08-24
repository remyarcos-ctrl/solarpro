import React, { useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Sparkles, Loader2, ChevronDown, ChevronUp, Mic, MicOff, Mail, X } from "lucide-react";
import { getSolarCoefficient, ORIENTATIONS } from "./roofUtils";
async function callAnthropic(prompt) {
  const isDev = window.location.hostname === 'localhost';
  const url = isDev ? '/anthropic/v1/messages' : '/api/anthropic';
  const headers = {
    'Content-Type': 'application/json',
    'anthropic-version': '2023-06-01',
    ...(isDev && { 'x-api-key': import.meta.env.VITE_ANTHROPIC_API_KEY }),
  };
  const response = await fetch(url, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      model: 'claude-sonnet-4-6',
      max_tokens: 1500,
      messages: [{ role: 'user', content: prompt }],
    }),
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error?.message || `HTTP ${response.status}`);
  return data.content[0].text;
}

async function askClaude(prompt) {
  const text = await callAnthropic(prompt);
  const match = text.match(/\{[\s\S]*\}/);
  return JSON.parse(match ? match[0] : text);
}

function buildPrompt({ pans, panel, settings, address, pvgisData, aidData }) {
  const prodRef = pvgisData?.annualKwhPerKwc || settings?.regional_production || 1100;
  const elecPrice = aidData?.edfPrice || settings?.electricity_price || 0.2001;
  const prixWc = settings?.installation_cost_per_wc || 2.5;

  const panDetails = pans.map((pan, i) => {
    const coef = getSolarCoefficient(pan.orientation, pan.inclination);
    const kwc = ((pan.maxPanels || 0) * (panel?.power_wc || 410)) / 1000;
    const prod = Math.round(kwc * prodRef * coef);
    const oriLabel = ORIENTATIONS.find(o => o.value === pan.orientation)?.label || pan.orientation;
    return `  Pan ${i+1}: ${oriLabel} ${pan.inclination}° | ${pan.area}m² | max ${pan.maxPanels} panneaux | rend. ${Math.round(coef*100)}% | ~${prod} kWh/an`;
  }).join("\n");

  const totalMax = pans.reduce((s, p) => s + (p.maxPanels || 0), 0);
  const totalKwc = (totalMax * (panel?.power_wc || 410)) / 1000;
  const cout = totalKwc * 1000 * prixWc;
  const prime = (aidData?.prime_autoconsommation_kwc ?? 0) * totalKwc;

  return `Analyse cette installation solaire et fournis des recommandations professionnelles.

ADRESSE: ${address || "France"}
PANNEAU: ${panel?.brand || ""} ${panel?.model_name || ""} — ${panel?.power_wc || 410}Wc
PRIX ELECTRICITÉ: ${elecPrice} €/kWh
${pvgisData ? `PVGIS: ${pvgisData.annualKwhPerKwc} kWh/kWc/an (données réelles CE)` : ""}
${aidData ? `RÉGION: ${aidData.region} | Prime: ${aidData.prime_autoconsommation_kwc}€/kWc | TVA: ${aidData.tva_reduite}%` : ""}

PANS (${pans.length}):
${panDetails || "Aucun pan tracé"}

TOTAL: ${totalMax} panneaux max | ${totalKwc.toFixed(2)} kWc | ~${Math.round(cout).toLocaleString("fr-FR")}€ | prime ~${Math.round(prime).toLocaleString("fr-FR")}€

Retourne ce JSON:
{
  "score_global": 85,
  "verdict": "Excellente toiture pour le solaire",
  "detection_obstacles": ["Vérifier cheminée côté nord"],
  "recommandation_panneaux": {
    "total_optimal": 12,
    "repartition": [
      {"pan": 1, "nb_recommandes": 8, "priorite": "haute", "raison": "Sud idéal", "ordre_installation": 1}
    ]
  },
  "scenarios": {
    "A": {"label": "Investissement minimal", "panneaux": 6, "kwc": 2.46, "prod_an": 2700, "cout": 6900, "rac": 5970, "eco_an": 675, "roi_ans": 8.8},
    "B": {"label": "Configuration optimale", "panneaux": 12, "kwc": 4.92, "prod_an": 5412, "cout": 13800, "rac": 11940, "eco_an": 1350, "roi_ans": 8.8},
    "C": {"label": "Puissance maximale", "panneaux": 20, "kwc": 8.2, "prod_an": 9020, "cout": 23000, "rac": 19880, "eco_an": 2250, "roi_ans": 8.8}
  },
  "production_annuelle_estimee": 5412,
  "economies_annuelles_estimees": 1350,
  "roi_estime_ans": 8.8,
  "angle_optimal_recommande": 35,
  "orientation_optimale": "S",
  "conseil_disposition": "Commencez par le pan sud pour le meilleur rendement.",
  "conseil_orientation_panneaux": "Installez en portrait pour maximiser la production hivernale.",
  "financement_suggestion": "Mensualités estimées : 85€/mois sur 15 ans avec Éco-PTZ à 0%",
  "points_forts": ["Orientation sud optimale", "Surface suffisante"],
  "points_attention": ["Vérifier ombrage arbres proches"],
  "email_suivi": "Bonjour,\\n\\nSuite à notre rendez-vous, voici le résumé de votre projet solaire.\\n\\nCordialement",
  "alerte": null
}`;
}

function buildVoicePrompt(transcript) {
  return `Un commercial solaire décrit une situation client oralement. Extrais les infos.
TRANSCRIPTION: "${transcript}"
Retourne ce JSON:
{
  "first_name": "",
  "last_name": "",
  "address": "",
  "property_type": "maison",
  "comment": "",
  "panel_count_suggestion": null,
  "orientation_suggestion": "portrait",
  "roof_area_suggestion": null,
  "suggestion_message": "Résumé de la situation et recommandations"
}`;
}

function ScoreRing({ score }) {
  const color = score >= 80 ? "#22c55e" : score >= 60 ? "#f59e0b" : "#ef4444";
  const r = 28, circ = 2 * Math.PI * r, dash = (score / 100) * circ;
  return (
    <div className="relative w-16 h-16 flex items-center justify-center flex-shrink-0">
      <svg className="absolute inset-0 -rotate-90" width="64" height="64">
        <circle cx="32" cy="32" r={r} fill="none" stroke="rgba(255,255,255,0.1)" strokeWidth="5" />
        <circle cx="32" cy="32" r={r} fill="none" stroke={color} strokeWidth="5"
          strokeDasharray={`${dash} ${circ}`} strokeLinecap="round" />
      </svg>
      <span className="text-base font-black" style={{ color }}>{score}</span>
    </div>
  );
}

function ScenarioComparison({ scenarios }) {
  if (!scenarios) return null;
  const items = Object.entries(scenarios).map(([k, v]) => ({ key: k, ...v }));
  const styles = {
    A: { border: "border-blue-500/30", bg: "bg-blue-500/8", text: "text-blue-400" },
    B: { border: "border-amber-500/30", bg: "bg-amber-500/8", text: "text-amber-400" },
    C: { border: "border-emerald-500/30", bg: "bg-emerald-500/8", text: "text-emerald-400" },
  };
  return (
    <div>
      <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">📊 Comparaison de scénarios</div>
      <div className="grid grid-cols-3 gap-2">
        {items.map(({ key, label, panneaux, kwc, prod_an, rac, eco_an, roi_ans }) => {
          const s = styles[key] || styles.A;
          return (
            <div key={key} className={`rounded-xl border p-3 ${s.border} ${s.bg}`}>
              <div className={`text-xs font-bold mb-1 ${s.text}`}>Scénario {key}</div>
              <div className="text-[10px] text-muted-foreground mb-2">{label}</div>
              <div className="space-y-1 text-[11px]">
                {[
                  ["Panneaux", panneaux],
                  ["Puissance", `${kwc} kWc`],
                  ["Production", `${prod_an?.toLocaleString("fr-FR")} kWh`],
                  ["Reste à charge", `${rac?.toLocaleString("fr-FR")} €`],
                  ["Économies/an", `${eco_an?.toLocaleString("fr-FR")} €`],
                  ["ROI", `${roi_ans} ans`],
                ].map(([l, v]) => (
                  <div key={l} className="flex justify-between">
                    <span className="text-muted-foreground">{l}</span>
                    <strong className={l === "ROI" || l === "Reste à charge" ? s.text : "text-foreground"}>{v}</strong>
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function VoiceAssistant({ onFillForm, onClose }) {
  const [listening, setListening] = useState(false);
  const [transcript, setTranscript] = useState("");
  const [processing, setProcessing] = useState(false);
  const [suggestion, setSuggestion] = useState(null);
  const recognitionRef = useRef(null);

  const toggle = () => {
    if (listening) {
      recognitionRef.current?.stop();
      setListening(false);
      return;
    }
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) { alert("Reconnaissance vocale non supportée. Utilisez Chrome."); return; }
    const r = new SR();
    r.lang = "fr-FR"; r.continuous = true; r.interimResults = true;
    r.onresult = (e) => setTranscript(Array.from(e.results).map(x => x[0].transcript).join(" "));
    r.onend = () => setListening(false);
    r.start();
    recognitionRef.current = r;
    setListening(true);
  };

  const analyze = async () => {
    if (!transcript) return;
    setProcessing(true);
    try {
      const text = await callAnthropic(buildVoicePrompt(transcript));
      const match = text.match(/\{[\s\S]*\}/);
      setSuggestion(JSON.parse(match ? match[0] : text));
    } catch (e) { console.error(e); }
    finally { setProcessing(false); }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="bg-card border border-border rounded-2xl p-6 w-full max-w-lg mx-4 shadow-2xl">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2"><Mic className="w-5 h-5 text-violet-400" /><h3 className="font-semibold">Assistant vocal</h3></div>
          <button onClick={onClose}><X className="w-5 h-5 text-muted-foreground" /></button>
        </div>
        <p className="text-sm text-muted-foreground mb-4">Décrivez la situation du client — l'IA remplira le formulaire.</p>
        <div className="flex gap-3 mb-4">
          <button onClick={toggle}
            className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-xl font-semibold text-sm ${listening ? "bg-red-500 text-white animate-pulse" : "bg-violet-600 text-white hover:bg-violet-500"}`}>
            {listening ? <><MicOff className="w-4 h-4" /> Arrêter</> : <><Mic className="w-4 h-4" /> Parler</>}
          </button>
          {transcript && !processing && (
            <button onClick={analyze} className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl bg-amber-500 text-black font-semibold text-sm hover:bg-amber-400">
              <Sparkles className="w-4 h-4" /> Analyser
            </button>
          )}
        </div>
        {transcript && <div className="bg-secondary/40 rounded-lg p-3 text-sm mb-4 min-h-[60px]"><span className="text-xs text-muted-foreground block mb-1">Transcription :</span>{transcript}</div>}
        {processing && <div className="flex items-center justify-center gap-2 py-4 text-muted-foreground"><Loader2 className="w-4 h-4 animate-spin" /><span className="text-sm">Analyse en cours…</span></div>}
        {suggestion && (
          <div className="space-y-3">
            <div className="bg-violet-500/10 border border-violet-500/20 rounded-lg p-3">
              <div className="text-xs font-semibold text-violet-400 mb-1">💡 Suggestion IA</div>
              <p className="text-sm">{suggestion.suggestion_message}</p>
            </div>
            <div className="text-xs text-muted-foreground space-y-1">
              {suggestion.first_name && <div>Prénom : <strong className="text-foreground">{suggestion.first_name}</strong></div>}
              {suggestion.address && <div>Adresse : <strong className="text-foreground">{suggestion.address}</strong></div>}
              {suggestion.panel_count_suggestion && <div>Panneaux suggérés : <strong className="text-amber-400">{suggestion.panel_count_suggestion}</strong></div>}
            </div>
            <button onClick={() => { onFillForm(suggestion); onClose(); }}
              className="w-full py-2.5 bg-primary text-primary-foreground rounded-lg font-semibold text-sm hover:bg-primary/90">
              ✨ Remplir le formulaire automatiquement
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

function EmailModal({ emailContent, clientName, onClose }) {
  const [copied, setCopied] = useState(false);
  const text = (emailContent || "").replace(/\\n/g, "\n");
  const copy = () => { navigator.clipboard.writeText(text); setCopied(true); setTimeout(() => setCopied(false), 2000); };
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="bg-card border border-border rounded-2xl p-6 w-full max-w-xl mx-4 shadow-2xl">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2"><Mail className="w-5 h-5 text-primary" /><h3 className="font-semibold">Email de suivi — {clientName}</h3></div>
          <button onClick={onClose}><X className="w-5 h-5 text-muted-foreground" /></button>
        </div>
        <textarea className="w-full h-56 bg-secondary/40 border border-border rounded-lg p-3 text-sm resize-none focus:outline-none" value={text} readOnly />
        <div className="flex gap-3 mt-3">
          <button onClick={copy} className="flex-1 py-2.5 bg-primary text-primary-foreground rounded-lg font-semibold text-sm">{copied ? "✓ Copié !" : "📋 Copier"}</button>
          <button onClick={() => { window.location.href = `mailto:?subject=Votre étude solaire&body=${encodeURIComponent(text)}`; }}
            className="flex-1 py-2.5 border border-border rounded-lg font-semibold text-sm hover:bg-secondary/40">✉️ Ouvrir email</button>
        </div>
      </div>
    </div>
  );
}

export default function SolarAI({ pans = [], panel, settings, address, totalPanels, pvgisData, aidData, clientName, onApplyRecommendation, onFillFormFromVoice }) {
  const [loading,    setLoading]    = useState(false);
  const [result,     setResult]     = useState(null);
  const [error,      setError]      = useState(null);
  const [expanded,   setExpanded]   = useState(true);
  const [showVoice,  setShowVoice]  = useState(false);
  const [showEmail,  setShowEmail]  = useState(false);

  const canAnalyze = pans.length > 0 && panel;

  const analyze = async () => {
    if (!canAnalyze) return;
    setLoading(true); setError(null); setResult(null);
    try {
      const json = await askClaude(buildPrompt({ pans, panel, settings, address, pvgisData, aidData }));
      setResult(json); setExpanded(true);
    } catch (e) {
      setError("Analyse impossible. Vérifiez votre connexion.");
    } finally { setLoading(false); }
  };

  const prioColor = p => ({ haute: "bg-emerald-500/15 text-emerald-400 border-emerald-500/30", moyenne: "bg-amber-500/15 text-amber-400 border-amber-500/30", basse: "bg-red-500/15 text-red-400 border-red-500/30" }[p] || "bg-secondary text-muted-foreground border-border");

  return (
    <>
      {showVoice && <VoiceAssistant onFillForm={onFillFormFromVoice || (() => {})} onClose={() => setShowVoice(false)} />}
      {showEmail && result?.email_suivi && <EmailModal emailContent={result.email_suivi} clientName={clientName || "client"} onClose={() => setShowEmail(false)} />}

      <div className="rounded-xl border border-border bg-card overflow-hidden">
        {/* Header */}
        <div className="px-4 py-3 border-b border-border bg-gradient-to-r from-violet-500/10 to-primary/10 flex items-center gap-2 flex-wrap">
          <Sparkles className="w-4 h-4 text-violet-400 flex-shrink-0" />
          <h3 className="text-sm font-semibold flex-1">Analyse IA — Recommandations solaires</h3>
          <button onClick={() => setShowVoice(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-violet-500/15 border border-violet-500/30 text-violet-400 text-xs font-semibold hover:bg-violet-500/25">
            <Mic className="w-3.5 h-3.5" /> Vocal
          </button>
          {result && <>
            <button onClick={() => setShowEmail(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-primary/15 border border-primary/30 text-primary text-xs font-semibold hover:bg-primary/25">
              <Mail className="w-3.5 h-3.5" /> Email
            </button>
            <button onClick={() => setExpanded(e => !e)} className="text-muted-foreground hover:text-foreground">
              {expanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            </button>
          </>}
          <Button size="sm" onClick={analyze} disabled={!canAnalyze || loading} className="bg-violet-600 hover:bg-violet-500 text-white gap-1.5">
            {loading ? <><Loader2 className="w-3.5 h-3.5 animate-spin" />Analyse…</> : <><Sparkles className="w-3.5 h-3.5" />{result ? "Relancer" : "Analyser"}</>}
          </Button>
        </div>

        {/* Badge PVGIS */}
        {pvgisData && (
          <div className="px-4 py-2 bg-emerald-500/8 border-b border-emerald-500/20 text-xs text-emerald-400">
            🛰️ Données réelles PVGIS : <strong>{pvgisData.annualKwhPerKwc} kWh/kWc/an</strong> · Angle optimal : <strong>{pvgisData.optimalAngle}°</strong>
          </div>
        )}

        {/* Placeholder */}
        {!result && !loading && !error && (
          <div className="px-4 py-8 text-center">
            <Sparkles className="w-8 h-8 text-violet-400/30 mx-auto mb-2" />
            <p className="text-sm text-muted-foreground">
              {canAnalyze ? "Cliquez sur \"Analyser\" pour obtenir les recommandations IA, scénarios et email de suivi." : "Tracez au moins un pan de toiture pour activer l'analyse IA."}
            </p>
          </div>
        )}

        {error && <div className="px-4 py-3 text-sm text-red-400 bg-red-500/8">❌ {error}</div>}

        {loading && (
          <div className="px-4 py-8 flex flex-col items-center gap-3">
            <div className="flex gap-1">{[0,1,2].map(i => <div key={i} className="w-2 h-2 bg-violet-400 rounded-full animate-bounce" style={{ animationDelay: `${i*0.15}s` }} />)}</div>
            <p className="text-sm text-muted-foreground">Claude analyse votre toiture…</p>
          </div>
        )}

        {result && expanded && (
          <div className="p-4 space-y-4">
            {/* Score */}
            <div className="flex items-center gap-4">
              <ScoreRing score={result.score_global} />
              <div>
                <div className="font-semibold text-base">{result.verdict}</div>
                {result.alerte && <div className="text-xs text-amber-400 mt-1">⚠️ {result.alerte}</div>}
                {result.angle_optimal_recommande && (
                  <div className="text-xs text-muted-foreground mt-0.5">Angle optimal : <strong className="text-primary">{result.angle_optimal_recommande}°</strong> · Orientation : <strong className="text-primary">{result.orientation_optimale}</strong></div>
                )}
              </div>
            </div>

            {/* Obstacles */}
            {result.detection_obstacles?.length > 0 && (
              <div className="bg-amber-500/8 border border-amber-500/20 rounded-lg p-3">
                <div className="text-xs font-semibold text-amber-400 mb-1">🔍 Obstacles détectés</div>
                {result.detection_obstacles.map((o, i) => <div key={i} className="text-xs text-muted-foreground">• {o}</div>)}
              </div>
            )}

            {/* Répartition */}
            {result.recommandation_panneaux?.repartition?.length > 0 && (
              <div>
                <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">☀️ Répartition recommandée ({result.recommandation_panneaux.total_optimal} panneaux)</div>
                <div className="space-y-2">
                  {result.recommandation_panneaux.repartition.map((r, i) => (
                    <div key={i} className="flex items-center gap-3 text-sm bg-secondary/20 rounded-lg px-3 py-2">
                      <span className="text-muted-foreground w-10 text-xs flex-shrink-0">Pan {r.pan}</span>
                      <span className="font-bold w-6 flex-shrink-0">{r.nb_recommandes}</span>
                      <span className={`px-2 py-0.5 rounded-full text-xs border flex-shrink-0 ${prioColor(r.priorite)}`}>{r.priorite}</span>
                      <span className="text-muted-foreground text-xs flex-1">{r.raison}</span>
                    </div>
                  ))}
                </div>
                {onApplyRecommendation && (
                  <Button size="sm" variant="outline" className="mt-3 text-violet-400 border-violet-500/30 hover:bg-violet-500/10"
                    onClick={() => onApplyRecommendation(result.recommandation_panneaux)}>
                    ✨ Appliquer cette répartition
                  </Button>
                )}
              </div>
            )}

            {/* KPIs */}
            <div className="grid grid-cols-3 gap-3">
              {[
                { v: result.production_annuelle_estimee?.toLocaleString("fr-FR"), u: "kWh/an", c: "text-primary" },
                { v: `${result.economies_annuelles_estimees?.toLocaleString("fr-FR")} €`, u: "/an", c: "text-emerald-400" },
                { v: result.roi_estime_ans, u: "ans", c: "text-amber-400" },
              ].map(({ v, u, c }, i) => (
                <div key={i} className="bg-secondary/40 rounded-lg p-3 text-center">
                  <div className={`text-lg font-bold ${c}`}>{v}<span className="text-xs text-muted-foreground ml-0.5">{u}</span></div>
                </div>
              ))}
            </div>

            {/* Scénarios */}
            <ScenarioComparison scenarios={result.scenarios} />

            {/* Conseils */}
            <div className="bg-violet-500/8 border border-violet-500/20 rounded-lg p-3 space-y-2">
              <div className="text-xs font-semibold text-violet-400 uppercase tracking-wider">💡 Conseils</div>
              <p className="text-sm">{result.conseil_disposition}</p>
              {result.conseil_orientation_panneaux && <p className="text-xs text-muted-foreground border-t border-violet-500/20 pt-2">{result.conseil_orientation_panneaux}</p>}
              {result.financement_suggestion && <p className="text-xs text-primary border-t border-violet-500/20 pt-2">💰 {result.financement_suggestion}</p>}
            </div>

            {/* Points forts / attention */}
            <div className="grid grid-cols-2 gap-4">
              {result.points_forts?.length > 0 && (
                <div>
                  <div className="text-xs font-semibold text-emerald-400 mb-1">✅ Points forts</div>
                  {result.points_forts.map((p, i) => <div key={i} className="text-xs text-muted-foreground">• {p}</div>)}
                </div>
              )}
              {result.points_attention?.length > 0 && (
                <div>
                  <div className="text-xs font-semibold text-amber-400 mb-1">⚠️ Points d'attention</div>
                  {result.points_attention.map((p, i) => <div key={i} className="text-xs text-muted-foreground">• {p}</div>)}
                </div>
              )}
            </div>

            {/* Bouton email */}
            {result.email_suivi && (
              <button onClick={() => setShowEmail(true)}
                className="w-full flex items-center justify-center gap-2 py-2.5 border border-primary/30 text-primary rounded-lg text-sm font-semibold hover:bg-primary/10">
                <Mail className="w-4 h-4" /> Générer l'email de suivi client
              </button>
            )}

            <div className="text-xs text-muted-foreground/40 text-right">Analyse Claude (Anthropic) · Estimation indicative</div>
          </div>
        )}
      </div>
    </>
  );
}