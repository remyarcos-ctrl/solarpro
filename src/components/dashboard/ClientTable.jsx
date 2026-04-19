import React from "react";
import { Link } from "react-router-dom";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Eye, MoreHorizontal } from "lucide-react";
import { STATUS_LABELS, STATUS_COLORS, PROPERTY_LABELS, formatCurrency } from "@/lib/solarCalculations";
import { motion } from "framer-motion";

export default function ClientTable({ clients }) {
  if (!clients || clients.length === 0) {
    return (
      <div className="rounded-xl bg-card border border-border p-12 text-center">
        <p className="text-muted-foreground">Aucun dossier client pour le moment</p>
        <Link to="/nouveau-dossier">
          <Button className="mt-4 bg-primary text-primary-foreground hover:bg-primary/90">
            Créer un premier dossier
          </Button>
        </Link>
      </div>
    );
  }

  return (
    <div className="rounded-xl bg-card border border-border overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b border-border bg-secondary/30">
              <th className="text-left px-6 py-4 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Client</th>
              <th className="text-left px-6 py-4 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Type</th>
              <th className="text-left px-6 py-4 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Statut</th>
              <th className="text-left px-6 py-4 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Puissance</th>
              <th className="text-left px-6 py-4 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Coût</th>
              <th className="text-right px-6 py-4 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Actions</th>
            </tr>
          </thead>
          <tbody>
            {clients.map((client, idx) => (
              <motion.tr
                key={client.id}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: idx * 0.05 }}
                className="border-b border-border/50 hover:bg-secondary/20 transition-colors"
              >
                <td className="px-6 py-4">
                  <div>
                    <p className="font-medium text-foreground">{client.first_name} {client.last_name}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">{client.phone || client.email || "—"}</p>
                  </div>
                </td>
                <td className="px-6 py-4 text-sm text-muted-foreground">
                  {PROPERTY_LABELS[client.property_type] || "—"}
                </td>
                <td className="px-6 py-4">
                  <Badge variant="outline" className={`${STATUS_COLORS[client.status] || ""} text-xs`}>
                    {STATUS_LABELS[client.status] || client.status}
                  </Badge>
                </td>
                <td className="px-6 py-4 text-sm text-foreground">
                  {client.total_power_kwc ? `${client.total_power_kwc} kWc` : "—"}
                </td>
                <td className="px-6 py-4 text-sm text-foreground">
                  {client.installation_cost ? formatCurrency(client.installation_cost) : "—"}
                </td>
                <td className="px-6 py-4 text-right">
                  <Link to={`/dossier/${client.id}`}>
                    <Button variant="ghost" size="sm" className="text-primary hover:text-primary hover:bg-primary/10">
                      <Eye className="w-4 h-4 mr-1" />
                      Voir
                    </Button>
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