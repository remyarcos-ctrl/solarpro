import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { FileText, Loader2 } from "lucide-react";
import { jsPDF } from "jspdf";

function getQRUrl(text) {
  return `https://api.qrserver.com/v1/create-qr-code/?size=80x80&data=${encodeURIComponent(text)}`;
}

function getMonthlyProduction(annualKwh, pvgisMonthly) {
  if (pvgisMonthly && pvgisMonthly.length > 0) {
    const total = pvgisMonthly.reduce((s, m) => s + m.kWhPerKwc, 0);
    return pvgisMonthly.map(m => Math.round((m.kWhPerKwc / total) * annualKwh));
  }
  const coeffs = [0.042, 0.058, 0.085, 0.105, 0.118, 0.122, 0.125, 0.112, 0.090, 0.068, 0.044, 0.031];
  return coeffs.map(c => Math.round(c * annualKwh));
}

const MONTHS = ["Jan", "Fév", "Mar", "Avr", "Mai", "Jun", "Jul", "Aoû", "Sep", "Oct", "Nov", "Déc"];

export default function ExportPdfButton({ client, panel, profitability, settings, pvgisData, pans }) {
  const [exporting, setExporting] = useState(false);

  const exportPdf = async () => {
    if (!client || !profitability) return;
    setExporting(true);
    try {
      const doc = new jsPDF("p", "mm", "a4");
      const W = 210, H = 297, M = 15, CW = W - M * 2;
      const GOLD  = [232, 160, 32];
      const DARK  = [13, 17, 23];
      const DARK2 = [22, 27, 36];
      const DARK3 = [30, 37, 48];
      const WHITE = [232, 237, 245];
      const GRAY  = [100, 110, 130];
      const GREEN = [46, 204, 113];
      const BLUE  = [59, 130, 246];
      const fmt  = v => new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR", maximumFractionDigits: 0 }).format(v || 0);
      const fmtN = v => new Intl.NumberFormat("fr-FR").format(v || 0);

      // PAGE 1
      doc.setFillColor(...DARK); doc.rect(0, 0, W, H, "F");
      doc.setFillColor(...GOLD); doc.rect(0, 0, W, 52, "F");
      doc.setTextColor(...DARK);
      doc.setFontSize(24); doc.setFont("helvetica", "bold");
      doc.text(settings?.company_name || "SolarPro", M, 22);
      doc.setFontSize(9); doc.setFont("helvetica", "normal");
      doc.text("ÉNERGIE SOLAIRE PHOTOVOLTAÏQUE", M, 30);
      doc.setFontSize(8);
      doc.text(new Date().toLocaleDateString("fr-FR"), W - M, 18, { align: "right" });
      doc.text(`Réf. SP-${Date.now().toString().slice(-6)}`, W - M, 24, { align: "right" });
      doc.setTextColor(...WHITE);
      doc.setFontSize(28); doc.setFont("helvetica", "bold");
      doc.text("Étude Photovoltaïque", M, 75);
      doc.text("Personnalisée", M, 88);
      doc.setFontSize(10); doc.setFont("helvetica", "normal");
      doc.setTextColor(...GRAY);
      doc.text("Simulation complète · Analyse financière · Recommandations IA", M, 98);
      doc.setFillColor(...DARK2); doc.roundedRect(M, 108, CW, 38, 3, 3, "F");
      doc.setTextColor(...GOLD); doc.setFontSize(8); doc.setFont("helvetica", "bold");
      doc.text("CLIENT", M + 8, 118);
      doc.setTextColor(...WHITE); doc.setFontSize(14); doc.setFont("helvetica", "bold");
      doc.text(`${client.first_name || ""} ${client.last_name || ""}`, M + 8, 127);
      doc.setFontSize(9); doc.setFont("helvetica", "normal"); doc.setTextColor(...GRAY);
      doc.text(client.address || "—", M + 8, 135);
      doc.text(`${client.phone || ""} · ${client.email || ""}`, M + 8, 141);
      const kpis = [
        { v: `${profitability.totalPowerKwc} kWc`, l: "Puissance" },
        { v: `${fmtN(profitability.annualProduction)} kWh`, l: "Production/an" },
        { v: fmt(profitability.resteACharge), l: "Reste à charge" },
        { v: `${profitability.roiYears} ans`, l: "Retour invest." },
      ];
      const kw = CW / kpis.length;
      kpis.forEach((k, i) => {
        const x = M + i * kw;
        doc.setFillColor(...DARK3); doc.rect(x, 152, kw - 2, 28, "F");
        doc.setTextColor(...GOLD); doc.setFontSize(13); doc.setFont("helvetica", "bold");
        doc.text(k.v, x + kw / 2 - 1, 165, { align: "center" });
        doc.setTextColor(...GRAY); doc.setFontSize(7); doc.setFont("helvetica", "normal");
        doc.text(k.l, x + kw / 2 - 1, 173, { align: "center" });
      });
      if (client.roof_capture) {
        try {
          doc.addImage(client.roof_capture, "PNG", M, 186, CW, 70);
          doc.setDrawColor(...GOLD); doc.setLineWidth(0.5); doc.rect(M, 186, CW, 70);
          doc.setFillColor(...DARK); doc.rect(M, 186, CW, 8, "F");
          doc.setTextColor(...GRAY); doc.setFontSize(7);
          doc.text("Vue satellite — Toiture avec simulation panneaux", M + 2, 192);
        } catch (_) {}
      } else {
        doc.setFillColor(...DARK3); doc.roundedRect(M, 186, CW, 55, 2, 2, "F");
        doc.setTextColor(...GRAY); doc.setFontSize(9);
        doc.text("Capturez la carte pour inclure la vue satellite", W / 2, 218, { align: "center" });
      }
      doc.setFillColor(...GOLD); doc.rect(0, H - 12, W, 12, "F");
      doc.setTextColor(...DARK); doc.setFontSize(7);
      doc.text(`${settings?.company_name || "SolarPro"} · Page 1/3`, W / 2, H - 4, { align: "center" });

      // PAGE 2
      doc.addPage();
      doc.setFillColor(...DARK); doc.rect(0, 0, W, H, "F");
      doc.setFillColor(...GOLD); doc.rect(0, 0, W, 14, "F");
      doc.setTextColor(...DARK); doc.setFontSize(8); doc.setFont("helvetica", "bold");
      doc.text("Technique & Production mensuelle", M, 9);
      doc.setFontSize(7); doc.setFont("helvetica", "normal");
      doc.text(`${client.first_name || ""} ${client.last_name || ""} · ${new Date().toLocaleDateString("fr-FR")}`, W - M, 9, { align: "right" });
      let y = 22;
      doc.setFillColor(...DARK2); doc.roundedRect(M, y, CW, 22, 2, 2, "F");
      doc.setTextColor(...GOLD); doc.setFontSize(7); doc.setFont("helvetica", "bold");
      doc.text("PANNEAU SÉLECTIONNÉ", M + 4, y + 6);
      doc.setTextColor(...WHITE); doc.setFontSize(10); doc.setFont("helvetica", "bold");
      doc.text(`${panel?.brand || ""} ${panel?.model_name || ""} — ${panel?.power_wc || 0} Wc`, M + 4, y + 13);
      doc.setTextColor(...GRAY); doc.setFontSize(7); doc.setFont("helvetica", "normal");
      doc.text(`${panel?.height_mm || 0}mm × ${panel?.width_mm || 0}mm · Rendement : ${panel?.efficiency || 0}%`, M + 4, y + 19);
      y += 28;
      [
        ["Nombre de panneaux", `${client.panel_count || 0}`],
        ["Puissance totale", `${profitability.totalPowerKwc} kWc`],
        ["Surface toiture", `${client.roof_area || 0} m² brut · ${client.roof_area_usable || 0} m² utile`],
        ["Données production", pvgisData ? `PVGIS réel — ${pvgisData.annualKwhPerKwc} kWh/kWc/an` : `Estimation — ${settings?.regional_production || 1100} kWh/kWc/an`],
      ].forEach(([l, v]) => {
        doc.setFillColor(...DARK3); doc.rect(M, y, CW, 8, "F");
        doc.setTextColor(...GRAY); doc.setFontSize(7); doc.setFont("helvetica", "normal");
        doc.text(l, M + 3, y + 5.5);
        doc.setTextColor(...WHITE); doc.setFont("helvetica", "bold");
        doc.text(v, W - M - 3, y + 5.5, { align: "right" });
        y += 9;
      });
      // Tableau récapitulatif des pans — utilise profitability.panDetails (source unique)
      if (profitability.panDetails && profitability.panDetails.length > 0) {
        y += 5;
        doc.setTextColor(...GOLD); doc.setFontSize(9); doc.setFont("helvetica", "bold");
        doc.text("Récapitulatif des pans de toiture", M, y); y += 4;
        const panHeaders = ["Pan", "Orientation", "Incl.", "kWc", "PR", "Ombrage", "Prod./an"];
        const colW = CW / panHeaders.length;
        doc.setFillColor(...DARK3); doc.rect(M, y, CW, 7, "F");
        doc.setTextColor(...GRAY); doc.setFontSize(6); doc.setFont("helvetica", "bold");
        panHeaders.forEach((h, i) => doc.text(h, M + i * colW + 2, y + 5));
        y += 7;
        const oriMap = { S:"Sud", SE:"Sud-Est", SW:"Sud-Ouest", E:"Est", W:"Ouest", N:"Nord", NE:"Nord-Est", NW:"Nord-Ouest" };
        profitability.panDetails.forEach((pd, idx) => {
          const matchingPan = (pans || [])[idx] || {};
          const rowValues = [
            pd.label || `Pan ${idx + 1}`,
            `${oriMap[pd.orientation] || pd.orientation || "—"} ${matchingPan.azimut != null ? Math.round(matchingPan.azimut) + "°" : ""}`,
            `${pd.inclination ?? 20}°`,
            `${pd.kwc?.toFixed(2) ?? "—"}`,
            `${pd.PR ?? "—"}%`,
            `${Math.round((pd.shadingCoef ?? 100))}%`,
            `${(pd.production || 0).toLocaleString("fr-FR")} kWh`,
          ];
          const rowColor = idx % 2 === 0 ? DARK2 : DARK3;
          doc.setFillColor(...rowColor);
          doc.rect(M, y, CW, 6, "F");
          doc.setTextColor(...WHITE); doc.setFontSize(6); doc.setFont("helvetica", "normal");
          rowValues.forEach((v, i) => doc.text(v, M + i * colW + 2, y + 4.5));
          y += 6;
        });
        y += 2;
      }

      y += 5;
      doc.setTextColor(...GOLD); doc.setFontSize(9); doc.setFont("helvetica", "bold");
      doc.text("Production mensuelle estimée (kWh)", M, y); y += 4;
      const monthly = getMonthlyProduction(profitability.annualProduction, pvgisData?.monthlyProduction);
      const maxM = Math.max(...monthly);
      const chartH = 45, barW = CW / 12 - 2;
      doc.setFillColor(...DARK2); doc.rect(M, y, CW, chartH, "F");
      monthly.forEach((val, i) => {
        const bh = (val / maxM) * (chartH - 14);
        const bx = M + i * (CW / 12) + 1;
        const by = y + chartH - bh - 8;
        const ratio = val / maxM;
        doc.setFillColor(Math.round(232 * ratio), Math.round(160 * ratio), Math.round(32 * ratio));
        doc.rect(bx, by, barW, bh, "F");
        doc.setTextColor(...GRAY); doc.setFontSize(5);
        doc.text(MONTHS[i], bx + barW / 2, y + chartH - 2, { align: "center" });
        if (val > 0) { doc.setTextColor(...WHITE); doc.setFontSize(4.5); doc.text(`${val}`, bx + barW / 2, by - 1, { align: "center" }); }
      });
      y += chartH + 8;
      doc.setTextColor(...GOLD); doc.setFontSize(9); doc.setFont("helvetica", "bold");
      doc.text("Bilan production & consommation", M, y); y += 6;
      const autoRate = profitability.selfConsRate ?? (settings?.self_consumption_rate || 50);
      const autoLabel = profitability.consMode === 'monthly+battery'
        ? `Autoconsommation (${autoRate}%, calcul mensuel + batterie)`
        : profitability.consMode === 'monthly'
        ? `Autoconsommation (${autoRate}%, calcul mensuel réel)`
        : `Autoconsommation (${autoRate}%, taux fixe)`;
      const bilanLines = [
        ["Production annuelle", `${fmtN(profitability.annualProduction)} kWh`, WHITE],
        [autoLabel, `${fmtN(profitability.selfConsumed)} kWh`, GREEN],
        [profitability.surplusMode === 'bv' ? "Surplus stocké (batterie virtuelle)" : "Surplus injecté réseau", `${fmtN(profitability.surplus)} kWh`, BLUE],
        ["Économies sur facture", `${fmt(profitability.annualSavings)}/an`, GREEN],
        [profitability.surplusMode === 'bv' ? "Surplus stocké en BV (net déstockage)" : "Revenus revente surplus", `${fmt(profitability.annualBuybackRevenue)}/an`, BLUE],
        ...(profitability.surplusMode === 'bv' && profitability.bvAboAnnual > 0
          ? [["Abonnement batterie virtuelle", `- ${fmt(profitability.bvAboAnnual)}/an`, GRAY]]
          : []),
        ["Bénéfice annuel total", `${fmt(profitability.totalAnnualBenefit)}/an`, GOLD],
        ["CO₂ évité sur 25 ans", `${fmtN(profitability.co2SavedKg || 0)} kg`, GREEN],
      ];
      bilanLines.forEach(([l, v, c]) => {
        doc.setFillColor(...DARK3); doc.rect(M, y, CW, 8, "F");
        doc.setTextColor(...GRAY); doc.setFontSize(7); doc.setFont("helvetica", "normal");
        doc.text(l, M + 3, y + 5.5);
        doc.setTextColor(...c); doc.setFont("helvetica", "bold");
        doc.text(v, W - M - 3, y + 5.5, { align: "right" });
        y += 9;
      });
      doc.setFillColor(...GOLD); doc.rect(0, H - 12, W, 12, "F");
      doc.setTextColor(...DARK); doc.setFontSize(7);
      doc.text(`${settings?.company_name || "SolarPro"} · Page 2/3`, W / 2, H - 4, { align: "center" });

      // PAGE 3
      doc.addPage();
      doc.setFillColor(...DARK); doc.rect(0, 0, W, H, "F");
      doc.setFillColor(...GOLD); doc.rect(0, 0, W, 14, "F");
      doc.setTextColor(...DARK); doc.setFontSize(8); doc.setFont("helvetica", "bold");
      doc.text("Étude de rentabilité & Projection 25 ans", M, 9);
      doc.setFontSize(7); doc.setFont("helvetica", "normal");
      doc.text(`${client.first_name || ""} ${client.last_name || ""} · ${new Date().toLocaleDateString("fr-FR")}`, W - M, 9, { align: "right" });
      y = 22;
      doc.setTextColor(...GOLD); doc.setFontSize(9); doc.setFont("helvetica", "bold");
      doc.text("Investissement & Financement", M, y); y += 6;
      const costLines = [
        ["Panneaux", fmt(profitability.panelCost), WHITE],
        ["Installation & pose", fmt(profitability.installationCost), WHITE],
      ];
      if (profitability.batteryCost > 0) {
        costLines.push(["Batterie de stockage", fmt(profitability.batteryCost), WHITE]);
      }
      if (profitability.bvAdhesion > 0) {
        costLines.push(["Adhésion batterie virtuelle (Urban Solar)", fmt(profitability.bvAdhesion), WHITE]);
      }
      costLines.push(["Coût total brut", fmt(profitability.totalCost), WHITE]);
      if (profitability.primeAutoConsommation > 0) {
        costLines.push(["Prime à l'autoconsommation", `- ${fmt(profitability.primeAutoConsommation)}`, GREEN]);
      }
      costLines.push(
        ["Reste à charge", fmt(profitability.resteACharge), GOLD],
        ["Retour sur investissement", `${profitability.roiYears} ans`, GREEN],
      );
      if (profitability.inverterReplacementCost > 0) {
        costLines.push([
          `Remplacement onduleur (année ${profitability.inverterReplacementYear})`,
          `- ${fmt(profitability.inverterReplacementCost)}`,
          GRAY,
        ]);
      }
      costLines.forEach(([l, v, c]) => {
        doc.setFillColor(...DARK3); doc.rect(M, y, CW, 8, "F");
        doc.setTextColor(...GRAY); doc.setFontSize(7); doc.setFont("helvetica", "normal");
        doc.text(l, M + 3, y + 5.5);
        doc.setTextColor(...c); doc.setFont("helvetica", "bold");
        doc.text(v, W - M - 3, y + 5.5, { align: "right" });
        y += 9;
      });
      y += 4;
      doc.setTextColor(...GOLD); doc.setFontSize(9); doc.setFont("helvetica", "bold");
      doc.text("Gains cumulés sur 25 ans", M, y); y += 4;
      const projections = profitability.projections || [];
      const maxGain = Math.max(...projections.map(p => Math.abs(p.cumulativeGains)), 1);
      const gChartH = 40;
      doc.setFillColor(...DARK2); doc.rect(M, y, CW, gChartH, "F");
      const zeroY = y + gChartH * 0.45;
      doc.setDrawColor(...GRAY); doc.setLineWidth(0.2);
      doc.line(M, zeroY, M + CW, zeroY);
      const barGW = CW / 25 - 1;
      projections.slice(0, 25).forEach((p, i) => {
        const v = p.cumulativeGains;
        const maxH = gChartH * 0.42;
        const bh = Math.min(Math.abs(v) / maxGain * maxH, maxH);
        const bx = M + i * (CW / 25) + 0.5;
        doc.setFillColor(...(v >= 0 ? GREEN : [239, 68, 68]));
        if (v >= 0) doc.rect(bx, zeroY - bh, barGW, bh, "F");
        else doc.rect(bx, zeroY, barGW, bh, "F");
        if ([5, 10, 15, 20, 25].includes(i + 1)) {
          doc.setTextColor(...GRAY); doc.setFontSize(4.5);
          doc.text(`${i + 1}a`, bx + barGW / 2, y + gChartH - 1, { align: "center" });
        }
      });
      y += gChartH + 6;
      const milestones = [5, 10, 15, 20, 25].map(yr => ({ yr, gains: projections.find(x => x.year === yr)?.cumulativeGains || 0 }));
      doc.setFillColor(...DARK2); doc.rect(M, y, CW, 10, "F");
      doc.setTextColor(...GOLD); doc.setFontSize(7); doc.setFont("helvetica", "bold");
      milestones.forEach((m, i) => { doc.text(`${m.yr} ans`, M + i * (CW / 5) + CW / 10, y + 5, { align: "center" }); });
      y += 10;
      doc.setFillColor(...DARK3); doc.rect(M, y, CW, 10, "F");
      milestones.forEach((m, i) => {
        const cx = M + i * (CW / 5) + CW / 10;
        doc.setTextColor(m.gains >= 0 ? GREEN[0] : 239, m.gains >= 0 ? GREEN[1] : 68, m.gains >= 0 ? GREEN[2] : 68);
        doc.setFontSize(7); doc.setFont("helvetica", "bold");
        doc.text(`${m.gains >= 0 ? "+" : ""}${fmt(m.gains)}`, cx, y + 6.5, { align: "center" });
      });
      y += 14;
      doc.setTextColor(...GOLD); doc.setFontSize(8); doc.setFont("helvetica", "bold");
      doc.text("Hypothèses de calcul", M, y); y += 5;
      const tariffLabel = profitability.tariff === 'hphc'
        ? `HP/HC — autoconso valorisée à ${(profitability.autoElecPrice || settings?.electricity_price_hp || 0.255).toFixed(4).replace('.', ',')} €/kWh (prix HP)`
        : `Tarif Bleu Base — ${(profitability.autoElecPrice || settings?.electricity_price || 0.2001).toFixed(4).replace('.', ',')} €/kWh`;
      const profileLabels = {
        standard: 'résidence principale',
        electric_heating: 'chauffage électrique',
        heat_pump: 'pompe à chaleur',
        secondary: 'résidence secondaire',
        teletravail: 'télétravail',
        business: 'commerce / tertiaire',
      };
      const hyps = [
        `Production : ${pvgisData?.annualKwhPerKwc || settings?.regional_production || 1100} kWh/kWc/an${pvgisData ? ' (PVGIS réel)' : ''}`,
        `Performance Ratio moyen (PR) : ${profitability.avgPR || '—'}% (E_y/H(i)_y × ombrage)`,
        tariffLabel,
        profitability.surplusMode === 'bv'
          ? `Surplus stocké en batterie virtuelle Urban Solar — déstockage ${(profitability.bvDestockage ?? 0.10).toFixed(2).replace('.', ',')} €/kWh, abonnement ${fmt(profitability.bvAboAnnual)}/an`
          : `Tarif rachat surplus : ${(settings?.buyback_rate ?? 0.011).toFixed(4).replace('.', ',')} €/kWh (indexé +2%/an, contrat 20 ans)`,
      ];
      if (profitability.consMode === 'monthly' || profitability.consMode === 'monthly+battery') {
        hyps.push(`Conso foyer : ${fmtN(profitability.annualConsKwh)} kWh/an — profil « ${profileLabels[profitability.profileKey] || profitability.profileKey} »`);
        hyps.push(`Autoconsommation : ${profitability.selfConsRate}% (calcul mensuel réel)`);
      } else {
        hyps.push(`Autoconsommation : ${profitability.selfConsRate || settings?.self_consumption_rate || 50}% (taux fixe)`);
      }
      if (profitability.batteryKwh > 0) {
        hyps.push(`Batterie : ${profitability.batteryKwh} kWh (~${Math.round(profitability.batteryKwh * 30 * 0.9)} kWh stockés/mois)`);
      }
      hyps.push(
        `Inflation électricité : ${settings?.inflation_rate ?? 2}%/an`,
        `Dégradation panneaux : ${settings?.degradation_rate ?? 0.4}%/an`,
        `Facteur CO₂ mix électrique : ${Math.round((settings?.co2_kg_per_kwh ?? 0.052) * 1000)} g/kWh${settings?.co2_kg_per_kwh ? ' (RTE eCO2mix)' : ' (ADEME 2024)'}`,
      );
      doc.setFillColor(...DARK2); doc.rect(M, y, CW, hyps.length * 6 + 4, "F");
      doc.setTextColor(...GRAY); doc.setFontSize(6.5); doc.setFont("helvetica", "normal");
      hyps.forEach((h, i) => doc.text(`• ${h}`, M + 3, y + 5 + i * 6));
      y += hyps.length * 6 + 8;
      doc.setFillColor(...DARK2); doc.roundedRect(M, y, CW, 42, 2, 2, "F");
      doc.setTextColor(...GOLD); doc.setFontSize(8); doc.setFont("helvetica", "bold");
      doc.text("Validation & Prochaines étapes", M + 4, y + 7);
      doc.setTextColor(...GRAY); doc.setFontSize(7); doc.setFont("helvetica", "normal");
      ["✓ Visite technique sur site", "✓ Dossier administratif pris en charge", "✓ Installation par équipe certifiée QualiPV", "✓ Mise en service & raccordement réseau"]
        .forEach((s, i) => doc.text(s, M + 4, y + 14 + i * 5.5));
      doc.setDrawColor(...GRAY); doc.setLineWidth(0.3);
      doc.line(M + 4, y + 38, M + 75, y + 38);
      doc.line(M + CW - 75, y + 38, M + CW - 4, y + 38);
      doc.setFontSize(6);
      doc.text("Signature client", M + 4, y + 42);
      doc.text("Signature commercial", M + CW - 75, y + 42);
      try {
        const qrImg = new Image(); qrImg.crossOrigin = "anonymous";
        await new Promise((res, rej) => { qrImg.onload = res; qrImg.onerror = rej; qrImg.src = getQRUrl(`https://solarpro.fr?ref=${Date.now().toString().slice(-6)}`); });
        const cv = document.createElement("canvas"); cv.width = 80; cv.height = 80;
        cv.getContext("2d").drawImage(qrImg, 0, 0, 80, 80);
        doc.addImage(cv.toDataURL("image/png"), "PNG", W - M - 22, y + 14, 18, 18);
        doc.setTextColor(...GRAY); doc.setFontSize(5);
        doc.text("Simulation en ligne", W - M - 13, y + 34, { align: "center" });
      } catch (_) {}
      doc.setFillColor(...GOLD); doc.rect(0, H - 12, W, 12, "F");
      doc.setTextColor(...DARK); doc.setFontSize(7);
      doc.text(`${settings?.company_name || "SolarPro"} · ${settings?.company_phone || ""} · ${settings?.company_email || ""} · Page 3/3`, W / 2, H - 4, { align: "center" });
      doc.save(`Etude_Solaire_${client.first_name || "client"}_${client.last_name || ""}_${new Date().toLocaleDateString("fr-FR").replace(/\//g, "-")}.pdf`);
    } catch (e) {
      console.error("PDF error:", e);
    } finally {
      setExporting(false);
    }
  };

  return (
    <Button variant="outline" size="sm" onClick={exportPdf}
      disabled={exporting || !profitability}
      className="border-primary/30 text-primary hover:bg-primary/10 gap-2">
      {exporting ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileText className="w-4 h-4" />}
      {exporting ? "Génération…" : "Export PDF"}
    </Button>
  );
}