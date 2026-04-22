import React, { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Mail, CheckSquare, Square, ExternalLink, AlertCircle } from "lucide-react";
import { Link } from "react-router-dom";

function fmtN(v) {
  return v != null ? new Intl.NumberFormat("fr-FR").format(Math.round(v)) : "—";
}
function fmtE(v) {
  return v != null
    ? new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR", maximumFractionDigits: 0 }).format(v)
    : "—";
}

function buildEmailBody(client, panel, profitability, settings, pans) {
  const totalKwc   = profitability?.totalPowerKwc
    ?? ((client?.panel_count || 0) * (panel?.power_wc || 410) / 1000);
  const nPanels    = client?.panel_count || "—";
  const annualProd = profitability?.annualProduction;
  const savings    = profitability?.annualSavings;
  const roi        = profitability?.roiYears;
  const totalCost  = profitability?.resteACharge ?? profitability?.totalCost;
  const panelName  = panel ? `${panel.brand || ""} ${panel.name || ""} ${panel.power_wc || ""}Wc`.trim() : "—";
  const panelDims  = panel ? `${panel.width_mm || "—"} × ${panel.height_mm || "—"} mm` : "—";
  const nPans      = pans?.length || "—";
  const roofArea   = pans?.reduce((s, p) => s + (p.area || 0), 0);

  return [
    "Bonjour,",
    "",
    "Dans le cadre d'un projet d'installation photovoltaïque, nous sollicitons votre meilleure offre (avoir fournisseur).",
    "",
    "─── INFORMATIONS CLIENT ───────────────────────",
    `Nom         : ${client?.first_name || ""} ${client?.last_name || ""}`.trim(),
    `Adresse     : ${client?.address || "—"}`,
    `Type de bien: ${client?.property_type || "maison"}`,
    "",
    "─── CONFIGURATION PROJET ──────────────────────",
    `Nombre de panneaux  : ${nPanels}`,
    `Puissance totale    : ${typeof totalKwc === "number" ? (Math.round(totalKwc * 100) / 100) : "—"} kWc`,
    `Modèle panneau      : ${panelName}`,
    `Dimensions panneau  : ${panelDims}`,
    `Pans de toit        : ${nPans}`,
    `Surface toit totale : ${roofArea > 0 ? fmtN(roofArea) + " m²" : "—"}`,
    "",
    "─── DONNÉES TECHNIQUES ────────────────────────",
    `Production annuelle estimée : ${annualProd ? fmtN(annualProd) + " kWh/an" : "—"}`,
    "",
    "─── ANALYSE FINANCIÈRE ────────────────────────",
    `Coût total (reste à charge) : ${fmtE(totalCost)}`,
    `Économies annuelles         : ${fmtE(savings)}`,
    `Retour sur investissement   : ${roi ? fmtN(roi) + " ans" : "—"}`,
    "",
    "───────────────────────────────────────────────",
    "",
    "Merci de nous faire parvenir votre meilleure offre pour ce matériel.",
    "",
    "Cordialement,",
    settings?.company_name || "SolarPro",
    settings?.company_phone ? `Tél : ${settings.company_phone}` : null,
    settings?.company_email ? `Email : ${settings.company_email}` : null,
    settings?.company_siret ? `SIRET : ${settings.company_siret}` : null,
  ].filter(l => l !== null).join("\n");
}

