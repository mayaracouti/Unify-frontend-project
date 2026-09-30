import { useCallback, useEffect, useRef, useState } from "react";
import type { PageResponse } from "../types/pagination";
import { formatApiErrorMessage } from "../utils/auth";
import { mergeCommunityItems } from "../utils/communityPagination";

/** Refresh invalidates older pages; page errors retain already loaded content. */
export function useCommunityPage<T>(
  load: (page: number) => Promise<PageResponse<T>>,
  identify: (item: T) => string | null | undefined
) {
  const [items, setItems] = useState<T[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasNext, setHasNext] = useState(false);
  const page = useRef(-1);
  const next = useRef(false);
  const busy = useRef(false);
  const generation = useRef(0);

  useEffect(() => {
    generation.current += 1;
    page.current = -1;
    next.current = false;
    busy.current = false;
    setItems([]);
    setHasNext(false);
    setLoading(false);
    setLoadingMore(false);
    setError(null);
    return () => { generation.current += 1; };
  }, [load]);

  const request = useCallback(async (append: boolean) => {
    if (append && (busy.current || !next.current)) return;
    const version = ++generation.current;
    busy.current = true;
    setError(null);
    setLoading(!append);
    setLoadingMore(append);
    try {
      const response = await load(append ? page.current + 1 : 0);
      if (version !== generation.current) return;
      page.current = response.page;
      next.current = response.hasNext;
      setHasNext(response.hasNext);
      setItems((current) => append ? mergeCommunityItems(current, response.content, identify) : response.content);
    } catch (cause) {
      if (version === generation.current) setError(formatApiErrorMessage(cause, "Não foi possível carregar a lista. Tente novamente."));
    } finally {
      if (version === generation.current) {
        busy.current = false;
        setLoading(false);
        setLoadingMore(false);
      }
    }
  }, [identify, load]);

  const refresh = useCallback(() => request(false), [request]);
  const loadMore = useCallback(() => request(true), [request]);
  return { items, setItems, loading, loadingMore, hasNext, error, refresh, loadMore };
}
