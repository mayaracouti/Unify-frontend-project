import { getPersonalPostImageDescription, splitPostSpeech } from "../utils/personalPostContent";
export interface AccessiblePostContent {
  body: string;
  imageDescription?: string | null;
  hasImage: boolean;
  origin?: "PERSONAL" | "COMMUNITY";
}
export function resolvePostImageDescription(post: AccessiblePostContent): string | null {
  if (!post.hasImage) return null;
  return post.imageDescription?.trim() || (post.origin === "PERSONAL" ? getPersonalPostImageDescription(post.body) : null);
}
export function postImageLabel(description: string | null | undefined, authorName: string): string {
  return description?.trim() ? `Descrição da imagem: ${description.trim()}` : `Imagem da publicação de ${authorName}, sem descrição`;
}
export function postSpeechParts(post: AccessiblePostContent): string[] {
  const description = resolvePostImageDescription(post);
  // Legacy personal descriptions are already included in body.
  const separateDescription = description && (post.origin !== "PERSONAL" || post.imageDescription?.trim());
  return [...splitPostSpeech(post.body), ...(separateDescription ? ["Descrição da imagem.", ...splitPostSpeech(description)] : [])];
}
