import { useIsFocused } from "@react-navigation/native";
import { useLocalSearchParams, useRouter } from "expo-router";
import type { ComponentProps } from "react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Pressable,
  RefreshControl,
  ScrollView,
  Text,
  View,
} from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";
import { LinearGradient } from "expo-linear-gradient";
import { SafeAreaView } from "react-native-safe-area-context";

import {
  buildActionSpeech,
  buildCommunityMemberSpeech,
  buildCommunityPostSpeech,
  buildCommunitySpeech,
  useTTS,
} from "../../src/accessibility/tts";
import {
  CommunityRoleBadge,
  canModerateRole,
  formatMemberCount,
} from "../../src/components/community/community-card";
import { GlobalBottomNav } from "../../src/components/navigation/global-bottom-nav";
import { GlobalTopNav } from "../../src/components/navigation/global-top-nav";
import {
  AuthenticatedRemoteImage,
  preloadAuthenticatedRemoteImages,
} from "../../src/components/profile/authenticated-remote-image";
import { ReportModal } from "../../src/components/report/report-modal";
import { ActionSheet, type ActionSheetOption } from "../../src/components/ui/action-sheet";
import { ScreenEmpty } from "../../src/components/ui/screen-empty";
import { ScreenError } from "../../src/components/ui/screen-error";
import { ScreenLoading } from "../../src/components/ui/screen-loading";
import { useAppShell } from "../../src/context/AppShellContext";
import { useAuth } from "../../src/context/AuthContext";
import { communityService } from "../../src/services/communityService";
import type {
  CommunityUserSummaryResponse,
  CommunityMemberResponse,
  CommunityFeedResponse,
  CommunityLikeResponse,
  CommunityMembershipResponse,
  CommunityPostResponse,
  CommunityRole,
  CommunitySummaryResponse,
} from "../../src/types/community";
import {
  accessibilityAnnouncements,
  announceForAccessibility,
} from "../../src/utils/accessibilityAnnouncements";
import { formatApiErrorMessage } from "../../src/utils/auth";
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

function getEffectiveCommunityRole(
  community?: CommunitySummaryResponse | null
): CommunityRole | null {
  if (!community) {
    return null;
  }

  if (community.currentUserRole) {
    return community.currentUserRole;
  }

  return community.isOwner ? "ADMIN" : null;
}

function canParticipateInCommunity(community?: CommunitySummaryResponse | null) {
  if (!community) {
    return false;
  }

  return Boolean(community.isMember || community.isOwner || community.currentUserRole);
}

type NormalizedCommunityFeed = {
  community: CommunitySummaryResponse | null;
  posts: CommunityPostResponse[];
  // TODO: paginação incremental — expor `postsHasNext`/`postsPage` quando o feed
  // ganhar scroll infinito; hoje carregamos apenas a primeira página (size padrão).
  postsHasNext: boolean;
};

function normalizeFeedResponse(response: CommunityFeedResponse): NormalizedCommunityFeed {
  return {
    community: response.community ?? null,
    posts: Array.isArray(response.posts?.content) ? response.posts.content : [],
    postsHasNext: response.posts?.hasNext ?? false,
  };
}

function collectCommunityAssetUrls(feed: NormalizedCommunityFeed) {
  const communityIconUrl = communityService.resolveAssetUrl(feed.community?.iconData);
  const ownerAvatarUrl = communityService.resolveAssetUrl(feed.community?.owner?.avatarData);
  const postAssetUrls = feed.posts.flatMap((post) => {
    const authorAvatarUrl = communityService.resolveAssetUrl(post.author.avatarData);
    const mediaUrl = communityService.resolveAssetUrl(post.mediaData);

    return [authorAvatarUrl, mediaUrl].filter(
      (value): value is string => typeof value === "string" && value.length > 0
    );
  });

  return [communityIconUrl, ownerAvatarUrl, ...postAssetUrls].filter(
    (value): value is string => typeof value === "string" && value.length > 0
  );
}

function collectMemberAssetUrls(members: CommunityMemberResponse[]) {
  return members
    .map((member) => communityService.resolveAssetUrl(member.avatarData))
    .filter((value): value is string => typeof value === "string" && value.length > 0);
}

function resolveCommunityActorId(actor?: CommunityUserSummaryResponse | null) {
  return [actor?.userProfileId, actor?.id]
    .map((value) => value?.trim())
    .find((value): value is string => Boolean(value));
}

function resolveCommunityMemberTargetId(member: CommunityMemberResponse) {
  return [member.userProfileId, member.id]
    .map((value) => value?.trim())
    .find((value): value is string => Boolean(value));
}

