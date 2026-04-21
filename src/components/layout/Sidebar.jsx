import React from "react";
import { Link, useLocation } from "react-router-dom";
import { LayoutDashboard, UserPlus, Sun, Settings, Database } from "lucide-react";

const navItems = [
  { path: "/", icon: LayoutDashboard, label: "Dashboard" },
  { path: "/nouveau-dossier", icon: UserPlus, label: "Nouveau dossier" },
  { path: "/panneaux", icon: Sun, label: "Bibliothèque" },
  { path: "/parametres", icon: Settings, label: "Paramètres" },
];

export default function Sidebar() {
  const location = useLocation();

  const isItemActive = (path) =>
    location.pathname === path || (path !== "/" && location.pathname.startsWith(path));

  return (
    <>
      {/* ── Desktop : sidebar fixe à gauche ──────────────────────────────── */}
      <aside className="hidden md:flex fixed left-0 top-0 h-full w-64 bg-card/60 backdrop-blur-xl border-r border-border/80 flex-col z-40">
        <div className="p-6 border-b border-border/60">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-primary/40 via-primary/20 to-transparent border border-primary/30 flex items-center justify-center shadow-[inset_0_1px_0_0_hsl(40_100%_80%/0.2)]">
              <Sun className="w-6 h-6 text-primary drop-shadow-[0_0_8px_hsl(38_82%_55%/0.6)]" />
            </div>
            <div>
              <h1 className="text-lg font-display font-bold tracking-tight gradient-text">SolarPro</h1>
              <p className="text-[11px] text-muted-foreground uppercase tracking-widest">Installateur</p>
            </div>
          </div>
        </div>
        <nav className="flex-1 p-3 space-y-1">
          {navItems.map((item) => {
            const isActive = isItemActive(item.path);
            return (
              <Link
                key={item.path}
                to={item.path}
                className={`relative flex items-center gap-3 px-4 py-2.5 rounded-lg transition-all duration-200 group
                  ${isActive
                    ? "bg-gradient-to-r from-primary/20 to-primary/5 text-primary"
                    : "text-muted-foreground hover:text-foreground hover:bg-secondary/60"
                  }`}
              >
                {isActive && <span className="absolute left-0 top-1.5 bottom-1.5 w-[3px] rounded-r-full bg-primary shadow-[0_0_8px_hsl(38_82%_55%/0.7)]" />}
                <item.icon className={`w-[18px] h-[18px] ${isActive ? "text-primary" : "text-muted-foreground group-hover:text-foreground"} transition-colors`} />
                <span className={`text-sm ${isActive ? "font-semibold" : "font-medium"}`}>{item.label}</span>
              </Link>
            );
          })}
        </nav>
        <div className="p-4 border-t border-border">
          <div className="flex items-center gap-2 px-4 py-2">
            <Database className="w-4 h-4 text-muted-foreground" />
            <span className="text-xs text-muted-foreground">v1.0 — Solaire</span>
          </div>
        </div>
      </aside>

      {/* ── Mobile : bottom nav fixe en bas ──────────────────────────────── */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 glass border-t border-border/60 z-40 flex">
        {navItems.map((item) => {
          const isActive = isItemActive(item.path);
          return (
            <Link key={item.path} to={item.path}
              className={`relative flex-1 flex flex-col items-center justify-center py-2.5 gap-0.5 transition
                ${isActive ? "text-primary" : "text-muted-foreground"}`}
            >
              {isActive && <span className="absolute top-0 left-1/2 -translate-x-1/2 h-[2px] w-8 rounded-full bg-primary shadow-[0_0_8px_hsl(38_82%_55%/0.7)]" />}
              <item.icon className="w-5 h-5" />
              <span className="text-[10px] font-medium">{item.label.split(' ')[0]}</span>
            </Link>
          );
        })}
      </nav>
    </>
  );
}