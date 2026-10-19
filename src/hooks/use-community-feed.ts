import { useCallback, useEffect, useRef, useState } from "react";
import { communityService } from "../services/communityService";
import { collectCommunityAssetUrls, normalizeFeedResponse, type NormalizedCommunityFeed } from "../community/feed-state";
import { preloadAuthenticatedRemoteImages } from "../components/profile/authenticated-remote-image";
import { formatApiErrorMessage } from "../utils/auth";

/** Owns loading/refresh lifecycle; route changes invalidate stale responses. */
export function useCommunityFeed(communityId: string, authToken: string | null, focused: boolean) {
  const [feed, setFeed] = useState<NormalizedCommunityFeed | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const generation = useRef(0);
  const initialLoad = useRef(false);
  useEffect(() => {
    generation.current++; initialLoad.current = false; setFeed(null); setLoading(true); setLoadError(null);
    const lifecycle = generation; return () => { lifecycle.current++; };
  }, [communityId, authToken]);
  const loadFeed = useCallback(async (options?: { showLoader?: boolean }) => {
    const current = ++generation.current;
    if (options?.showLoader) setLoading(true);
    setLoadError(null);
    try {
      const next = normalizeFeedResponse(await communityService.getFeed(communityId));
      if (generation.current !== current) return;
      setFeed(next);
      void preloadAuthenticatedRemoteImages(collectCommunityAssetUrls(next), authToken);
    } catch (error) {
      if (generation.current !== current) return;
      setLoadError(formatApiErrorMessage(error, "Não foi possível carregar os dados da comunidade."));
      setFeed((old) => old ?? { community: null, posts: [], postsHasNext: false });
    } finally { if (generation.current === current) setLoading(false); }
  }, [communityId, authToken]);
  useEffect(() => {
    if (!focused) return;
    const showLoader = !initialLoad.current;
    initialLoad.current = true;
    void loadFeed({ showLoader });
  }, [focused, loadFeed]);
  return { feed, setFeed, loading, loadError, loadFeed };
}
