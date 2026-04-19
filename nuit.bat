@echo off
:: ── SolarPro — Script de relance rapide ──────────────────────────────────
:: Double-cliquez pour ouvrir le projet complet demain matin

echo.
echo  ╔══════════════════════════════════════════╗
echo  ║   SolarPro — Relance développement       ║
echo  ╚══════════════════════════════════════════╝
echo.

:: Afficher l'état git
echo [GIT] Etat du projet :
git -C "%~dp0" log --oneline -5
echo.
git -C "%~dp0" status --short
echo.

:: Ouvrir le rapport d'état
echo [INFO] Ouverture du rapport d'etat...
start notepad "%~dp0RAPPORT_ETAT.md"

:: Lancer le serveur de dev
echo [DEV] Demarrage du serveur Vite...
cd /d "%~dp0"
start cmd /k "npm run dev"

:: Attendre 3 secondes puis ouvrir le navigateur
timeout /t 3 /nobreak >nul
start http://localhost:5173

echo.
echo  [OK] Serveur lance sur http://localhost:5173
echo  [OK] Rapport d'etat ouvert dans Notepad
echo.
echo  Resumez le travail dans Claude Code avec :
echo  "Reprends le RAPPORT_ETAT.md — continue par les priorites du jour"
echo.
pause
