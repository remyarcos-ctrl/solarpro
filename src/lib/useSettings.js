import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { DEFAULT_SETTINGS, TARIFF_VERSION } from "./solarCalculations";
import { localSettings } from "./localStore";

// Réglages enregistrés avec d'anciens tarifs : on remplace uniquement les
// valeurs restées à un ancien défaut (liste) — les valeurs modifiées à la
// main par l'utilisateur sont conservées.
const STALE_DEFAULTS = {
  electricity_price:            [0.2516],
  electricity_price_updated_at: ['2025-02-01'],
  buyback_rate:                 [0.1302],
  prime_per_kwc:                [380],
  self_consumption_rate:        [70],
  inflation_rate:               [5, 2],
};

function migrateTariffs(stored) {
  if (!stored || stored.tariff_version === TARIFF_VERSION) return stored;
  const migrated = { ...stored, tariff_version: TARIFF_VERSION };
  for (const [key, staleValues] of Object.entries(STALE_DEFAULTS)) {
    if (stored[key] === undefined || staleValues.includes(stored[key])) {
      migrated[key] = DEFAULT_SETTINGS[key];
    }
  }
  localSettings.save(migrated);
  return migrated;
}

export function useSettings() {
  const queryClient = useQueryClient();

  const { data: stored } = useQuery({
    queryKey:    ["settings"],
    queryFn:     () => migrateTariffs(localSettings.get()),
    initialData: () => migrateTariffs(localSettings.get()),
  });

  const settings   = stored ? { ...DEFAULT_SETTINGS, ...stored } : DEFAULT_SETTINGS;
  const settingsId = stored?.id ?? null;

  const updateSettings = useMutation({
    mutationFn: (newSettings) => {
      const merged = { ...settings, ...newSettings, id: settingsId ?? 'local' };
      localSettings.save(merged);
      return merged;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["settings"] });
    },
  });

  return { settings, isLoading: false, updateSettings, settingsId };
}