export default function SupplierMailDialog({ client, panel, profitability, settings, pans }) {
  const [selected, setSelected] = useState(new Set());
  const [open, setOpen] = useState(false);

  const suppliers = settings?.suppliers ?? [];

  const toggle = (i) =>
    setSelected(prev => { const n = new Set(prev); n.has(i) ? n.delete(i) : n.add(i); return n; });

  const toggleAll = () =>
    setSelected(selected.size === suppliers.length ? new Set() : new Set(suppliers.map((_, i) => i)));

  const handleSend = () => {
    const subject = `Demande de devis - Installation solaire - ${client?.first_name || ""} ${client?.last_name || ""} - ${client?.address || ""}`.trim();
    const body    = buildEmailBody(client, panel, profitability, settings, pans);
    const emails  = suppliers.filter((_, i) => selected.has(i)).map(s => s.email).filter(Boolean);
    if (!emails.length) return;
    window.open(`mailto:${emails.join(",")}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`);
    setOpen(false);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm"
          className="border-sky-500/40 text-sky-300 hover:bg-sky-500/10 hover:border-sky-500/60">
          <Mail className="w-4 h-4 mr-1.5" /> Mail fournisseur
        </Button>
      </DialogTrigger>

      <DialogContent className="max-w-xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Mail className="w-5 h-5 text-sky-400" />
            Demande de devis fournisseur
          </DialogTitle>
        </DialogHeader>

        {suppliers.length === 0 ? (
          <div className="flex flex-col items-center gap-4 py-8 text-center">
            <AlertCircle className="w-10 h-10 text-amber-400" />
            <div>
              <p className="text-sm font-medium text-foreground mb-1">Aucun fournisseur configuré</p>
              <p className="text-xs text-muted-foreground">
                Ajoutez vos fournisseurs dans les paramètres pour pouvoir envoyer des demandes de devis.
              </p>
            </div>
            <Link to="/settings" onClick={() => setOpen(false)}>
              <Button variant="outline" size="sm">
                Configurer les fournisseurs <ExternalLink className="w-3.5 h-3.5 ml-1.5" />
              </Button>
            </Link>
          </div>
        ) : (
          <div className="space-y-5 mt-1">

            {/* Sélection destinataires */}
            <div>
              <div className="flex items-center justify-between mb-2.5">
                <p className="text-sm font-semibold text-foreground">Destinataires</p>
                <button className="text-xs text-primary hover:underline" onClick={toggleAll}>
                  {selected.size === suppliers.length ? "Tout désélectionner" : "Tout sélectionner"}
                </button>
              </div>
              <div className="space-y-1.5">
                {suppliers.map((s, i) => (
                  <button key={i} onClick={() => toggle(i)}
                    className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg border transition-all text-left ${
                      selected.has(i)
                        ? "border-sky-500/50 bg-sky-500/10"
                        : "border-border bg-secondary/30 hover:border-border/70"
                    }`}>
                    {selected.has(i)
                      ? <CheckSquare className="w-4 h-4 text-sky-400 flex-shrink-0" />
                      : <Square className="w-4 h-4 text-muted-foreground flex-shrink-0" />}
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-foreground truncate">{s.name}</p>
                      <p className="text-xs text-muted-foreground truncate">{s.email}</p>
                    </div>
                  </button>
                ))}
              </div>
            </div>

            {/* Aperçu de l'avoir */}
            <div>
              <p className="text-sm font-semibold text-foreground mb-2">Aperçu de l'avoir</p>
              <div className="rounded-lg border border-border bg-secondary/20 p-3 max-h-56 overflow-y-auto">
                <pre className="text-[11px] font-mono text-muted-foreground whitespace-pre-wrap leading-relaxed">
                  {buildEmailBody(client, panel, profitability, settings, pans)}
                </pre>
              </div>
            </div>

            {/* Actions */}
            <div className="flex items-center justify-between pt-1 border-t border-border">
              <p className="text-xs text-muted-foreground">
                {selected.size > 0
                  ? `${selected.size} fournisseur${selected.size > 1 ? "s" : ""} sélectionné${selected.size > 1 ? "s" : ""}`
                  : "Aucun fournisseur sélectionné"}
              </p>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={() => setOpen(false)}>Annuler</Button>
                <Button size="sm" disabled={selected.size === 0} onClick={handleSend}
                  className="bg-sky-600 hover:bg-sky-500 text-white disabled:opacity-40">
                  <Mail className="w-4 h-4 mr-1.5" />
                  Envoyer ({selected.size})
                </Button>
              </div>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
