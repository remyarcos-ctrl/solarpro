import React from "react";
import { TrendingUp, Banknote, Sun, Leaf, Award, Calculator } from "lucide-react";
import { formatCurrency, formatNumber } from "@/lib/solarCalculations";
import ProfitabilityChart from "./ProfitabilityChart";

function StatRow({ icon: Icon, label, value, highlight }) {
  return (
    <div className={`flex items-center justify-between py-3 px-4 rounded-lg ${highlight ? "bg-primary/10 border border-primary/20" : "bg-secondary/30"}`}>
      <div className="flex items-center gap-3">
        <Icon className={`w-4 h-4 ${highlight ? "text-primary" : "text-muted-foreground"}`} />
        <span className="text-sm text-muted-foreground">{label}</span>
      </div>
      <span className={`font-semibold ${highlight ? "text-primary" : "text-foreground"}`}>{value}</span>
    </div>
  );
}

export default function ProfitabilityStudy({ profitability, settings }) {
  if (!profitability) {
    return (
      <div className="rounded-xl bg-card border border-border p-8 text-center">
        <Calculator className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
        <p className="text-muted-foreground">Configurez l'installation pour voir l'étude de rentabilité</p>
      </div>
    );
  }

  const milestones = [5, 10, 15, 20, 25];
  const milestonesData = milestones.map(year => {
    const proj = profitability.projections.find(p => p.year === year);
    return { year, gains: proj?.cumulativeGains || 0 };
  });

  return (
    <div className="space-y-6">
      {/* Production & Consommation */}
      <div className="rounded-xl bg-card border border-border p-6">
        <h3 className="text-lg font-semibold text-foreground mb-4 flex items-center gap-2">
          <Sun className="w-5 h-5 text-primary" />
          Production & Consommation
        </h3>
        <div className="space-y-2">
          <StatRow icon={Sun} label="Production annuelle" value={`${formatNumber(profitability.annualProduction)} kWh`} />
          <StatRow icon={Leaf} label={`Autoconsommation (${settings.self_consumption_rate}%)`} value={`${formatNumber(profitability.selfConsumed)} kWh`} />
          <StatRow icon={TrendingUp} label="Surplus revendu" value={`${formatNumber(profitability.surplus)} kWh`} />
        </div>
      </div>

      {/* Revenus annuels */}
      <div className="rounded-xl bg-card border border-border p-6">
        <h3 className="text-lg font-semibold text-foreground mb-4 flex items-center gap-2">
          <Banknote className="w-5 h-5 text-primary" />
          Revenus annuels
        </h3>
        <div className="space-y-2">
          <StatRow icon={Banknote} label="Économies autoconsommation" value={`${formatCurrency(profitability.annualSavings)}/an`} />
          <StatRow icon={TrendingUp} label="Revenus revente surplus" value={`${formatCurrency(profitability.annualBuybackRevenue)}/an`} />
          <StatRow icon={Award} label="Bénéfice annuel total" value={`${formatCurrency(profitability.totalAnnualBenefit)}/an`} highlight />
        </div>
      </div>

      {/* Coûts & Financement */}
      <div className="rounded-xl bg-card border border-border p-6">
        <h3 className="text-lg font-semibold text-foreground mb-4 flex items-center gap-2">
          <Calculator className="w-5 h-5 text-primary" />
          Coûts & Financement
        </h3>
        <div className="space-y-2">
          <StatRow icon={Calculator} label="Coût panneaux" value={formatCurrency(profitability.panelCost)} />
          <StatRow icon={Calculator} label="Coût installation" value={formatCurrency(profitability.installationCost)} />
          <StatRow icon={Calculator} label="Coût total" value={formatCurrency(profitability.totalCost)} />
          {profitability.primeAutoConsommation > 0 && (
            <StatRow icon={Award} label="Prime autoconsommation" value={`- ${formatCurrency(profitability.primeAutoConsommation)}`} highlight />
          )}
          <StatRow icon={Banknote} label="Reste à charge" value={formatCurrency(profitability.resteACharge)} highlight />
        </div>
      </div>

      {/* ROI */}
      <div className="rounded-xl bg-primary/10 border border-primary/30 p-6 text-center">
        <p className="text-sm text-muted-foreground mb-2">Retour sur investissement</p>
        <p className="text-4xl font-bold text-primary">{profitability.roiYears} ans</p>
      </div>

      {/* Milestones */}
      <div className="grid grid-cols-5 gap-3">
        {milestonesData.map(({ year, gains }) => (
          <div key={year} className={`rounded-xl p-4 text-center border ${gains >= 0 ? "bg-emerald-500/10 border-emerald-500/20" : "bg-red-500/10 border-red-500/20"}`}>
            <p className="text-xs text-muted-foreground">{year} ans</p>
            <p className={`text-sm font-bold mt-1 ${gains >= 0 ? "text-emerald-400" : "text-red-400"}`}>
              {formatCurrency(gains)}
            </p>
          </div>
        ))}
      </div>

      {/* Chart */}
      <ProfitabilityChart projections={profitability.projections} />
    </div>
  );
}