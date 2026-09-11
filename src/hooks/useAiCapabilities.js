import { useQuery } from "@tanstack/react-query";
import {
  DEFAULT_AI_CAPABILITIES,
  getAiCapabilities,
} from "@/lib/aiCapabilities";

export function useAiCapabilities() {
  const query = useQuery({
    queryKey: ["ai-capabilities"],
    queryFn: getAiCapabilities,
    retry: false,
    staleTime: 60_000,
    refetchOnReconnect: true,
    refetchOnWindowFocus: true,
  });

  return {
    capabilities: query.isError ? DEFAULT_AI_CAPABILITIES : query.data || DEFAULT_AI_CAPABILITIES,
    isLoading: query.isLoading,
    isError: query.isError,
  };
}
