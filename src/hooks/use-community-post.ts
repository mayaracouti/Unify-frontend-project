import { useCallback, useRef, useState } from "react";
import { useFocusEffect } from "expo-router";
import { communityService } from "../services/communityService";
import type { CommunityPostDetailResponse } from "../types/community";
import { formatApiErrorMessage } from "../utils/auth";

export function useCommunityPost(postId: string) {
  const generation = useRef(0);
  const [data, setData] = useState<CommunityPostDetailResponse | null>(null);
  const [loading, setLoading] = useState(Boolean(postId));
  const [error, setError] = useState<string | null>(null);
  const reload = useCallback(async () => {
    const request = ++generation.current;
    setData(null);
    setError(null);
    setLoading(Boolean(postId));
    if (!postId) return;
    try {
      const response = await communityService.getPost(postId);
      if (response.post?.id !== postId || !response.community?.id) throw new Error("A publicação não foi encontrada.");
      if (request === generation.current) setData(response);
    } catch (cause) {
      if (request === generation.current) setError(formatApiErrorMessage(cause, "Não foi possível carregar a publicação."));
    } finally {
      if (request === generation.current) setLoading(false);
    }
  }, [postId]);
  useFocusEffect(useCallback(() => {
    void reload();
    return () => { generation.current += 1; };
  }, [reload]));
  const current = data?.post.id === postId ? data : null;
  return { data: current, community: current?.community ?? null, loading, error, reload };
}
