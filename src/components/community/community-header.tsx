import type { ComponentProps } from "react";
import { ActivityIndicator, Pressable, Text, View } from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";
import { useTTS } from "../../accessibility/tts";
import { canModerateRole, formatMemberCount, CommunityRoleBadge } from "./community-card";
import { AuthenticatedRemoteImage } from "../profile/authenticated-remote-image";
import { communityService } from "../../services/communityService";
import type { CommunitySummaryResponse } from "../../types/community";
type CommunityViewTab = "posts" | "members";
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

export function CommunityHeader({
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

