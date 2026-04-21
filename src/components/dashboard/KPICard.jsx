import React from "react";
import { motion } from "framer-motion";

export default function KPICard({ icon: Icon, label, value, subtitle, index = 0 }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.08, duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
      className="card-elevated card-elevated-hover relative overflow-hidden p-6 group"
    >
      {/* Halo orange en coin haut-droit */}
      <div className="pointer-events-none absolute -top-12 -right-12 w-40 h-40 rounded-full bg-[radial-gradient(closest-side,hsl(38_82%_55%/0.18),transparent)] group-hover:bg-[radial-gradient(closest-side,hsl(38_82%_55%/0.28),transparent)] transition-all duration-500" />
      <div className="relative">
        <div className="flex items-center justify-between mb-5">
          <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-primary/25 to-primary/5 border border-primary/20 flex items-center justify-center shadow-[inset_0_1px_0_0_hsl(40_100%_80%/0.15)]">
            <Icon className="w-5 h-5 text-primary" />
          </div>
        </div>
        <p className="text-3xl font-display font-bold gradient-text leading-none tracking-tight">{value}</p>
        <p className="text-sm text-muted-foreground mt-2">{label}</p>
        {subtitle && <p className="text-xs text-primary/80 mt-1 font-medium">{subtitle}</p>}
      </div>
    </motion.div>
  );
}