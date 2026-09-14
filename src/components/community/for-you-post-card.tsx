import { ActivityIndicator, Pressable, Text, View } from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";
import { LinearGradient } from "expo-linear-gradient";
import type { ComponentProps } from "react";

import { buildCommunityPostSpeech, useTTS } from "../../accessibility/tts";
import { AuthenticatedRemoteImage } from "../profile/authenticated-remote-image";
import { communityService } from "../../services/communityService";
import type { CommunityForYouPostResponse } from "../../types/community";

function getInitials(name?: string | null) {
  if (!name) {
    return "";
  }

  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part.charAt(0).toUpperCase())
    .join("");
}

function FeedAction({
  accessibilityHint,
  accessibilityLabel,
  icon,
  count,
  active,
  loading,
  onPress,
}: {
  accessibilityHint?: string;
  accessibilityLabel: string;
  icon: ComponentProps<typeof Ionicons>["name"];
  count?: number | null;
  active?: boolean | null;
  loading?: boolean;
  onPress: () => void;
}) {
  const busy = Boolean(loading);

  return (
    <Pressable
      className="h-12 flex-1 flex-row items-center justify-center gap-2 rounded-lg"
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      accessibilityHint={accessibilityHint}
      accessibilityState={{ busy, disabled: busy, selected: Boolean(active) }}
      onPress={onPress}
      disabled={loading}
    >
      {loading ? (
        <ActivityIndicator color="#7C4DFF" size="small" />
      ) : (
        <Ionicons name={icon} size={22} color={active ? "#7C4DFF" : "#CAC3D8"} />
      )}
      {typeof count === "number" ? (
        <Text
          className={`text-[15px] font-bold ${active ? "text-[#7C4DFF]" : "text-[#E5E2E1]"}`}
        >
          {count}
        </Text>
      ) : null}
    </Pressable>
  );
}

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
  const { speak } = useTTS();
  const post = item.post;
  const communityIconUrl = communityService.resolveAssetUrl(item.communityIconData);
  const avatarUrl = communityService.resolveAssetUrl(post.author.avatarData);
  const mediaUrl = communityService.resolveAssetUrl(post.mediaData);

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

      <Pressable
        className="mt-4"
        onPress={() => speak(buildCommunityPostSpeech(post))}
        accessibilityRole="button"
        accessibilityLabel={`Publicação de ${post.author.name} na comunidade ${item.communityName}`}
        accessibilityHint="Lê em voz alta o autor, o texto e os contadores desta publicação"
      >
        <View className="flex-row items-center gap-3">
          <View className="h-11 w-11 items-center justify-center overflow-hidden rounded-full border-2 border-[#CDBDFF] bg-[#353534]">
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
                    <Text className="text-[13px] font-black text-white">
                      {getInitials(post.author.name) || "?"}
                    </Text>
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
                <Text className="text-[13px] font-black text-white">
                  {getInitials(post.author.name) || "?"}
                </Text>
              </LinearGradient>
            )}
          </View>

          <View className="flex-1">
            <Text className="text-[16px] font-black text-[#E5E2E1]">{post.author.name}</Text>
            {post.publishedAt ? (
              <Text className="mt-0.5 text-[13px] font-semibold text-[#948EA1]">
                {post.publishedAt}
              </Text>
            ) : null}
          </View>
        </View>

        <Text className="mt-4 text-[17px] font-semibold leading-7 text-[#E5E2E1]">
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

      <View className="mt-4 h-0.5 bg-[#353534]" />

      <View className="mt-1 flex-row items-center justify-between">
        <FeedAction
          accessibilityLabel={post.likedByCurrentUser ? "Remover curtida" : "Curtir publicação"}
          accessibilityHint={
            post.likedByCurrentUser
              ? "Retira a sua curtida desta publicação"
              : "Registra a sua curtida nesta publicação"
          }
          icon={post.likedByCurrentUser ? "thumbs-up" : "thumbs-up-outline"}
          count={post.likesCount}
          active={post.likedByCurrentUser}
          loading={likeBusy}
          onPress={onToggleLike}
        />
        <FeedAction
          accessibilityLabel="Abrir comentários"
          accessibilityHint="Abre a tela de comentários desta publicação"
          icon={post.commentedByCurrentUser ? "chatbubble" : "chatbubble-outline"}
          count={post.commentsCount}
          active={post.commentedByCurrentUser}
          onPress={onOpenComments}
        />
      </View>
    </View>
  );
}
