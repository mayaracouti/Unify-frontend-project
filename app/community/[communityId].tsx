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

import { GlobalBottomNav } from "../../src/components/navigation/global-bottom-nav";
import { GlobalTopNav } from "../../src/components/navigation/global-top-nav";
import {
  AuthenticatedRemoteImage,
  preloadAuthenticatedRemoteImages,
} from "../../src/components/profile/authenticated-remote-image";
import { useAppShell } from "../../src/context/AppShellContext";
import { useAuth } from "../../src/context/AuthContext";
import { useRequireCompletedOnboarding } from "../../src/hooks/useRequireCompletedOnboarding";
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
import { formatApiErrorMessage } from "../../src/utils/auth";
import { showGlobalToast } from "../../src/utils/globalToast";

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

function canModerateRole(role?: CommunityRole | null) {
  return role === "ADMIN" || role === "MODERATOR";
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

function normalizeFeedResponse(response: CommunityFeedResponse): CommunityFeedResponse {
  return {
    community: response.community ?? null,
    posts: Array.isArray(response.posts) ? response.posts : [],
  };
}

function collectCommunityAssetUrls(feed: CommunityFeedResponse) {
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
  currentFeed: CommunityFeedResponse | null,
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
    },
  };
}

function applyLikeUpdate(currentFeed: CommunityFeedResponse | null, like: CommunityLikeResponse) {
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

function removePost(currentFeed: CommunityFeedResponse | null, postId: string) {
  if (!currentFeed) {
    return currentFeed;
  }

  return {
    ...currentFeed,
    posts: currentFeed.posts.filter((post) => post.id !== postId),
  };
}

function formatMemberCount(memberCount?: number | null) {
  if (typeof memberCount !== "number") {
    return null;
  }

  if (memberCount >= 1000) {
    const compactValue = memberCount / 1000;
    const formattedValue = compactValue.toLocaleString("pt-BR", {
      maximumFractionDigits: compactValue >= 10 ? 1 : 1,
      minimumFractionDigits: compactValue % 1 === 0 ? 0 : 1,
    });

    return `${formattedValue}k membros`;
  }

  return `${memberCount.toLocaleString("pt-BR")} membros`;
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

function traduzirNomeRole(role: CommunityRole | null | undefined) {
  switch (role) {
    case "ADMIN":
      return "Administrador";
    case "MODERATOR":
      return "Moderador";
    case "MEMBER":
      return "Membro";
    default:
      return role;
  }
}

function CommunityRoleBadge({
  isOwner,
  role,
}: {
  isOwner?: boolean | null;
  role?: CommunityRole | null;
}) {
  const label = isOwner ? "Criador" : traduzirNomeRole(role);

  if (!label) {
    return null;
  }

  return (
    <View
      className={`rounded-full px-3 py-2 ${
        isOwner
          ? "bg-[#312114]"
          : canModerateRole(role)
            ? "bg-[#1B2631]"
            : "bg-[#1E1A28]"
      }`}
    >
      <Text
        className={`text-[12px] font-black uppercase tracking-[1.1px] ${
          isOwner
            ? "text-[#FFD28A]"
            : canModerateRole(role)
              ? "text-[#9FD9FF]"
              : "text-[#CDBDFF]"
        }`}
      >
        {label}
      </Text>
    </View>
  );
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

function AuthorAvatar({
  authToken,
  name,
  avatarData,
}: {
  authToken: string | null;
  name?: string | null;
  avatarData?: string | null;
}) {
  const initials = getInitials(name);
  const avatarUrl = communityService.resolveAssetUrl(avatarData);

  return (
    <View className="h-14 w-14 items-center justify-center overflow-hidden rounded-full border-2 border-[#CDBDFF] bg-[#353534]">
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
}

function PostAction({
  accessibilityLabel,
  disabled,
  icon,
  count,
  active,
  loading,
  onPress,
}: {
  accessibilityLabel: string;
  disabled?: boolean;
  icon: ComponentProps<typeof Ionicons>["name"];
  count?: number | null;
  active?: boolean | null;
  loading?: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      className={`h-14 flex-1 flex-row items-center justify-center gap-2 rounded-lg ${
        disabled ? "opacity-60" : ""
      }`}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
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
  onPress,
}: {
  busy: boolean;
  isMember?: boolean | null;
  onPress: () => void;
}) {
  return (
    <Pressable
      className={`mt-8 h-14 w-full flex-row items-center justify-center gap-3 rounded-xl border-2 ${
        isMember
          ? "border-[#494455] bg-[#2E2B33]"
          : "border-[#EAEA00] bg-[#EAEA00]"
      }`}
      onPress={onPress}
      disabled={busy}
      accessibilityRole="button"
      accessibilityLabel={isMember ? "Sair da comunidade" : "Entrar na comunidade"}
    >
      {busy ? (
        <ActivityIndicator color={isMember ? "#E5E2E1" : "#323200"} size="small" />
      ) : (
        <>
          <Ionicons
            name={isMember ? "exit-outline" : "add-circle"}
            size={22}
            color={isMember ? "#E5E2E1" : "#323200"}
          />
          <Text
            className={`text-[18px] font-black ${
              isMember ? "text-[#E5E2E1]" : "text-[#1D1D00]"
            }`}
          >
            {isMember ? "Sair da comunidade" : "Participar"}
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
          <Text className="text-[13px] font-semibold text-[#CAC3D8]">Criador</Text>
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
  community,
  deletingCommunity,
  membershipBusy,
  onChangeTab,
  onDeleteCommunity,
  onToggleMembership,
}: {
  activeTab: CommunityViewTab;
  authToken: string | null;
  community: CommunitySummaryResponse;
  deletingCommunity: boolean;
  membershipBusy: boolean;
  onChangeTab: (tab: CommunityViewTab) => void;
  onDeleteCommunity: () => void;
  onToggleMembership: () => void;
}) {
  const memberCountLabel = formatMemberCount(community.memberCount);

  return (
    <View className="border-b-2 border-[#494455] bg-[#201F1F] px-6 pb-12 pt-7">
      <View className="flex-row items-start justify-between gap-4">
        <CommunityBadge authToken={authToken} community={community} />

        {community.isOwner ? (
          <Pressable
            className={`rounded-full border border-[#6A4456] px-4 py-3 ${
              deletingCommunity ? "bg-[#3A202A]" : "bg-[#2A1C24]"
            }`}
            onPress={onDeleteCommunity}
            disabled={deletingCommunity}
          >
            {deletingCommunity ? (
              <ActivityIndicator color="#FFD3DD" size="small" />
            ) : (
              <View className="flex-row items-center gap-2">
                <Ionicons name="trash-outline" size={16} color="#FFD3DD" />
              </View>
            )}
          </Pressable>
        ) : null}
      </View>

      <Text className="mt-5 text-[32px] font-black leading-10 text-[#E5E2E1]">
        {community.name}
      </Text>

      {memberCountLabel ? (
        <View className="mt-3 flex-row items-center gap-2">
          <Ionicons name="person" size={16} color="#7C4DFF" />
          <Text className="text-[16px] font-black text-[#7C4DFF]">
            {memberCountLabel}
          </Text>
        </View>
      ) : null}

      {/* <View className="mt-6 rounded-2xl border border-[#3A3246] bg-[#17181C] px-4 py-4"> */}
        {/* <Text className="text-[12px] font-black uppercase tracking-[1.2px] text-[#CAC3D8]">
          Navegacao da comunidade
        </Text>
        <Text className="mt-2 text-[14px] font-semibold leading-6 text-[#E5E2E1]">
          Escolha entre as publicacoes e a lista de membros.
        </Text> */}

        <CommunityContentTabs
          activeTab={activeTab}
          memberCount={community.memberCount}
          onChange={onChangeTab}
        />
      {/* </View> */}

      {community.description ? (
        <Text className="mt-5 text-[18px] font-semibold leading-8 text-[#E5E2E1]">
          {community.description}
        </Text>
      ) : null}

      {/* <CommunityOwnerCard authToken={authToken} community={community} /> */}

      <Text className="mt-5 text-[14px] font-semibold leading-6 text-[#CAC3D8]">
        {community.isOwner
          ? "Você é a pessoa proprietária desta comunidade e pode gerenciar conteúdo e membros elevados."
          : community.currentUserRole
            ? canModerateRole(community.currentUserRole)
              ? "Você participa com elevação e pode moderar conteúdo dentro desta comunidade."
              : "Você participa desta comunidade e já pode publicar, curtir e comentar."
            : "Entre para publicar, curtir e comentar nos posts da comunidade."}
      </Text>

      {!community.isOwner ? (
        <MemberButton
          busy={membershipBusy}
          isMember={community.isMember}
          onPress={onToggleMembership}
        />
      ) : null}
    </View>
  );
}

function CommunityPostCard({
  authToken,
  canDelete,
  deleting,
  likeBusy,
  onDelete,
  onOpenComments,
  onToggleLike,
  post,
}: {
  authToken: string | null;
  canDelete: boolean;
  deleting: boolean;
  likeBusy: boolean;
  onDelete: () => void;
  onOpenComments: () => void;
  onToggleLike: () => void;
  post: CommunityPostResponse;
}) {
  const mediaUrl = communityService.resolveAssetUrl(post.mediaData);

  return (
    <View className="rounded-xl bg-[#2A2A2A] p-4">
      <View className="flex-row items-start gap-3">
        <AuthorAvatar
          authToken={authToken}
          name={post.author.name}
          avatarData={post.author.avatarData}
        />

        <View className="flex-1">
          <Text className="text-[17px] font-black text-[#E5E2E1]">
            {post.author.name}
          </Text>
          {post.publishedAt ? (
            <Text className="mt-0.5 text-[14px] font-semibold text-[#E5E2E1]">
              {post.publishedAt}
            </Text>
          ) : null}
        </View>

        {canDelete ? (
          <View className="flex-row items-center gap-2">
            {canDelete ? (
              <Pressable
                className="h-10 w-10 items-center justify-center rounded-full bg-[#1E1A22]"
                onPress={onDelete}
                disabled={deleting}
              >
                {deleting ? (
                  <ActivityIndicator color="#FFD3DD" size="small" />
                ) : (
                  <Ionicons name="trash-outline" size={18} color="#FFD3DD" />
                )}
              </Pressable>
            ) : null}
          </View>
        ) : null}
      </View>

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

      <View className="mt-4 h-0.5 bg-[#494455]" />

      <View className="mt-1 flex-row items-center justify-between">
        <PostAction
          accessibilityLabel={post.likedByCurrentUser ? "Remover curtida" : "Curtir publicação"}
          disabled={likeBusy}
          icon={post.likedByCurrentUser ? "thumbs-up" : "thumbs-up-outline"}
          count={post.likesCount}
          active={post.likedByCurrentUser}
          loading={likeBusy}
          onPress={onToggleLike}
        />
        <PostAction
          accessibilityLabel="Abrir comentários"
          icon={post.commentedByCurrentUser ? "chatbubble" : "chatbubble-outline"}
          count={post.commentsCount}
          active={post.commentedByCurrentUser}
          onPress={onOpenComments}
        />
      </View>
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
      <View className="h-16 w-16 items-center justify-center rounded-full bg-[#201F1F]">
        <Ionicons name="people-outline" size={32} color="#7C4DFF" />
      </View>
      <Text className="mt-6 text-center text-[22px] font-black text-[#E5E2E1]">
        Comunidade indisponível
      </Text>
      <Text className="mt-3 text-center text-[15px] font-semibold leading-6 text-[#CAC3D8]">
        {message}
      </Text>
      {onRetry ? (
        <Pressable
          className="mt-6 rounded-full border border-[#494455] bg-[#201F1F] px-5 py-3"
          onPress={onRetry}
        >
          <Text className="text-[14px] font-bold text-white">Tentar novamente</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

function EmptyPostState({ canParticipate }: { canParticipate: boolean }) {
  return (
    <View className="mx-6 mt-7 rounded-2xl border border-[#3A3246] bg-[#1A1C1F] px-6 py-8">
      <Text className="text-[22px] font-black text-white">Ainda sem publicações</Text>
      <Text className="mt-3 text-[15px] font-semibold leading-6 text-[#CAC3D8]">
        {canParticipate
          ? "Seja a primeira pessoa a compartilhar algo com a comunidade."
          : "Entre na comunidade para começar a publicar e interagir com os posts."}
      </Text>
    </View>
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
              accessibilityRole="button"
              onPress={() => onChange(tab.key as CommunityViewTab)}
            >
              <Ionicons
                name={tab.icon as ComponentProps<typeof Ionicons>["name"]}
                size={16}
                color={isActive ? "#FCF6FF" : "#CAC3D8"}
              />
              <Text
                className={`text-[13px] font-black ${
                  isActive ? "text-[#FCF6FF]" : "text-[#CAC3D8]"
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
}: {
  authToken: string | null;
  canManageRole: boolean;
  community: CommunitySummaryResponse;
  member: CommunityMemberResponse;
  onManageRole: () => void;
}) {
  return (
    <View className="rounded-2xl border border-[#353534] bg-[#17181C] p-4">
      <View className="flex-row items-center gap-3">
        <AuthorAvatar
          authToken={authToken}
          name={member.name}
          avatarData={member.avatarData}
        />

        <View className="flex-1">
          <Text className="text-[17px] font-black text-[#E5E2E1]">{member.name}</Text>
          <View className="mt-2 flex-row flex-wrap items-center gap-2">
            <CommunityRoleBadge
              isOwner={isCommunityMemberOwner(member, community)}
              role={member.role}
            />
          </View>
        </View>

        {canManageRole ? (
          <Pressable
            className="rounded-full border border-[#46708A] bg-[#16232C] px-4 py-3"
            accessibilityRole="button"
            onPress={onManageRole}
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
    <View className="mx-6 mt-7 rounded-2xl border border-[#3A3246] bg-[#1A1C1F] px-6 py-8">
      <Text className="text-[22px] font-black text-white">Nenhum membro listado</Text>
      <Text className="mt-3 text-[15px] font-semibold leading-6 text-[#CAC3D8]">
        Não foi possível encontrar participantes para esta comunidade no momento.
      </Text>
    </View>
  );
}

export default function CommunityDetailScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ communityId?: string | string[]; tab?: string | string[] }>();
  const isFocused = useIsFocused();
  const { session } = useAuth();
  const { currentUserId, currentUserProfileId } = useAppShell();

  const { canAccessCompletedOnboardingContent } = useRequireCompletedOnboarding();

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
  const [feed, setFeed] = useState<CommunityFeedResponse | null>(null);
  const [members, setMembers] = useState<CommunityMemberResponse[]>([]);
  const [activeTab, setActiveTab] = useState<CommunityViewTab>(requestedTab);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [membersLoading, setMembersLoading] = useState(false);
  const [membersLoadError, setMembersLoadError] = useState<string | null>(null);
  const [membershipBusy, setMembershipBusy] = useState(false);
  const [communityDeleteBusy, setCommunityDeleteBusy] = useState(false);
  const [pendingLikePostId, setPendingLikePostId] = useState<string | null>(null);
  const [pendingDeletePostId, setPendingDeletePostId] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    setActiveTab(requestedTab);
  }, [requestedTab]);

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
      setFeed((currentFeed) => currentFeed ?? { community: null, posts: [] });
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

        const response = await communityService.getMembers(communityId);
        const nextMembers = Array.isArray(response.members) ? response.members : [];
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
    if (!isFocused || !canAccessCompletedOnboardingContent) {
      return;
    }

    const shouldShowLoader = !initialLoadRef.current;
    initialLoadRef.current = true;

    void loadFeed({ showLoader: shouldShowLoader });
  }, [canAccessCompletedOnboardingContent, isFocused, loadFeed]);

  useEffect(() => {
    if (!isFocused || !canAccessCompletedOnboardingContent || activeTab !== "members") {
      return;
    }

    const shouldShowLoader = !membersInitialLoadRef.current;
    membersInitialLoadRef.current = true;

    void loadMembers({ showLoader: shouldShowLoader });
  }, [activeTab, canAccessCompletedOnboardingContent, isFocused, loadMembers]);

  const handleRefresh = useCallback(() => {
    setRefreshing(true);

    void (async () => {
      try {
        await Promise.all([
          loadFeed(),
          activeTab === "members" ? loadMembers() : Promise.resolve(),
        ]);
      } finally {
        setRefreshing(false);
      }
    })();
  }, [activeTab, loadFeed, loadMembers]);

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

    setMembershipBusy(true);

    try {
      const response = feed.community.isMember
        ? await communityService.leaveCommunity(communityId)
        : await communityService.joinCommunity(communityId);

      setFeed((currentFeed) => applyMembershipUpdate(currentFeed, response));

      if (activeTab === "members") {
        void loadMembers();
      }

      showGlobalToast({
        title: response.isMember ? "Você entrou na comunidade" : "Você saiu da comunidade",
        variant: "success",
        message: response.isMember
          ? "Agora você pode publicar, curtir e comentar nos posts."
          : "Você pode entrar novamente quando quiser.",
      });
    } catch {
      // Global API error toast already explains the failure.
    } finally {
      setMembershipBusy(false);
    }
  }, [activeTab, feed?.community, loadMembers, membershipBusy, requestedCommunityId]);

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
    [feed?.community, pendingLikePostId]
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
    [confirmDeletePost]
  );

  const confirmDeleteCommunity = useCallback(async () => {
    const communityId = feed?.community?.id ?? requestedCommunityId;

    if (!communityId || communityDeleteBusy) {
      return;
    }

    setCommunityDeleteBusy(true);

    try {
      await communityService.deleteCommunity(communityId);
      showGlobalToast({
        title: "Comunidade removida",
        variant: "success",
        message: "A comunidade foi excluída com sucesso.",
      });
      router.replace("/community");
    } catch {
      // Global API error toast already explains the failure.
    } finally {
      setCommunityDeleteBusy(false);
    }
  }, [communityDeleteBusy, feed?.community?.id, requestedCommunityId, router]);

  const handleDeleteCommunity = useCallback(() => {
    Alert.alert(
      "Excluir comunidade",
      "Essa ação apaga a comunidade permanentemente. Deseja continuar?",
      [
        { text: "Cancelar", style: "cancel" },
        {
          text: "Excluir",
          style: "destructive",
          onPress: () => {
            void confirmDeleteCommunity();
          },
        },
      ]
    );
  }, [confirmDeleteCommunity]);

  const handleOpenComments = useCallback(
    (post: CommunityPostResponse) => {
      if (!feed?.community) {
        return;
      }

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
    [feed?.community, router]
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

    router.push({
      pathname: "/community/create",
      params: {
        communityId: feed.community.id,
      },
    });
  }, [feed?.community, router]);

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
              <ActivityIndicator color="#7C4DFF" size="large" />
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
                  onPress={() => router.replace("/community")}
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
                    community={community}
                    deletingCommunity={communityDeleteBusy}
                    membershipBusy={membershipBusy}
                    onChangeTab={handleChangeTab}
                    onDeleteCommunity={handleDeleteCommunity}
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
                            deleting={pendingDeletePostId === post.id}
                            likeBusy={pendingLikePostId === post.id}
                            onDelete={() => handleDeletePost(post)}
                            onOpenComments={() => handleOpenComments(post)}
                            onToggleLike={() => handleToggleLike(post)}
                            post={post}
                          />
                        ))}
                      </View>
                    ) : (
                      <EmptyPostState canParticipate={canParticipate} />
                    )
                  ) : (
                    <>
                      {/* <View className="mx-6 mt-7 rounded-2xl border border-[#3A3246] bg-[#1A1C1F] px-5 py-5">
                        <Text className="text-[18px] font-black text-white">Membros da comunidade</Text>
                        <Text className="mt-3 text-[14px] font-semibold leading-6 text-[#CAC3D8]">
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
                        <View className="items-center px-6 py-12">
                          <ActivityIndicator color="#7C4DFF" size="large" />
                        </View>
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
    </View>
  );
}
