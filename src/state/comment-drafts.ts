// Rascunhos ficam somente nesta sessão, separados por usuário e publicação.
// Não persistimos conteúdo pessoal no armazenamento do aparelho.
const drafts = new Map<string, string>();

function key(userId: string, postId: string): string {
  return JSON.stringify([userId, postId]);
}

export function getCommentDraft(userId: string, postId: string): string {
  return drafts.get(key(userId, postId)) ?? "";
}

export function saveCommentDraft(userId: string, postId: string, text: string): void {
  if (text) drafts.set(key(userId, postId), text);
  else drafts.delete(key(userId, postId));
}

export function clearCommentDrafts(): void {
  drafts.clear();
}
