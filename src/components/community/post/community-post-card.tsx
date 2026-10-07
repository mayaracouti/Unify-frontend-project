import { Pressable, Text, View } from "react-native";
import type { ReactNode } from "react";
import { useCommunityPostReader } from "../../../hooks/use-community-post-reader";
import { communityService } from "../../../services/communityService";
import type { CommunityPostResponse } from "../../../types/community";
import { AuthorAvatar } from "./post-author-avatar";
import { PostAction } from "./post-action";
import { PostContent } from "./post-content";
function formatCount(count: number | null | undefined, singular: string, plural: string) {
  const value = count ?? 0;
  return `${value} ${value === 1 ? singular : plural}`;
}
export function CommunityPostCard({
  authToken,
  likeBusy,
  onOpenComments,
  onOpenProfile,
  onToggleLike,
  post,
  menu,
  communityName,
}: {
  authToken: string | null;
  likeBusy: boolean;
  onOpenComments: () => void;
  onOpenProfile: (userProfileId: string, name?: string | null) => void;
  onToggleLike: () => void;
  post: CommunityPostResponse;
  menu?: ReactNode;
  communityName?: string;
}) {
  const reader = useCommunityPostReader(post);
  const mediaUrl = communityService.resolveAssetUrl(post.mediaData);
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
          onPress={reader.read}
          accessibilityRole="button"
          accessibilityLabel={[
            `Publicação de ${post.author.name}${communityName ? ` na comunidade ${communityName}` : ""}`,
            post.publishedAt,
            post.editedAt ? "editada" : null,
          ].filter(Boolean).join(", ")}
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

        {menu}
      </View>

      <PostContent editedAt={post.editedAt} body={post.body} imageDescription={post.imageDescription} mediaUri={mediaUrl}
        authorName={post.author.name} authToken={authToken} onRead={reader.read} onStop={reader.stop} />

      <View className="mt-4 h-0.5 bg-[#494455]" />

      <View className="mt-1 flex-row items-center justify-between">
        <PostAction
          accessibilityLabel={`${post.likedByCurrentUser ? "Descurtir publicação" : "Curtir publicação"}, ${formatCount(post.likesCount, "curtida", "curtidas")}`}
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
          accessibilityLabel={`Ver comentários, ${formatCount(post.commentsCount, "comentário", "comentários")}`}
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
