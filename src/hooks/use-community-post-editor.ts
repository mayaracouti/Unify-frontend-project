import { useCallback, useEffect, useRef, useState } from "react";
import type { ImagePickerAsset } from "expo-image-picker";
import { communityService } from "../services/communityService";
import { formatApiErrorMessage } from "../utils/auth";
import { createCommunityPostFormData, draftFromPost, draftHasImage, draftTextUpdate, emptyPostDraft, removeDraftImage, replaceDraftImage, validatePostDraft } from "../community/post-draft";

export function useCommunityPostEditor(postId: string | null) {
  const [draft, setDraft] = useState(emptyPostDraft);
  const [loading, setLoading] = useState(Boolean(postId));
  const [loadError, setLoadError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const request = useRef(0);
  const submitLock = useRef(false);
  const load = useCallback(async () => {
    const generation = ++request.current;
    setLoading(Boolean(postId));
    setLoadError(null);
    try {
      const next = postId ? draftFromPost(await communityService.getPost(postId)) : emptyPostDraft;
      if (request.current === generation) setDraft(next);
    } catch (error) {
      if (request.current === generation) setLoadError(formatApiErrorMessage(error, "Não foi possível carregar a publicação."));
    } finally {
      if (request.current === generation) setLoading(false);
    }
  }, [postId]);
  useEffect(() => { void load(); const lifecycle = request; return () => { lifecycle.current++; }; }, [load]);
  const save = async (communityId: string) => {
    if (submitLock.current || loading || loadError) return false;
    const error = validatePostDraft(draft);
    if (error) throw new Error(error);
    submitLock.current = true;
    setSubmitting(true);
    try {
      if (!postId) await communityService.createPost(communityId, createCommunityPostFormData(draft));
      else if (draft.image || draft.removeImage) await communityService.updatePostMedia(postId, createCommunityPostFormData(draft));
      else await communityService.updatePost(postId, draftTextUpdate(draft));
      return true;
    } finally { submitLock.current = false; setSubmitting(false); }
  };
  return {
    draft, loading, loadError, submitting, reload: load, save,
    hasImage: draftHasImage(draft),
    setBody: (body: string) => setDraft((current) => ({ ...current, body })),
    setDescription: (imageDescription: string) => setDraft((current) => ({ ...current, imageDescription })),
    selectImage: (image: ImagePickerAsset) => setDraft((current) => replaceDraftImage(current, image)),
    removeImage: () => setDraft(removeDraftImage),
  };
}
