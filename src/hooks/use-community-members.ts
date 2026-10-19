import { useCallback, useEffect, useRef, useState } from "react";
import { communityService } from "../services/communityService";
import { collectMemberAssetUrls } from "../community/feed-state";
import { preloadAuthenticatedRemoteImages } from "../components/profile/authenticated-remote-image";
import { formatApiErrorMessage } from "../utils/auth";
import type { CommunityMemberResponse } from "../types/community";

export function useCommunityMembers(communityId: string, authToken: string | null, active: boolean) {
  const [members, setMembers] = useState<CommunityMemberResponse[]>([]);
  const [membersLoading, setLoading] = useState(false);
  const [membersLoadError, setError] = useState<string | null>(null);
  const generation = useRef(0);
  const initial = useRef(false);
  useEffect(() => {
    generation.current++; initial.current = false; setMembers([]); setError(null); setLoading(false);
    const lifecycle = generation; return () => { lifecycle.current++; };
  }, [communityId, authToken]);
  const loadMembers = useCallback(async (options?: { showLoader?: boolean }) => {
    const current = ++generation.current;
    if (options?.showLoader) setLoading(true);
    setError(null);
    if (!communityId) { setError("Não foi possível identificar a comunidade selecionada."); setLoading(false); return; }
    try {
      const response = await communityService.getMembers(communityId);
      if (generation.current !== current) return;
      const next = Array.isArray(response.content) ? response.content : [];
      setMembers(next);
      void preloadAuthenticatedRemoteImages(collectMemberAssetUrls(next), authToken);
    } catch (error) {
      if (generation.current === current) setError(formatApiErrorMessage(error, "Não foi possível carregar os membros da comunidade."));
    } finally { if (generation.current === current) setLoading(false); }
  }, [communityId, authToken]);
  useEffect(() => {
    if (!active) return;
    const showLoader = !initial.current; initial.current = true;
    void loadMembers({ showLoader });
  }, [active, loadMembers]);
  const clearMembers = useCallback(() => { generation.current++; initial.current = false; setMembers([]); setError(null); setLoading(false); }, []);
  return { clearMembers, members, setMembers, membersLoading, membersLoadError, loadMembers };
}
