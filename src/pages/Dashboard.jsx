import React from "react";
import { useQuery } from "@tanstack/react-query";
import { localClients } from "@/lib/localStore";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { FolderPlus, FileCheck, Zap, DollarSign, UserPlus } from "lucide-react";
import KPICard from "@/components/dashboard/KPICard";
import ClientTable from "@/components/dashboard/ClientTable";
import { formatCurrency, formatNumber } from "@/lib/solarCalculations";

export default function Dashboard() {
  const { data: clients, isLoading } = useQuery({
    queryKey: ["clients"],
    queryFn: () => localClients.list(),
    initialData: [],
  });

  const totalDossiers = clients.length;
  const dossiersSigned = clients.filter(c => c.status === "signe" || c.status === "installe").length;
  const totalPower = clients.reduce((sum, c) => sum + (c.total_power_kwc || 0), 0);
  const totalCA = clients
    .filter(c => c.status !== "annule")
    .reduce((sum, c) => sum + (c.installation_cost || 0), 0);

  return (
    <div className="p-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Tableau de bord</h1>
          <p className="text-muted-foreground mt-1">Vue d'ensemble de votre activité commerciale</p>
        </div>
        <Link to="/nouveau-dossier">
          <Button className="bg-primary text-primary-foreground hover:bg-primary/90 gap-2 font-semibold">
            <UserPlus className="w-4 h-4" />
            Nouveau dossier
          </Button>
        </Link>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <KPICard icon={FolderPlus} label="Dossiers créés" value={totalDossiers} index={0} />
        <KPICard icon={FileCheck} label="Dossiers signés" value={dossiersSigned} subtitle={totalDossiers > 0 ? `${Math.round(dossiersSigned/totalDossiers*100)}% de conversion` : null} index={1} />
        <KPICard icon={Zap} label="Puissance totale" value={`${formatNumber(Math.round(totalPower * 10) / 10)} kWc`} index={2} />
        <KPICard icon={DollarSign} label="CA potentiel" value={formatCurrency(totalCA)} index={3} />
      </div>

      {/* Client Table */}
      <div>
        <h2 className="text-xl font-semibold text-foreground mb-4">Dossiers clients</h2>
        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <div className="w-8 h-8 border-4 border-primary/30 border-t-primary rounded-full animate-spin" />
          </div>
        ) : (
          <ClientTable clients={clients} />
        )}
      </div>
    </div>
  );
}