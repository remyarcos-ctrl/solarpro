import React from "react";
import { Outlet } from "react-router-dom";
import Sidebar from "./Sidebar";

export default function AppLayout() {
  return (
    <div className="min-h-screen bg-background">
      <Sidebar />
      {/* Desktop : sidebar fixe à gauche (ml-64). Mobile : bottom bar → pb-20 */}
      <main className="md:ml-64 min-h-screen pb-20 md:pb-0">
        <Outlet />
      </main>
    </div>
  );
}