function isCommunityMemberOwner(
  member: CommunityMemberResponse,
  community?: CommunitySummaryResponse | null
) {
  if (member.isOwner || member.owner) {
    return true;
  }

  const ownerId = resolveCommunityActorId(community?.owner);
  const memberTargetId = resolveCommunityMemberTargetId(member);

  return Boolean(ownerId && memberTargetId && ownerId === memberTargetId);
}

function applyMembershipUpdate(
  currentFeed: NormalizedCommunityFeed | null,
  membership: CommunityMembershipResponse
) {
  if (!currentFeed?.community) {
    return currentFeed;
  }

  return {
    ...currentFeed,
    community: {
      ...currentFeed.community,
      isMember: membership.isMember,
      memberCount: membership.memberCount,
      currentUserRole: membership.role ?? null,
      isOwner: membership.isOwner ?? false,
      hasPendingRequest: membership.pendingRequest ?? false,
    },
  };
}

function applyLikeUpdate(currentFeed: NormalizedCommunityFeed | null, like: CommunityLikeResponse) {
  if (!currentFeed) {
    return currentFeed;
  }

  return {
    ...currentFeed,
    posts: currentFeed.posts.map((post) =>
      post.id === like.postId
        ? {
            ...post,
            likedByCurrentUser: like.likedByCurrentUser,
            likesCount: like.likesCount,
          }
        : post
    ),
  };
}

function removePost(currentFeed: NormalizedCommunityFeed | null, postId: string) {
  if (!currentFeed) {
    return currentFeed;
  }

  return {
    ...currentFeed,
    posts: currentFeed.posts.filter((post) => post.id !== postId),
  };
}

