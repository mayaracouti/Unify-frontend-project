import { useRouter } from "expo-router";
import { useCallback, useState, type Dispatch, type SetStateAction } from "react";

import { communityService } from "../../services/communityService";
import { feedService } from "../../services/feedService";
import { followService } from "../../services/followService";
import type { UserPostResponse } from "../../types/social";
import {
  accessibilityAnnouncements,
  announceForAccessibility,
} from "../../utils/accessibilityAnnouncements";
import { showGlobalToast } from "../../utils/globalToast";
import { formatRelativePostDate } from "../../utils/postFormatting";
import { buildUserProfileHref } from "../../utils/userProfileRoute";
import { ReportModal } from "../report/report-modal";
import { ActionSheet } from "../ui/action-sheet";
import type { FeedPostCardHandlers } from "./feed-post-card";

/**
 * Acoes compartilhadas por toda lista de `FeedPostCard` (Inicio, Perfil,
 * perfil publico, lista completa de publicacoes).
 *
 * Um post do feed unificado pode ser PESSOAL ou de COMUNIDADE; a origem decide
 * o backend: `feedService` (`/users/posts/...`) para pessoais e
 * `communityService` (`/communities/posts/...`) para os de comunidade. Curtir
 * e otimista: o contador muda na hora e volta se a requisicao falhar.
 */
