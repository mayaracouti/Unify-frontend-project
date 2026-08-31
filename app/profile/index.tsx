import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  Text,
  View,
} from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";
import * as ImagePicker from "expo-image-picker";
import { useRouter } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";

import { joinSpeechParts, useTTS } from "../../src/accessibility/tts";
import { GlobalBottomNav } from "../../src/components/navigation/global-bottom-nav";
import { GlobalTopNav } from "../../src/components/navigation/global-top-nav";
import { AuthenticatedRemoteImage } from "../../src/components/profile/authenticated-remote-image";
import { ScreenError } from "../../src/components/ui/screen-error";
import { ScreenLoading } from "../../src/components/ui/screen-loading";
import { useAccessibility } from "../../src/context/AccessibilityContext";
import { useAppShell } from "../../src/context/AppShellContext";
import { useAsyncState } from "../../src/hooks/useAsyncState";
import { useRequireCompletedOnboarding } from "../../src/hooks/useRequireCompletedOnboarding";
import { profileService } from "../../src/services/profileService";
import { getAuthSnapshot, subscribeToAuthStorage } from "../../src/storage/tokenStorage";
import type {
  DisabilityOptionResponse,
  LookupOptionResponse,
  UserProfileImageResponse,
  UserProfileResponse,
} from "../../src/types/profile";
import { announceForAccessibility } from "../../src/utils/accessibilityAnnouncements";
import { formatApiErrorMessage } from "../../src/utils/auth";

type UploadTarget = "profilePicture" | "gallery";
type ImageSource = "camera" | "gallery";

const IMAGE_MEDIA_TYPES: ImagePicker.MediaType[] = ["images"];

type ProfileAction = {
  route: "/profile/edit" | "/profile/edit-match-preferences" | "/profile/accessibility-settings";
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  hint: string;
  primary?: boolean;
};

const PROFILE_ACTIONS: ProfileAction[] = [
  {
    route: "/profile/edit",
    icon: "create-outline",
    label: "Editar perfil",
    hint: "Abre a tela de edição do seu perfil",
    primary: true,
  },
  {
    route: "/profile/edit-match-preferences",
    icon: "options-outline",
    label: "Editar preferências de match",
    hint: "Abre a tela de preferências de match",
  },
  {
    route: "/profile/accessibility-settings",
    icon: "accessibility-outline",
    label: "Configurações de acessibilidade",
    hint: "Abre os ajustes de fonte, contraste, leitura por voz e movimento",
  },
];

function ProfileActionButton({
  action,
  onPress,
}: {
  action: ProfileAction;
  onPress: () => void;
}) {
  const [tooltipVisible, setTooltipVisible] = useState(false);

  return (
    <View className="flex-1">
      {tooltipVisible ? (
        <View
          className="absolute bottom-[62px] left-0 right-0 items-center"
          pointerEvents="none"
        >
          <View className="rounded-xl border border-[#494455] bg-[#0E0F11] px-3 py-2">
            <Text className="text-center text-[13px] font-bold text-white">
              {action.label}
            </Text>
          </View>
        </View>
      ) : null}

      <Pressable
        className={`h-14 items-center justify-center rounded-[18px] ${
          action.primary
            ? "bg-[#F1EF00]"
            : "border border-[#494455] bg-[#1A1C1F]"
        }`}
        onPress={() => {
          setTooltipVisible(false);
          onPress();
        }}
        onLongPress={() => setTooltipVisible(true)}
        onPressOut={() => setTooltipVisible(false)}
        delayLongPress={300}
        accessibilityRole="button"
        accessibilityLabel={action.label}
        accessibilityHint={action.hint}
      >
        <Ionicons
          name={action.icon}
          size={22}
          color={action.primary ? "#212000" : "#FFFFFF"}
          importantForAccessibility="no"
        />
      </Pressable>
    </View>
  );
}

function isIoniconName(
  value?: string | null
): value is keyof typeof Ionicons.glyphMap {
  return typeof value === "string" && value in Ionicons.glyphMap;
}

