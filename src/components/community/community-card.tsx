import { Pressable, Text, View } from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";

import { buildCommunitySpeech, useTTS } from "../../accessibility/tts";
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
  const { speak } = useTTS();
  const iconUrl = communityService.resolveAssetUrl(community.iconData);
  const ownerAvatarUrl = communityService.resolveAssetUrl(community.owner?.avatarData);
  const memberCountLabel = formatMemberCount(community.memberCount);

  return (
    <Pressable
      className="rounded-[28px] border border-[#353534] bg-surface-alt p-5"
      onPress={() => {
        // O card e o dono da fala deste toque: fala o conteudo semantico da
        // comunidade (dados de runtime), e a tela apenas navega.
        speak(buildCommunitySpeech(community));
        onPress();
      }}
      accessibilityRole="button"
      accessibilityLabel={`Abrir ${community.name}`}
    >
      {/* Linha 1: identidade da comunidade (icone, nome e selo de papel). */}
      <View className="flex-row items-center gap-4">
        <View className="h-16 w-16 overflow-hidden rounded-2xl border border-[#CDBDFF] bg-[#7C4DFF]">
          {iconUrl ? (
            <AuthenticatedRemoteImage
              uri={iconUrl}
              authToken={authToken}
              className="h-full w-full"
              resizeMode="cover"
              fallback={
                <View className="flex-1 items-center justify-center bg-[#7C4DFF]">
                  <Ionicons name="people" size={28} color="#FCF6FF" />
                </View>
              }
            />
          ) : (
            <View className="flex-1 items-center justify-center bg-[#7C4DFF]">
              <Ionicons name="people" size={28} color="#FCF6FF" />
            </View>
          )}
        </View>

        <Text
          className="flex-1 text-[22px] font-black leading-7 text-white"
          numberOfLines={2}
        >
          {community.name}
        </Text>

        <CommunityRoleBadge
          fallbackLabel="Explorar"
          isOwner={community.isOwner}
          role={community.currentUserRole}
        />
      </View>

      {/* Linha 2: descricao ocupando a largura inteira do cartao. */}
      {community.description ? (
        <Text className="mt-4 text-[15px] font-semibold leading-6 text-content-secondary">
          {community.description}
        </Text>
      ) : (
        <Text className="mt-4 text-[15px] font-semibold leading-6 text-[#948EA1]">
          Esta comunidade ainda não possui descrição.
        </Text>
      )}

      {/* Linha 3: autoria em linha unica, sem caixa aninhada. */}
      <View className="mt-4 flex-row items-center gap-3">
        <View className="h-9 w-9 overflow-hidden rounded-full bg-[#2C2834]">
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

        <Text
          className="flex-1 text-[14px] font-semibold text-content-secondary"
          numberOfLines={1}
        >
          Criada por{" "}
          <Text className="font-black text-white">
            {community.owner?.name ?? "criador não informado"}
          </Text>
        </Text>
      </View>

      {/* Linha 4: metadados. */}
      <View className="mt-4 flex-row flex-wrap items-center gap-2 border-t border-[#2A2A2E] pt-4">
        <View className="flex-row items-center gap-1.5 rounded-full border border-[#3A3246] bg-[#17181C] px-3 py-2">
          <Ionicons
            name={community.privacy === "PRIVATE" ? "lock-closed-outline" : "globe-outline"}
            size={13}
            color="#CAC3D8"
          />
          <Text className="text-[13px] font-bold text-[#E5E2E1]">
            {community.privacy === "PRIVATE" ? "Privada" : "Pública"}
          </Text>
        </View>

        {community.category ? (
          <View className="rounded-full border border-[#3A3246] bg-[#17181C] px-3 py-2">
            <Text className="text-[13px] font-bold text-[#E5E2E1]">
              {community.category.description}
            </Text>
          </View>
        ) : null}

        {memberCountLabel ? (
          <View className="flex-row items-center gap-1.5 rounded-full border border-[#3A3246] bg-[#17181C] px-3 py-2">
            <Ionicons name="people-outline" size={13} color="#CAC3D8" />
            <Text className="text-[13px] font-bold text-[#E5E2E1]">{memberCountLabel}</Text>
          </View>
        ) : null}

        <View className="rounded-full border border-[#3A3246] bg-[#17181C] px-3 py-2">
          <Text className="text-[13px] font-bold text-[#E5E2E1]">
            {community.isMember
              ? "Você participa"
              : community.hasPendingRequest
                ? "Solicitação pendente"
                : "Você ainda não participa"}
          </Text>
        </View>
      </View>
    </Pressable>
  );
}
