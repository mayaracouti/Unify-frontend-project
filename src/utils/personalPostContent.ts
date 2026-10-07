export const PERSONAL_POST_MAX_LENGTH = 600;
const DESCRIPTION_MARKER = "\n\nDescrição da imagem: ";

/** A descrição faz parte do texto persistido, compatível com a API atual. */
export function buildPersonalPostBody(body: string, description: string, hasImage: boolean): string {
  const text = body.trim();
  return hasImage && description.trim()
    ? `${text}${DESCRIPTION_MARKER}${description.trim()}`
    : text;
}

export function getPersonalPostImageDescription(body: string): string | null {
  const index = body.lastIndexOf(DESCRIPTION_MARKER);
  return index < 0 ? null : body.slice(index + DESCRIPTION_MARKER.length).trim() || null;
}

/** Frases curtas para o motor não cortar publicações longas. */
export function splitPostSpeech(body: string): string[] {
  const parts: string[] = [];
  let remaining = body.trim();
  while (remaining.length > 350) {
    const space = remaining.lastIndexOf(" ", 350);
    const cut = space > 0 ? space : 350;
    parts.push(remaining.slice(0, cut));
    remaining = remaining.slice(cut).trim();
  }
  if (remaining) parts.push(remaining);
  return parts;
}