function buildDisplayName(profile: UserProfileResponse | null): string {
  const userName = profile?.user?.name?.trim();
  const profileName = profile?.name?.trim();
  const fullName = userName || profileName;

  return fullName || "Seu perfil";
}

function buildDisplayAge(profile: UserProfileResponse | null): string | null {
  const age = profile?.user?.age ?? profile?.age;

  return typeof age === "number" && Number.isFinite(age) ? String(age) : null;
}

function joinDescriptions(items: LookupOptionResponse[], fallback: string): string {
  return items.length > 0
    ? items.map((item) => item.description).join(" • ")
    : fallback;
}

function buildAccessibilityCards(profile: UserProfileResponse | null) {
  const cards = (profile?.disabilities ?? []).map((item: DisabilityOptionResponse) => ({
    key: `disability-${item.id}`,
    title: item.description,
    subtitle: "Tipo de deficiência informado no perfil",
    icon: isIoniconName(item.ionicIcon)
      ? item.ionicIcon
      : ("accessibility-outline" as const),
  }));

  if (cards.length > 0) {
    return cards;
  }

  return [
    {
      key: "empty-accessibility",
      title: "Nenhuma informação cadastrada",
      subtitle:
        "Adicione o tipo de deficiência no modo de edição para preencher esta seção.",
      icon: "sparkles-outline" as const,
    },
  ];
}

function createImageFormData(asset: ImagePicker.ImagePickerAsset): FormData {
  const formData = new FormData();
  const fileName = asset.fileName ?? `profile-${Date.now()}.jpg`;
  const mimeType = asset.mimeType ?? "image/jpeg";
  const webFile = (asset as ImagePicker.ImagePickerAsset & { file?: File }).file;

  if (Platform.OS === "web" && webFile) {
    formData.append("image", webFile, fileName);
    return formData;
  }

  formData.append(
    "image",
    {
      uri: asset.uri,
      name: fileName,
      type: mimeType,
    } as unknown as Blob
  );

  return formData;
}

function GalleryImageCard({
  image,
  index,
  authToken,
  removing,
  onRemove,
}: {
  image: UserProfileImageResponse;
  index: number;
  authToken: string | null;
  removing: boolean;
  onRemove: () => void;
}) {
  const imageUrl = profileService.resolveProfileImageUrl(image.url);
  const photoPosition = index + 1;

  return (
    <View className="mr-4 w-[132px]">
      <View className="h-[172px] overflow-hidden rounded-[24px] bg-[#262626]">
        {imageUrl ? (
          <AuthenticatedRemoteImage
            accessibilityLabel={`Foto ${photoPosition} da sua galeria`}
            uri={imageUrl}
            authToken={authToken}
            className="h-full w-full"
            resizeMode="cover"
            fallback={
              <View className="flex-1 items-center justify-center bg-[#2D2A33]">
                <Ionicons name="image-outline" size={28} color="#CAC3D8" />
              </View>
            }
          />
        ) : (
          <View className="flex-1 items-center justify-center bg-[#2D2A33]">
            <Ionicons name="image-outline" size={28} color="#CAC3D8" />
          </View>
        )}
      </View>

      <Pressable
        accessible
        className="mt-3 h-10 flex-row items-center justify-center rounded-full border border-[#494455] bg-[#1A1C1F]"
        hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
        onPress={onRemove}
        disabled={removing}
        accessibilityRole="button"
        accessibilityLabel={`Remover foto ${photoPosition}`}
        accessibilityHint="A foto sai do seu perfil"
        accessibilityState={{ disabled: removing, busy: removing }}
      >
        {removing ? (
          <ActivityIndicator color="#EAEA00" size="small" />
        ) : (
          <>
            <Ionicons
              name="trash-outline"
              size={16}
              color="#E5E2E1"
              importantForAccessibility="no"
            />
            <Text className="ml-2 text-[13px] font-bold text-white">Remover</Text>
          </>
        )}
      </Pressable>
    </View>
  );
}

function SectionLoadingState({ message }: { message: string }) {
  return (
    <ScreenLoading
      label={message}
      className="items-center justify-center rounded-[22px] border border-[#3A3246] bg-[#17181C] px-5 py-6"
    />
  );
}

