import Ionicons from "@expo/vector-icons/Ionicons";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import {
  buildActionSpeech,
  buildPublicProfileSpeech,
  joinSpeechParts,
  useTTS,
} from "../../src/accessibility/tts";
import { ProfilePostsSection } from "../../src/components/feed/profile-posts-section";
import { GlobalTopNav } from "../../src/components/navigation/global-top-nav";
import { AuthenticatedRemoteImage } from "../../src/components/profile/authenticated-remote-image";
import { ReportModal } from "../../src/components/report/report-modal";
import { ScreenError } from "../../src/components/ui/screen-error";
import { ScreenLoading } from "../../src/components/ui/screen-loading";
import { useAccessibility } from "../../src/context/AccessibilityContext";
import { useAppShell } from "../../src/context/AppShellContext";
import { useAuth } from "../../src/context/AuthContext";
import { useScreenHeadingFocus } from "../../src/hooks/use-screen-heading-focus";
import { followService } from "../../src/services/followService";
import { profileService } from "../../src/services/profileService";
import type { UserPublicProfileResponse } from "../../src/types/profile";
import type { FollowStatsResponse } from "../../src/types/social";
import {
  accessibilityAnnouncements,
  announceForAccessibility,
} from "../../src/utils/accessibilityAnnouncements";
import { formatApiErrorMessage } from "../../src/utils/auth";

function normalizeParam(value?: string | string[]) {
  return (Array.isArray(value) ? value[0] : value)?.trim() ?? "";
}

function descriptions(items: { description: string }[] | null | undefined) {
  return (items ?? []).map((item) => item.description).filter(Boolean);
}

function ChipList({ items }: { items: string[] }) {
  if (items.length === 0) {
    return null;
  }

  // A lista de chips e uma unidade semantica: um foco do leitor de tela em vez
  // de N paradas, uma por chip.
  return (
    <View
      accessible
      accessibilityRole="list"
      accessibilityLabel={items.join(", ")}
      className="mt-3 flex-row flex-wrap gap-2"
    >
      {items.map((item) => (
        <View key={item} className="rounded-full bg-[#24262B] px-4 py-2.5">
          <Text className="text-[14px] font-bold text-white">{item}</Text>
        </View>
      ))}
    </View>
  );
}

function DetailCard({
  children,
  icon,
  items,
  title,
}: {
  children?: React.ReactNode;
  icon: keyof typeof Ionicons.glyphMap;
  items?: string[];
  title: string;
}) {
  const { speak } = useTTS();

  if (!children && (!items || items.length === 0)) {
    return null;
  }

  return (
    <Pressable
      className="mb-4 rounded-[24px] bg-[#111214] p-5"
      onPress={() => speak(joinSpeechParts([title, items?.join(", ") ?? null], ": "))}
      accessibilityRole="button"
      accessibilityLabel={joinSpeechParts([title, items?.join(", ") ?? null], ": ") ?? title}
      accessibilityHint="Lê esta seção em voz alta"
    >
      <View className="flex-row items-center">
        <Ionicons name={icon} size={22} color="#A7A6B3" importantForAccessibility="no" />
        <Text accessibilityRole="header" className="ml-3 text-[18px] font-black text-[#C9C6D3]">
          {title}
        </Text>
      </View>
      {children}
      {items ? <ChipList items={items} /> : null}
    </Pressable>
  );
}

/**
 * Perfil publico de outra pessoa: aberto pelo avatar no chat, na lista de
 * conversas, nas publicacoes (Inicio/comunidade) e na lista de membros.
 * Traz seguir/deixar de seguir, contadores, denuncia, detalhes do perfil e a
 * secao Postagens (publicacoes pessoais) da pessoa.
 */