function getInitials(name?: string | null) {
  return (name ?? "")
    .trim()
    .split(" ")
    .filter(Boolean)
    .map((namePart) => namePart[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

function CommunityBadge({
  authToken,
  community,
}: {
  authToken: string | null;
  community: CommunitySummaryResponse;
}) {
  const iconUrl = communityService.resolveAssetUrl(community.iconData);

  return (
    <View className="h-20 w-20 items-center justify-center overflow-hidden rounded-xl border-2 border-[#CDBDFF] bg-[#7C4DFF]">
      {iconUrl ? (
        <AuthenticatedRemoteImage
          uri={iconUrl}
          authToken={authToken}
          className="h-full w-full"
          resizeMode="cover"
          fallback={
            <View className="flex-1 items-center justify-center bg-[#7C4DFF]">
              <Ionicons name="people" size={36} color="#FCF6FF" />
            </View>
          }
        />
      ) : (
        <Ionicons name="people" size={36} color="#FCF6FF" />
      )}
    </View>
  );
}

/**
 * Avatar do autor/membro. Com `userProfileId` + `onOpenProfile` vira um botao
 * que abre o perfil publico da pessoa; sem eles e decorativo. O toque fala o
 * destino antes de navegar (padrao `buildActionSpeech`).
 */
function AuthorAvatar({
  authToken,
  name,
  avatarData,
  userProfileId,
  onOpenProfile,
}: {
  authToken: string | null;
  name?: string | null;
  avatarData?: string | null;
  userProfileId?: string | null;
  onOpenProfile?: (userProfileId: string, name?: string | null) => void;
}) {
  const initials = getInitials(name);
  const avatarUrl = communityService.resolveAssetUrl(avatarData);
  const resolvedProfileId = userProfileId?.trim() || null;
  const canOpenProfile = Boolean(resolvedProfileId && onOpenProfile);

  const content = (
    <View
      className="h-14 w-14 items-center justify-center overflow-hidden rounded-full border-2 border-[#CDBDFF] bg-[#353534]"
      importantForAccessibility={canOpenProfile ? "no-hide-descendants" : "auto"}
    >
      {avatarUrl ? (
        <AuthenticatedRemoteImage
          uri={avatarUrl}
          authToken={authToken}
          className="h-full w-full"
          resizeMode="cover"
          fallback={
            <LinearGradient
              colors={["#CDBDFF", "#7C4DFF"]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              className="h-full w-full items-center justify-center"
            >
              <Text className="text-[16px] font-black text-white">{initials || "?"}</Text>
            </LinearGradient>
          }
        />
      ) : (
        <LinearGradient
          colors={["#CDBDFF", "#7C4DFF"]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          className="h-full w-full items-center justify-center"
        >
          <Text className="text-[16px] font-black text-white">{initials || "?"}</Text>
        </LinearGradient>
      )}
    </View>
  );

  if (!canOpenProfile || !resolvedProfileId) {
    return content;
  }

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`Abrir perfil de ${name?.trim() || "pessoa sem nome"}`}
      accessibilityHint="Abre o perfil público desta pessoa"
      hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
      onPress={() => onOpenProfile?.(resolvedProfileId, name)}
    >
      {content}
    </Pressable>
  );
}

function PostAction({
  accessibilityHint,
  accessibilityLabel,
  disabled,
  icon,
  count,
  active,
  loading,
  onPress,
}: {
  accessibilityHint?: string;
  accessibilityLabel: string;
  disabled?: boolean;
  icon: ComponentProps<typeof Ionicons>["name"];
  count?: number | null;
  active?: boolean | null;
  loading?: boolean;
  onPress: () => void;
}) {
  const busy = Boolean(loading);

  return (
    <Pressable
      className={`h-14 flex-1 flex-row items-center justify-center gap-2 rounded-lg ${
        disabled ? "opacity-60" : ""
      }`}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      accessibilityHint={accessibilityHint}
      accessibilityState={{
        busy,
        disabled: Boolean(disabled) || busy,
        selected: Boolean(active),
      }}
      onPress={onPress}
      disabled={disabled || loading}
    >
      {loading ? (
        <ActivityIndicator color="#7C4DFF" size="small" />
      ) : (
        <Ionicons
          name={icon}
          size={26}
          color={active ? "#7C4DFF" : "#CAC3D8"}
        />
      )}
      {typeof count === "number" ? (
        <Text
          className={`text-[16px] font-bold ${
            active ? "text-[#7C4DFF]" : "text-[#E5E2E1]"
          }`}
        >
          {count}
        </Text>
      ) : null}
    </Pressable>
  );
}

function MemberButton({
  busy,
  isMember,
  isPrivate,
  pendingRequest,
  onPress,
}: {
  busy: boolean;
  isMember?: boolean | null;
  isPrivate?: boolean;
  pendingRequest?: boolean | null;
  onPress: () => void;
}) {
  const muted = Boolean(isMember || pendingRequest);
  const label = isMember
    ? "Sair da comunidade"
    : pendingRequest
      ? "Cancelar solicitação"
      : isPrivate
        ? "Solicitar entrada"
        : "Participar";
  const icon = isMember
    ? "exit-outline"
    : pendingRequest
      ? "hourglass-outline"
      : isPrivate
        ? "lock-open-outline"
        : "add-circle";

  return (
    <Pressable
      className={`mt-8 h-14 w-full flex-row items-center justify-center gap-3 rounded-xl border-2 ${
        muted ? "border-[#494455] bg-[#2E2B33]" : "border-[#EAEA00] bg-[#EAEA00]"
      }`}
      onPress={onPress}
      disabled={busy}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityHint={
        pendingRequest
          ? "Cancela sua solicitação pendente de entrada nesta comunidade"
          : isMember
            ? "Você deixa de ver e publicar nesta comunidade"
            : isPrivate
              ? "Envia um pedido de entrada para a moderação avaliar"
              : "Você passa a publicar, curtir e comentar nesta comunidade"
      }
      accessibilityState={{ busy, disabled: busy }}
    >
      {busy ? (
        <ActivityIndicator color={muted ? "#E5E2E1" : "#323200"} size="small" />
      ) : (
        <>
          <Ionicons
            name={icon as ComponentProps<typeof Ionicons>["name"]}
            size={22}
            color={muted ? "#E5E2E1" : "#323200"}
          />
          <Text
            className={`text-[18px] font-black ${
              muted ? "text-[#E5E2E1]" : "text-[#1D1D00]"
            }`}
          >
            {label}
          </Text>
        </>
      )}
    </Pressable>
  );
}

function CommunityOwnerCard({
  authToken,
  community,
}: {
  authToken: string | null;
  community: CommunitySummaryResponse;
}) {
  const avatarUrl = communityService.resolveAssetUrl(community.owner?.avatarData);

  return (
    <View className="mt-6 rounded-2xl border border-[#353534] bg-[#17181C] px-4 py-4">
      <View className="flex-row items-center gap-3">
        <View className="h-12 w-12 overflow-hidden rounded-full bg-[#2C2834]">
          {avatarUrl ? (
            <AuthenticatedRemoteImage
              uri={avatarUrl}
              authToken={authToken}
              className="h-full w-full"
              resizeMode="cover"
              fallback={
                <View className="flex-1 items-center justify-center bg-[#2C2834]">
                  <Ionicons name="person" size={18} color="#E5E2E1" />
                </View>
              }
            />
          ) : (
            <View className="flex-1 items-center justify-center bg-[#2C2834]">
              <Ionicons name="person" size={18} color="#E5E2E1" />
            </View>
          )}
        </View>

        <View className="flex-1">
          <Text className="text-[13px] font-semibold text-content-secondary">Criador</Text>
          <Text className="text-[16px] font-black text-white">
            {community.owner?.name ?? "Criador não informado"}
          </Text>
        </View>

        <CommunityRoleBadge isOwner={community.isOwner} role={community.currentUserRole} />
      </View>
    </View>
  );
}

function CommunityHeader({
  activeTab,
  authToken,
  canViewMembers,
  community,
  membershipBusy,
  onChangeTab,
  onOpenJoinRequests,
  onOpenSettings,
  onToggleMembership,
}: {
  activeTab: CommunityViewTab;
  authToken: string | null;
  canViewMembers: boolean;
  community: CommunitySummaryResponse;
  membershipBusy: boolean;
  onChangeTab: (tab: CommunityViewTab) => void;
  onOpenJoinRequests: () => void;
  onOpenSettings: () => void;
  onToggleMembership: () => void;
}) {
  const memberCountLabel = formatMemberCount(community.memberCount);

  return (
    <View className="border-b-2 border-[#494455] bg-[#201F1F] px-6 pb-12 pt-7">
      <View className="flex-row items-start justify-between gap-4">
        <CommunityBadge authToken={authToken} community={community} />

        <View className="flex-row items-center gap-2">
          {community.privacy === "PRIVATE" && canModerateRole(community.currentUserRole) ? (
            <Pressable
              className="rounded-full border border-[#494455] bg-[#1A1C1F] px-4 py-3"
              onPress={onOpenJoinRequests}
              accessibilityRole="button"
              accessibilityLabel="Solicitações de entrada"
              accessibilityHint="Abre a fila de solicitações pendentes para aprovar ou recusar"
            >
              <Ionicons name="person-add-outline" size={16} color="#EAEA00" />
            </Pressable>
          ) : null}

          {community.isOwner || community.currentUserRole === "ADMIN" ? (
            <Pressable
              className="rounded-full border border-[#494455] bg-[#1A1C1F] px-4 py-3"
              onPress={onOpenSettings}
              accessibilityRole="button"
              accessibilityLabel="Configurações da comunidade"
              accessibilityHint="Abre a tela para editar, sair ou excluir esta comunidade"
            >
              <Ionicons name="settings-outline" size={16} color="#E5E2E1" />
            </Pressable>
          ) : null}
        </View>
      </View>

      <Text className="mt-5 text-[32px] font-black leading-10 text-[#E5E2E1]">
        {community.name}
      </Text>

      <View className="mt-3 flex-row items-center gap-4">
        {memberCountLabel ? (
          <View className="flex-row items-center gap-2">
            <Ionicons name="person" size={16} color="#7C4DFF" />
            <Text className="text-[16px] font-black text-[#7C4DFF]">
              {memberCountLabel}
            </Text>
          </View>
        ) : null}

        <View
          className="flex-row items-center gap-1.5"
          accessible
          accessibilityLabel={
            community.privacy === "PRIVATE" ? "Comunidade privada" : "Comunidade pública"
          }
        >
          <Ionicons
            name={community.privacy === "PRIVATE" ? "lock-closed-outline" : "globe-outline"}
            size={15}
            color="#CAC3D8"
          />
          <Text className="text-[14px] font-bold text-content-secondary">
            {community.privacy === "PRIVATE" ? "Privada" : "Pública"}
          </Text>
        </View>
      </View>

      {/* <View className="mt-6 rounded-2xl border border-[#3A3246] bg-[#17181C] px-4 py-4"> */}
        {/* <Text className="text-[12px] font-black uppercase tracking-[1.2px] text-content-secondary">
          Navegacao da comunidade
        </Text>
        <Text className="mt-2 text-[14px] font-semibold leading-6 text-[#E5E2E1]">
          Escolha entre as publicacoes e a lista de membros.
        </Text> */}

        {canViewMembers ? (
          <CommunityContentTabs
            activeTab={activeTab}
            memberCount={community.memberCount}
            onChange={onChangeTab}
          />
        ) : null}
      {/* </View> */}

      {community.description ? (
        <Text className="mt-5 text-[18px] font-semibold leading-8 text-[#E5E2E1]">
          {community.description}
        </Text>
      ) : null}

      {/* <CommunityOwnerCard authToken={authToken} community={community} /> */}

      <Text className="mt-5 text-[14px] font-semibold leading-6 text-content-secondary">
        {community.isOwner
          ? "Você é a pessoa proprietária desta comunidade e pode gerenciar conteúdo e membros elevados."
          : community.currentUserRole
            ? canModerateRole(community.currentUserRole)
              ? "Você participa com elevação e pode moderar conteúdo dentro desta comunidade."
              : "Você participa desta comunidade e já pode publicar, curtir e comentar."
            : community.hasPendingRequest
              ? "Sua solicitação de entrada está pendente. Um administrador ou moderador precisa aprová-la."
              : community.privacy === "PRIVATE"
                ? "Esta comunidade é privada: solicite entrada e aguarde a aprovação da moderação."
                : "Entre para publicar, curtir e comentar nos posts da comunidade."}
      </Text>

      {!community.isOwner ? (
        <MemberButton
          busy={membershipBusy}
          isMember={community.isMember}
          isPrivate={community.privacy === "PRIVATE"}
          pendingRequest={community.hasPendingRequest}
          onPress={onToggleMembership}
        />
      ) : null}
    </View>
  );
}

function CommunityPostCard({
  authToken,
  canDelete,
  canEdit,
  canReport,
  deleting,
  likeBusy,
  onDelete,
  onEdit,
  onOpenComments,
  onOpenProfile,
  onReport,
  onToggleLike,
  post,
}: {
  authToken: string | null;
  canDelete: boolean;
  canEdit: boolean;
  canReport: boolean;
  deleting: boolean;
  likeBusy: boolean;
  onDelete: () => void;
  onEdit: () => void;
  onOpenComments: () => void;
  onOpenProfile: (userProfileId: string, name?: string | null) => void;
  onReport: () => void;
  onToggleLike: () => void;
  post: CommunityPostResponse;
}) {
  const { speak } = useTTS();
  const mediaUrl = communityService.resolveAssetUrl(post.mediaData);
  const [menuVisible, setMenuVisible] = useState(false);

  // Editar/excluir/denunciar saem dos botoes grandes e vao para um unico
  // menu discreto de reticencias: menos ruido visual e um so alvo de foco.
  const menuOptions: ActionSheetOption[] = [
    ...(canEdit
      ? [
          {
            key: "edit",
            label: "Editar publicação",
            hint: "Abre o texto da publicação para alterar",
            icon: "pencil-outline" as const,
            onPress: () => {
              setMenuVisible(false);
              speak("Editar publicação");
              onEdit();
            },
          },
        ]
      : []),
    ...(canDelete
      ? [
          {
            key: "delete",
            label: "Excluir publicação",
            hint: "Pede confirmação antes de remover a publicação",
            icon: "trash-outline" as const,
            destructive: true,
            onPress: () => {
              setMenuVisible(false);
              onDelete();
            },
          },
        ]
      : []),
    ...(canReport
      ? [
          {
            key: "report",
            label: "Denunciar publicação",
            hint: "Abre o formulário de denúncia desta publicação",
            icon: "flag-outline" as const,
            onPress: () => {
              setMenuVisible(false);
              onReport();
            },
          },
        ]
      : []),
  ];

  return (
    <View className="rounded-xl bg-[#2A2A2A] p-4">
      <View className="flex-row items-start gap-3">
        <AuthorAvatar
          authToken={authToken}
          name={post.author.name}
          avatarData={post.author.avatarData}
          userProfileId={post.author.userProfileId}
          onOpenProfile={onOpenProfile}
        />

        <Pressable
          className="flex-1"
          // A area de texto e a dona da fala da publicacao: toque le autor,
          // corpo e contadores reais vindos do backend.
          onPress={() => speak(buildCommunityPostSpeech(post))}
          accessibilityRole="button"
          accessibilityLabel={`Publicação de ${post.author.name}`}
          accessibilityHint="Lê em voz alta o autor, o texto e os contadores desta publicação"
        >
          <Text className="text-[17px] font-black text-[#E5E2E1]">
            {post.author.name}
          </Text>
          {post.publishedAt || post.editedAt ? (
            <Text className="mt-0.5 text-[14px] font-semibold text-[#E5E2E1]">
              {post.publishedAt ?? ""}
              {post.editedAt ? (
                <Text className="text-[12px] italic text-[#B5AFC4]">
                  {post.publishedAt ? " · editada" : "editada"}
                </Text>
              ) : null}
            </Text>
          ) : null}
        </Pressable>

        {menuOptions.length > 0 ? (
          <Pressable
            className="h-9 w-9 items-center justify-center rounded-full"
            onPress={() => {
              speak("Mais opções da publicação");
              setMenuVisible(true);
            }}
            disabled={deleting}
            hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
            accessibilityRole="button"
            accessibilityLabel="Mais opções da publicação"
            accessibilityHint="Abre editar, excluir ou denunciar"
            accessibilityState={{ busy: deleting, disabled: deleting }}
          >
            {deleting ? (
              <ActivityIndicator color="#CAC3D8" size="small" />
            ) : (
              <Ionicons name="ellipsis-horizontal" size={20} color="#CAC3D8" />
            )}
          </Pressable>
        ) : null}
      </View>

      <Pressable
        onPress={() => speak(buildCommunityPostSpeech(post))}
        accessibilityRole="button"
        accessibilityLabel={`Texto da publicação de ${post.author.name}`}
        accessibilityHint="Lê a publicação em voz alta"
      >
        <Text className="mt-5 text-[19px] font-semibold leading-8 text-[#E5E2E1]">
          {post.body}
        </Text>

        {mediaUrl ? (
          <View className="mt-4 aspect-video w-full overflow-hidden rounded-lg border-2 border-[#494455]">
            <AuthenticatedRemoteImage
              uri={mediaUrl}
              authToken={authToken}
              className="h-full w-full"
              resizeMode="cover"
              fallback={
                <View className="flex-1 items-center justify-center bg-[#1F1F23]">
                  <Ionicons name="image-outline" size={30} color="#CAC3D8" />
                </View>
              }
            />
          </View>
        ) : null}
      </Pressable>

      <View className="mt-4 h-0.5 bg-[#494455]" />

      <View className="mt-1 flex-row items-center justify-between">
        <PostAction
          accessibilityLabel={post.likedByCurrentUser ? "Remover curtida" : "Curtir publicação"}
          accessibilityHint={
            post.likedByCurrentUser
              ? "Retira a sua curtida desta publicação"
              : "Registra a sua curtida nesta publicação"
          }
          disabled={likeBusy}
          icon={post.likedByCurrentUser ? "thumbs-up" : "thumbs-up-outline"}
          count={post.likesCount}
          active={post.likedByCurrentUser}
          loading={likeBusy}
          onPress={onToggleLike}
        />
        <PostAction
          accessibilityLabel="Abrir comentários"
          accessibilityHint="Abre a tela de comentários desta publicação"
          icon={post.commentedByCurrentUser ? "chatbubble" : "chatbubble-outline"}
          count={post.commentsCount}
          active={post.commentedByCurrentUser}
          onPress={onOpenComments}
        />
      </View>

      <ActionSheet
        onClose={() => setMenuVisible(false)}
        options={menuOptions}
        title={`Publicação de ${post.author.name}`}
        visible={menuVisible}
      />
    </View>
  );
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

function CommunityContentTabs({
  activeTab,
  memberCount,
  onChange,
}: {
  activeTab: CommunityViewTab;
  memberCount?: number | null;
  onChange: (tab: CommunityViewTab) => void;
}) {
  const { speak } = useTTS();
  const membersLabel =
    typeof memberCount === "number"
      ? `Membros (${memberCount.toLocaleString("pt-BR")})`
      : "Membros";

  return (
    <View className="mt-6">
      <View className="flex-row rounded-2xl border border-[#3A3246] bg-[#1A1C1F] p-1.5">
        {[
          { key: "posts", label: "Publicações", icon: "newspaper-outline" },
          { key: "members", label: membersLabel, icon: "people-outline" },
        ].map((tab) => {
          const isActive = activeTab === tab.key;

          return (
            <Pressable
              key={tab.key}
              className={`flex-1 flex-row items-center justify-center gap-2 rounded-xl px-4 py-3 ${
                isActive ? "bg-[#7C4DFF]" : "bg-transparent"
              }`}
              accessibilityRole="tab"
              accessibilityLabel={tab.label}
              accessibilityState={{ selected: isActive }}
              onPress={() => {
                // O rotulo inclui a contagem real de membros do backend.
                speak(tab.label);
                onChange(tab.key as CommunityViewTab);
              }}
            >
              <Ionicons
                name={tab.icon as ComponentProps<typeof Ionicons>["name"]}
                size={16}
                color={isActive ? "#FCF6FF" : "#CAC3D8"}
              />
              <Text
                className={`text-[13px] font-black ${
                  isActive ? "text-[#FCF6FF]" : "text-content-secondary"
                }`}
              >
                {tab.label}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

function CommunityMemberCard({
  authToken,
  canManageRole,
  community,
  member,
  onManageRole,
  onOpenProfile,
}: {
  authToken: string | null;
  canManageRole: boolean;
  community: CommunitySummaryResponse;
  member: CommunityMemberResponse;
  onManageRole: () => void;
  onOpenProfile: (userProfileId: string, name?: string | null) => void;
}) {
  const { speak } = useTTS();

  return (
    <View className="rounded-2xl border border-[#353534] bg-[#17181C] p-4">
      <View className="flex-row items-center gap-3">
        <AuthorAvatar
          authToken={authToken}
          name={member.name}
          avatarData={member.avatarData}
          userProfileId={member.userProfileId}
          onOpenProfile={onOpenProfile}
        />

        <Pressable
          className="flex-1"
          // Toque no membro fala nome e papel reais vindos do backend.
          onPress={() => speak(buildCommunityMemberSpeech(member))}
          accessibilityRole="button"
          accessibilityLabel={member.name}
          accessibilityHint="Lê o nome e o cargo em voz alta"
        >
          <Text className="text-[17px] font-black text-[#E5E2E1]">{member.name}</Text>
          {member.joinedAt ? (
            <Text className="mt-1 text-[12px] font-semibold text-[#948EA1]">
              Membro desde {new Date(member.joinedAt).toLocaleDateString("pt-BR")}
            </Text>
          ) : null}
          <View className="mt-2 flex-row flex-wrap items-center gap-2">
            <CommunityRoleBadge
              isOwner={isCommunityMemberOwner(member, community)}
              role={member.role}
            />
          </View>
        </Pressable>

        {canManageRole ? (
          <Pressable
            className="rounded-full border border-[#46708A] bg-[#16232C] px-4 py-3"
            accessibilityRole="button"
            accessibilityLabel={`Gerenciar cargo de ${member.name}`}
            onPress={() => {
              speak(buildActionSpeech("Gerenciar cargo de", member.name));
              onManageRole();
            }}
          >
            <View className="flex-row items-center gap-2">
              <Ionicons name="shield-checkmark-outline" size={16} color="#9FD9FF" />
              <Text className="text-[13px] font-black text-[#9FD9FF]">Gerenciar cargo</Text>
            </View>
          </Pressable>
        ) : null}
      </View>
    </View>
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
  const initialLoadRef = useRef(false);
  const membersInitialLoadRef = useRef(false);
  const scrollViewRef = useRef<ScrollView | null>(null);
  const contentStartOffsetRef = useRef(0);
  const [feed, setFeed] = useState<NormalizedCommunityFeed | null>(null);
  const [members, setMembers] = useState<CommunityMemberResponse[]>([]);
  const [activeTab, setActiveTab] = useState<CommunityViewTab>(requestedTab);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [membersLoading, setMembersLoading] = useState(false);
  const [membersLoadError, setMembersLoadError] = useState<string | null>(null);
  const [membershipBusy, setMembershipBusy] = useState(false);
  const [pendingLikePostId, setPendingLikePostId] = useState<string | null>(null);
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

  useEffect(() => {
    initialLoadRef.current = false;
    membersInitialLoadRef.current = false;
    setFeed(null);
    setMembers([]);
    setLoading(true);
    setLoadError(null);
    setMembersLoading(false);
    setMembersLoadError(null);
  }, [requestedCommunityId]);

  const loadFeed = useCallback(async (options?: { showLoader?: boolean }) => {
    if (options?.showLoader) {
      setLoading(true);
    }

    try {
      setLoadError(null);

      // TODO: paginação incremental — hoje sempre carregamos a primeira página
      // (size padrão do backend) das publicações da comunidade.
      const feedResponse = await communityService.getFeed(requestedCommunityId);
      const normalizedFeed = normalizeFeedResponse(feedResponse);
      setFeed(normalizedFeed);

      const assetUrls = collectCommunityAssetUrls(normalizedFeed);

      if (assetUrls.length > 0) {
        void preloadAuthenticatedRemoteImages(assetUrls, authToken);
      }
    } catch (error) {
      setLoadError(
        formatApiErrorMessage(error, "Não foi possível carregar os dados da comunidade.")
      );
      setFeed((currentFeed) => currentFeed ?? { community: null, posts: [], postsHasNext: false });
    } finally {
      setLoading(false);
    }
  }, [authToken, requestedCommunityId]);

  const loadMembers = useCallback(
    async (options?: { showLoader?: boolean }) => {
      const communityId = feed?.community?.id ?? requestedCommunityId;

      if (options?.showLoader) {
        setMembersLoading(true);
      }

      if (!communityId) {
        setMembers([]);
        setMembersLoadError("Não foi possível identificar a comunidade selecionada.");
        setMembersLoading(false);
        return;
      }

      try {
        setMembersLoadError(null);

        // TODO: paginação incremental — hoje sempre carregamos a primeira página
        // (size padrão do backend) da lista de membros.
        const response = await communityService.getMembers(communityId);
        const nextMembers = Array.isArray(response.content) ? response.content : [];
        setMembers(nextMembers);

        const avatarUrls = collectMemberAssetUrls(nextMembers);

        if (avatarUrls.length > 0) {
          void preloadAuthenticatedRemoteImages(avatarUrls, authToken);
        }
      } catch (error) {
        setMembersLoadError(
          formatApiErrorMessage(error, "Não foi possível carregar os membros da comunidade.")
        );
      } finally {
        setMembersLoading(false);
      }
    },
    [authToken, feed?.community?.id, requestedCommunityId]
  );

  useEffect(() => {
    if (!isFocused) {
      return;
    }

    const shouldShowLoader = !initialLoadRef.current;
    initialLoadRef.current = true;

    void loadFeed({ showLoader: shouldShowLoader });
  }, [isFocused, loadFeed]);

  useEffect(() => {
    if (
      !isFocused ||
      !canViewMembers ||
      activeTab !== "members"
    ) {
      return;
    }

    const shouldShowLoader = !membersInitialLoadRef.current;
    membersInitialLoadRef.current = true;

    void loadMembers({ showLoader: shouldShowLoader });
  }, [activeTab, canViewMembers, isFocused, loadMembers]);

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
        setMembers([]);
        setMembersLoadError(null);
        membersInitialLoadRef.current = false;
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
  }, [activeTab, feed?.community, loadMembers, membershipBusy, requestedCommunityId, speak]);

  const handleToggleLike = useCallback(
    async (post: CommunityPostResponse) => {
      if (pendingLikePostId) {
        return;
      }

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
      setPendingLikePostId(post.id);

      try {
        const response = post.likedByCurrentUser
          ? await communityService.unlikePost(post.id)
          : await communityService.likePost(post.id);

        setFeed((currentFeed) => applyLikeUpdate(currentFeed, response));
      } catch {
        // Global API error toast already explains the failure.
      } finally {
        setPendingLikePostId(null);
      }
    },
    [feed?.community, pendingLikePostId, speak]
  );

  const canDeletePost = useCallback(
    (post: CommunityPostResponse) => {
      if (!feed?.community) {
        return false;
      }

      const viewerRole = getEffectiveCommunityRole(feed.community);

      if (canModerateRole(viewerRole)) {
        return true;
      }

      const postAuthorId = resolveCommunityActorId(post.author);

      return Boolean(
        postAuthorId &&
          (postAuthorId === currentUserProfileId || postAuthorId === currentUserId)
      );
    },
    [currentUserId, currentUserProfileId, feed?.community]
  );

  /** Editar e so do autor: moderadores excluem, mas nao reescrevem o texto alheio. */
  const canEditPost = useCallback(
    (post: CommunityPostResponse) => {
      const postAuthorId = resolveCommunityActorId(post.author);
      const authorUserId = post.author.id?.trim();

      return Boolean(
        (authorUserId && currentUserId && authorUserId === currentUserId) ||
          (postAuthorId &&
            ((currentUserProfileId && postAuthorId === currentUserProfileId) ||
              (currentUserId && postAuthorId === currentUserId)))
      );
    },
    [currentUserId, currentUserProfileId]
  );

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
          body: post.body,
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
  const canReportPost = useCallback(
    (post: CommunityPostResponse) => {
      const postAuthorId = resolveCommunityActorId(post.author);
      const authorUserId = post.author.id?.trim();

      if (
        postAuthorId &&
        ((currentUserProfileId && postAuthorId === currentUserProfileId) ||
          (currentUserId && postAuthorId === currentUserId))
      ) {
        return false;
      }

      if (authorUserId && currentUserId && authorUserId === currentUserId) {
        return false;
      }

      return Boolean(authorUserId || postAuthorId);
    },
    [currentUserId, currentUserProfileId]
  );

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
    [pendingDeletePostId]
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
  const canManageRoles = canModerateRole(getEffectiveCommunityRole(community));
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
                            canDelete={canDeletePost(post)}
                            canEdit={canEditPost(post)}
                            canReport={canReportPost(post)}
                            deleting={pendingDeletePostId === post.id}
                            likeBusy={pendingLikePostId === post.id}
                            onDelete={() => handleDeletePost(post)}
                            onEdit={() => handleEditPost(post)}
                            onOpenComments={() => handleOpenComments(post)}
                            onOpenProfile={handleOpenProfile}
                            onReport={() => handleReportPost(post)}
                            onToggleLike={() => handleToggleLike(post)}
                            post={post}
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
                    setLoading(true);
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
          contextLabel={`publicação de ${reportTarget.authorName}`}
        />
      ) : null}
    </View>
  );
}
