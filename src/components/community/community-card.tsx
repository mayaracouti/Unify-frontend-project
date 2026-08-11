import { Pressable, Text, View } from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";

import { AuthenticatedRemoteImage } from "../profile/authenticated-remote-image";
import { communityService } from "../../services/communityService";
import type { CommunityRole, CommunitySummaryResponse } from "../../types/community";

export function formatMemberCount(memberCount?: number | null) {
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

export function canModerateRole(role?: CommunityRole | null) {
  return role === "ADMIN" || role === "MODERATOR";
}

export function traduzirNomeRole(role: CommunityRole | null | undefined) {
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

/**
 * Selo de papel do usuario dentro da comunidade. Quando nao ha papel algum,
 * `fallbackLabel` permite exibir um rotulo neutro (a listagem geral usa
 * "Explorar"); sem `fallbackLabel` o selo simplesmente nao e renderizado.
 */
export function CommunityRoleBadge({
  fallbackLabel,
  isOwner,
  role,
}: {
  fallbackLabel?: string | null;
  isOwner?: boolean | null;
  role?: CommunityRole | null;
}) {
  const label = isOwner ? "Criador" : traduzirNomeRole(role);

  if (!label) {
    if (!fallbackLabel) {
      return null;
    }

    return (
      <View className="rounded-full bg-[#1E1A28] px-3 py-2">
        <Text className="text-[12px] font-black uppercase tracking-[1.1px] text-[#CDBDFF]">
          {fallbackLabel}
        </Text>
      </View>
    );
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

export function CommunityDirectoryCard({
  authToken,
  community,
  onPress,
}: {
  authToken: string | null;
  community: CommunitySummaryResponse;
  onPress: () => void;
}) {
  const iconUrl = communityService.resolveAssetUrl(community.iconData);
  const ownerAvatarUrl = communityService.resolveAssetUrl(community.owner?.avatarData);
  const memberCountLabel = formatMemberCount(community.memberCount);

  return (
    <Pressable
      className="rounded-[28px] border border-[#353534] bg-surface-alt p-5"
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`Abrir ${community.name}`}
    >
      <View className="flex-row items-start gap-4">
        <View className="h-20 w-20 overflow-hidden rounded-2xl border border-[#CDBDFF] bg-[#7C4DFF]">
          {iconUrl ? (
            <AuthenticatedRemoteImage
              uri={iconUrl}
              authToken={authToken}
              className="h-full w-full"
              resizeMode="cover"
              fallback={
                <View className="flex-1 items-center justify-center bg-[#7C4DFF]">
                  <Ionicons name="people" size={34} color="#FCF6FF" />
                </View>
              }
            />
          ) : (
            <View className="flex-1 items-center justify-center bg-[#7C4DFF]">
              <Ionicons name="people" size={34} color="#FCF6FF" />
            </View>
          )}
        </View>

        <View className="flex-1">
          <View className="flex-row items-start justify-between gap-3">
            <Text className="flex-1 text-[24px] font-black leading-8 text-white">
              {community.name}
            </Text>
            <CommunityRoleBadge
              fallbackLabel="Explorar"
              isOwner={community.isOwner}
              role={community.currentUserRole}
            />
          </View>

          {community.description ? (
            <Text className="mt-3 text-[15px] font-semibold leading-6 text-content-secondary">
              {community.description}
            </Text>
          ) : (
            <Text className="mt-3 text-[15px] font-semibold leading-6 text-[#948EA1]">
              Esta comunidade ainda não possui descrição.
            </Text>
          )}

          <View className="mt-4 flex-row items-center gap-3 rounded-2xl bg-[#17181C] px-4 py-3">
            <View className="h-10 w-10 overflow-hidden rounded-full bg-[#2C2834]">
              {ownerAvatarUrl ? (
                <AuthenticatedRemoteImage
                  uri={ownerAvatarUrl}
                  authToken={authToken}
                  className="h-full w-full"
                  resizeMode="cover"
                  fallback={
                    <View className="flex-1 items-center justify-center bg-[#2C2834]">
                      <Ionicons name="person" size={16} color="#E5E2E1" />
                    </View>
                  }
                />
              ) : (
                <View className="flex-1 items-center justify-center bg-[#2C2834]">
                  <Ionicons name="person" size={16} color="#E5E2E1" />
                </View>
              )}
            </View>

            <View className="flex-1">
              <Text className="text-[13px] font-semibold text-content-secondary">Criada por</Text>
              <Text className="text-[15px] font-black text-white">
                {community.owner?.name ?? "Comunidade sem criador informado"}
              </Text>
            </View>
          </View>

          <View className="mt-4 flex-row flex-wrap gap-2">
            {community.category ? (
              <View className="rounded-full border border-[#3A3246] bg-[#17181C] px-3 py-2">
                <Text className="text-[13px] font-bold text-[#E5E2E1]">
                  {community.category.description}
                </Text>
              </View>
            ) : null}

            {memberCountLabel ? (
              <View className="rounded-full border border-[#3A3246] bg-[#17181C] px-3 py-2">
                <Text className="text-[13px] font-bold text-[#E5E2E1]">{memberCountLabel}</Text>
              </View>
            ) : null}

            <View className="rounded-full border border-[#3A3246] bg-[#17181C] px-3 py-2">
              <Text className="text-[13px] font-bold text-[#E5E2E1]">
                {community.isMember ? "Você participa" : "Você ainda não participa"}
              </Text>
            </View>
          </View>
        </View>
      </View>

      <View className="mt-5 flex-row items-center justify-between rounded-2xl bg-[#17181C] px-4 py-4">
        <View>
          <Text className="text-[15px] font-bold text-white">Abrir comunidade</Text>
          <Text className="mt-1 text-[13px] font-semibold text-content-secondary">
            Veja publicações, comentários e ações de participação.
          </Text>
        </View>

        <Ionicons name="chevron-forward" size={24} color="#EAEA00" />
      </View>
    </Pressable>
  );
}