export default function UserPublicProfileScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{
    userProfileId?: string | string[];
    name?: string | string[];
  }>();
  const headingRef = useScreenHeadingFocus<Text>();
  const { speak } = useTTS();
  const { session } = useAuth();
  const authToken = session?.accessToken ?? null;
  const { currentUserProfileId } = useAppShell();
  const { settings } = useAccessibility();
  const highContrast = settings.highContrast;

  const userProfileId = normalizeParam(params.userProfileId);
  const fallbackName = normalizeParam(params.name);
  const isOwnProfile = Boolean(userProfileId) && userProfileId === currentUserProfileId;

  const [profile, setProfile] = useState<UserPublicProfileResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [followStats, setFollowStats] = useState<FollowStatsResponse | null>(null);
  const [followBusy, setFollowBusy] = useState(false);
  const [photoIndex, setPhotoIndex] = useState(0);
  const [reportVisible, setReportVisible] = useState(false);

  // O proprio perfil tem tela dedicada (aba Perfil), com edicao e galeria.
  useEffect(() => {
    if (isOwnProfile) {
      router.replace("/profile");
    }
  }, [isOwnProfile, router]);

  const load = useCallback(async () => {
    if (!userProfileId) {
      setLoadError("Não foi possível identificar o perfil.");
      setLoading(false);
      return;
    }

    setLoading(true);

    try {
      const [nextProfile, nextStats] = await Promise.all([
        profileService.getPublicProfile(userProfileId),
        followService.getFollowStats(userProfileId).catch(() => null),
      ]);

      setProfile(nextProfile);
      setFollowStats(nextStats);
      setPhotoIndex(0);
      setLoadError("");
    } catch (nextError) {
      setLoadError(formatApiErrorMessage(nextError, "Não foi possível carregar este perfil."));
    } finally {
      setLoading(false);
    }
  }, [userProfileId]);

  useEffect(() => {
    if (!isOwnProfile) {
      void load();
    }
  }, [isOwnProfile, load]);

  const displayName = profile?.name?.trim() || fallbackName || "Perfil";
  const photoUrls = useMemo(
    () =>
      (profile?.galleryImageIds ?? [])
        .map((imageId) => profileService.resolvePublicProfileImageUrl(userProfileId, imageId))
        .filter((url): url is string => Boolean(url)),
    [profile?.galleryImageIds, userProfileId]
  );
  const activePhotoUrl = photoUrls[photoIndex] ?? photoUrls[0] ?? null;

  const toggleFollow = useCallback(async () => {
    if (!followStats || followBusy || !userProfileId) {
      return;
    }

    const willFollow = !followStats.followedByCurrentUser;
    const previous = followStats;

    setFollowBusy(true);
    // Atualização otimista: o botão responde na hora e volta se a requisição falhar.
    setFollowStats({
      ...previous,
      followedByCurrentUser: willFollow,
      followersCount: Math.max(0, previous.followersCount + (willFollow ? 1 : -1)),
    });

    try {
      const response = willFollow
        ? await followService.follow(userProfileId)
        : await followService.unfollow(userProfileId);

      setFollowStats((current) =>
        current
          ? {
              ...current,
              followedByCurrentUser: response.following,
              followersCount: response.followersCount,
            }
          : current
      );
      announceForAccessibility(
        response.following
          ? accessibilityAnnouncements.followStarted(displayName)
          : accessibilityAnnouncements.followStopped(displayName)
      );
    } catch {
      setFollowStats(previous);
      // Global API error toast already explains the failure.
    } finally {
      setFollowBusy(false);
    }
  }, [displayName, followBusy, followStats, userProfileId]);

  const following = followStats?.followedByCurrentUser ?? false;
  const followersLabel = followStats
    ? followStats.followersCount === 1
      ? "1 seguidor"
      : `${followStats.followersCount} seguidores`
    : null;
  const followingLabel = followStats
    ? `${followStats.followingCount} seguindo`
    : null;

  const renderBody = () => {
    if (loading) {
      return <ScreenLoading label={`Carregando perfil de ${displayName}`} />;
    }

    if (loadError || !profile) {
      return (
        <ScreenError
          message={loadError || "Perfil indisponível."}
          title="Não foi possível abrir o perfil"
          onRetry={() => {
            void load();
          }}
          retrying={loading}
        />
      );
    }

    const profileSpeech = buildPublicProfileSpeech(profile);
    const age = typeof profile.age === "number" && profile.age > 0 ? profile.age : null;

    return (
      <ScrollView
        className="flex-1"
        contentContainerClassName="px-6 pb-12 pt-6"
        showsVerticalScrollIndicator={false}
      >
        <View className="items-center">
          <View className="h-[172px] w-[172px] items-center justify-center overflow-hidden rounded-full border-[4px] border-[#7C4DFF] bg-[#2D2A33]">
            {activePhotoUrl ? (
              <AuthenticatedRemoteImage
                accessibilityLabel={`Foto ${photoIndex + 1} de ${photoUrls.length} de ${displayName}`}
                uri={activePhotoUrl}
                authToken={authToken}
                className="h-full w-full"
                resizeMode="cover"
                fallback={
                  <View className="flex-1 items-center justify-center bg-[#2D2A33]">
                    <Ionicons name="person" size={72} color="#CAC3D8" />
                  </View>
                }
              />
            ) : (
              <View
                accessible
                accessibilityLabel={`${displayName} não tem fotos públicas`}
                className="flex-1 items-center justify-center bg-[#2D2A33]"
              >
                <Ionicons name="person" size={72} color="#CAC3D8" />
              </View>
            )}
          </View>

          {photoUrls.length > 1 ? (
            <View
              accessibilityRole="toolbar"
              accessibilityLabel="Fotos do perfil"
              className="mt-4 flex-row items-center gap-3"
            >
              <Pressable
                className="h-11 w-11 items-center justify-center rounded-full bg-[#17181C]"
                onPress={() => {
                  const next = (photoIndex - 1 + photoUrls.length) % photoUrls.length;
                  setPhotoIndex(next);
                  speak(accessibilityAnnouncements.photoChanged(next + 1, photoUrls.length));
                  announceForAccessibility(
                    accessibilityAnnouncements.photoChanged(next + 1, photoUrls.length)
                  );
                }}
                accessibilityRole="button"
                accessibilityLabel="Foto anterior"
              >
                <Ionicons name="chevron-back" size={22} color="#FFFFFF" importantForAccessibility="no" />
              </Pressable>
              <Text className="text-[13px] font-bold text-[#CAC3D8]" importantForAccessibility="no">
                {photoIndex + 1} / {photoUrls.length}
              </Text>
              <Pressable
                className="h-11 w-11 items-center justify-center rounded-full bg-[#17181C]"
                onPress={() => {
                  const next = (photoIndex + 1) % photoUrls.length;
                  setPhotoIndex(next);
                  speak(accessibilityAnnouncements.photoChanged(next + 1, photoUrls.length));
                  announceForAccessibility(
                    accessibilityAnnouncements.photoChanged(next + 1, photoUrls.length)
                  );
                }}
                accessibilityRole="button"
                accessibilityLabel="Próxima foto"
              >
                <Ionicons name="chevron-forward" size={22} color="#FFFFFF" importantForAccessibility="no" />
              </Pressable>
            </View>
          ) : null}

          <Pressable
            onPress={() => speak(profileSpeech)}
            accessibilityRole="button"
            accessibilityLabel={profileSpeech ?? displayName}
            accessibilityHint="Repete o resumo do perfil em voz alta"
          >
            <Text
              ref={headingRef}
              accessibilityRole="header"
              className="mt-6 text-center text-[30px] font-extrabold text-white"
            >
              {displayName}
              {age ? `, ${age}` : ""}
            </Text>
            {profile.pronouns?.description ? (
              <Text className="mt-1 text-center text-[14px] font-semibold text-[#CAC3D8]">
                {profile.pronouns.description}
              </Text>
            ) : null}
            {profile.bio?.trim() ? (
              <Text className="mt-4 max-w-[320px] text-center text-[16px] font-medium leading-7 text-[#E5E2E1]">
                {profile.bio.trim()}
              </Text>
            ) : null}
          </Pressable>
        </View>

        <View className="mt-6 flex-row overflow-hidden rounded-[26px] border border-[#68598C] bg-[#262228]">
          <View
            accessible
            accessibilityLabel={followersLabel ?? "Seguidores, carregando"}
            className="flex-1 border-r border-[#4D4656] px-3 py-4"
          >
            <Text className="text-center text-[18px] font-black text-[#D7C3FF]">
              {followStats ? followStats.followersCount : "—"}
            </Text>
            <Text className="mt-1 text-center text-[14px] font-bold text-white">Seguidores</Text>
          </View>
          <View
            accessible
            accessibilityLabel={followingLabel ?? "Seguindo, carregando"}
            className="flex-1 px-3 py-4"
          >
            <Text className="text-center text-[18px] font-black text-[#D7C3FF]">
              {followStats ? followStats.followingCount : "—"}
            </Text>
            <Text className="mt-1 text-center text-[14px] font-bold text-white">Seguindo</Text>
          </View>
        </View>

        <View
          accessibilityRole="toolbar"
          accessibilityLabel={`Ações sobre o perfil de ${displayName}`}
          className="mt-4 flex-row items-center gap-3"
        >
          <Pressable
            className={`h-14 flex-1 flex-row items-center justify-center rounded-[18px] border ${
              following ? "border-[#CDBDFF] bg-[#2B2338]" : "border-[#EAEA00] bg-[#EAEA00]"
            }`}
            onPress={() => {
              speak(buildActionSpeech(following ? "Deixar de seguir" : "Seguir", displayName));
              void toggleFollow();
            }}
            disabled={followBusy || !followStats}
            accessibilityRole="button"
            accessibilityLabel={
              following ? `Deixar de seguir ${displayName}` : `Seguir ${displayName}`
            }
            accessibilityHint={
              following
                ? "As publicações desta pessoa saem do seu feed"
                : "As publicações desta pessoa passam a aparecer no seu feed"
            }
            accessibilityState={{
              selected: following,
              busy: followBusy,
              disabled: followBusy || !followStats,
            }}
          >
            {followBusy ? (
              <ActivityIndicator color={following ? "#FFFFFF" : "#1D1D00"} size="small" />
            ) : (
              <>
                <Ionicons
                  name={following ? "checkmark" : "person-add-outline"}
                  size={18}
                  color={following ? "#FFFFFF" : "#1D1D00"}
                  importantForAccessibility="no"
                />
                <Text
                  className={`ml-2 text-[15px] font-black ${
                    following ? "text-white" : "text-[#1D1D00]"
                  }`}
                >
                  {following ? "Seguindo" : "Seguir"}
                </Text>
              </>
            )}
          </Pressable>

          <Pressable
            className="h-14 w-14 items-center justify-center rounded-[18px] border border-[#494455] bg-[#1A1C1F]"
            onPress={() => {
              speak(buildActionSpeech("Denunciar", displayName));
              setReportVisible(true);
            }}
            accessibilityRole="button"
            accessibilityLabel={`Denunciar ${displayName}`}
            accessibilityHint="Abre o formulário de denúncia de perfil"
          >
            <Ionicons name="flag-outline" size={20} color="#FFFFFF" importantForAccessibility="no" />
          </Pressable>
        </View>

        <View className="mt-8">
          <DetailCard title="Interesses" icon="sparkles-outline" items={descriptions(profile.interestTypes)} />
          <DetailCard
            title="Comunicação"
            icon="chatbubbles-outline"
            items={descriptions(profile.communicationForms)}
          />
          <DetailCard
            title="Acessibilidade e autonomia"
            icon="body-outline"
            items={[
              ...descriptions(profile.disabilities),
              ...descriptions(profile.accessibilityNeeds),
              ...(profile.autonomyLevel?.description ? [profile.autonomyLevel.description] : []),
            ]}
          />
          <DetailCard
            title="Estilo de vida"
            icon="leaf-outline"
            items={[
              ...(profile.energyLevel?.description ? [profile.energyLevel.description] : []),
              ...descriptions(profile.lifestyleTypes),
            ]}
          />
          <DetailCard
            title="Linguagem do amor"
            icon="heart-outline"
            items={descriptions(profile.loveLanguages)}
          />
        </View>

        <ProfilePostsSection
          authToken={authToken}
          highContrast={highContrast}
          isOwnProfile={false}
          onSeeAll={() =>
            router.push({
              pathname: "/profile/posts",
              params: { userProfileId, name: displayName },
            })
          }
          ownerName={displayName}
          userProfileId={userProfileId}
        />
      </ScrollView>
    );
  };

  if (isOwnProfile) {
    return null;
  }

  return (
    <View className={`flex-1 ${highContrast ? "bg-hc-bg" : "bg-[#151515]"}`}>
      <SafeAreaView className="flex-1">
        <GlobalTopNav />

        <View className="flex-row items-center px-6 pt-4">
          <Pressable
            className="h-11 w-11 items-center justify-center rounded-full bg-[#17181C]"
            onPress={() => {
              speak("Voltar");
              if (router.canGoBack()) {
                router.back();
                return;
              }
              router.replace("/home");
            }}
            accessibilityRole="button"
            accessibilityLabel="Voltar"
            accessibilityHint="Volta para a tela anterior"
          >
            <Ionicons name="arrow-back" size={24} color="#A270FF" importantForAccessibility="no" />
          </Pressable>
          <Text className="ml-3 text-[14px] font-bold uppercase tracking-[1.2px] text-[#9F96B8]">
            Perfil
          </Text>
        </View>

        {renderBody()}
      </SafeAreaView>

      {/*
        O perfil público não expõe o id do `User`; a denúncia usa o id do
        perfil como referência, mesmo fallback da tela de Encontros.
      */}
      <ReportModal
        visible={reportVisible}
        onClose={() => setReportVisible(false)}
        reportedUserId={userProfileId}
        contextLabel={`perfil de ${displayName}`}
      />
    </View>
  );
}
