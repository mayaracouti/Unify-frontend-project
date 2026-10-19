export const CHAT_IMAGE_DESCRIPTION_MAX_LENGTH = 240;
const DESCRIPTION_PREFIX = "Descrição da imagem: ";

/** A API do chat persiste caption em body; o prefixo distingue descrições de legendas antigas. */
export function buildChatImageCaption(description: string): string | undefined {
  return description.trim() ? `${DESCRIPTION_PREFIX}${description.trim()}` : undefined;
}

export function chatImageCaptionLabel(body: string | null): string | null {
  const caption = body?.trim();
  if (!caption) return null;
  return caption.startsWith(DESCRIPTION_PREFIX)
    ? caption
    : `Legenda: ${caption}`;
}

export function describeChatImage(body: string | null): string {
  const caption = chatImageCaptionLabel(body);
  return caption ? `Imagem. ${caption}` : "Imagem sem descrição";
}
