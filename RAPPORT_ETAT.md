# RAPPORT D'ÉTAT SOLARPRO — 2026-04-19 (mis à jour)

## ✅ CE QUI FONCTIONNE À 100%

### Carte satellite & dessin de pans
- Vue satellite IGN haute résolution (géoplateforme)
- Dessin de polygones multi-pans avec MapboxDraw
- Rotation libre, vue 0°/30°/45°/60°, boussole
- Labels de rues (toggle)
- Capture screenshot de la carte

### Géocodage
- API officielle française api-adresse.data.gouv.fr

### BDTOPO IGN
- Requête WFS sur BDTOPO_V3:batiment (géoplateforme)
- Fix CRS:84 (axe lon/lat correct)
- Calcul inclinaison depuis coordonnées Z 3D
- Bouton "Tracer le bâtiment IGN" avec contour orange guide
- Badge "🌍 BDTOPO actif" dans la toolbar

### Google Solar API
- Récupération des segments de toit (pitchDegrees, azimuthDegrees)
- Sélection du segment le plus proche de l'orientation détectée
- Ombrage calculé depuis sunshineHoursPerYear / 8760 → solarShadingFactor
- Badge "☀️ Solar API actif" dans la toolbar

### PVGIS v5.2 JRC (✅ NOUVEAU)
- Appel global : référence Sud 30°, loss=14 → annualKwhPerKwc
- Appel par pan : orientation + inclinaison réelles → pvgisKwhPerKwc (fire-and-forget)
- pvgisSource flag propagé via settingsWithPVGIS dans DossierDetail
- Spinner de chargement dans PanSummaryTable pendant la requête

### Calcul de production (PanSummaryTable + solarCalculations)
- 3 modes : PVGIS par pan / PVGIS global / fallback régional
- Ombrage : Solar API (sunshineHoursPerYear) prioritaire sur catégorie manuelle
- PR affiché selon le mode
- Production annuelle et économies par pan
- Détail expandable avec breakdown des facteurs

### Comparateur de scénarios (✅ NOUVEAU)
- Jusqu'à 4 scénarios locaux
- Overrides par scénario : panelCount, prix électricité, autoconso, inflation, inclinaison globale, ombrage global
- Tableau comparatif : production, puissance, PR, bénéfice/an, coût, reste à charge, ROI, gain 10/25 ans, CO2
- Mise en évidence ▲ du meilleur par indicateur
- Boutons : + Nouveau, Dupliquer, Supprimer
- Export impression (window.print + CSS @media print)

### Étude de rentabilité (ProfitabilityStudy)
- Production, autoconsommation, surplus
- ROI, coût total, reste à charge
- Projection 25 ans avec inflation
- Graphique ProfitabilityChart

### Export PDF (ExportPdfButton)
- 3 pages : page de garde + technique + rentabilité
- Capture satellite incluse
- Graphiques mensuels et 25 ans
- QR code

### IA solaire (SolarAI)
- Description vocale → remplissage formulaire
- Analyse et recommandations

### Navigation & Layout
- Dashboard clients, création dossier, bibliothèque panneaux
- Paramètres système (prix EDF, aides, dégradation...)

---

## ⚠️ AMÉLIORATIONS MINEURES RESTANTES

### Pan. max = 0 après tracé
**Statut** : Guard ajouté + console.warn — cause racine non encore diagnostiquée.
**Fix** : Ouvrir DevTools Console, tracer un pan, analyser le log "[pan] maxPanels=0".

### Analyse IA qui peut timeout
**Problème** : `SolarAI.jsx` utilise `base44.InvokeLLM` sans retry.
**Fix** : Ajouter error handling + retry (faible priorité).

---

## 📋 OPTIONNEL (FUTURES SESSIONS)

- Persister les scénarios dans le dossier client (base44)
- Export scénarios en PDF structuré (pas juste window.print)
- Graphiques comparatifs dans ScenarioComparator
- Module simulation LiDAR : affichage pitch 3D sur la carte
- Fix région Midi-Pyrénées (vérif ordre — code actuel semble correct)

---

## 🔄 WORKFLOW ACTUEL

```
Utilisateur saisit une adresse
    │
    ├─── api-adresse.data.gouv.fr → coordonnées GPS
    │
    ├─── [Parallèle, arrière-plan]
    │    ├── Google Solar API → roofSegmentStats (pitch, azimuth, sunshineHours)
    │    ├── IGN LiDAR (analyzeRoofFromGPS) → pitch [timeout 10s]
    │    └── BDTOPO WFS (fetchBuildingFromBDTOPO) → footprint, pitch 3D
    │
    ├─── [DossierDetail] PVGIS v5.2 → annualKwhPerKwc (Sud 30°, référence)
    │    → settingsWithPVGIS = { ...settings, regional_production, pvgisSource }
    │
Utilisateur trace un polygone
    │
    ├─── createPanFromCoordsRef()
    │    ├── Détection orientation (arête la plus longue)
    │    ├── Source inclinaison : Solar API → BDTOPO → 20° défaut
    │    ├── solarShadingFactor = sunshineHoursPerYear / 8760 (Solar API)
    │    ├── buildPanelGridRotated() → maxPanels
    │    └── fetchPVGISForPan(lat, lon, azimut, incl) async → pvgisKwhPerKwc
    │
PanSummaryTable
    ├── si pvgisKwhPerKwc : prod = kWc × pvgisKwhPerKwc × shadingFactor
    ├── si pvgisMode     : prod = kWc × globalBase × orientCoef × shadingFactor
    └── sinon            : prod = kWc × globalBase × orientCoef × shadingFactor × systemLoss

ScenarioComparator
    ├── Overrides → pans modifiés + settings modifiés
    ├── calculateProfitability par scénario
    └── Tableau comparatif avec ▲ meilleur par colonne
```

---

## 📁 FICHIERS CLÉS

| Fichier | Rôle | État |
|---------|------|------|
| `src/lib/pvgisApi.js` | API solaire (PVGIS, aides, EDF) | ✅ v5.2 + par pan |
| `src/lib/solarCalculations.js` | Calcul rentabilité | ✅ 3 modes PVGIS |
| `src/lib/bdtopoBuilding.js` | WFS BDTOPO (emprise bâtiment) | ✅ OK |
| `src/lib/ignRoofAnalysis.js` | LiDAR IGN (inclinaison) | ✅ Timeout 10s ajouté |
| `src/components/dossier/SatelliteMap.jsx` | Carte + dessin pans | ✅ pvgisData prop + guards |
| `src/components/dossier/PanSummaryTable.jsx` | Tableau récap pans | ✅ 3 modes + Solar API badge |
| `src/components/dossier/ScenarioComparator.jsx` | Module scénarios | ✅ NOUVEAU |
| `src/components/dossier/roofUtils.jsx` | Utilitaires géo + grille panneaux | ✅ OK |
| `src/pages/DossierDetail.jsx` | Page principale dossier | ✅ ScenarioComparator intégré |

---

## 🚀 POUR REPRENDRE

```
cd C:\Users\Utilisateur\solarpro
npm run dev
```
Ouvrir http://localhost:5173

Ou double-cliquer nuit.bat

---

*Mis à jour le 2026-04-19 — commit d664069*
