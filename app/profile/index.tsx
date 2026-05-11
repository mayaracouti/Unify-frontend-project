import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import {
  ActivityIndicator,
  Image,
  type ImageProps,
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

import { GlobalBottomNav } from "../../src/components/navigation/global-bottom-nav";
import { useRequireCompletedOnboarding } from "../../src/hooks/useRequireCompletedOnboarding";
import { profileService } from "../../src/services/profileService";
import { getAuthSnapshot, subscribeToAuthStorage } from "../../src/storage/tokenStorage";
import type {
  DisabilityOptionResponse,
  LookupOptionResponse,
  UserProfileImageResponse,
  UserProfileResponse,
} from "../../src/types/profile";
import { formatApiErrorMessage } from "../../src/utils/auth";

type UploadTarget = "profilePicture" | "gallery";
type ImageSource = "camera" | "gallery";

const IMAGE_MEDIA_TYPES: ImagePicker.MediaType[] = ["images"];

function isIoniconName(
  value?: string | null
): value is keyof typeof Ionicons.glyphMap {
  return typeof value === "string" && value in Ionicons.glyphMap;
}

function AuthenticatedRemoteImage({
  uri,
  authToken,
  className,
  resizeMode = "cover",
  fallback,
}: {
  uri: string;
  authToken: string | null;
  className: string;
  resizeMode?: ImageProps["resizeMode"];
  fallback: ReactNode;
}) {
  const [resolvedUri, setResolvedUri] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [hasLoadError, setHasLoadError] = useState(false);

  async function blobToDataUri(blob: Blob): Promise<string> {
    return await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();

      reader.onloadend = () => {
        if (typeof reader.result === "string") {
          resolve(reader.result);
          return;
        }

        reject(new Error("Unable to convert image blob to data URI."));
      };

      reader.onerror = () => {
        reject(reader.error ?? new Error("Unable to read image blob."));
      };

      reader.readAsDataURL(blob);
    });
  }

  useEffect(() => {
    let disposed = false;

    const loadImage = async () => {
      setIsLoading(true);
      setHasLoadError(false);
      setResolvedUri(null);

      const attempts = authToken
        ? [{ Authorization: `Bearer ${authToken}` }, undefined]
        : [undefined];

      for (const headers of attempts) {
        const response = await fetch(uri, headers ? { headers } : undefined);

        if (!response.ok) {
          continue;
        }

        const imageBlob = await response.blob();
        const dataUri = await blobToDataUri(imageBlob);

        if (!disposed) {
          setResolvedUri(dataUri);
          setIsLoading(false);
        }

        return;
      }

      throw new Error("Image request did not return a successful response.");
    };

    void loadImage().catch(() => {
      if (!disposed) {
        setHasLoadError(true);
        setIsLoading(false);
      }
    });

    return () => {
      disposed = true;
    };
  }, [authToken, uri]);

  if (isLoading) {
    return (
      <View className="flex-1 items-center justify-center bg-[#2D2A33]">
        <ActivityIndicator color="#EAEA00" size="small" />
      </View>
    );
  }

  if (hasLoadError || !resolvedUri) {
    return <>{fallback}</>;
  }

  return (
    <Image
      source={{ uri: resolvedUri }}
      className={className}
      resizeMode={resizeMode}
      onError={() => {
        setHasLoadError(true);
      }}
    />
  );
}

