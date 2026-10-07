import { CommunityPostCard } from "./post/community-post-card";
import { Pressable, Text, View } from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";

import { useRouter } from "expo-router";

import { AuthenticatedRemoteImage } from "../profile/authenticated-remote-image";
import { communityService } from "../../services/communityService";
import type { CommunityForYouPostResponse } from "../../types/community";
import { buildUserProfileHref } from "../../utils/userProfileRoute";

export function CommunityForYouPostCard({
  authToken,
  item,
  likeBusy,
  onOpenCommunity,
  onOpenComments,
  onToggleLike,
}: {
  authToken: string | null;
  item: CommunityForYouPostResponse;
  likeBusy: boolean;
  onOpenCommunity: () => void;
  onOpenComments: () => void;
  onToggleLike: () => void;
}) {
  const router = useRouter();
  const post = item.post;
  const communityIconUrl = communityService.resolveAssetUrl(item.communityIconData);
  return (
    <View className="rounded-[24px] border border-[#353534] bg-surface-alt p-4">
      <Pressable
        className="flex-row items-center gap-3 rounded-2xl border border-[#3A3246] bg-[#17181C] px-3 py-2.5"
        onPress={onOpenCommunity}
        accessibilityRole="button"
        accessibilityLabel={`Abrir comunidade ${item.communityName}`}
        accessibilityHint="Abre o feed completo desta comunidade"
      >
        <View className="h-9 w-9 items-center justify-center overflow-hidden rounded-full bg-[#2A2A2A]">
          {communityIconUrl ? (
            <AuthenticatedRemoteImage
              uri={communityIconUrl}
              authToken={authToken}
              className="h-full w-full"
              resizeMode="cover"
              fallback={
                <View className="h-full w-full items-center justify-center bg-[#2A2A2A]">
                  <Ionicons name="people-outline" size={16} color="#CDBDFF" />
                </View>
              }
            />
          ) : (
            <Ionicons name="people-outline" size={16} color="#CDBDFF" />
          )}
        </View>
        <Text className="flex-1 text-[14px] font-black text-white" numberOfLines={1}>
          {item.communityName}
        </Text>
        <Ionicons name="chevron-forward" size={16} color="#948EA1" />
      </Pressable>

      {/* Avatar e um botao irmao do card de texto: abre o perfil publico do
          autor sem aninhar Pressable dentro de Pressable. */}
      <View className="mt-4">
        <CommunityPostCard authToken={authToken} post={post} likeBusy={likeBusy}
          onOpenComments={onOpenComments} onToggleLike={onToggleLike}
          onOpenProfile={(id, name) => router.push(buildUserProfileHref(id, name))} />
      </View>
    </View>
  );
}
