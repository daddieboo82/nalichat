import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/lib/AuthContext";
import {
  DEFAULT_AI_CAPABILITIES,
  getAiCapabilities,
} from "@/lib/aiCapabilities";

export function useAiCapabilities() {
  const { user } = useAuth();
  const query = useQuery({
    queryKey: ["ai-capabilities", user?.id || "anonymous"],
    queryFn: () => getAiCapabilities(user?.id),
    retry: false,
    staleTime: 60_000,
    refetchOnReconnect: true,
    refetchOnWindowFocus: true,
    enabled: !!user?.id,
  });

  return {
    capabilities: query.isError ? DEFAULT_AI_CAPABILITIES : query.data || DEFAULT_AI_CAPABILITIES,
    isLoading: query.isLoading,
    isError: query.isError,
  };
}
