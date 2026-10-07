import * as ImagePicker from "expo-image-picker";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useCallback, useMemo, useState } from "react";
import {
  ActivityIndicator,
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
import { useAuth } from "../../src/context/AuthContext";
import { useCommunityPostEditor } from "../../src/hooks/use-community-post-editor";
import { PostImage } from "../../src/components/community/post/post-image";
import { ScreenError } from "../../src/components/ui/screen-error";
import { ScreenLoading } from "../../src/components/ui/screen-loading";
import { IMAGE_DESCRIPTION_MAX_LENGTH } from "../../src/community/post-draft";
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
  // Editing loads the current post by id, including image and description.
  const params = useLocalSearchParams<{
    communityId?: string | string[];
    postId?: string | string[];
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
  const isEditing = editingPostId !== null;
  const editor = useCommunityPostEditor(editingPostId);
  const { session } = useAuth();
  const { body, image: selectedImage, imageDescription } = editor.draft;
  const { setBody, submitting } = editor;
  const previewUri = selectedImage?.uri ?? (!editor.draft.removeImage ? communityService.resolveAssetUrl(editor.draft.existingMedia) : null);
  const [imageSourceVisible, setImageSourceVisible] = useState(false);
  const [pickingImage, setPickingImage] = useState(false);
  const unavailable = submitting || editor.loading || Boolean(editor.loadError);

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
          const image = pickerResult.assets[0];
          if (image) editor.selectImage(image);
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
    [editor, pickingImage]
  );

  const handleSubmit = useCallback(async () => {
    if (unavailable) {
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

    try {
      if (editingPostId) {
        if (!await editor.save(communityId)) return;

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

      if (!await editor.save(communityId)) return;

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
    } catch {
      // Global API error toast already explains the failure.
    }
  }, [communityId, editingPostId, editor, router, unavailable, trimmedBody]);

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
                  router.back();
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
                trimmedBody.length > 0 && !unavailable ? "bg-[#EAEA00]" : "bg-[#3B3841]"
              }`}
              onPress={() => {
                speak(submitLabel);
                void handleSubmit();
              }}
              disabled={trimmedBody.length === 0 || unavailable}
              accessibilityRole="button"
              accessibilityLabel={submitLabel}
              accessibilityHint={
                isEditing
                  ? "Salva o texto, a imagem e sua descrição na comunidade."
                  : "Envia o texto e a imagem para o mural da comunidade."
              }
              accessibilityState={{
                disabled: trimmedBody.length === 0 || unavailable,
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
            {editor.loading ? <ScreenLoading label="Carregando publicação..." /> : null}
            {editor.loadError ? <ScreenError message={editor.loadError} onRetry={() => { void editor.reload(); }} /> : null}
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
                  ? "Altere o texto, a descrição ou a imagem da publicação."
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
                value={body}
                onChangeText={setBody}
                editable={!unavailable}
                onFocus={() => speak("Texto da publicação")}
                accessibilityLabel="Texto da publicação"
                accessibilityHint="Obrigatório. Escreva o texto da publicação"
              />
              <Text className="mt-2 text-right text-[12px] font-semibold text-[#948EA1]">
                {body.length} / 600
              </Text>
            </View>

            {(
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
                        editor.hasImage
                          ? "Trocar imagem da publicação"
                          : "Adicionar imagem à publicação"
                      );
                      setImageSourceVisible(true);
                    }}
                    disabled={pickingImage || unavailable}
                    accessibilityRole="button"
                    accessibilityLabel={
                      editor.hasImage
                        ? "Trocar imagem da publicação"
                        : "Adicionar imagem à publicação"
                    }
                    accessibilityHint="Escolhe entre tirar uma foto ou abrir a galeria do aparelho"
                    accessibilityState={{
                      disabled: pickingImage || unavailable,
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

                {previewUri ? (
                  <View className="mt-5 overflow-hidden rounded-[24px] border border-[#353534] bg-[#1A1C1F]">
                    <PostImage uri={previewUri} description={imageDescription} authorName="você" authToken={session?.accessToken ?? null} />
                    <View className="px-4 pt-4">
                      <Text className="mb-2 text-[16px] font-bold text-white">Descrição da imagem (opcional)</Text>
                      <TextInput multiline maxLength={IMAGE_DESCRIPTION_MAX_LENGTH}
                        value={imageDescription} onChangeText={editor.setDescription} editable={!unavailable}
                        accessibilityLabel="Descrição da imagem"
                        accessibilityHint="Descreva o conteúdo relevante para quem não consegue ver a imagem. Até 240 caracteres."
                        placeholder="O que aparece na imagem?" placeholderTextColor="#948EA1"
                        className="min-h-[100px] rounded-xl border border-[#494455] px-3 py-3 text-white" />
                      <Text className="mt-2 text-right text-[#CAC3D8]">{imageDescription.length} / 240</Text>
                    </View>
                    <View className="flex-row items-center justify-between px-4 py-4">
                      <Text className="flex-1 text-[13px] font-semibold text-[#CAC3D8]">
                        {selectedImage?.fileName ?? "Imagem da publicação"}
                      </Text>
                      <Pressable
                        className="min-h-[44px] justify-center pl-3"
                        onPress={() => {
                          speak("Imagem removida");
                          editor.removeImage();
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
        title={editor.hasImage ? "Trocar imagem" : "Adicionar imagem"}
        visible={imageSourceVisible}
      />
    </View>
  );
}
