import React from "react";
import { Link } from "react-router-dom";
import { Badge } from "@/components/ui/badge";
import { Eye, FolderPlus, ArrowRight } from "lucide-react";
import { STATUS_LABELS, STATUS_COLORS, PROPERTY_LABELS, formatCurrency } from "@/lib/solarCalculations";
import { motion } from "framer-motion";

export default function ClientTable({ clients }) {
  if (!clients || clients.length === 0) {
    return (
      <div className="card-elevated p-14 text-center">
        <div className="w-16 h-16 mx-auto mb-5 rounded-2xl bg-gradient-to-br from-primary/25 to-primary/5 border border-primary/20 flex items-center justify-center">
          <FolderPlus className="w-7 h-7 text-primary" />
        </div>
        <p className="text-foreground font-display font-semibold text-lg">Aucun dossier client</p>
        <p className="text-muted-foreground text-sm mt-1 mb-5">Lancez votre première simulation pour démarrer</p>
        <Link to="/nouveau-dossier">
          <button className="btn-primary-glow inline-flex items-center gap-2 font-semibold px-5 py-2.5 rounded-lg text-sm">
            Créer un premier dossier <ArrowRight className="w-4 h-4" />
          </button>
        </Link>
      </div>
    );
  }

  return (
    <div className="card-elevated overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b border-border/60 bg-gradient-to-r from-secondary/50 to-transparent">
              <th className="text-left px-6 py-4 text-[10px] font-semibold text-muted-foreground uppercase tracking-[0.15em]">Client</th>
              <th className="text-left px-6 py-4 text-[10px] font-semibold text-muted-foreground uppercase tracking-[0.15em]">Type</th>
              <th className="text-left px-6 py-4 text-[10px] font-semibold text-muted-foreground uppercase tracking-[0.15em]">Statut</th>
              <th className="text-left px-6 py-4 text-[10px] font-semibold text-muted-foreground uppercase tracking-[0.15em]">Puissance</th>
              <th className="text-left px-6 py-4 text-[10px] font-semibold text-muted-foreground uppercase tracking-[0.15em]">Coût</th>
              <th className="text-right px-6 py-4 text-[10px] font-semibold text-muted-foreground uppercase tracking-[0.15em]">Actions</th>
            </tr>
          </thead>
          <tbody>
            {clients.map((client, idx) => (
              <motion.tr
                key={client.id}
                initial={{ opacity: 0, y: 4 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: idx * 0.04, ease: [0.16, 1, 0.3, 1] }}
                className="border-b border-border/30 last:border-0 hover:bg-gradient-to-r hover:from-primary/5 hover:to-transparent transition-colors group"
              >
                <td className="px-6 py-4">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-primary/20 to-primary/5 border border-primary/15 flex items-center justify-center text-primary font-display font-semibold text-sm">
                      {(client.first_name || '?')[0]?.toUpperCase()}{(client.last_name || '')[0]?.toUpperCase()}
                    </div>
                    <div>
                      <p className="font-display font-semibold text-foreground">{client.first_name} {client.last_name}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">{client.phone || client.email || "—"}</p>
                    </div>
                  </div>
                </td>
                <td className="px-6 py-4 text-sm text-muted-foreground">
                  {PROPERTY_LABELS[client.property_type] || "—"}
                </td>
                <td className="px-6 py-4">
                  <Badge variant="outline" className={`${STATUS_COLORS[client.status] || ""} text-[10px] font-semibold uppercase tracking-wider`}>
                    {STATUS_LABELS[client.status] || client.status}
                  </Badge>
                </td>
                <td className="px-6 py-4 text-sm text-foreground font-display font-semibold">
                  {client.total_power_kwc ? `${client.total_power_kwc} kWc` : <span className="text-muted-foreground">—</span>}
                </td>
                <td className="px-6 py-4 text-sm text-foreground font-display font-semibold">
                  {client.installation_cost ? formatCurrency(client.installation_cost) : <span className="text-muted-foreground">—</span>}
                </td>
                <td className="px-6 py-4 text-right">
                  <Link to={`/dossier/${client.id}`}
                    className="inline-flex items-center gap-1 text-xs font-semibold text-primary/90 hover:text-primary opacity-60 group-hover:opacity-100 transition">
                    <Eye className="w-3.5 h-3.5" /> Voir
                    <ArrowRight className="w-3 h-3 -ml-0.5 opacity-0 group-hover:opacity-100 group-hover:translate-x-0.5 transition" />
                  </Link>
                </td>
              </motion.tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}