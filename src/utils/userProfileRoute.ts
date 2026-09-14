import type { Href } from "expo-router";

/**
 * Rota do perfil público de outra pessoa (`app/users/[userProfileId].tsx`).
 *
 * Centralizada para que avatar no chat, na lista de conversas, nos posts e na
 * lista de membros abram a mesma tela com os mesmos parâmetros. Quando o id é o
 * do próprio usuário, a tela redireciona para `/profile`.
 */
export function buildUserProfileHref(
  userProfileId: string,
  name?: string | null
): Href {
  return {
    pathname: "/users/[userProfileId]",
    params: {
      userProfileId,
      ...(name?.trim() ? { name: name.trim() } : {}),
    },
  };
}
