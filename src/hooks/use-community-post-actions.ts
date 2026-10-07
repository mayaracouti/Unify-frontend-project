import { useCallback, useEffect, useRef, useState } from "react";
import { communityService } from "../services/communityService";
import type { CommunityLikeResponse, CommunityPostResponse } from "../types/community";

/** Operations are independent across posts; the ref locks before React renders. */
export function useCommunityPostActions(onLike: (response: CommunityLikeResponse) => void, scope = "") {
  const locks = useRef(new Set<string>());
  const [likeBusyPostIds, setBusy] = useState<ReadonlySet<string>>(new Set());
  const generation = useRef(0);
  useEffect(() => {
    generation.current++;
    locks.current = new Set();
    setBusy(new Set());
    const lifecycle = generation; return () => { lifecycle.current++; };
  }, [scope]);
  const toggleLike = useCallback(async (post: CommunityPostResponse) => {
    const current = generation.current;
    const operationLocks = locks.current;
    if (operationLocks.has(post.id)) return;
    operationLocks.add(post.id);
    setBusy(new Set(locks.current));
    try {
      const result = post.likedByCurrentUser ? await communityService.unlikePost(post.id) : await communityService.likePost(post.id);
      if (generation.current === current) onLike(result);
    } catch {
      // HTTP interceptor already reports errors; no optimistic state to roll back.
    } finally {
      operationLocks.delete(post.id);
      if (generation.current === current) setBusy(new Set(operationLocks));
    }
  }, [onLike]);
  return { likeBusyPostIds, toggleLike };
}
