import React, { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { localPanels } from "@/lib/localStore";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Plus, Pencil, Trash2, Sun } from "lucide-react";
import { toast } from "sonner";
import { formatCurrency } from "@/lib/solarCalculations";
import { motion } from "framer-motion";

function PanelForm({ panel, onSubmit, onCancel }) {
  const [form, setForm] = useState(panel || {
    brand: "", model_name: "", power_wc: 400, width_mm: 1722, height_mm: 1134,
    price: 250, efficiency: 21, is_default: false,
  });

  const update = (k, v) => setForm({ ...form, [k]: v });

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label className="text-xs uppercase text-muted-foreground">Marque</Label>
          <Input value={form.brand} onChange={e => update("brand", e.target.value)} className="bg-secondary/50" />
        </div>
        <div className="space-y-2">
          <Label className="text-xs uppercase text-muted-foreground">Modèle</Label>
          <Input value={form.model_name} onChange={e => update("model_name", e.target.value)} className="bg-secondary/50" />
        </div>
      </div>
      <div className="grid grid-cols-3 gap-4">
        <div className="space-y-2">
          <Label className="text-xs uppercase text-muted-foreground">Puissance (Wc)</Label>
          <Input type="number" value={form.power_wc} onChange={e => update("power_wc", parseFloat(e.target.value))} className="bg-secondary/50" />
        </div>
        <div className="space-y-2">
          <Label className="text-xs uppercase text-muted-foreground">Largeur (mm)</Label>
          <Input type="number" value={form.width_mm} onChange={e => update("width_mm", parseFloat(e.target.value))} className="bg-secondary/50" />
        </div>
        <div className="space-y-2">
          <Label className="text-xs uppercase text-muted-foreground">Hauteur (mm)</Label>
          <Input type="number" value={form.height_mm} onChange={e => update("height_mm", parseFloat(e.target.value))} className="bg-secondary/50" />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label className="text-xs uppercase text-muted-foreground">Prix (€)</Label>
          <Input type="number" value={form.price} onChange={e => update("price", parseFloat(e.target.value))} className="bg-secondary/50" />
        </div>
        <div className="space-y-2">
          <Label className="text-xs uppercase text-muted-foreground">Rendement (%)</Label>
          <Input type="number" value={form.efficiency} onChange={e => update("efficiency", parseFloat(e.target.value))} className="bg-secondary/50" step="0.1" />
        </div>
      </div>
      <div className="flex justify-end gap-3 pt-2">
        <Button variant="outline" onClick={onCancel}>Annuler</Button>
        <Button onClick={() => onSubmit(form)} className="bg-primary text-primary-foreground">Enregistrer</Button>
      </div>
    </div>
  );
}

export default function PanelLibrary() {
  const queryClient = useQueryClient();
  const [editingPanel, setEditingPanel] = useState(null);
  const [dialogOpen, setDialogOpen] = useState(false);

  const { data: panels, isLoading } = useQuery({
    queryKey:    ["panelModels"],
    queryFn:     () => localPanels.list(),
    initialData: localPanels.list(),
  });

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ["panelModels"] });

  const createMutation = useMutation({
    mutationFn: (data) => localPanels.create(data),
    onSuccess: () => { invalidate(); setDialogOpen(false); toast.success("Panneau ajouté"); },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => localPanels.update(id, data),
    onSuccess: () => { invalidate(); setEditingPanel(null); setDialogOpen(false); toast.success("Panneau mis à jour"); },
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => localPanels.delete(id),
    onSuccess: () => { invalidate(); toast.success("Panneau supprimé"); },
  });

  const handleSubmit = (data) => {
    if (editingPanel) updateMutation.mutate({ id: editingPanel.id, data });
    else createMutation.mutate(data);
  };

  return (
    <div className="p-6 md:p-8 max-w-[1600px] mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4 mb-10 fade-in-up">
        <div>
          <p className="text-xs uppercase tracking-[0.2em] text-primary/80 font-semibold mb-2">Bibliothèque</p>
          <h1 className="text-4xl md:text-5xl font-display font-bold tracking-tight">
            <span className="text-foreground">Vos modèles de</span>{' '}
            <span className="gradient-text">panneaux</span>
          </h1>
          <p className="text-muted-foreground mt-2 text-sm">Catalogue des modèles utilisables dans les études</p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={(v) => { setDialogOpen(v); if (!v) setEditingPanel(null); }}>
          <DialogTrigger asChild>
            <button className="btn-primary-glow inline-flex items-center gap-2 font-semibold px-5 py-2.5 rounded-lg text-sm self-start sm:self-auto">
              <Plus className="w-4 h-4" /> Ajouter un panneau
            </button>
          </DialogTrigger>
          <DialogContent className="bg-card border-border">
            <DialogHeader>
              <DialogTitle>{editingPanel ? "Modifier le panneau" : "Nouveau panneau"}</DialogTitle>
            </DialogHeader>
            <PanelForm
              panel={editingPanel}
              onSubmit={handleSubmit}
              onCancel={() => { setDialogOpen(false); setEditingPanel(null); }}
            />
          </DialogContent>
        </Dialog>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <div className="w-8 h-8 border-4 border-primary/30 border-t-primary rounded-full animate-spin" />
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {panels.map((p, idx) => (
            <motion.div
              key={p.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: idx * 0.1 }}
              className="card-elevated card-elevated-hover p-6"
            >
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                    <Sun className="w-5 h-5 text-primary" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-foreground">{p.brand}</h3>
                    <p className="text-sm text-muted-foreground">{p.model_name}</p>
                  </div>
                </div>
                <div className="flex gap-1">
                  <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-primary"
                    onClick={() => { setEditingPanel(p); setDialogOpen(true); }}>
                    <Pencil className="w-4 h-4" />
                  </Button>
                  <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-destructive"
                    onClick={() => deleteMutation.mutate(p.id)}>
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div className="bg-secondary/30 rounded-lg p-3">
                  <p className="text-xs text-muted-foreground">Puissance</p>
                  <p className="font-bold text-primary">{p.power_wc} Wc</p>
                </div>
                <div className="bg-secondary/30 rounded-lg p-3">
                  <p className="text-xs text-muted-foreground">Rendement</p>
                  <p className="font-bold text-foreground">{p.efficiency}%</p>
                </div>
                <div className="bg-secondary/30 rounded-lg p-3">
                  <p className="text-xs text-muted-foreground">Dimensions</p>
                  <p className="font-bold text-foreground">{p.width_mm}×{p.height_mm}</p>
                </div>
                <div className="bg-secondary/30 rounded-lg p-3">
                  <p className="text-xs text-muted-foreground">Prix</p>
                  <p className="font-bold text-foreground">{formatCurrency(p.price)}</p>
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      )}
    </div>
  );
}
