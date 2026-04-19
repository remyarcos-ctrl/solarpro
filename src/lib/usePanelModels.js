import { useQuery } from "@tanstack/react-query";
import { localPanels } from "./localStore";

export function usePanelModels() {
  const { data: panels, isLoading } = useQuery({
    queryKey: ["panelModels"],
    queryFn:  () => localPanels.list(),
    initialData: localPanels.list(),
  });

  return { panels, isLoading };
}
