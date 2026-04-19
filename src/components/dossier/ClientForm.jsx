import React from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export default function ClientForm({ data, onChange }) {
  const update = (field, value) => onChange({ ...data, [field]: value });

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label className="text-muted-foreground text-xs uppercase tracking-wider">Prénom *</Label>
          <Input
            value={data.first_name || ""}
            onChange={(e) => update("first_name", e.target.value)}
            className="bg-secondary/50 border-border focus:border-primary"
            placeholder="Prénom"
          />
        </div>
        <div className="space-y-2">
          <Label className="text-muted-foreground text-xs uppercase tracking-wider">Nom *</Label>
          <Input
            value={data.last_name || ""}
            onChange={(e) => update("last_name", e.target.value)}
            className="bg-secondary/50 border-border focus:border-primary"
            placeholder="Nom"
          />
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label className="text-muted-foreground text-xs uppercase tracking-wider">Téléphone</Label>
          <Input
            value={data.phone || ""}
            onChange={(e) => update("phone", e.target.value)}
            className="bg-secondary/50 border-border focus:border-primary"
            placeholder="06 00 00 00 00"
          />
        </div>
        <div className="space-y-2">
          <Label className="text-muted-foreground text-xs uppercase tracking-wider">Email</Label>
          <Input
            value={data.email || ""}
            onChange={(e) => update("email", e.target.value)}
            className="bg-secondary/50 border-border focus:border-primary"
            placeholder="client@email.com"
            type="email"
          />
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label className="text-muted-foreground text-xs uppercase tracking-wider">Type de bien</Label>
          <Select value={data.property_type || ""} onValueChange={(v) => update("property_type", v)}>
            <SelectTrigger className="bg-secondary/50 border-border">
              <SelectValue placeholder="Sélectionner" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="maison">Maison</SelectItem>
              <SelectItem value="immeuble">Immeuble</SelectItem>
              <SelectItem value="batiment_commercial">Bâtiment commercial</SelectItem>
              <SelectItem value="hangar">Hangar</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label className="text-muted-foreground text-xs uppercase tracking-wider">Statut</Label>
          <Select value={data.status || "prospect"} onValueChange={(v) => update("status", v)}>
            <SelectTrigger className="bg-secondary/50 border-border">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="prospect">Prospect</SelectItem>
              <SelectItem value="visite_planifiee">Visite planifiée</SelectItem>
              <SelectItem value="etude_envoyee">Étude envoyée</SelectItem>
              <SelectItem value="signe">Signé</SelectItem>
              <SelectItem value="installe">Installé</SelectItem>
              <SelectItem value="annule">Annulé</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="space-y-2">
        <Label className="text-muted-foreground text-xs uppercase tracking-wider">Adresse complète</Label>
        <Input
          value={data.address || ""}
          onChange={(e) => update("address", e.target.value)}
          className="bg-secondary/50 border-border focus:border-primary"
          placeholder="123 rue de la Paix, 75001 Paris"
        />
      </div>

      <div className="space-y-2">
        <Label className="text-muted-foreground text-xs uppercase tracking-wider">Commentaire</Label>
        <Textarea
          value={data.comment || ""}
          onChange={(e) => update("comment", e.target.value)}
          className="bg-secondary/50 border-border focus:border-primary min-h-[80px]"
          placeholder="Notes sur le client..."
        />
      </div>
    </div>
  );
}