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
    <div className="p-6 md:p-8 max-w-[1600px] mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4 mb-10 fade-in-up">
        <div>
          <p className="text-xs uppercase tracking-[0.2em] text-primary/80 mb-2 font-semibold">Tableau de bord</p>
          <h1 className="text-4xl md:text-5xl font-display font-bold tracking-tight">
            <span className="text-foreground">Votre activité</span>{' '}
            <span className="gradient-text">en un coup d'œil</span>
          </h1>
          <p className="text-muted-foreground mt-2 text-sm">Suivi commercial · conversion · puissance installée · CA</p>
        </div>
        <Link to="/nouveau-dossier" className="self-start sm:self-auto">
          <button className="btn-primary-glow inline-flex items-center gap-2 font-semibold px-5 py-2.5 rounded-lg text-sm">
            <UserPlus className="w-4 h-4" />
            Nouveau dossier
          </button>
        </Link>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5 mb-10">
        <KPICard icon={FolderPlus} label="Dossiers créés" value={totalDossiers} index={0} />
        <KPICard icon={FileCheck} label="Dossiers signés" value={dossiersSigned} subtitle={totalDossiers > 0 ? `${Math.round(dossiersSigned/totalDossiers*100)}% de conversion` : null} index={1} />
        <KPICard icon={Zap} label="Puissance totale" value={`${formatNumber(Math.round(totalPower * 10) / 10)} kWc`} index={2} />
        <KPICard icon={DollarSign} label="CA potentiel" value={formatCurrency(totalCA)} index={3} />
      </div>

      {/* Client Table */}
      <div className="fade-in-up" style={{ animationDelay: '300ms' }}>
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-2xl font-display font-semibold text-foreground">Dossiers clients</h2>
          <span className="text-xs text-muted-foreground">{clients.length} entrée{clients.length > 1 ? 's' : ''}</span>
        </div>
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