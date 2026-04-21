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
      <aside className="hidden md:flex fixed left-0 top-0 h-full w-64 bg-card border-r border-border flex-col z-40">
        <div className="p-6 border-b border-border">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-primary/20 flex items-center justify-center">
              <Sun className="w-6 h-6 text-primary" />
            </div>
            <div>
              <h1 className="text-lg font-bold text-foreground tracking-tight">SolarPro</h1>
              <p className="text-xs text-muted-foreground">Gestion commerciale</p>
            </div>
          </div>
        </div>
        <nav className="flex-1 p-4 space-y-1">
          {navItems.map((item) => {
            const isActive = isItemActive(item.path);
            return (
              <Link
                key={item.path}
                to={item.path}
                className={`flex items-center gap-3 px-4 py-3 rounded-lg transition-all duration-200 group
                  ${isActive
                    ? "bg-primary/15 text-primary border border-primary/20"
                    : "text-muted-foreground hover:text-foreground hover:bg-secondary border border-transparent"
                  }`}
              >
                <item.icon className={`w-5 h-5 ${isActive ? "text-primary" : "text-muted-foreground group-hover:text-foreground"}`} />
                <span className="font-medium text-sm">{item.label}</span>
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
      <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-card border-t border-border z-40 flex">
        {navItems.map((item) => {
          const isActive = isItemActive(item.path);
          return (
            <Link key={item.path} to={item.path}
              className={`flex-1 flex flex-col items-center justify-center py-2 gap-0.5 transition
                ${isActive ? "text-primary" : "text-muted-foreground"}`}
            >
              <item.icon className="w-5 h-5" />
              <span className="text-[10px] font-medium">{item.label.split(' ')[0]}</span>
            </Link>
          );
        })}
      </nav>
    </>
  );
}