import { useCallback, useRef, useState } from "react";
import { useFocusEffect } from "expo-router";
import { communityService } from "../services/communityService";
import type { CommunitySummaryResponse } from "../types/community";
import { formatApiErrorMessage } from "../utils/auth";

/** Permissions come from the API, never from editable route parameters. */
export function useCommunityAccess(communityId: string) {
  const generation = useRef(0);
  const [community, setCommunity] = useState<CommunitySummaryResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const reload = useCallback(async () => {
    const request = ++generation.current;
    setLoading(true);
    setCommunity(null);
    setError(null);
    try {
      if (!communityId) throw new Error("Não foi possível identificar a comunidade.");
      const response = await communityService.getFeed(communityId, { page: 0, size: 1 });
      if (!response.community || response.community.id !== communityId) throw new Error("A comunidade não foi encontrada.");
      if (request === generation.current) setCommunity(response.community);
    } catch (cause) {
      if (request === generation.current) setError(formatApiErrorMessage(cause, "Não foi possível verificar sua participação."));
    } finally {
      if (request === generation.current) setLoading(false);
    }
  }, [communityId]);
  useFocusEffect(useCallback(() => {
    void reload();
    return () => { generation.current += 1; };
  }, [reload]));
  return { community: community?.id === communityId ? community : null, loading, error, reload };
}
