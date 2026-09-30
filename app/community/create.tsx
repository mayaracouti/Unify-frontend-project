import { useCommunityPost } from "../../src/hooks/use-community-post";
import { useAppShell } from "../../src/context/AppShellContext";
import { isCommunityAuthor } from "../../src/utils/communityPermissions";
import { buildCommunityPostFormData } from "../../src/utils/communityFormData";
import { useCommunityAccess } from "../../src/hooks/use-community-access";
import { canParticipate } from "../../src/utils/communityPermissions";
import { ScreenError } from "../../src/components/ui/screen-error";
import { goBackOrReplace } from "../../src/utils/navigation";
import * as ImagePicker from "expo-image-picker";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Image,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";
import { SafeAreaView } from "react-native-safe-area-context";

import { useTTS } from "../../src/accessibility/tts";
import { ActionSheet } from "../../src/components/ui/action-sheet";
import { useScreenHeadingFocus } from "../../src/hooks/use-screen-heading-focus";
import { communityService } from "../../src/services/communityService";
import {
  accessibilityAnnouncements,
  announceForAccessibility,
} from "../../src/utils/accessibilityAnnouncements";
import { showGlobalToast } from "../../src/utils/globalToast";

const IMAGE_MEDIA_TYPES: ImagePicker.MediaType[] = ["images"];

type ImageSource = "camera" | "library";

function normalizeRouteParam(value?: string | string[]) {
  if (Array.isArray(value)) {
    return value[0] ?? "";
  }

  return value ?? "";
}

