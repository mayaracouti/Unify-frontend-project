import type { ComponentProps } from "react";
import { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Image,
  Pressable,
  RefreshControl,
  ScrollView,
  Text,
  View,
} from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";
import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";

import { GlobalBottomNav } from "../../src/components/navigation/global-bottom-nav";
import { useRequireCompletedOnboarding } from "../../src/hooks/useRequireCompletedOnboarding";
import { communityService } from "../../src/services/communityService";
import type {
  CommunityFeedResponse,
  CommunityPostResponse,
  CommunitySummaryResponse,
} from "../../src/types/community";

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

function CommunityBadge({ community }: { community: CommunitySummaryResponse }) {
  return (
    <View className="h-20 w-20 items-center justify-center overflow-hidden rounded-xl border-2 border-[#CDBDFF] bg-[#7C4DFF]">
      {community.iconUrl ? (
        <Image
          source={{ uri: community.iconUrl }}
          className="h-full w-full"
          resizeMode="cover"
        />
      ) : (
        <Ionicons name="people" size={36} color="#FCF6FF" />
      )}
    </View>
  );
}

function MemberButton({ isMember }: { isMember?: boolean | null }) {
  return (
    <Pressable className="mt-8 h-14 w-full flex-row items-center justify-center gap-3 rounded-xl border-2 border-[#EAEA00] bg-[#EAEA00]">
      <Ionicons
        name={isMember ? "checkmark-circle" : "add-circle"}
        size={22}
        color="#323200"
      />
      <Text className="text-[18px] font-black text-[#1D1D00]">
        {isMember ? "Membro" : "Participar"}
      </Text>
    </Pressable>
  );
}

