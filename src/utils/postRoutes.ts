import type { Href } from "expo-router";

import type { UserPostResponse } from "../types/social";
import { formatRelativePostDate } from "./postFormatting";

/**
 * Tela de comentarios certa para um post do formato do feed: post de
 * comunidade usa as rotas/endpoints da comunidade; post pessoal, os de
 * `/users/posts`. Compartilhado pelo feed (`usePostListActions`) e pelo deep
 * link de notificacao de curtida/comentario.
 */
export function buildPostCommentsHref(post: UserPostResponse): Href {
  if (post.origin === "COMMUNITY" && post.community) {
    // O post so chega ao feed (ou a uma notificacao minha) quando posso ve-lo
    // como membro; moderacao fica a cargo da propria comunidade.
    return {
      pathname: "/community/comments",
      params: {
        communityId: post.community.id,
        communityName: post.community.name,
        postId: post.id,
        authorName: post.author.name,
        postBody: post.body,
        publishedAt: formatRelativePostDate(post.createdAt),
        isMember: "true",
        canModerate: "false",
      },
    };
  }

  return {
    pathname: "/posts/comments",
    params: {
      postId: post.id,
      authorName: post.author.name,
      authorUserProfileId: post.author.userProfileId ?? "",
      postBody: post.body,
      mediaUrl: post.mediaUrl ?? "",
      imageDescription: post.imageDescription ?? "",
      createdAt: post.createdAt,
    },
  };
}
