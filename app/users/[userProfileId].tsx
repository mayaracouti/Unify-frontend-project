import Ionicons from "@expo/vector-icons/Ionicons";
import { useIsFocused } from "@react-navigation/native";
import { useFocusEffect, useLocalSearchParams, useRouter } from "expo-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { FollowPendingIcon } from "../../src/components/social/follow-pending-icon";

import {
  buildActionSpeech,
  buildPublicProfileSpeech,
  joinSpeechParts,
  stopSpeaking,
  useTTS,
} from "../../src/accessibility/tts";
import { ProfilePostsSection } from "../../src/components/feed/profile-posts-section";
import {
  AuthenticatedAudioPlayer,
  type AuthenticatedAudioPlayerHandle,
} from "../../src/components/media/authenticated-audio-player";
import { BlockUserSheet, type BlockUserTarget } from "../../src/components/privacy/block-user-sheet";
import { GlobalTopNav } from "../../src/components/navigation/global-top-nav";
import { AuthenticatedRemoteImage } from "../../src/components/profile/authenticated-remote-image";
import { LockedProfileNotice } from "../../src/components/profile/locked-profile-notice";
import { ReportModal } from "../../src/components/report/report-modal";
import { useProfileFollowToggle } from "../../src/components/social/use-profile-follow-toggle";
import { ScreenError } from "../../src/components/ui/screen-error";
import { ScreenLoading } from "../../src/components/ui/screen-loading";
import { useAccessibility } from "../../src/context/AccessibilityContext";
import { useAppShell } from "../../src/context/AppShellContext";
import { useAuth } from "../../src/context/AuthContext";
import { useScreenHeadingFocus } from "../../src/hooks/use-screen-heading-focus";
import { feedService } from "../../src/services/feedService";
import { followService } from "../../src/services/followService";
import { profileService } from "../../src/services/profileService";
import { isApiError } from "../../src/types/auth";
import type { UserPublicProfileResponse } from "../../src/types/profile";
import {
  accessibilityAnnouncements,
  announceForAccessibility,
} from "../../src/utils/accessibilityAnnouncements";
import { formatApiErrorMessage } from "../../src/utils/auth";
import { formatAudioDuration } from "../../src/utils/chatFormatting";
import {
  followStateFromStats,
  type FollowState,
} from "../../src/utils/followRelation";
import { getHiddenFields } from "../../src/utils/profileFieldVisibility";

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
 *
 * Conta privada que eu nao sigo (`locked`): foto de perfil, nome, contadores,
 * seguir e o aviso "Esta conta é privada"; abaixo, so as partes que ainda vem
 * visiveis (match mutuo: dados de match nao escondidos, idade/distancia). Nunca
 * bio, galeria, audio nem Postagens (nem `GET /users/{id}/posts`). O perfil
 * recarrega ao focar e depois de seguir, para destravar quando o pedido for
 * aceito.
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
  const [followState, setFollowState] = useState<FollowState | null>(null);
  const [photoIndex, setPhotoIndex] = useState(0);
  const [reportVisible, setReportVisible] = useState(false);
  const [blockTarget, setBlockTarget] = useState<BlockUserTarget | null>(null);
  /** Sobe a cada seguir/deixar de seguir confirmado: recarrega as Postagens. */
  const [postsReloadToken, setPostsReloadToken] = useState(0);
  /** 404: perfil inexistente, nao verificado ou bloqueio em qualquer direcao. */
  const [unavailable, setUnavailable] = useState(false);
  const isFocused = useIsFocused();
  const audioPlayerRef = useRef<AuthenticatedAudioPlayerHandle>(null);
  /** Perfil ja carregado uma vez: os proximos focos recarregam em segundo plano. */
  const loadedProfileIdRef = useRef<string | null>(null);

  // Sem autoplay; e o audio para ao sair da tela (a desmontagem ja libera o player).
  useEffect(() => {
    if (!isFocused) {
      audioPlayerRef.current?.stop();
    }
  }, [isFocused]);

  // O proprio perfil tem tela dedicada (aba Perfil), com edicao e galeria.
  useEffect(() => {
    if (isOwnProfile) {
      router.replace("/profile");
    }
  }, [isOwnProfile, router]);

  /**
   * `background`: recarga ao voltar para a tela ou depois de seguir — sem
   * spinner, mantendo o que ja esta na tela se falhar (o pedido aceito
   * destrava o perfil aqui).
   */
  const load = useCallback(
    async (background = false) => {
      if (!userProfileId) {
        setLoadError("Não foi possível identificar o perfil.");
        setLoading(false);
        return;
      }

      if (!background) {
        setLoading(true);
      }

      try {
        // Silenciosos: a propria tela mostra o erro (ou "Perfil indisponível").
        const [nextProfile, nextStats] = await Promise.all([
          profileService.getPublicProfile(userProfileId, { silent: true }),
          followService.getFollowStats(userProfileId, { silent: true }).catch(() => null),
        ]);

        setProfile(nextProfile);
        setFollowState((current) =>
          nextStats ? followStateFromStats(nextStats) : background ? current : null
        );

        if (!background) {
          setPhotoIndex(0);
        }

        setLoadError("");
        setUnavailable(false);
        loadedProfileIdRef.current = userProfileId;
      } catch (nextError) {
        if (isApiError(nextError) && nextError.status === 404) {
          setProfile(null);
          setUnavailable(true);
          setLoadError("");
          // O `ScreenError` ("Perfil indisponível") ja e alerta com live region.
          return;
        }

        if (!background) {
          setLoadError(formatApiErrorMessage(nextError, "Não foi possível carregar este perfil."));
        }
      } finally {
        if (!background) {
          setLoading(false);
        }
      }
    },
    [userProfileId]
  );

  // Carrega ao focar: na primeira vez com spinner; depois em segundo plano
  // (ex.: voltou depois que o pedido para seguir foi aceito).
  useFocusEffect(
    useCallback(() => {
      if (isOwnProfile) {
        return;
      }

      void load(loadedProfileIdRef.current === userProfileId);
    }, [isOwnProfile, load, userProfileId])
  );

  const displayName = profile?.name?.trim() || fallbackName || "Perfil";
  // Partes escondidas pelo dono: nao renderizam, nao entram na fala e nao
  // geram requisicao (galeria/audio escondidos respondem 404 nos bytes).
  const hiddenFields = useMemo(() => getHiddenFields(profile), [profile]);
  const galleryHidden = hiddenFields.includes("GALLERY");
  const photoUrls = useMemo(
    () =>
      galleryHidden
        ? []
        : (profile?.galleryImageIds ?? [])
            .map((imageId) => profileService.resolvePublicProfileImageUrl(userProfileId, imageId))
            .filter((url): url is string => Boolean(url)),
    [galleryHidden, profile?.galleryImageIds, userProfileId]
  );
  const activePhotoUrl = photoUrls[photoIndex] ?? photoUrls[0] ?? null;

  // A cada seguir/pedido/cancelamento confirmado: recarrega as Postagens e o
  // perfil (seguir uma conta privada destrava; deixar de seguir trava de novo).
  const handleFollowChanged = useCallback(() => {
    setPostsReloadToken((current) => current + 1);
    void load(true);
  }, [load]);

  const {
    busy: followBusy,
    button: followButton,
    confirmSheet: cancelFollowRequestSheet,
    press: pressFollow,
  } = useProfileFollowToggle({
    onChanged: handleFollowChanged,
    setState: setFollowState,
    state: followState,
    targetName: displayName,
    targetProfileId: userProfileId || null,
  });

  // "Ativo" = seguindo ou solicitado (botao escuro); so "Seguir" fica amarelo.
  const followActive = followButton?.selected ?? false;
  const followersLabel = followState
    ? followState.followersCount === 1
      ? "1 seguidor"
      : `${followState.followersCount} seguidores`
    : null;
  const followingLabel = followState
    ? `${followState.followingCount} seguindo`
    : null;

  const renderBody = () => {
    if (loading) {
      return <ScreenLoading label={`Carregando perfil de ${displayName}`} />;
    }

    if (unavailable) {
      return (
        <ScreenError
          title="Perfil indisponível"
          message="Este perfil não está disponível para você. A pessoa pode ter saído do Unify ou vocês não podem mais se ver."
        />
      );
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
    // Conta privada que eu nao sigo: so foto de perfil, nome, contadores e seguir.
    const locked = profile.locked === true;
    // Travado: sem galeria, a foto e a de perfil (`avatarUrl` vem mesmo travado).
    const lockedAvatarUrl = locked ? feedService.resolveAssetUrl(profile.avatarUrl) : null;
    const age = typeof profile.age === "number" && profile.age > 0 ? profile.age : null;
    const distanceKm =
      typeof profile.distanceKm === "number" && Number.isFinite(profile.distanceKm)
        ? Math.round(profile.distanceKm)
        : null;
    const isHidden = (field: (typeof hiddenFields)[number]) => hiddenFields.includes(field);
    const presentationAudio = isHidden("PRESENTATION_AUDIO") ? null : profile.presentationAudio;
    const pronouns = isHidden("PRONOUNS") ? null : profile.pronouns?.description?.trim() || null;
    // Bio nunca aparece em perfil travado (mesmo com match mutuo).
    const bio = locked || isHidden("BIO") ? null : profile.bio?.trim() || null;
    const visibleDescriptions = (
      field: (typeof hiddenFields)[number],
      items: { description: string }[] | null | undefined
    ) => (isHidden(field) ? [] : descriptions(items));
    const visibleDescription = (
      field: (typeof hiddenFields)[number],
      item: { description: string } | null | undefined
    ) => (isHidden(field) || !item?.description ? [] : [item.description]);
    const presentationAudioUrl = presentationAudio
      ? profileService.resolvePublicPresentationAudioUrl(userProfileId, presentationAudio.id)
      : null;

    return (
      <ScrollView
        className="flex-1"
        contentContainerClassName="px-6 pb-12 pt-6"
        showsVerticalScrollIndicator={false}
      >
        <View className="items-center">
          <View className="h-[172px] w-[172px] items-center justify-center overflow-hidden rounded-full border-[4px] border-[#7C4DFF] bg-[#2D2A33]">
            {locked ? (
              lockedAvatarUrl ? (
                <AuthenticatedRemoteImage
                  accessibilityLabel={`Foto de perfil de ${displayName}`}
                  uri={lockedAvatarUrl}
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
                  accessibilityLabel={`Foto de perfil de ${displayName}`}
                  className="flex-1 items-center justify-center bg-[#2D2A33]"
                >
                  <Ionicons name="person" size={72} color="#CAC3D8" />
                </View>
              )
            ) : activePhotoUrl ? (
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
                accessibilityLabel={
                  galleryHidden
                    ? `As fotos de ${displayName} são privadas`
                    : `${displayName} não tem fotos públicas`
                }
                className="flex-1 items-center justify-center bg-[#2D2A33]"
              >
                <Ionicons name="person" size={72} color="#CAC3D8" />
              </View>
            )}
          </View>

          {!locked && photoUrls.length > 1 ? (
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
            {pronouns ? (
              <Text className="mt-1 text-center text-[14px] font-semibold text-[#CAC3D8]">
                {pronouns}
              </Text>
            ) : null}
            {/* Nula quando a pessoa ocultou a distancia: a linha some (nunca "0 km"). */}
            {distanceKm !== null ? (
              <Text className="mt-1 text-center text-[14px] font-semibold text-[#CAC3D8]">
                A {distanceKm} km de você
              </Text>
            ) : null}
            {bio ? (
              <Text className="mt-4 max-w-[320px] text-center text-[16px] font-medium leading-7 text-[#E5E2E1]">
                {bio}
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
              {followState ? followState.followersCount : "—"}
            </Text>
            <Text className="mt-1 text-center text-[14px] font-bold text-white">Seguidores</Text>
          </View>
          <View
            accessible
            accessibilityLabel={followingLabel ?? "Seguindo, carregando"}
            className="flex-1 px-3 py-4"
          >
            <Text className="text-center text-[18px] font-black text-[#D7C3FF]">
              {followState ? followState.followingCount : "—"}
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
            className={`min-h-[56px] flex-1 flex-row items-center justify-center rounded-[18px] border px-3 py-2 ${
              followActive ? "border-[#CDBDFF] bg-[#2B2338]" : "border-[#EAEA00] bg-[#EAEA00]"
            }`}
            onPress={pressFollow}
            disabled={followBusy || !followButton}
            accessibilityRole="button"
            accessibilityLabel={followButton?.accessibilityLabel ?? `Seguir ${displayName}`}
            accessibilityHint={
              followButton?.accessibilityHint ??
              "As publicações desta pessoa passam a aparecer no seu feed"
            }
            accessibilityState={{
              selected: followActive,
              busy: followBusy,
              disabled: followBusy || !followButton,
            }}
          >
            {followBusy ? (
              <ActivityIndicator color={followActive ? "#FFFFFF" : "#1D1D00"} size="small" />
            ) : (
              <>
                {followButton?.relation === "REQUESTED" ? (
                  <FollowPendingIcon size={18} badgeBackground="#2B2338" />
                ) : (
                  <Ionicons
                    name={followButton?.icon ?? "person-add-outline"}
                    size={18}
                    color={followActive ? "#FFFFFF" : "#1D1D00"}
                    importantForAccessibility="no"
                  />
                )}
                <Text
                  className={`ml-2 flex-shrink text-center text-[15px] font-black ${
                    followActive ? "text-white" : "text-[#1D1D00]"
                  }`}
                >
                  {followButton?.text ?? "Seguir"}
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

          <Pressable
            className="h-14 w-14 items-center justify-center rounded-[18px] border border-[#6A4456] bg-[#2A1C24]"
            onPress={() => {
              speak(buildActionSpeech("Bloquear", displayName));
              setBlockTarget({ userProfileId, name: displayName });
            }}
            accessibilityRole="button"
            accessibilityLabel={`Bloquear ${displayName}`}
            accessibilityHint="Pede confirmação. Vocês deixam de se ver e de trocar mensagens"
          >
            <Ionicons name="ban-outline" size={20} color="#FF8FAB" importantForAccessibility="no" />
          </Pressable>
        </View>

        {locked ? (
          // Abaixo so as partes que ainda vem visiveis; nunca audio nem Postagens.
          <LockedProfileNotice className="mt-6" highContrast={highContrast} />
        ) : null}

        {!locked && presentationAudio && presentationAudioUrl ? (
          // Sem autoplay: a fala do perfil avisa que o audio existe e a pessoa
          // escolhe ouvir. Tocar cala o TTS para nao falar por cima.
          <View className="mt-3">
            <AuthenticatedAudioPlayer
              ref={audioPlayerRef}
              accessibilityHint="Toque para ouvir ou pausar a apresentação em voz"
              accessibilityLabel={`Ouvir apresentação de ${displayName}, ${formatAudioDuration(
                presentationAudio.durationSeconds
              )}`}
              authToken={authToken}
              cacheKey={`presentation-${presentationAudio.id}`}
              durationSeconds={presentationAudio.durationSeconds}
              onPlaybackStart={stopSpeaking}
              playingAccessibilityLabel={`Pausar apresentação de ${displayName}`}
              title="Ouvir apresentação"
              uri={presentationAudioUrl}
              variant="profile"
            />
          </View>
        ) : null}

        <View className="mt-8">
          {/* Cards sem itens visiveis (vazios ou escondidos) nao renderizam. */}
          <DetailCard
            title="Interesses"
            icon="sparkles-outline"
            items={visibleDescriptions("INTEREST_TYPES", profile.interestTypes)}
          />
          <DetailCard
            title="Comunicação"
            icon="chatbubbles-outline"
            items={visibleDescriptions("COMMUNICATION_FORMS", profile.communicationForms)}
          />
          <DetailCard
            title="Acessibilidade e autonomia"
            icon="body-outline"
            items={[
              ...visibleDescriptions("DISABILITIES", profile.disabilities),
              ...visibleDescriptions("ACCESSIBILITY_NEEDS", profile.accessibilityNeeds),
              ...visibleDescription("AUTONOMY_LEVEL", profile.autonomyLevel),
            ]}
          />
          <DetailCard
            title="Estilo de vida"
            icon="leaf-outline"
            items={[
              ...visibleDescription("ENERGY_LEVEL", profile.energyLevel),
              ...visibleDescriptions("LIFESTYLE_TYPES", profile.lifestyleTypes),
            ]}
          />
          <DetailCard
            title="Linguagem do amor"
            icon="heart-outline"
            items={visibleDescriptions("LOVE_LANGUAGES", profile.loveLanguages)}
          />
        </View>

        {locked ? null : (
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
            // Seguir/deixar de seguir muda o que perfis "só para seguidores" mostram.
            reloadToken={postsReloadToken}
            userProfileId={userProfileId}
          />
        )}
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

      {cancelFollowRequestSheet}

      <BlockUserSheet
        target={blockTarget}
        onClose={() => setBlockTarget(null)}
        onBlocked={() => {
          audioPlayerRef.current?.stop();
          if (router.canGoBack()) {
            router.back();
            return;
          }
          router.replace("/home");
        }}
      />
    </View>
  );
}