export default function Profile() {
  const router = useRouter();
  const { speak } = useTTS();
  const { syncProfileSummary } = useAppShell();
  const { settings } = useAccessibility();
  const reduceMotion = settings.reduceMotion;
  const { canAccessCompletedOnboardingContent } = useRequireCompletedOnboarding();

  const {
    data: profile,
    setData: setProfile,
    error: actionError,
    setError: setActionError,
  } = useAsyncState<UserProfileResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [uploadingTarget, setUploadingTarget] = useState<UploadTarget | null>(null);
  const [removingImageId, setRemovingImageId] = useState<string | null>(null);
  const [sourcePickerTarget, setSourcePickerTarget] = useState<UploadTarget | null>(null);
  const [imageAuthToken, setImageAuthToken] = useState<string | null>(null);

  const galleryImages = profile?.galleryImages ?? [];
  const profilePictureUrl = profileService.resolveProfileImageUrl(profile?.profilePicture?.url);
  const displayName = buildDisplayName(profile);
  const displayAge = buildDisplayAge(profile);
  const accessibilityCards = useMemo(() => buildAccessibilityCards(profile), [profile]);
  const statItems = useMemo(
    () => [
      { label: "Fotos", value: String(galleryImages.length) },
      { label: "Interesses", value: String(profile?.interestTypes.length ?? 0) },
    ],
    [galleryImages.length, profile?.interestTypes.length]
  );

  const loadProfile = useCallback(async (showLoader = false) => {
    if (showLoader) {
      setRefreshing(true);
    }

    try {
      const nextProfile = await profileService.getProfile();
      setProfile(nextProfile);
      syncProfileSummary(nextProfile);
    } catch (nextError) {
      setActionError(formatApiErrorMessage(nextError, "Não foi possível carregar seu perfil."));
    } finally {
      if (showLoader) {
        setRefreshing(false);
      }

      setLoading(false);
    }
  }, [syncProfileSummary]);

  useEffect(() => {
    if (!canAccessCompletedOnboardingContent) {
      return;
    }

    void loadProfile();
  }, [canAccessCompletedOnboardingContent, loadProfile]);

  useEffect(() => {
    let active = true;

    const syncToken = async () => {
      const snapshot = await getAuthSnapshot();

      if (!active) {
        return;
      }

      setImageAuthToken(snapshot.session?.accessToken ?? null);
    };

    void syncToken();

    const unsubscribe = subscribeToAuthStorage((snapshot) => {
      if (!active) {
        return;
      }

      setImageAuthToken(snapshot.session?.accessToken ?? null);
    });

    return () => {
      active = false;
      unsubscribe();
    };
  }, []);

  async function requestImagePermission(source: ImageSource) {
    const permission =
      source === "camera"
        ? await ImagePicker.requestCameraPermissionsAsync()
        : await ImagePicker.requestMediaLibraryPermissionsAsync();

    if (permission.status === ImagePicker.PermissionStatus.GRANTED) {
      return true;
    }

    setActionError(
      source === "camera"
        ? "Permita o acesso à câmera para enviar imagens para o seu perfil."
        : "Permita o acesso à galeria para enviar imagens para o seu perfil."
    );

    return false;
  }

  function openImageSourcePicker(target: UploadTarget) {
    speak(
      target === "profilePicture"
        ? "Atualizar foto de perfil"
        : "Adicionar foto ao carrossel"
    );
    setActionError("");
    setSourcePickerTarget(target);
  }

  function closeImageSourcePicker() {
    if (uploadingTarget !== null) {
      return;
    }

    setSourcePickerTarget(null);
  }

  async function pickAndUploadImage(target: UploadTarget, source: ImageSource) {
    try {
      setActionError("");
      setSourcePickerTarget(null);
      setUploadingTarget(target);

      const hasPermission = await requestImagePermission(source);

      if (!hasPermission) {
        return;
      }

      const pickerOptions: ImagePicker.ImagePickerOptions = {
        mediaTypes: IMAGE_MEDIA_TYPES,
        allowsEditing: target === "profilePicture",
        aspect: target === "profilePicture" ? [1, 1] : undefined,
        quality: 0.8,
        selectionLimit: 1,
      };

      const result =
        source === "camera"
          ? await ImagePicker.launchCameraAsync(pickerOptions)
          : await ImagePicker.launchImageLibraryAsync(pickerOptions);

      if (result.canceled || result.assets.length === 0) {
        return;
      }

      const formData = createImageFormData(result.assets[0]);

      if (target === "profilePicture") {
        await profileService.uploadProfilePicture(formData);
      } else {
        await profileService.uploadGalleryImage(formData);
      }

      await loadProfile(true);

      announceForAccessibility(
        target === "profilePicture"
          ? "Foto de perfil atualizada."
          : "Foto adicionada ao carrossel."
      );
    } catch (nextError) {
      setActionError(
        formatApiErrorMessage(nextError, "Não foi possível enviar a imagem agora.")
      );
    } finally {
      setUploadingTarget(null);
    }
  }

  async function handleDeleteImage(imageId: string) {
    try {
      setActionError("");
      setRemovingImageId(imageId);
      await profileService.deleteProfileImage(imageId);
      await loadProfile(true);

      announceForAccessibility("Foto removida do perfil.");
    } catch (nextError) {
      setActionError(
        formatApiErrorMessage(nextError, "Não foi possível remover a imagem agora.")
      );
    } finally {
      setRemovingImageId(null);
    }
  }

  return (
    <View className="flex-1 bg-[#151515]">
      <SafeAreaView className="flex-1">
        <Modal
          transparent
          animationType={reduceMotion ? "none" : "fade"}
          visible={sourcePickerTarget !== null}
          onRequestClose={closeImageSourcePicker}
        >
          <View
            accessibilityViewIsModal
            importantForAccessibility="yes"
            className="flex-1 justify-end bg-black/65 px-6 pb-8"
          >
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Fechar"
              accessibilityHint="Fecha a escolha da origem da imagem"
              className="absolute bottom-0 left-0 right-0 top-0"
              onPress={closeImageSourcePicker}
            />

            <View className="rounded-[28px] border border-[#393145] bg-surface-alt p-6">
              <Text
                accessibilityRole="header"
                className="text-[21px] font-black text-white"
              >
                {sourcePickerTarget === "profilePicture"
                  ? "Atualizar foto de perfil"
                  : "Adicionar foto ao carrossel"}
              </Text>
              <Text className="mt-2 text-[14px] font-semibold leading-6 text-content-secondary">
                Escolha como deseja enviar a imagem.
              </Text>

              <Pressable
                className="mt-6 h-14 flex-row items-center justify-center rounded-[18px] bg-[#F1EF00]"
                onPress={() => {
                  if (sourcePickerTarget) {
                    speak("Tirar foto");
                    void pickAndUploadImage(sourcePickerTarget, "camera");
                  }
                }}
                disabled={uploadingTarget !== null}
                accessibilityRole="button"
                accessibilityLabel="Tirar foto"
                accessibilityState={{
                  disabled: uploadingTarget !== null,
                  busy: uploadingTarget !== null,
                }}
              >
                <Ionicons
                  name="camera-outline"
                  size={18}
                  color="#212000"
                  importantForAccessibility="no"
                />
                <Text className="ml-2 text-[16px] font-black text-[#212000]">
                  Tirar foto
                </Text>
              </Pressable>

              <Pressable
                className="mt-3 h-14 flex-row items-center justify-center rounded-[18px] border border-[#494455] bg-[#1A1C1F]"
                onPress={() => {
                  if (sourcePickerTarget) {
                    speak("Escolher da galeria");
                    void pickAndUploadImage(sourcePickerTarget, "gallery");
                  }
                }}
                disabled={uploadingTarget !== null}
                accessibilityRole="button"
                accessibilityLabel="Escolher da galeria"
                accessibilityState={{
                  disabled: uploadingTarget !== null,
                  busy: uploadingTarget !== null,
                }}
              >
                <Ionicons
                  name="images-outline"
                  size={18}
                  color="#FFFFFF"
                  importantForAccessibility="no"
                />
                <Text className="ml-2 text-[16px] font-black text-white">
                  Escolher da galeria
                </Text>
              </Pressable>

              <Pressable
                className="mt-3 h-12 items-center justify-center rounded-[18px]"
                onPress={() => {
                  speak("Cancelar");
                  closeImageSourcePicker();
                }}
                disabled={uploadingTarget !== null}
                accessibilityRole="button"
                accessibilityLabel="Cancelar"
                accessibilityState={{
                  disabled: uploadingTarget !== null,
                  busy: uploadingTarget !== null,
                }}
              >
                <Text className="text-[14px] font-bold text-content-secondary">Cancelar</Text>
              </Pressable>
            </View>
          </View>
        </Modal>

        <GlobalTopNav settingsRoute="/profile/edit" />

        <>
          <ScrollView
            className="flex-1"
            contentContainerClassName="px-6 pb-8 pt-6"
            showsVerticalScrollIndicator={false}
          >
            <View className="items-center">
              <View className="relative">
                <View className="h-[148px] w-[148px] items-center justify-center rounded-full border-[4px] border-[#7C4DFF] bg-[#EFEDED] p-1">
                  <View className="h-full w-full overflow-hidden rounded-full bg-[#2D2A33]">
                    {profilePictureUrl ? (
                      <AuthenticatedRemoteImage
                        accessibilityLabel="Sua foto de perfil"
                        uri={profilePictureUrl}
                        authToken={imageAuthToken}
                        className="h-full w-full"
                        resizeMode="cover"
                        fallback={
                          <View className="flex-1 items-center justify-center bg-[#2D2A33]">
                            <Ionicons name="person" size={64} color="#CAC3D8" />
                          </View>
                        }
                      />
                    ) : (
                      <View className="flex-1 items-center justify-center bg-[#2D2A33]">
                        <Ionicons name="person" size={64} color="#CAC3D8" />
                      </View>
                    )}
                  </View>
                </View>

                <Pressable
                  className="absolute bottom-1 right-0 h-12 w-12 items-center justify-center rounded-full border-4 border-[#151515] bg-[#EAEA00]"
                  onPress={() => openImageSourcePicker("profilePicture")}
                  disabled={uploadingTarget !== null}
                  hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                  accessibilityRole="button"
                  accessibilityLabel="Alterar foto de perfil"
                  accessibilityHint="Abre a escolha entre câmera e galeria"
                  accessibilityState={{
                    disabled: uploadingTarget !== null,
                    busy: uploadingTarget === "profilePicture",
                  }}
                >
                  {uploadingTarget === "profilePicture" ? (
                    <ActivityIndicator color="#323200" size="small" />
                  ) : (
                    <Ionicons
                      name="camera-outline"
                      size={22}
                      color="#323200"
                      importantForAccessibility="no"
                    />
                  )}
                </Pressable>
              </View>

              <Pressable
                // Toque no nome rele o resumo do perfil (dados de runtime).
                onPress={() =>
                  speak(
                    joinSpeechParts([
                      joinSpeechParts(
                        [displayName, displayAge ? `${displayAge} anos` : null],
                        ", "
                      ),
                      profile?.bio?.trim() || null,
                    ])
                  )
                }
                accessibilityRole="button"
                accessibilityLabel={displayName}
                accessibilityHint="Repete o resumo do seu perfil em voz alta"
              >
                <Text
                  accessibilityRole="header"
                  className="mt-6 text-center text-[31px] font-extrabold text-white"
                >
                  {loading ? "Carregando perfil..." : `${displayName}${displayAge ? `, ${displayAge}` : ""}`}
                </Text>
              </Pressable>

              {loading ? (
                <View
                  accessible
                  accessibilityRole="progressbar"
                  accessibilityLabel="Buscando seus dados principais"
                  accessibilityState={{ busy: true }}
                  className="mt-4 w-full max-w-[320px] rounded-[22px] border border-[#3A3246] bg-[#17181C] px-5 py-4"
                >
                  <View className="flex-row items-center justify-center">
                    <ActivityIndicator color="#EAEA00" size="small" />
                    <Text className="ml-3 text-center text-[14px] font-semibold text-content-secondary">
                      Buscando seus dados principais...
                    </Text>
                  </View>
                </View>
              ) : (
                <Text className="mt-4 max-w-[320px] text-center text-[16px] font-medium leading-8 text-[#E5E2E1]">
                  {profile?.bio?.trim() || "Adicione uma descrição para que as próximas conexões entendam melhor quem você é."}
                </Text>
              )}
            </View>

            <View className="mt-8">
              <View className="mb-4 flex-row items-center justify-between">
                <Text
                  accessibilityRole="header"
                  className="text-[20px] font-black text-white"
                >
                  Exibição do perfil
                </Text>
                <Text
                  accessibilityLiveRegion="polite"
                  className="text-[13px] font-bold text-content-secondary"
                >
                  {loading ? "Carregando fotos..." : `${galleryImages.length} / 5 fotos ativas`}
                </Text>
              </View>

              {loading ? (
                <SectionLoadingState message="Montando sua galeria e liberando as imagens do perfil..." />
              ) : (
                <ScrollView
                  accessibilityLabel="Carrossel de fotos do perfil"
                  horizontal
                  showsHorizontalScrollIndicator={false}
                >
                  {galleryImages.map((image, index) => (
                    <GalleryImageCard
                      key={image.id}
                      image={image}
                      index={index}
                      authToken={imageAuthToken}
                      removing={removingImageId === image.id}
                      onRemove={() => {
                        speak("Remover foto da galeria");
                        void handleDeleteImage(image.id);
                      }}
                    />
                  ))}

                  {galleryImages.length < 5 ? (
                    <Pressable
                      className="mr-4 h-[172px] w-[132px] items-center justify-center rounded-[24px] border border-dashed border-[#7C4DFF] bg-[#1A1C1F] px-4"
                      onPress={() => openImageSourcePicker("gallery")}
                      disabled={uploadingTarget !== null}
                      accessibilityRole="button"
                      accessibilityLabel="Adicionar foto para match"
                      accessibilityHint={`Você tem ${galleryImages.length} de 5 fotos`}
                      accessibilityState={{
                        disabled: uploadingTarget !== null,
                        busy: uploadingTarget === "gallery",
                      }}
                    >
                      {uploadingTarget === "gallery" ? (
                        <ActivityIndicator color="#EAEA00" />
                      ) : (
                        <>
                          <Ionicons
                            name="add-circle-outline"
                            size={32}
                            color="#EAEA00"
                            importantForAccessibility="no"
                          />
                          <Text className="mt-3 text-center text-[14px] font-bold text-white">
                            Adicionar foto para match
                          </Text>
                        </>
                      )}
                    </Pressable>
                  ) : null}
                </ScrollView>
              )}
            </View>

            {loading ? (
              <View className="mt-8">
                <SectionLoadingState message="Calculando seus indicadores de perfil..." />
              </View>
            ) : (
              <View className="mt-8 flex-row overflow-hidden rounded-[26px] border border-[#68598C] bg-[#262228]">
                {statItems.map((item, index) => (
                  <View key={item.label} className={`flex-1 px-6 py-5 ${index === 0 ? "border-r border-[#4D4656]" : ""}`}>
                    <Text className="text-center text-[18px] font-black text-[#D7C3FF]">{item.value}</Text>
                    <Text className="mt-1 text-center text-[14px] font-bold text-white">{item.label}</Text>
                  </View>
                ))}
              </View>
            )}

            <View className="mt-6 flex-row items-center justify-center gap-3">
              {PROFILE_ACTIONS.map((action) => (
                <ProfileActionButton
                  key={action.route}
                  action={action}
                  onPress={() => {
                    speak(action.label);
                    router.push(action.route);
                  }}
                />
              ))}
            </View>

            {actionError ? (
              <View accessibilityRole="alert">
                <ScreenError
                  className="mt-5 items-center rounded-2xl bg-transparent px-0 py-0"
                  title="Não foi possível concluir a ação"
                  message={actionError}
                />
              </View>
            ) : null}

            {refreshing ? (
              <ScreenLoading
                label="Atualizando perfil..."
                className="mt-5 flex-row items-center justify-center"
              />
            ) : null}

            <View className="mt-10">
              <View className="mb-4 flex-row items-center">
                <Ionicons
                  name="body-outline"
                  size={22}
                  color="#D6C5FF"
                  importantForAccessibility="no"
                />
                <Text
                  accessibilityRole="header"
                  className="ml-3 text-[20px] font-black text-white"
                >
                  Acessibilidade
                </Text>
              </View>

              {loading ? (
                <SectionLoadingState message="Carregando os detalhes de acessibilidade do seu perfil..." />
              ) : (
                accessibilityCards.map((card) => (
                  <Pressable
                    key={card.key}
                    className="mb-3 rounded-[22px] border border-[#8D74C8] bg-[#2A272D] p-4"
                    // Fala o conteudo real do card (deficiencias do perfil).
                    onPress={() => speak(joinSpeechParts([card.title, card.subtitle]))}
                    accessibilityRole="button"
                    accessibilityLabel={`${card.title}. ${card.subtitle}`}
                  >
                    <View className="flex-row items-center justify-between">
                      <View className="flex-row flex-1 items-center">
                        <View className="h-12 w-12 items-center justify-center rounded-2xl bg-[#7C4DFF]">
                          <Ionicons
                            name={card.icon}
                            size={22}
                            color="#FFFFFF"
                            importantForAccessibility="no"
                          />
                        </View>

                        <View className="ml-4 flex-1">
                          <Text className="text-[18px] font-black text-white">{card.title}</Text>
                          <Text className="mt-1 text-[14px] font-semibold leading-5 text-content-secondary">
                            {card.subtitle}
                          </Text>
                        </View>
                      </View>

                      <Ionicons
                        name="checkmark-circle"
                        size={22}
                        color="#D9C9FF"
                        importantForAccessibility="no"
                      />
                    </View>
                  </Pressable>
                ))
              )}
            </View>

            <Pressable
              className="mt-8 rounded-[28px] bg-surface-alt p-6"
              // Fala formas de comunicacao e interesses reais do perfil.
              onPress={() =>
                speak(
                  joinSpeechParts([
                    joinSpeechParts(
                      [
                        "Comunicação",
                        joinDescriptions(
                          profile?.communicationForms ?? [],
                          "nenhuma forma cadastrada"
                        ).replaceAll(" • ", ", "),
                      ],
                      ": "
                    ),
                    joinSpeechParts(
                      [
                        "Interesses",
                        joinDescriptions(
                          profile?.interestTypes ?? [],
                          "nenhum interesse cadastrado"
                        ).replaceAll(" • ", ", "),
                      ],
                      ": "
                    ),
                  ])
                )
              }
              accessibilityRole="button"
              accessibilityLabel="Comunicação e interesses"
            >
              <Text
                accessibilityRole="header"
                className="text-[18px] font-black text-white"
              >
                Comunicação
              </Text>
              <Text className="mt-3 text-[15px] font-semibold leading-6 text-content-secondary">
                {loading
                  ? "Carregando suas formas de comunicação..."
                  : joinDescriptions(
                      profile?.communicationForms ?? [],
                      "Adicione formas de comunicação no modo de edição para mostrar como você prefere interagir."
                    )}
              </Text>

              <Text
                accessibilityRole="header"
                className="mt-6 text-[18px] font-black text-white"
              >
                Interesses
              </Text>
              <Text className="mt-3 text-[15px] font-semibold leading-6 text-content-secondary">
                {loading
                  ? "Carregando seus interesses e hobbies..."
                  : joinDescriptions(
                      profile?.interestTypes ?? [],
                      "Adicione interesses e hobbies para enriquecer sua apresentação."
                    )}
              </Text>
            </Pressable>
          </ScrollView>

          <GlobalBottomNav />
        </>
      </SafeAreaView>
    </View>
  );
}