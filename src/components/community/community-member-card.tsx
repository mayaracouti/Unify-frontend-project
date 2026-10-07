import { Pressable, Text, View } from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";
import { useTTS, buildActionSpeech, buildCommunityMemberSpeech } from "../../accessibility/tts";
import { CommunityRoleBadge } from "./community-card";
import { AuthorAvatar } from "./post/post-author-avatar";
import { isCommunityMemberOwner } from "../../community/permissions";
import type { CommunityMemberResponse, CommunitySummaryResponse } from "../../types/community";
export function CommunityMemberCard({
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

