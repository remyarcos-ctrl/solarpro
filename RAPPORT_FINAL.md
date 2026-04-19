# SolarPro — Rapport Final

## État des fonctionnalités implémentées

### Carte satellite & tracé de pans
- Carte IGN Haute Résolution (orthophotos) avec Mapbox GL
- Tracé manuel de polygones (pans de toiture) avec MapboxDraw
- Visualisation de la grille de panneaux sur chaque pan
- Rose des vents pour correction d'orientation
- Labels de rues toggleables
- Capture screenshot du toit (base64 PNG)

### Sélection automatique via Google Solar API
- Récupération des `roofSegmentStats` (pitch, azimut, surface, ensoleillement)
- Tableau interactif avec checkboxes — clic pour créer automatiquement un pan
- Boutons "Tout sélectionner" / "Désélectionner"
- Génération du polygone depuis le centroïde et la surface du segment
- `buildSegmentPolygon` : rectangle orienté selon l'azimut du segment

### Données d'inclinaison & orientation (par priorité)
1. Google Solar API (pitchDegrees + azimuthDegrees) — le plus précis
2. BDTOPO IGN 3D (calcul pitch depuis coordonnées Z)
3. IGN LiDAR HD (différences finies sur croix de 5 points ±2m)
4. Défaut 20°

### PVGIS par pan
- Appel PVGIS v5.2 JRC pour chaque pan avec l'orientation et l'inclinaison réelles
- E_y (kWh/kWc/an) intègre orientation + température + 14% pertes système
- Fonctionne pour les pans manuels ET les pans Solar API

### Tableau récapitulatif (PanSummaryTable)
- PR effectif par pan
- Production annuelle, économies/an
- Surface tracée vs Surface Solar API
- Ombrage Solar API vs manuel
- Détails expandables par pan

### Comparateur de scénarios (ScenarioComparator)
- Jusqu'à 6 scénarios en parallèle (était limité à 4)
- Duplication de scénario avec ses overrides
- Comparaison temps réel via `useMemo` (recalcul à chaque changement)
- Export impression via `window.print()` avec styles CSS `@media print`
- Métriques : production, puissance, PR, bénéfice, coût, ROI, gains 10/25 ans, CO₂

### Export PDF client (ExportPdfButton)
- 3 pages jsPDF : page de garde + infos client, technique + production mensuelle, rentabilité 25 ans
- Infos client : prénom, nom, adresse, téléphone, email
- Tableau des KPIs clés (puissance, production, reste à charge, ROI)
- Vue satellite Mapbox (`data.roof_capture` — base64 PNG)
- Graphique production mensuelle (barres colorées)
- Graphique gains cumulés 25 ans (barres vert/rouge)
- Hypothèses de calcul détaillées
- Signatures client + commercial
- QR code de simulation

---

## Architecture technique

```
src/
├── pages/
│   └── DossierDetail.jsx       — Page principale, orchestration données
├── components/dossier/
│   ├── SatelliteMap.jsx        — Carte Mapbox + tracé pans + Solar segments
│   ├── PanSummaryTable.jsx     — Tableau récapitulatif des pans
│   ├── ScenarioComparator.jsx  — Comparateur multi-scénarios
│   ├── ExportPdfButton.jsx     — Export PDF jsPDF 3 pages
│   ├── PanelConfigurator.jsx   — Configuration panneau photovoltaïque
│   └── roofUtils.js            — Utilitaires calcul toit (grille, orientation)
└── lib/
    ├── pvgisApi.js             — PVGIS v5.2 JRC + calculs solaires
    ├── solarCalculations.js    — Rentabilité 25 ans
    ├── bdtopoBuilding.js       — Contours bâtiment IGN WFS BDTOPO V3
    ├── ignRoofAnalysis.js      — Inclinaison toit via IGN LiDAR HD
    ├── usePVGIS.js             — Hook TanStack Query PVGIS
    ├── usePanelModels.js       — Hook modèles panneaux
    └── useSettings.js          — Hook paramètres commerciaux
```

**Stack** : React 18 + Vite + TanStack Query v5 + Tailwind CSS + Radix UI + Mapbox GL + jsPDF

---

## APIs utilisées

| API | Usage | Auth |
|-----|-------|------|
| **Google Solar API** | `buildingInsights:findClosest` — segments de toit, pitch/azimut/surface | API Key |
| **PVGIS v5.2 JRC** | Production réelle kWh/kWc/an par coordonnées GPS + orientation | Publique (CORS *) |
| **IGN Géoplateforme — BDTOPO V3** | Contours bâtiment (footprint), hauteur, usage | Publique |
| **IGN Géoplateforme — LiDAR HD** | Élévations 5 points → inclinaison + azimut toit | Publique |
| **IGN — WMTS orthophotos HR** | Fond de carte satellite haute résolution | Publique |
| **Mapbox GL** | Rendu carte, draw polygones, labels rues, capture canvas | Token public |
| **Base44** | Backend SaaS — clients, panneaux, paramètres, auth | SDK interne |

---

## Workflow commercial complet

1. **Création du dossier client** — prénom, nom, adresse, téléphone, email
2. **Géocodage adresse** → centrage carte satellite (zoom 20, pitch 45°)
3. **Chargement automatique en arrière-plan** :
   - Google Solar API → segments de toit
   - BDTOPO IGN → contour bâtiment + inclinaison 3D
   - IGN LiDAR HD → inclinaison précise
4. **Sélection des pans** :
   - Mode A : cliquer sur un segment Solar API → pan créé automatiquement
   - Mode B : tracer manuellement le polygone sur la carte
5. **Calcul automatique par pan** :
   - Inclinaison + orientation depuis Solar API (prioritaire) ou LiDAR
   - PVGIS v5.2 JRC → kWh/kWc/an réel pour ce pan exact
   - Nombre de panneaux max (surface Solar API × 85% / surface panneau)
6. **Tableau récapitulatif** — visualisation, ajustements ombrage/orientation
7. **Comparateur de scénarios** — jusqu'à 6 variantes, comparaison temps réel
8. **Capture vue satellite** → incluse dans PDF
9. **Export PDF 3 pages** — étude personnalisée à remettre au client
   - Page 1 : infos client + KPIs + vue satellite
   - Page 2 : technique + production mensuelle
   - Page 3 : investissement + rentabilité 25 ans + signatures