export default function CommunityCreatePostScreen() {
  const router = useRouter();
  const { speak } = useTTS();
  // `postId` + `body` presentes = modo edicao (so do texto).
  const params = useLocalSearchParams<{
    communityId?: string | string[];
    postId?: string | string[];
    body?: string | string[];
  }>();

  // Ao entrar na tela, o leitor de tela do sistema comeca pelo titulo.
  const headingRef = useScreenHeadingFocus<Text>();

  const communityId = useMemo(
    () => normalizeRouteParam(params.communityId).trim(),
    [params.communityId]
  );
  const editingPostId = useMemo(
    () => normalizeRouteParam(params.postId).trim() || null,
    [params.postId]
  );
  const access = useCommunityAccess(communityId);
  const isEditing = editingPostId !== null;
  const postContext = useCommunityPost(editingPostId ?? "");
  const { currentUserId, currentUserProfileId } = useAppShell();
  const submitLock = useRef(false);
  const canEdit = Boolean(postContext.data && postContext.community?.id === communityId &&
    isCommunityAuthor(postContext.data.post.author, currentUserId, currentUserProfileId));
  const [body, setBody] = useState(() =>
    isEditing ? normalizeRouteParam(params.body) : ""
  );
  const [selectedImage, setSelectedImage] = useState<ImagePicker.ImagePickerAsset | null>(
    null
  );
  const [imageSourceVisible, setImageSourceVisible] = useState(false);
  const [pickingImage, setPickingImage] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (postContext.data) setBody(postContext.data.post.body);
  }, [postContext.data]);

  const trimmedBody = useMemo(() => body.trim(), [body]);

  const handlePickImage = useCallback(
    async (source: ImageSource) => {
      setImageSourceVisible(false);

      if (pickingImage) {
        return;
      }

      setPickingImage(true);

      try {
        const permission =
          source === "camera"
            ? await ImagePicker.requestCameraPermissionsAsync()
            : await ImagePicker.requestMediaLibraryPermissionsAsync();

        if (!permission.granted) {
          showGlobalToast({
            title: source === "camera" ? "Câmera bloqueada" : "Galeria bloqueada",
            variant: "warning",
            message:
              source === "camera"
                ? "Autorize o uso da câmera nos ajustes do celular para tirar fotos."
                : "Libere o acesso à galeria para anexar uma imagem ao post.",
          });
          return;
        }

        // Sem `aspect`: o corte fica livre para a pessoa enquadrar como quiser.
        const pickerOptions: ImagePicker.ImagePickerOptions = {
          mediaTypes: IMAGE_MEDIA_TYPES,
          allowsEditing: true,
          quality: 0.8,
        };

        const pickerResult =
          source === "camera"
            ? await ImagePicker.launchCameraAsync(pickerOptions)
            : await ImagePicker.launchImageLibraryAsync(pickerOptions);

        if (!pickerResult.canceled) {
          setSelectedImage(pickerResult.assets[0] ?? null);
        }
      } catch {
        showGlobalToast({
          title:
            source === "camera" ? "Falha ao abrir a câmera" : "Falha ao abrir a galeria",
          variant: "error",
          message: "Não foi possível selecionar uma imagem agora.",
        });
      } finally {
        setPickingImage(false);
      }
    },
    [pickingImage]
  );

  const handleSubmit = useCallback(async () => {
    if (submitLock.current || pickingImage || access.loading || !canParticipate(access.community) || (isEditing && !canEdit)) {
      return;
    }

    if (!communityId) {
      showGlobalToast({
        title: "Comunidade não encontrada",
        variant: "warning",
        message: "Abra uma comunidade antes de tentar publicar.",
      });
      router.replace("/community");
      return;
    }

    if (trimmedBody.length === 0) {
      showGlobalToast({
        title: "Texto obrigatório",
        variant: "warning",
        message: "Escreva algo antes de publicar.",
      });
      return;
    }

    submitLock.current = true;
    setSubmitting(true);

    try {
      if (editingPostId) {
        await communityService.updatePost(editingPostId, { body: trimmedBody });

        showGlobalToast({
          title: "Publicação atualizada",
          variant: "success",
          message: "O novo texto já está visível na comunidade.",
        });
        announceForAccessibility("Publicação atualizada.");
        router.replace({
          pathname: "/community/[communityId]",
          params: { communityId },
        });
        return;
      }

      const formData = await buildCommunityPostFormData(trimmedBody, selectedImage);
      await communityService.createPost(communityId, formData);

      showGlobalToast({
        title: "Publicação criada",
        variant: "success",
        message: "Seu post já está visível na comunidade.",
      });
      announceForAccessibility(accessibilityAnnouncements.communityPostCreated());
      router.replace({
        pathname: "/community/[communityId]",
        params: { communityId },
      });
    } catch (error) {
      if (error instanceof Error) showGlobalToast({ title: "Não foi possível salvar", variant: "error", message: error.message || "Tente novamente. Seu texto foi mantido." });
      // HTTP errors already use the global API toast.
    } finally {
      submitLock.current = false;
      setSubmitting(false);
    }
  }, [access.community, access.loading, canEdit, isEditing, pickingImage, communityId, editingPostId, router, selectedImage, trimmedBody]);

  if (isEditing && postContext.error) return <ScreenError message={postContext.error} onRetry={() => void postContext.reload()} />;
  if (isEditing && !postContext.loading && !canEdit) return <ScreenError message="Somente o autor pode editar esta publicação." />;
  if (access.error) return <ScreenError message={access.error} onRetry={() => void access.reload()} />;
  if (access.loading || (isEditing && postContext.loading)) return <View className="flex-1 items-center justify-center bg-[#09090A]"><ActivityIndicator color="#7C4DFF" /></View>;
  if (!canParticipate(access.community)) return <ScreenError message="Entre na comunidade para publicar." onRetry={() => router.replace({ pathname: "/community/[communityId]", params: { communityId } })} />;

  const submitLabel = isEditing ? "Salvar" : "Publicar na comunidade";

  return (
    <View className="flex-1 bg-[#09090A]">
      <SafeAreaView className="flex-1 bg-[#09090A]">
        <KeyboardAvoidingView
          className="flex-1"
          behavior={Platform.OS === "ios" ? "padding" : undefined}
        >
          <View className="h-16 flex-row items-center justify-between border-b border-[#2A2A2A] px-6">
            <View className="flex-row items-center">
              <Pressable
                className="mr-3 h-10 w-10 items-center justify-center rounded-full"
                // 40dp visuais + hitSlop = area de toque de 48dp.
                hitSlop={{ top: 4, bottom: 4, left: 4, right: 4 }}
                onPress={() => {
                  speak("Voltar");
                  goBackOrReplace(router, "/community");
                }}
                accessibilityRole="button"
                accessibilityLabel="Voltar"
                accessibilityHint="Sai da publicação sem salvar o texto digitado."
              >
                <Ionicons name="arrow-back" size={24} color="#E5E2E1" />
              </Pressable>
              <Text className="text-2xl font-black text-[#7C4DFF]">Unify</Text>
            </View>

            <Pressable
              className={`min-h-[44px] justify-center rounded-full px-4 py-2 ${
                trimmedBody.length > 0 && !submitting ? "bg-[#EAEA00]" : "bg-[#3B3841]"
              }`}
              onPress={() => {
                speak(submitLabel);
                void handleSubmit();
              }}
              disabled={trimmedBody.length === 0 || submitting || pickingImage}
              accessibilityRole="button"
              accessibilityLabel={submitLabel}
              accessibilityHint={
                isEditing
                  ? "Salva o novo texto da publicação na comunidade."
                  : "Envia o texto e a imagem para o mural da comunidade."
              }
              accessibilityState={{
                disabled: trimmedBody.length === 0 || submitting || pickingImage,
                busy: submitting,
              }}
            >
              {submitting ? (
                <ActivityIndicator color="#1D1D00" size="small" />
              ) : (
                <Text className="text-[14px] font-black text-[#1D1D00]">
                  {isEditing ? "Salvar" : "Publicar"}
                </Text>
              )}
            </Pressable>
          </View>

          <ScrollView
            className="flex-1"
            contentContainerClassName="mx-auto w-full max-w-[720px] px-6 pb-10 pt-8"
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            <View className="rounded-[28px] bg-[#111214] p-6">
              <Text
                ref={headingRef}
                accessibilityRole="header"
                className="text-[30px] font-extrabold leading-10 text-white"
              >
                {isEditing ? "Editar publicação" : "Compartilhe algo com a comunidade"}
              </Text>
              <Text className="mt-2 text-[15px] font-semibold leading-6 text-[#CAC3D8]">
                {isEditing
                  ? "Altere o texto da publicação. A imagem anexada continua a mesma."
                  : "Publique uma atualização rápida, tire uma foto ou anexe uma imagem da galeria."}
              </Text>
            </View>

            <View className="mt-6 rounded-[28px] bg-[#111214] p-6">
              <Text className="mb-3 text-[22px] font-bold text-white">Seu texto</Text>
              <TextInput
                className="min-h-[180px] rounded-2xl border-2 border-[#494455] bg-[#1C1B1B] px-4 py-4 text-[16px] leading-7 text-white"
                multiline
                maxLength={600}
                placeholder="O que você quer compartilhar hoje?"
                placeholderTextColor="#948EA1"
                textAlignVertical="top"
                editable={!submitting}
                value={body}
                onChangeText={setBody}
                onFocus={() => speak("Texto da publicação")}
                accessibilityLabel="Texto da publicação"
                accessibilityHint="Obrigatório. Escreva o texto da publicação"
              />
              <Text className="mt-2 text-right text-[12px] font-semibold text-[#948EA1]">
                {body.length} / 600
              </Text>
            </View>

            {/* Edicao e so de texto: a secao de imagem nao aparece. */}
            {isEditing ? null : (
              <View className="mt-6 rounded-[28px] bg-[#111214] p-6">
                <View className="flex-row items-center justify-between">
                  <View className="mr-3 flex-1">
                    <Text
                      className="text-[22px] font-bold text-white"
                      accessibilityRole="header"
                    >
                      Imagem opcional
                    </Text>
                  </View>

                  <Pressable
                    className="rounded-full border border-[#494455] bg-[#1A1C1F] px-4 py-3"
                    onPress={() => {
                      speak(
                        selectedImage
                          ? "Trocar imagem da publicação"
                          : "Adicionar imagem à publicação"
                      );
                      setImageSourceVisible(true);
                    }}
                    disabled={pickingImage}
                    accessibilityRole="button"
                    accessibilityLabel={
                      selectedImage
                        ? "Trocar imagem da publicação"
                        : "Adicionar imagem à publicação"
                    }
                    accessibilityHint="Escolhe entre tirar uma foto ou abrir a galeria do aparelho"
                    accessibilityState={{
                      disabled: pickingImage,
                      busy: pickingImage,
                    }}
                  >
                    {pickingImage ? (
                      <ActivityIndicator color="#EAEA00" size="small" />
                    ) : (
                      <View className="flex-row items-center">
                        <Ionicons
                          name="image-outline"
                          size={18}
                          color="#E5E2E1"
                          importantForAccessibility="no"
                        />
                        <Text className="ml-2 text-[14px] font-bold text-white">
                          {selectedImage ? "Trocar" : "Selecionar"}
                        </Text>
                      </View>
                    )}
                  </Pressable>
                </View>

                {selectedImage ? (
                  <View className="mt-5 overflow-hidden rounded-[24px] border border-[#353534] bg-[#1A1C1F]">
                    <Image
                      source={{ uri: selectedImage.uri }}
                      className="aspect-video w-full"
                      resizeMode="cover"
                      accessibilityLabel="Pré-visualização da imagem selecionada"
                    />
                    <View className="flex-row items-center justify-between px-4 py-4">
                      <Text className="flex-1 text-[13px] font-semibold text-[#CAC3D8]">
                        {selectedImage.fileName ?? "Imagem selecionada"}
                      </Text>
                      <Pressable
                        className="min-h-[44px] justify-center pl-3"
                        onPress={() => {
                          speak("Imagem removida");
                          setSelectedImage(null);
                        }}
                        // `disabled` real acompanha o accessibilityState abaixo.
                        disabled={submitting}
                        accessibilityRole="button"
                        accessibilityLabel="Remover imagem"
                        accessibilityHint="Descarta a imagem anexada. O texto da publicação continua."
                        accessibilityState={{ disabled: submitting }}
                      >
                        <Text className="text-[14px] font-bold text-[#FF8A8A]">
                          Remover
                        </Text>
                      </Pressable>
                    </View>
                  </View>
                ) : (
                  <View className="mt-5 rounded-[24px] border border-dashed border-[#494455] bg-[#151619] px-5 py-8">
                    <Ionicons name="images-outline" size={32} color="#7C4DFF" />
                    <Text className="mt-4 text-[16px] font-bold text-white">
                      Nenhuma imagem selecionada
                    </Text>
                    <Text className="mt-2 text-[14px] font-semibold leading-6 text-[#CAC3D8]">
                      Você pode publicar apenas com texto, tirar uma foto ou anexar uma
                      imagem da galeria.
                    </Text>
                  </View>
                )}
              </View>
            )}
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>

      <ActionSheet
        onClose={() => setImageSourceVisible(false)}
        options={[
          {
            key: "camera",
            label: "Tirar foto",
            hint: "Abre a câmera do celular",
            icon: "camera-outline",
            onPress: () => {
              speak("Tirar foto");
              void handlePickImage("camera");
            },
          },
          {
            key: "library",
            label: "Escolher da galeria",
            hint: "Abre as fotos salvas no celular",
            icon: "images-outline",
            onPress: () => {
              speak("Escolher da galeria");
              void handlePickImage("library");
            },
          },
        ]}
        title={selectedImage ? "Trocar imagem" : "Adicionar imagem"}
        visible={imageSourceVisible}
      />
    </View>
  );
}