function buildDisplayName(profile: UserProfileResponse | null): string {
  const firstName = profile?.user?.name ?? profile?.name;
  const lastName = profile?.user?.lastName ?? profile?.lastName;
  const fullName = [firstName, lastName].filter(Boolean).join(" ").trim();

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
  authToken,
  removing,
  onRemove,
}: {
  image: UserProfileImageResponse;
  authToken: string | null;
  removing: boolean;
  onRemove: () => void;
}) {
  const imageUrl = profileService.resolveProfileImageUrl(image.url);

  return (
    <View className="mr-4 w-[132px]">
      <View className="h-[172px] overflow-hidden rounded-[24px] bg-[#262626]">
        {imageUrl ? (
          <AuthenticatedRemoteImage
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
        className="mt-3 h-10 flex-row items-center justify-center rounded-full border border-[#494455] bg-[#1A1C1F]"
        onPress={onRemove}
        disabled={removing}
      >
        {removing ? (
          <ActivityIndicator color="#EAEA00" size="small" />
        ) : (
          <>
            <Ionicons name="trash-outline" size={16} color="#E5E2E1" />
            <Text className="ml-2 text-[13px] font-bold text-white">Remover</Text>
          </>
        )}
      </Pressable>
    </View>
  );
}

function SectionLoadingState({ message }: { message: string }) {
  return (
    <View className="items-center justify-center rounded-[22px] border border-[#3A3246] bg-[#17181C] px-5 py-6">
      <ActivityIndicator color="#EAEA00" size="small" />
      <Text className="mt-3 text-center text-[14px] font-semibold text-[#CAC3D8]">
        {message}
      </Text>
    </View>
  );
}

export default function Profile() {
  const router = useRouter();
  useRequireCompletedOnboarding();

  const [profile, setProfile] = useState<UserProfileResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [actionError, setActionError] = useState("");
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
    } catch (nextError) {
      setActionError(formatApiErrorMessage(nextError, "Não foi possível carregar seu perfil."));
    } finally {
      if (showLoader) {
        setRefreshing(false);
      }

      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadProfile();
  }, [loadProfile]);

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
          animationType="fade"
          visible={sourcePickerTarget !== null}
          onRequestClose={closeImageSourcePicker}
        >
          <View className="flex-1 justify-end bg-black/65 px-6 pb-8">
            <Pressable
              className="absolute bottom-0 left-0 right-0 top-0"
              onPress={closeImageSourcePicker}
            />

            <View className="rounded-[28px] border border-[#393145] bg-[#111214] p-6">
              <Text className="text-[21px] font-black text-white">
                {sourcePickerTarget === "profilePicture"
                  ? "Atualizar foto de perfil"
                  : "Adicionar foto ao carrossel"}
              </Text>
              <Text className="mt-2 text-[14px] font-semibold leading-6 text-[#CAC3D8]">
                Escolha como deseja enviar a imagem.
              </Text>

              <Pressable
                className="mt-6 h-14 flex-row items-center justify-center rounded-[18px] bg-[#F1EF00]"
                onPress={() =>
                  sourcePickerTarget
                    ? void pickAndUploadImage(sourcePickerTarget, "camera")
                    : undefined
                }
                disabled={uploadingTarget !== null}
              >
                <Ionicons name="camera-outline" size={18} color="#212000" />
                <Text className="ml-2 text-[16px] font-black text-[#212000]">
                  Tirar foto
                </Text>
              </Pressable>

              <Pressable
                className="mt-3 h-14 flex-row items-center justify-center rounded-[18px] border border-[#494455] bg-[#1A1C1F]"
                onPress={() =>
                  sourcePickerTarget
                    ? void pickAndUploadImage(sourcePickerTarget, "gallery")
                    : undefined
                }
                disabled={uploadingTarget !== null}
              >
                <Ionicons name="images-outline" size={18} color="#FFFFFF" />
                <Text className="ml-2 text-[16px] font-black text-white">
                  Escolher da galeria
                </Text>
              </Pressable>

              <Pressable
                className="mt-3 h-12 items-center justify-center rounded-[18px]"
                onPress={closeImageSourcePicker}
                disabled={uploadingTarget !== null}
              >
                <Text className="text-[14px] font-bold text-[#CAC3D8]">Cancelar</Text>
              </Pressable>
            </View>
          </View>
        </Modal>

        <View className="h-16 flex-row items-center justify-between border-b border-[#262037] bg-[#090B18] px-6">
          <Pressable className="h-10 w-10 items-center justify-center rounded-full" onPress={() => router.replace("/home")}>
            <Ionicons name="menu-outline" size={24} color="#A270FF" />
          </Pressable>

          <Text className="text-[26px] font-black tracking-[2px] text-[#7C4DFF]">UNIFY</Text>

          <Pressable className="h-10 w-10 items-center justify-center rounded-full" onPress={() => router.push("/profile/edit")}> 
            <Ionicons name="settings-outline" size={24} color="#A270FF" />
          </Pressable>
        </View>

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
                >
                  {uploadingTarget === "profilePicture" ? (
                    <ActivityIndicator color="#323200" size="small" />
                  ) : (
                    <Ionicons name="camera-outline" size={22} color="#323200" />
                  )}
                </Pressable>
              </View>

              <Text className="mt-6 text-center text-[31px] font-extrabold text-white">
                {loading ? "Carregando perfil..." : `${displayName}${displayAge ? `, ${displayAge}` : ""}`}
              </Text>

              {loading ? (
                <View className="mt-4 w-full max-w-[320px] rounded-[22px] border border-[#3A3246] bg-[#17181C] px-5 py-4">
                  <View className="flex-row items-center justify-center">
                    <ActivityIndicator color="#EAEA00" size="small" />
                    <Text className="ml-3 text-center text-[14px] font-semibold text-[#CAC3D8]">
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
                <Text className="text-[20px] font-black text-white">Exibição do perfil</Text>
                <Text className="text-[13px] font-bold text-[#CAC3D8]">
                  {loading ? "Carregando fotos..." : `${galleryImages.length} / 5 fotos ativas`}
                </Text>
              </View>

              {loading ? (
                <SectionLoadingState message="Montando sua galeria e liberando as imagens do perfil..." />
              ) : (
                <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                  {galleryImages.map((image) => (
                    <GalleryImageCard
                      key={image.id}
                      image={image}
                      authToken={imageAuthToken}
                      removing={removingImageId === image.id}
                      onRemove={() => handleDeleteImage(image.id)}
                    />
                  ))}

                  {galleryImages.length < 5 ? (
                    <Pressable
                      className="mr-4 h-[172px] w-[132px] items-center justify-center rounded-[24px] border border-dashed border-[#7C4DFF] bg-[#1A1C1F] px-4"
                      onPress={() => openImageSourcePicker("gallery")}
                      disabled={uploadingTarget !== null}
                    >
                      {uploadingTarget === "gallery" ? (
                        <ActivityIndicator color="#EAEA00" />
                      ) : (
                        <>
                          <Ionicons name="add-circle-outline" size={32} color="#EAEA00" />
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

            <Pressable
              className="mt-6 h-14 flex-row items-center justify-center rounded-[18px] bg-[#F1EF00]"
              onPress={() => router.push("/profile/edit")}
            >
              <Ionicons name="create-outline" size={18} color="#212000" />
              <Text className="ml-2 text-[17px] font-black text-[#212000]">
                Editar Perfil
              </Text>
            </Pressable>

            <Pressable
              className="mt-3 h-14 flex-row items-center justify-center rounded-[18px] border border-[#494455] bg-[#1A1C1F]"
              onPress={() => router.push("/profile/edit-match-preferences")}
            >
              <Ionicons name="options-outline" size={18} color="#FFFFFF" />
              <Text className="ml-2 text-[16px] font-black text-white">
                Editar preferências de match
              </Text>
            </Pressable>

            {actionError ? (
              <Text className="mt-5 text-center text-[13px] font-semibold text-red-300">
                {actionError}
              </Text>
            ) : null}

            {refreshing ? (
              <View className="mt-5 flex-row items-center justify-center">
                <ActivityIndicator color="#EAEA00" size="small" />
                <Text className="ml-2 text-[13px] font-semibold text-[#CAC3D8]">
                  Atualizando perfil...
                </Text>
              </View>
            ) : null}

            <View className="mt-10">
              <View className="mb-4 flex-row items-center">
                <Ionicons name="body-outline" size={22} color="#D6C5FF" />
                <Text className="ml-3 text-[20px] font-black text-white">Acessibilidade</Text>
              </View>

              {loading ? (
                <SectionLoadingState message="Carregando os detalhes de acessibilidade do seu perfil..." />
              ) : (
                accessibilityCards.map((card) => (
                  <View key={card.key} className="mb-3 rounded-[22px] border border-[#8D74C8] bg-[#2A272D] p-4">
                    <View className="flex-row items-center justify-between">
                      <View className="flex-row flex-1 items-center">
                        <View className="h-12 w-12 items-center justify-center rounded-2xl bg-[#7C4DFF]">
                          <Ionicons name={card.icon} size={22} color="#FFFFFF" />
                        </View>

                        <View className="ml-4 flex-1">
                          <Text className="text-[18px] font-black text-white">{card.title}</Text>
                          <Text className="mt-1 text-[14px] font-semibold leading-5 text-[#CAC3D8]">
                            {card.subtitle}
                          </Text>
                        </View>
                      </View>

                      <Ionicons name="checkmark-circle" size={22} color="#D9C9FF" />
                    </View>
                  </View>
                ))
              )}
            </View>

            <View className="mt-8 rounded-[28px] bg-[#111214] p-6">
              <Text className="text-[18px] font-black text-white">Comunicação</Text>
              <Text className="mt-3 text-[15px] font-semibold leading-6 text-[#CAC3D8]">
                {loading
                  ? "Carregando suas formas de comunicação..."
                  : joinDescriptions(
                      profile?.communicationForms ?? [],
                      "Adicione formas de comunicação no modo de edição para mostrar como você prefere interagir."
                    )}
              </Text>

              <Text className="mt-6 text-[18px] font-black text-white">Interesses</Text>
              <Text className="mt-3 text-[15px] font-semibold leading-6 text-[#CAC3D8]">
                {loading
                  ? "Carregando seus interesses e hobbies..."
                  : joinDescriptions(
                      profile?.interestTypes ?? [],
                      "Adicione interesses e hobbies para enriquecer sua apresentação."
                    )}
              </Text>
            </View>
          </ScrollView>

          <GlobalBottomNav />
        </>
      </SafeAreaView>
    </View>
  );
}