import { DEFAULT_PANELS, DEFAULT_SETTINGS } from './solarCalculations';

const PANELS_KEY   = 'solarpro_panels';
const SETTINGS_KEY = 'solarpro_settings';

function uid() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2);
}

// Panels without ids (DEFAULT_PANELS) get stable fallback ids so DossierDetail
// can reliably match panel_model_id even when running without Base44.
const DEFAULT_PANELS_WITH_IDS = DEFAULT_PANELS.map((p, i) => ({
  ...p,
  id: p.id ?? `default-${i}`,
}));

export const localPanels = {
  list() {
    try {
      const raw = localStorage.getItem(PANELS_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch {}
    return DEFAULT_PANELS_WITH_IDS;
  },

  save(panels) {
    localStorage.setItem(PANELS_KEY, JSON.stringify(panels));
  },

  create(data) {
    const panels = this.list();
    const newPanel = { ...data, id: uid() };
    this.save([...panels, newPanel]);
    return newPanel;
  },

  update(id, data) {
    const panels = this.list().map(p => p.id === id ? { ...p, ...data } : p);
    this.save(panels);
    return panels.find(p => p.id === id);
  },

  delete(id) {
    this.save(this.list().filter(p => p.id !== id));
  },
};

export const localSettings = {
  get() {
    try {
      const raw = localStorage.getItem(SETTINGS_KEY);
      if (raw) return JSON.parse(raw);
    } catch {}
    return null;
  },

  save(settings) {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
  },
};
