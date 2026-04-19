import React from "react";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
} from "recharts";
import { formatCurrency } from "@/lib/solarCalculations";

const CustomTooltip = ({ active, payload, label }) => {
  if (active && payload && payload.length) {
    return (
      <div className="bg-card border border-border rounded-lg p-3 shadow-xl">
        <p className="text-sm font-semibold text-foreground mb-1">Année {label}</p>
        <p className="text-xs text-muted-foreground">
          Gains cumulés : <span className={`font-semibold ${payload[0].value >= 0 ? "text-emerald-400" : "text-red-400"}`}>
            {formatCurrency(payload[0].value)}
          </span>
        </p>
        <p className="text-xs text-muted-foreground">
          Bénéfice annuel : <span className="font-semibold text-primary">{formatCurrency(payload[1]?.value)}</span>
        </p>
      </div>
    );
  }
  return null;
};

export default function ProfitabilityChart({ projections }) {
  if (!projections || projections.length === 0) return null;

  return (
    <div className="rounded-xl bg-card border border-border p-6">
      <h3 className="text-lg font-semibold text-foreground mb-4">Projection sur 25 ans</h3>
      <div className="h-[300px]">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={projections} margin={{ top: 10, right: 10, left: 10, bottom: 0 }}>
            <defs>
              <linearGradient id="colorGains" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#E8A020" stopOpacity={0.3} />
                <stop offset="95%" stopColor="#E8A020" stopOpacity={0} />
              </linearGradient>
              <linearGradient id="colorBenefit" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#10b981" stopOpacity={0.3} />
                <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(220 15% 18%)" />
            <XAxis dataKey="year" stroke="#718096" tick={{ fontSize: 12 }} />
            <YAxis stroke="#718096" tick={{ fontSize: 12 }} tickFormatter={(v) => `${Math.round(v / 1000)}k`} />
            <Tooltip content={<CustomTooltip />} />
            <ReferenceLine y={0} stroke="#718096" strokeDasharray="3 3" />
            <Area
              type="monotone"
              dataKey="cumulativeGains"
              stroke="#E8A020"
              fill="url(#colorGains)"
              strokeWidth={2}
              name="Gains cumulés"
            />
            <Area
              type="monotone"
              dataKey="totalBenefit"
              stroke="#10b981"
              fill="url(#colorBenefit)"
              strokeWidth={2}
              name="Bénéfice annuel"
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}