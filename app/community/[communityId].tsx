import { CommunityPostMenu } from "../../src/components/community/post/post-menu";
import { useCommunityFeed } from "../../src/hooks/use-community-feed";
import { useCommunityMembers } from "../../src/hooks/use-community-members";
import { applyLikeUpdate, applyMembershipUpdate, removePost } from "../../src/community/feed-state";
import { useCommunityPostActions } from "../../src/hooks/use-community-post-actions";
import { getEffectiveCommunityRole, canParticipateInCommunity, resolveCommunityActorId, resolveCommunityMemberTargetId, isCommunityMemberOwner, canEditCommunityPost, canDeleteCommunityPost, canReportCommunityPost } from "../../src/community/permissions";
import { CommunityHeader } from "../../src/components/community/community-header";
import { CommunityMemberCard } from "../../src/components/community/community-member-card";
import { CommunityPostCard } from "../../src/components/community/post/community-post-card";
import { useIsFocused } from "@react-navigation/native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Alert,
  Pressable,
  RefreshControl,
  ScrollView,
  Text,
  View,
} from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";
import { SafeAreaView } from "react-native-safe-area-context";

import {
  buildActionSpeech,
  buildCommunitySpeech,
  useTTS,
} from "../../src/accessibility/tts";
import {
  canModerateRole,
} from "../../src/components/community/community-card";
import { GlobalBottomNav } from "../../src/components/navigation/global-bottom-nav";
import { GlobalTopNav } from "../../src/components/navigation/global-top-nav";
import { ReportModal } from "../../src/components/report/report-modal";
import { ScreenEmpty } from "../../src/components/ui/screen-empty";
import { ScreenError } from "../../src/components/ui/screen-error";
import { ScreenLoading } from "../../src/components/ui/screen-loading";
import { useAppShell } from "../../src/context/AppShellContext";
import { useAuth } from "../../src/context/AuthContext";
import { communityService } from "../../src/services/communityService";
import type {
  CommunityMemberResponse,
  CommunityPostResponse,
} from "../../src/types/community";
import {
  accessibilityAnnouncements,
  announceForAccessibility,
} from "../../src/utils/accessibilityAnnouncements";
import { showGlobalToast } from "../../src/utils/globalToast";
import { buildUserProfileHref } from "../../src/utils/userProfileRoute";

function normalizeRouteParam(value?: string | string[]) {
  if (Array.isArray(value)) {
    return value[0] ?? "";
  }

  return value ?? "";
}

type CommunityViewTab = "posts" | "members";

function normalizeCommunityTab(value?: string | string[]) {
  return normalizeRouteParam(value).trim().toLowerCase() === "members"
    ? "members"
    : "posts";
}

function EmptyCommunityState({
  message,
  onRetry,
}: {
  message: string;
  onRetry?: () => void;
}) {
  return (
    <View className="flex-1 items-center justify-center px-8 py-16">
      <ScreenError title="Comunidade indisponível" message={message} onRetry={onRetry} />
    </View>
  );
}

function EmptyPostState({
  canParticipate,
  isPrivate,
  hasPendingRequest,
}: {
  canParticipate: boolean;
  isPrivate: boolean;
  hasPendingRequest: boolean;
}) {
  // Privada e nao participo: o backend devolve so o cabecalho (nome, descricao,
  // membros, visibilidade); as publicacoes e os membros nominais ficam ocultos
  // ate a entrada ser aprovada.
  if (isPrivate && !canParticipate) {
    return (
      <ScreenEmpty
        className="mx-6 mt-7 rounded-2xl border border-[#3A3246] bg-[#1A1C1F] px-6 py-8"
        title="Comunidade privada"
        description={
          hasPendingRequest
            ? "Seu pedido de entrada está aguardando aprovação. As publicações aparecem aqui assim que você for aceito."
            : "As publicações e a lista de membros são visíveis só para quem participa. Toque em Solicitar entrada para enviar um pedido de participação."
        }
        icon={
          <Ionicons
            name="lock-closed-outline"
            size={36}
            color="#CDBDFF"
            importantForAccessibility="no"
          />
        }
      />
    );
  }

  return (
    <ScreenEmpty
      className="mx-6 mt-7 rounded-2xl border border-[#3A3246] bg-[#1A1C1F] px-6 py-8"
      title="Ainda sem publicações"
      description={
        canParticipate
          ? "Seja a primeira pessoa a compartilhar algo com a comunidade."
          : "Entre na comunidade para começar a publicar e interagir com os posts."
      }
    />
  );
}