function AuthorAvatar({
  name,
  avatarUrl,
}: {
  name?: string | null;
  avatarUrl?: string | null;
}) {
  const initials = getInitials(name);

  return (
    <View className="h-14 w-14 items-center justify-center overflow-hidden rounded-full border-2 border-[#CDBDFF] bg-[#353534]">
      {avatarUrl ? (
        <Image
          source={{ uri: avatarUrl }}
          className="h-full w-full"
          resizeMode="cover"
        />
      ) : (
        <LinearGradient
          colors={["#CDBDFF", "#7C4DFF"]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          className="h-full w-full items-center justify-center"
        >
          <Text className="text-[16px] font-black text-white">
            {initials || "?"}
          </Text>
        </LinearGradient>
      )}
    </View>
  );
}

function PostAction({
  icon,
  count,
  active,
}: {
  icon: ComponentProps<typeof Ionicons>["name"];
  count?: number | null;
  active?: boolean | null;
}) {
  return (
    <Pressable className="h-14 flex-1 flex-row items-center justify-center gap-2 rounded-lg">
      <Ionicons
        name={icon}
        size={26}
        color={active ? "#7C4DFF" : "#CAC3D8"}
      />
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

function CommunityHeader({
  community,
}: {
  community: CommunitySummaryResponse;
}) {
  const memberCountLabel = formatMemberCount(community.memberCount);

  return (
    <View className="border-b-2 border-[#494455] bg-[#201F1F] px-6 pb-12 pt-7">
      <CommunityBadge community={community} />

      <Text className="mt-5 max-w-[310px] text-[32px] font-black leading-10 text-[#E5E2E1]">
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

      {community.description ? (
        <Text className="mt-5 text-[18px] font-semibold leading-8 text-[#E5E2E1]">
          {community.description}
        </Text>
      ) : null}

      <MemberButton isMember={community.isMember} />
    </View>
  );
}

function CommunityPostCard({ post }: { post: CommunityPostResponse }) {
  return (
    <View className="rounded-xl bg-[#2A2A2A] p-4">
      <View className="flex-row items-center gap-3">
        <AuthorAvatar name={post.author.name} avatarUrl={post.author.avatarUrl} />
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
      </View>

      <Text className="mt-5 text-[19px] font-semibold leading-8 text-[#E5E2E1]">
        {post.body}
      </Text>

      {post.mediaUrl ? (
        <View className="mt-4 aspect-video w-full overflow-hidden rounded-lg border-2 border-[#494455]">
          <Image
            source={{ uri: post.mediaUrl }}
            className="h-full w-full"
            resizeMode="cover"
          />
        </View>
      ) : null}

      <View className="mt-4 h-0.5 bg-[#494455]" />

      <View className="mt-1 flex-row items-center justify-between">
        <PostAction
          icon={post.likedByCurrentUser ? "thumbs-up" : "thumbs-up-outline"}
          count={post.likesCount}
          active={post.likedByCurrentUser}
        />
        <PostAction
          icon={post.commentedByCurrentUser ? "chatbubble" : "chatbubble-outline"}
          count={post.commentsCount}
          active={post.commentedByCurrentUser}
        />
        <PostAction icon="share-social-outline" />
      </View>
    </View>
  );
}

function EmptyCommunityState() {
  return (
    <View className="flex-1 items-center justify-center px-8 py-16">
      <View className="h-16 w-16 items-center justify-center rounded-full bg-[#201F1F]">
        <Ionicons name="people-outline" size={32} color="#7C4DFF" />
      </View>
      <Text className="mt-6 text-center text-[22px] font-black text-[#E5E2E1]">
        Nenhuma comunidade disponível
      </Text>
      <Text className="mt-3 text-center text-[15px] font-semibold leading-6 text-[#CAC3D8]">
        As informações aparecerão aqui quando forem enviadas pelo backend.
      </Text>
    </View>
  );
}

export default function Community() {
  useRequireCompletedOnboarding();
  const router = useRouter();
  const [feed, setFeed] = useState<CommunityFeedResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const loadFeed = useCallback(async () => {
    try {
      const response = await communityService.getFeed();
      setFeed({
        community: response.community ?? null,
        posts: Array.isArray(response.posts) ? response.posts : [],
      });
    } catch {
      setFeed({ community: null, posts: [] });
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    void loadFeed();
  }, [loadFeed]);

  const handleRefresh = useCallback(() => {
    setRefreshing(true);
    void loadFeed();
  }, [loadFeed]);

  const community = feed?.community ?? null;
  const posts = feed?.posts ?? [];

  return (
    <View className="flex-1 bg-[#131313]">
      <SafeAreaView className="flex-1 bg-black">
        <View className="h-16 flex-row items-center border-b-2 border-[#353534] bg-black px-6">
          <Pressable
            className="mr-4 h-10 w-10 items-center justify-center rounded-full"
            accessibilityRole="button"
            accessibilityLabel="Voltar"
            onPress={() => router.back()}
          >
            <Ionicons name="arrow-back" size={28} color="#7C4DFF" />
          </Pressable>
          <Text className="text-[20px] font-black text-[#7C4DFF]">
            Comunidade
          </Text>
        </View>

        <View className="flex-1">
          {loading ? (
            <View className="flex-1 items-center justify-center bg-[#131313]">
              <ActivityIndicator color="#7C4DFF" size="large" />
            </View>
          ) : (
            <ScrollView
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
              {community ? (
                <>
                  <CommunityHeader community={community} />

                  {posts.length > 0 ? (
                    <View className="gap-4 px-6 pt-7">
                      {posts.map((post) => (
                        <CommunityPostCard key={post.id} post={post} />
                      ))}
                    </View>
                  ) : null}
                </>
              ) : (
                <EmptyCommunityState />
              )}
            </ScrollView>
          )}

          {community ? (
            <Pressable
              className="absolute bottom-6 right-6 h-16 w-16 items-center justify-center rounded-full border-2 border-[#CDBDFF] bg-[#7C4DFF]"
              accessibilityRole="button"
              accessibilityLabel="Criar publicação"
            >
              <Ionicons name="add" size={38} color="#FCF6FF" />
            </Pressable>
          ) : null}
        </View>

        <GlobalBottomNav />
      </SafeAreaView>
    </View>
  );
}
