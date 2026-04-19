import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { DEFAULT_SETTINGS } from "./solarCalculations";
import { localSettings } from "./localStore";

export function useSettings() {
  const queryClient = useQueryClient();

  const { data: stored } = useQuery({
    queryKey:    ["settings"],
    queryFn:     () => localSettings.get(),
    initialData: localSettings.get(),
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