function EmptyMembersState() {
  return (
    <ScreenEmpty
      className="mx-6 mt-7 rounded-2xl border border-[#3A3246] bg-[#1A1C1F] px-6 py-8"
      title="Nenhum membro listado"
      description="Não foi possível encontrar participantes para esta comunidade no momento."
    />
  );
}

export default function CommunityDetailScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ communityId?: string | string[]; tab?: string | string[] }>();
  const isFocused = useIsFocused();
  const { speak } = useTTS();
  const { session } = useAuth();
  const { currentUserId, currentUserProfileId } = useAppShell();

  const requestedCommunityId = useMemo(
    () => normalizeRouteParam(params.communityId).trim(),
    [params.communityId]
  );
  const requestedTab = useMemo(() => normalizeCommunityTab(params.tab), [params.tab]);
  const authToken = session?.accessToken ?? null;
  const scrollViewRef = useRef<ScrollView | null>(null);
  const contentStartOffsetRef = useRef(0);
  const [activeTab, setActiveTab] = useState<CommunityViewTab>(requestedTab);
  const { feed, setFeed, loading, loadError, loadFeed } = useCommunityFeed(requestedCommunityId, authToken, isFocused);
  const { members, clearMembers, membersLoading, membersLoadError, loadMembers } = useCommunityMembers(
    feed?.community?.id ?? requestedCommunityId, authToken, isFocused && canParticipateInCommunity(feed?.community) && activeTab === "members");
  const [membershipBusy, setMembershipBusy] = useState(false);
  const { likeBusyPostIds, toggleLike } = useCommunityPostActions((response) => setFeed((current) => applyLikeUpdate(current, response)), `${requestedCommunityId}:${authToken ?? ""}`);
  const [pendingDeletePostId, setPendingDeletePostId] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [reportTarget, setReportTarget] = useState<{
    userId: string;
    postId: string;
    authorName: string;
  } | null>(null);
  const spokenCommunityIdRef = useRef<string | null>(null);
  // A aba de membros e restrita a quem participa: o backend recusa a listagem
  // para nao membros, entao a aba nem chega a ser exibida.
  const canViewMembers = canParticipateInCommunity(feed?.community);

  useEffect(() => {
    setActiveTab(requestedTab);
  }, [requestedTab]);

  // Deep link com `tab=members` ou saida da comunidade caem de volta nas publicacoes.
  useEffect(() => {
    if (!canViewMembers) {
      setActiveTab("posts");
    }
  }, [canViewMembers]);

  // Abrir a comunidade (inclusive por deep link) anuncia o conteudo semantico
  // real dela uma unica vez por comunidade carregada.
  useEffect(() => {
    const loadedCommunity = feed?.community;

    if (!isFocused || !loadedCommunity) {
      return;
    }

    if (spokenCommunityIdRef.current === loadedCommunity.id) {
      return;
    }

    spokenCommunityIdRef.current = loadedCommunity.id;
    speak(buildCommunitySpeech(loadedCommunity));
  }, [feed?.community, isFocused, speak]);

  const handleRefresh = useCallback(() => {
    setRefreshing(true);

    void (async () => {
      try {
        await Promise.all([
          loadFeed(),
          activeTab === "members" && canViewMembers ? loadMembers() : Promise.resolve(),
        ]);
      } finally {
        setRefreshing(false);
      }
    })();
  }, [activeTab, canViewMembers, loadFeed, loadMembers]);

  const handleChangeTab = useCallback((tab: CommunityViewTab) => {
    setActiveTab(tab);

    requestAnimationFrame(() => {
      if (!scrollViewRef.current) {
        return;
      }

      scrollViewRef.current.scrollTo({
        y: Math.max(contentStartOffsetRef.current - 16, 0),
        animated: true,
      });
    });
  }, []);

  const handleToggleMembership = useCallback(async () => {
    const communityId = feed?.community?.id ?? requestedCommunityId;

    if (!communityId || !feed?.community || membershipBusy) {
      return;
    }

    const leavingOrCanceling = Boolean(
      feed.community.isMember || feed.community.hasPendingRequest
    );

    // Acao sobre entidade dinamica: inclui o nome real da comunidade.
    speak(
      buildActionSpeech(
        feed.community.isMember
          ? "Sair da comunidade"
          : feed.community.hasPendingRequest
            ? "Cancelar solicitação de entrada na comunidade"
            : feed.community.privacy === "PRIVATE"
              ? "Solicitar entrada na comunidade"
              : "Participar da comunidade",
        feed.community.name
      )
    );
    setMembershipBusy(true);

    try {
      const response = leavingOrCanceling
        ? await communityService.leaveCommunity(communityId)
        : await communityService.joinCommunity(communityId);

      setFeed((currentFeed) => applyMembershipUpdate(currentFeed, response));

      // Sair da comunidade tira o acesso a listagem: so recarrega quem continua membro.
      if (activeTab === "members" && response.isMember) {
        void loadMembers();
      } else if (!response.isMember) {
        clearMembers();
      }

      showGlobalToast({
        title: response.isMember
          ? "Você entrou na comunidade"
          : response.pendingRequest
            ? "Solicitação enviada"
            : leavingOrCanceling && !feed.community.isMember
              ? "Solicitação cancelada"
              : "Você saiu da comunidade",
        variant: "success",
        message: response.isMember
          ? "Agora você pode publicar, curtir e comentar nos posts."
          : response.pendingRequest
            ? "Um administrador ou moderador da comunidade vai revisar sua entrada."
            : leavingOrCanceling && !feed.community.isMember
              ? "Você pode solicitar entrada novamente quando quiser."
              : "Você pode entrar novamente quando quiser.",
      });

      // Entrar/sair muda o que a tela permite fazer; o leitor de tela precisa
      // saber disso sem ter que varrer a tela atras do botao.
      if (response.isMember) {
        announceForAccessibility(
          accessibilityAnnouncements.communityJoined(feed.community.name)
        );
      } else if (!response.pendingRequest) {
        announceForAccessibility(
          accessibilityAnnouncements.communityLeft(feed.community.name)
        );
      }
    } catch {
      // Global API error toast already explains the failure.
    } finally {
      setMembershipBusy(false);
    }
  }, [activeTab, feed?.community, loadMembers, membershipBusy, requestedCommunityId, speak, clearMembers, setFeed]);

  const handleToggleLike = useCallback(
    async (post: CommunityPostResponse) => {
      if (!canParticipateInCommunity(feed?.community)) {
        showGlobalToast({
          title: "Participação necessária",
          variant: "warning",
          message: "Entre na comunidade para curtir publicações.",
        });
        return;
      }

      speak(
        buildActionSpeech(
          post.likedByCurrentUser
            ? "Remover curtida da publicação de"
            : "Curtir publicação de",
          post.author.name
        )
      );
      await toggleLike(post);
    },
    [feed?.community, toggleLike, speak]
  );

  const viewer = { userId: currentUserId, userProfileId: currentUserProfileId };
  const canDeletePost = (post: CommunityPostResponse) => canDeleteCommunityPost(post, viewer, feed?.community);
  const canEditPost = (post: CommunityPostResponse) => canEditCommunityPost(post, viewer);

  const handleEditPost = useCallback(
    (post: CommunityPostResponse) => {
      if (!feed?.community) {
        return;
      }

      // `create.tsx` em modo edicao (params postId/body): ao voltar, o efeito
      // de foco recarrega o feed e o texto novo aparece.
      router.push({
        pathname: "/community/create",
        params: {
          communityId: feed.community.id,
          postId: post.id,
        },
      });
    },
    [feed?.community, router]
  );

  const handleOpenProfile = useCallback(
    (userProfileId: string, name?: string | null) => {
      speak(buildActionSpeech("Abrir perfil de", name?.trim() || null));
      router.push(buildUserProfileHref(userProfileId, name));
    },
    [router, speak]
  );

  /**
   * Denuncia e sempre sobre outra pessoa: o proprio autor nunca ve o botao.
   * A comparacao cobre os dois ids porque o backend ora identifica o autor pelo
   * `User`, ora pelo `UserProfile`.
   */
  const canReportPost = (post: CommunityPostResponse) => canReportCommunityPost(post, viewer);

  const handleReportPost = useCallback(
    (post: CommunityPostResponse) => {
      const reportedUserId = post.author.id?.trim() || resolveCommunityActorId(post.author);

      if (!reportedUserId) {
        return;
      }

      speak(buildActionSpeech("Denunciar publicação de", post.author.name));
      setReportTarget({
        authorName: post.author.name,
        postId: post.id,
        userId: reportedUserId,
      });
    },
    [speak]
  );

  const canManageMemberRole = useCallback(
    (member: CommunityMemberResponse) => {
      if (!feed?.community) {
        return false;
      }

      const viewerRole = getEffectiveCommunityRole(feed.community);

      if (!canModerateRole(viewerRole)) {
        return false;
      }

      const targetId = resolveCommunityMemberTargetId(member);

      if (!targetId) {
        return false;
      }

      if (isCommunityMemberOwner(member, feed.community)) {
        return false;
      }

      if (
        (currentUserProfileId && targetId === currentUserProfileId) ||
        (currentUserId && targetId === currentUserId)
      ) {
        return false;
      }

      if (viewerRole === "MODERATOR" && member.role === "ADMIN") {
        return false;
      }

      return true;
    },
    [currentUserId, currentUserProfileId, feed?.community]
  );

  const confirmDeletePost = useCallback(
    async (post: CommunityPostResponse) => {
      if (pendingDeletePostId) {
        return;
      }

      setPendingDeletePostId(post.id);

      try {
        await communityService.deletePost(post.id);
        setFeed((currentFeed) => removePost(currentFeed, post.id));
        showGlobalToast({
          title: "Publicação removida",
          variant: "success",
          message: "A publicação foi removida da comunidade.",
        });
        announceForAccessibility(accessibilityAnnouncements.communityPostDeleted());
      } catch {
        // Global API error toast already explains the failure.
      } finally {
        setPendingDeletePostId(null);
      }
    },
    [pendingDeletePostId, setFeed]
  );

  const handleDeletePost = useCallback(
    (post: CommunityPostResponse) => {
      speak(buildActionSpeech("Excluir publicação de", post.author.name));
      Alert.alert(
        "Excluir publicação",
        "Essa ação remove a publicação da comunidade. Deseja continuar?",
        [
          { text: "Cancelar", style: "cancel" },
          {
            text: "Excluir",
            style: "destructive",
            onPress: () => {
              void confirmDeletePost(post);
            },
          },
        ]
      );
    },
    [confirmDeletePost, speak]
  );

  // Excluir/sair da comunidade migrou para `app/community/settings.tsx`
  // (hook `use-community-danger-actions`), acessivel pela engrenagem do
  // cabecalho para owner/admin.
  const handleOpenJoinRequests = useCallback(() => {
    const communityId = feed?.community?.id ?? requestedCommunityId;

    if (!communityId) {
      return;
    }

    speak(
      buildActionSpeech(
        "Solicitações de entrada da comunidade",
        feed?.community?.name ?? null
      )
    );
    router.push({
      pathname: "/community/join-requests",
      params: {
        communityId,
        communityName: feed?.community?.name ?? "",
      },
    });
  }, [feed?.community?.id, feed?.community?.name, requestedCommunityId, router, speak]);

  const handleOpenCommunitySettings = useCallback(() => {
    const communityId = feed?.community?.id ?? requestedCommunityId;

    if (!communityId) {
      return;
    }

    speak(
      buildActionSpeech(
        "Configurações da comunidade",
        feed?.community?.name ?? null
      )
    );
    router.push({
      pathname: "/community/settings",
      params: { communityId },
    });
  }, [feed?.community?.id, feed?.community?.name, requestedCommunityId, router, speak]);

  const handleOpenComments = useCallback(
    (post: CommunityPostResponse) => {
      if (!feed?.community) {
        return;
      }

      speak(buildActionSpeech("Abrir comentários da publicação de", post.author.name));
      router.push({
        pathname: "/community/comments",
        params: {
          communityId: feed.community.id,
          communityName: feed.community.name,
          postId: post.id,
          authorName: post.author.name,
          postBody: post.body,
          publishedAt: post.publishedAt ?? "",
          isMember: canParticipateInCommunity(feed.community) ? "true" : "false",
          canModerate: canModerateRole(getEffectiveCommunityRole(feed.community)) ? "true" : "false",
        },
      });
    },
    [feed?.community, router, speak]
  );

  const handleOpenCreatePost = useCallback(() => {
    if (!feed?.community) {
      return;
    }

    if (!canParticipateInCommunity(feed.community)) {
      showGlobalToast({
        title: "Participação necessária",
        variant: "warning",
        message: "Entre na comunidade para criar publicações.",
      });
      return;
    }

    speak(buildActionSpeech("Criar publicação em", feed.community.name));
    router.push({
      pathname: "/community/create",
      params: {
        communityId: feed.community.id,
      },
    });
  }, [feed?.community, router, speak]);

  const handleManageMember = useCallback(
    (member: CommunityMemberResponse) => {
      if (!feed?.community) {
        return;
      }

      const targetId = resolveCommunityMemberTargetId(member);

      if (!targetId) {
        showGlobalToast({
          title: "Gestão indisponível",
          variant: "warning",
          message: "Não foi possível identificar esse membro para atualizar o cargo.",
        });
        return;
      }

      router.push({
        pathname: "/community/manage-member",
        params: {
          communityId: feed.community.id,
          communityName: feed.community.name,
          userProfileId: targetId,
          userName: member.name,
          viewerRole: getEffectiveCommunityRole(feed.community) ?? "",
          returnTab: "members",
        },
      });
    },
    [feed?.community, router]
  );

  const community = feed?.community ?? null;
  const posts = feed?.posts ?? [];
  const canParticipate = canParticipateInCommunity(community);
  const isRequestedCommunityVisible =
    !requestedCommunityId || !community || community.id === requestedCommunityId;

  return (
    <View className="flex-1 bg-[#131313]">
      <SafeAreaView className="flex-1 bg-black">
        <GlobalTopNav />

        <View className="flex-1">
          {loading && !feed ? (
            <View className="flex-1 items-center justify-center bg-[#131313]">
              <ScreenLoading label="Carregando comunidade..." />
            </View>
          ) : (
            <ScrollView
              ref={scrollViewRef}
              className="flex-1 bg-[#131313]"
              contentContainerClassName="min-h-full pb-28"
              refreshControl={
                <RefreshControl
                  refreshing={refreshing}
                  tintColor="#7C4DFF"
                  onRefresh={handleRefresh}
                />
              }
              showsVerticalScrollIndicator={false}
            >
              <View>
                <Pressable
                  className="self-start w-full border-[#494455] bg-[#1A1C1F] px-4 py-3"
                  onPress={() => {
                    speak("Voltar para comunidades");
                    router.replace("/community");
                  }}
                  accessibilityRole="button"
                  accessibilityLabel="Voltar para comunidades"
                  accessibilityHint="Volta para a lista de comunidades"
                >
                  <View className="flex-row items-center gap-2">
                    <Ionicons name="arrow-back" size={16} color="#E5E2E1" />
                    <Text className="text-[14px] font-bold text-white">
                      Voltar para comunidades
                    </Text>
                  </View>
                </Pressable>
              </View>

              {loadError && feed ? (
                <View className="mx-6 mt-6 rounded-2xl border border-[#6A4456] bg-[#2A1C24] px-4 py-4">
                  <Text className="text-[15px] font-bold text-[#FFD3DD]">Atualização parcial</Text>
                  <Text className="mt-2 text-[14px] font-semibold leading-6 text-[#FFEAF0]">
                    {loadError}
                  </Text>
                </View>
              ) : null}

              {community && isRequestedCommunityVisible ? (
                <>
                  <CommunityHeader
                    activeTab={activeTab}
                    authToken={authToken}
                    canViewMembers={canParticipate}
                    community={community}
                    membershipBusy={membershipBusy}
                    onChangeTab={handleChangeTab}
                    onOpenJoinRequests={handleOpenJoinRequests}
                    onOpenSettings={handleOpenCommunitySettings}
                    onToggleMembership={handleToggleMembership}
                  />

                  <View
                    onLayout={(event) => {
                      contentStartOffsetRef.current = event.nativeEvent.layout.y;
                    }}
                  />

                  {activeTab === "posts" ? (
                    posts.length > 0 ? (
                      <View className="gap-4 px-6 pt-7">
                        {posts.map((post) => (
                          <CommunityPostCard
                            key={post.id}
                            authToken={authToken}
                            likeBusy={likeBusyPostIds.has(post.id)}
                            onOpenComments={() => handleOpenComments(post)}
                            onOpenProfile={handleOpenProfile}
                            onToggleLike={() => handleToggleLike(post)}
                            post={post}
                            menu={<CommunityPostMenu authorName={post.author.name} deleting={pendingDeletePostId === post.id}
                              onEdit={canEditPost(post) ? () => handleEditPost(post) : undefined}
                              onDelete={canDeletePost(post) ? () => handleDeletePost(post) : undefined}
                              onReport={canReportPost(post) ? () => handleReportPost(post) : undefined} />}
                          />
                        ))}
                      </View>
                    ) : (
                      <EmptyPostState
                        canParticipate={canParticipate}
                        hasPendingRequest={Boolean(community.hasPendingRequest)}
                        isPrivate={community.privacy === "PRIVATE"}
                      />
                    )
                  ) : (
                    <>
                      {/* <View className="mx-6 mt-7 rounded-2xl border border-[#3A3246] bg-[#1A1C1F] px-5 py-5">
                        <Text className="text-[18px] font-black text-white">Membros da comunidade</Text>
                        <Text className="mt-3 text-[14px] font-semibold leading-6 text-content-secondary">
                          {canManageRoles
                            ? "Somente moderadores e admins podem alterar cargos. Use esta aba para gerir elevações em vez dos posts ou comentários."
                            : "Somente moderadores e admins podem alterar cargos. Nesta aba você pode acompanhar quem participa da comunidade."}
                        </Text>
                      </View> */}

                      {membersLoadError ? (
                        <View className="mx-6 mt-6 rounded-2xl border border-[#6A4456] bg-[#2A1C24] px-4 py-4">
                          <Text className="text-[15px] font-bold text-[#FFD3DD]">Falha ao carregar membros</Text>
                          <Text className="mt-2 text-[14px] font-semibold leading-6 text-[#FFEAF0]">
                            {membersLoadError}
                          </Text>
                        </View>
                      ) : null}

                      {membersLoading && members.length === 0 ? (
                        <ScreenLoading
                          label="Carregando membros..."
                          className="items-center px-6 py-12"
                        />
                      ) : members.length > 0 ? (
                        <View className="gap-4 px-6 pt-7">
                          {members.map((member, index) => (
                            <CommunityMemberCard
                              key={resolveCommunityMemberTargetId(member) ?? `${member.name}-${index}`}
                              authToken={authToken}
                              canManageRole={canManageMemberRole(member)}
                              community={community}
                              member={member}
                              onManageRole={() => handleManageMember(member)}
                              onOpenProfile={handleOpenProfile}
                            />
                          ))}
                        </View>
                      ) : (
                        <EmptyMembersState />
                      )}
                    </>
                  )}
                </>
              ) : (
                <EmptyCommunityState
                  message={
                    isRequestedCommunityVisible
                      ? loadError ??
                        "Não foi possível resolver a comunidade solicitada com os dados atuais do backend."
                      : "O backend retornou uma comunidade diferente da solicitada. Verifique se o communityId ainda existe."
                  }
                  onRetry={() => {
                    void loadFeed({ showLoader: true });
                  }}
                />
              )}
            </ScrollView>
          )}

          {community && isRequestedCommunityVisible && activeTab === "posts" ? (
            <Pressable
              className={`absolute bottom-6 right-6 h-16 w-16 items-center justify-center rounded-full border-2 ${
                canParticipate
                  ? "border-[#CDBDFF] bg-[#7C4DFF]"
                  : "border-[#4B4458] bg-[#2A2A2A]"
              }`}
              accessibilityRole="button"
              accessibilityLabel="Criar publicação"
              accessibilityHint={
                canParticipate
                  ? "Abre a tela para escrever uma publicação"
                  : "Entre na comunidade para publicar"
              }
              accessibilityState={{ disabled: !canParticipate }}
              onPress={handleOpenCreatePost}
            >
              <Ionicons
                name="add"
                size={38}
                color={canParticipate ? "#FCF6FF" : "#948EA1"}
              />
            </Pressable>
          ) : null}
        </View>

        <GlobalBottomNav />
      </SafeAreaView>

      {reportTarget ? (
        <ReportModal
          visible={reportTarget !== null}
          onClose={() => setReportTarget(null)}
          reportedUserId={reportTarget.userId}
          reportedPostId={reportTarget.postId}
          contextLabel={`uma publicação de ${reportTarget.authorName}`}
        />
      ) : null}
    </View>
  );
}
