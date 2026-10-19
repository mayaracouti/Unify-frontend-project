import { useEffect, useRef, useState } from "react";
import type { ImagePickerAsset } from "expo-image-picker";
import { communityService } from "../services/communityService";
import { createCommunityPostFormData, IMAGE_DESCRIPTION_MAX_LENGTH } from "../community/post-draft";
import { showGlobalToast } from "../utils/globalToast";

export function useCommunityCommentEditor(postId: string, isMember: boolean, authToken: string | null) {
  const [body, setBody] = useState("");
  const [image, setImage] = useState<ImagePickerAsset | null>(null);
  const [imageDescription, setImageDescription] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const inFlight = useRef(false);
  const generation = useRef(0);

  useEffect(() => {
    generation.current++;
    setBody(""); setImage(null); setImageDescription(""); setSubmitting(false);
    const lifecycle = generation;
    return () => { lifecycle.current++; };
  }, [postId, authToken]);

  function selectImage(next: ImagePickerAsset | null) {
    if (inFlight.current) return;
    setImage(next);
    setImageDescription("");
  }

  async function submit() {
    if (inFlight.current || !postId || !isMember) return null;
    const validation = body.trim().length > 400 ? "O comentário deve ter até 400 caracteres."
      : !body.trim() && !image ? "Escreva um comentário ou selecione uma imagem."
      : imageDescription.trim().length > IMAGE_DESCRIPTION_MAX_LENGTH ? "A descrição deve ter até 240 caracteres."
      : !image && imageDescription.trim() ? "A descrição exige uma imagem." : null;
    if (validation) {
      showGlobalToast({ title: "Confira o comentário", message: validation, variant: "warning" });
      return null;
    }
    inFlight.current = true;
    const current = generation.current;
    setSubmitting(true);
    try {
      const comment = image
        ? await communityService.createCommentWithImage(postId, createCommunityPostFormData({
          body, image, imageDescription, existingMedia: null, removeImage: false,
        }))
        : await communityService.createComment(postId, { body: body.trim() });
      if (generation.current !== current) return null;
      setBody(""); setImage(null); setImageDescription("");
      return comment;
    } catch {
      // A API apresenta o erro; o rascunho completo permanece para tentar novamente.
      return null;
    } finally {
      inFlight.current = false;
      if (generation.current === current) setSubmitting(false);
    }
  }

  return { body, setBody, image, selectImage, imageDescription, setImageDescription, submitting, submit };
}