export function usePostListActions(
  setPosts: Dispatch<SetStateAction<UserPostResponse[]>>
) {
  const router = useRouter();
  const [likeBusyPostId, setLikeBusyPostId] = useState<string | null>(null);
  const [deletingPostId, setDeletingPostId] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<UserPostResponse | null>(null);
  const [reportTarget, setReportTarget] = useState<UserPostResponse | null>(null);
  const [suggestionBusyPostId, setSuggestionBusyPostId] = useState<string | null>(null);

  const patchPost = useCallback(
    (postId: string, patch: Partial<UserPostResponse>) => {
      setPosts((previous) =>
        previous.map((post) => (post.id === postId ? { ...post, ...patch } : post))
      );
    },
    [setPosts]
  );

  const toggleLike = useCallback(
    (post: UserPostResponse) => {
      if (likeBusyPostId) {
        return;
      }

      const nextLiked = !post.likedByCurrentUser;
      const previousState = {
        likedByCurrentUser: post.likedByCurrentUser,
        likesCount: post.likesCount,
      };

      setLikeBusyPostId(post.id);
      patchPost(post.id, {
        likedByCurrentUser: nextLiked,
        likesCount: Math.max(0, post.likesCount + (nextLiked ? 1 : -1)),
      });

      void (async () => {
        try {
          if (post.origin === "COMMUNITY") {
            const response = nextLiked
              ? await communityService.likePost(post.id)
              : await communityService.unlikePost(post.id);
            patchPost(post.id, {
              likedByCurrentUser: response.likedByCurrentUser ?? nextLiked,
              likesCount:
                typeof response.likesCount === "number"
                  ? response.likesCount
                  : Math.max(0, post.likesCount + (nextLiked ? 1 : -1)),
            });
          } else {
            const response = nextLiked
              ? await feedService.likePost(post.id)
              : await feedService.unlikePost(post.id);
            patchPost(post.id, {
              likedByCurrentUser: response.likedByCurrentUser,
              likesCount: response.likesCount,
            });
          }

          announceForAccessibility(
            nextLiked
              ? accessibilityAnnouncements.postLiked()
              : accessibilityAnnouncements.postUnliked()
          );
        } catch {
          patchPost(post.id, previousState);
          // Global API error toast already explains the failure.
        } finally {
          setLikeBusyPostId(null);
        }
      })();
    },
    [likeBusyPostId, patchPost]
  );

  /**
   * Acao rapida da sugestao "perfil": seguir o autor. Todos os posts do mesmo
   * autor na lista deixam de ser sugestao (viram FOLLOWING) na hora; se a
   * requisicao falhar, voltam.
   */
  const followAuthor = useCallback(
    (post: UserPostResponse) => {
      const targetProfileId = post.author.userProfileId;
      if (!targetProfileId || suggestionBusyPostId) {
        return;
      }

      const authorUserId = post.author.userId;
      const patchAuthorPosts = (feedSource: UserPostResponse["feedSource"]) => {
        setPosts((previous) =>
          previous.map((item) =>
            item.origin === "PERSONAL" && item.author.userId === authorUserId
              ? { ...item, feedSource }
              : item
          )
        );
      };

      setSuggestionBusyPostId(post.id);
      patchAuthorPosts("FOLLOWING");

      void (async () => {
        try {
          await followService.follow(targetProfileId);
          announceForAccessibility(accessibilityAnnouncements.followStarted(post.author.name));
          showGlobalToast({
            title: `Você começou a seguir ${post.author.name}`,
            message: "As publicações dessa pessoa passam a aparecer no seu feed.",
            variant: "success",
          });
        } catch {
          patchAuthorPosts("SUGGESTED_PROFILE");
          // Global API error toast already explains the failure.
        } finally {
          setSuggestionBusyPostId(null);
        }
      })();
    },
    [setPosts, suggestionBusyPostId]
  );

  /**
   * Acao rapida da sugestao "comunidade": entrar. So comunidades PUBLICAS
   * chegam como sugestao, entao a entrada e imediata; ainda assim o retorno
   * do backend manda (`isMember`), para nao mentir se a comunidade virou
   * privada no meio do caminho.
   */
  const joinCommunity = useCallback(
    (post: UserPostResponse) => {
      const community = post.community;
      if (!community || suggestionBusyPostId) {
        return;
      }

      const patchCommunityPosts = (feedSource: UserPostResponse["feedSource"]) => {
        setPosts((previous) =>
          previous.map((item) =>
            item.community?.id === community.id ? { ...item, feedSource } : item
          )
        );
      };

      setSuggestionBusyPostId(post.id);

      void (async () => {
        try {
          const response = await communityService.joinCommunity(community.id);

          if (response.isMember) {
            patchCommunityPosts("MEMBER_COMMUNITY");
            announceForAccessibility(accessibilityAnnouncements.communityJoined(community.name));
            showGlobalToast({
              title: "Você entrou na comunidade",
              message: "Agora você pode publicar, curtir e comentar nos posts.",
              variant: "success",
            });
          } else {
            showGlobalToast({
              title: response.pendingRequest ? "Solicitação enviada" : "Entrada não concluída",
              message: response.pendingRequest
                ? "Um administrador ou moderador da comunidade vai revisar sua entrada."
                : "Tente novamente pela página da comunidade.",
              variant: "info",
            });
          }
        } catch {
          // Global API error toast already explains the failure.
        } finally {
          setSuggestionBusyPostId(null);
        }
      })();
    },
    [setPosts, suggestionBusyPostId]
  );

  const openComments = useCallback(
    (post: UserPostResponse) => {
      if (post.origin === "COMMUNITY" && post.community) {
        // Tela de comentarios da comunidade: o post so chega ao feed quando
        // sou membro, entao `isMember` e verdadeiro; moderacao fica a cargo da
        // propria comunidade.
        router.push({
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
        });
        return;
      }

      router.push({
        pathname: "/posts/comments",
        params: {
          postId: post.id,
          authorName: post.author.name,
          authorUserProfileId: post.author.userProfileId ?? "",
          postBody: post.body,
          createdAt: post.createdAt,
        },
      });
    },
    [router]
  );

  const openProfile = useCallback(
    (post: UserPostResponse) => {
      if (!post.author.userProfileId) {
        return;
      }

      router.push(buildUserProfileHref(post.author.userProfileId, post.author.name));
    },
    [router]
  );

  const openCommunity = useCallback(
    (post: UserPostResponse) => {
      if (!post.community) {
        return;
      }

      router.push({
        pathname: "/community/[communityId]",
        params: { communityId: post.community.id },
      });
    },
    [router]
  );

  const editPost = useCallback(
    (post: UserPostResponse) => {
      if (post.origin === "COMMUNITY" && post.community) {
        router.push({
          pathname: "/community/create",
          params: { communityId: post.community.id, postId: post.id, body: post.body },
        });
        return;
      }

      router.push({
        pathname: "/profile/new-post",
        params: { postId: post.id, body: post.body },
      });
    },
    [router]
  );

  const confirmDelete = useCallback(() => {
    const target = deleteTarget;
    setDeleteTarget(null);

    if (!target || deletingPostId) {
      return;
    }

    setDeletingPostId(target.id);

    void (async () => {
      try {
        if (target.origin === "COMMUNITY") {
          await communityService.deletePost(target.id);
          announceForAccessibility(accessibilityAnnouncements.communityPostDeleted());
        } else {
          await feedService.deletePost(target.id);
          announceForAccessibility(accessibilityAnnouncements.personalPostDeleted());
        }

        setPosts((previous) => previous.filter((post) => post.id !== target.id));
      } catch {
        // Global API error toast already explains the failure.
      } finally {
        setDeletingPostId(null);
      }
    })();
  }, [deleteTarget, deletingPostId, setPosts]);

  const handlers: FeedPostCardHandlers = {
    onToggleLike: toggleLike,
    onOpenComments: openComments,
    onOpenProfile: openProfile,
    onOpenCommunity: openCommunity,
    onEdit: editPost,
    onDelete: setDeleteTarget,
    onReport: setReportTarget,
    onFollowAuthor: followAuthor,
    onJoinCommunity: joinCommunity,
  };

  /**
   * Dialogos compartilhados (confirmacao de exclusao + denuncia). Renderizar
   * UMA vez por tela, fora da lista.
   */
  const dialogs = (
    <>
      <ActionSheet
        message="A publicação sai do feed e do seu perfil. Não dá para desfazer."
        onClose={() => setDeleteTarget(null)}
        options={[
          {
            key: "confirm-delete",
            label: "Excluir",
            hint: "Exclui a publicação de forma permanente",
            icon: "trash-outline",
            destructive: true,
            onPress: confirmDelete,
          },
        ]}
        title="Excluir publicação?"
        visible={Boolean(deleteTarget)}
      />

      {/*
        Posts pessoais e de comunidade vivem na mesma tabela no backend
        (`posts`, coluna origin), então a denúncia aponta para a própria
        publicação; o autor vai junto como usuário denunciado.
      */}
      <ReportModal
        visible={reportTarget !== null}
        onClose={() => setReportTarget(null)}
        reportedUserId={reportTarget?.author.userId ?? ""}
        reportedPostId={reportTarget?.id ?? null}
        contextLabel={`publicação de ${reportTarget?.author.name ?? ""}`}
      />
    </>
  );

  return { deletingPostId, dialogs, handlers, likeBusyPostId, patchPost, suggestionBusyPostId };
}
