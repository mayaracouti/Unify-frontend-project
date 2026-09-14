import Ionicons from "@expo/vector-icons/Ionicons";
import * as ImagePicker from "expo-image-picker";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useCallback, useMemo, useState } from "react";
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
import { SafeAreaView } from "react-native-safe-area-context";

import { useTTS } from "../../src/accessibility/tts";
import { ActionSheet } from "../../src/components/ui/action-sheet";
import { useAccessibility } from "../../src/context/AccessibilityContext";
import { useScreenHeadingFocus } from "../../src/hooks/use-screen-heading-focus";
import { feedService } from "../../src/services/feedService";
import {
  accessibilityAnnouncements,
  announceForAccessibility,
} from "../../src/utils/accessibilityAnnouncements";
import { showGlobalToast } from "../../src/utils/globalToast";

const IMAGE_MEDIA_TYPES: ImagePicker.MediaType[] = ["images"];

const BODY_MAX_LENGTH = 600;

type ImageSource = "camera" | "library";

function normalizeRouteParam(value?: string | string[]) {
  if (Array.isArray(value)) {
    return value[0] ?? "";
  }

  return value ?? "";
}

/**
 * Mesmo formato do `createCommunityPostFormData`: `POST /users/posts` espera
 * exatamente os campos `body` e (opcional) `image`.
 */
function createUserPostFormData(body: string, asset: ImagePicker.ImagePickerAsset | null) {
  const formData = new FormData();

  formData.append("body", body);

  if (!asset) {
    return formData;
  }

  const fileName = asset.fileName ?? `user-post-${Date.now()}.jpg`;
  const mimeType = asset.mimeType ?? "image/jpeg";
  const webFile = (asset as ImagePicker.ImagePickerAsset & { file?: File }).file;

  if (Platform.OS === "web" && webFile) {
    formData.append("image", webFile, fileName);
    return formData;
  }

  formData.append("image", {
    uri: asset.uri,
    name: fileName,
    type: mimeType,
  } as unknown as Blob);

  return formData;
}

/**
 * Criar (ou editar, com `postId` + `body` nos params) uma publicacao do
 * perfil. Aberta pelo "+" da barra inferior; ao publicar volta para a aba
 * Perfil, onde a secao Publicacoes lista os posts pessoais.
 */
export default function ProfileNewPostScreen() {
  const router = useRouter();
  const { speak } = useTTS();
  const { settings } = useAccessibility();
  const highContrast = settings.highContrast;
  const params = useLocalSearchParams<{
    postId?: string | string[];
    body?: string | string[];
  }>();

  // Ao entrar na tela, o leitor de tela do sistema comeca pelo titulo.
  const headingRef = useScreenHeadingFocus<Text>();

  const editingPostId = useMemo(
    () => normalizeRouteParam(params.postId).trim() || null,
    [params.postId]
  );
  const isEditing = editingPostId !== null;

  const [body, setBody] = useState(() =>
    isEditing ? normalizeRouteParam(params.body) : ""
  );
  const [selectedImage, setSelectedImage] = useState<ImagePicker.ImagePickerAsset | null>(
    null
  );
  const [imageSourceVisible, setImageSourceVisible] = useState(false);
  const [pickingImage, setPickingImage] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const trimmedBody = useMemo(() => body.trim(), [body]);
  const submitDisabled = trimmedBody.length === 0 || submitting;
  const submitLabel = isEditing ? "Salvar" : "Publicar";

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
    if (submitting) {
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

    setSubmitting(true);

    try {
      if (editingPostId) {
        await feedService.updatePost(editingPostId, trimmedBody);

        showGlobalToast({
          title: "Publicação atualizada",
          variant: "success",
          message: "O novo texto já está no seu perfil.",
        });
        announceForAccessibility(accessibilityAnnouncements.personalPostUpdated());
        router.back();
        return;
      }

      const formData = createUserPostFormData(trimmedBody, selectedImage);
      await feedService.createPost(formData);

      showGlobalToast({
        title: "Publicação criada",
        variant: "success",
        message: "Seu post já está na seção Publicações do seu perfil.",
      });
      announceForAccessibility(accessibilityAnnouncements.personalPostCreated());
      router.replace({ pathname: "/profile", params: { created: "1" } });
    } catch {
      // Global API error toast already explains the failure.
    } finally {
      setSubmitting(false);
    }
  }, [editingPostId, router, selectedImage, submitting, trimmedBody]);

  const pageBackground = highContrast ? "bg-hc-bg" : "bg-[#09090A]";
  const cardBackground = highContrast
    ? "border border-hc-border bg-hc-surface"
    : "bg-[#111214]";
  const titleColor = highContrast ? "text-hc-text" : "text-white";
  const secondaryColor = highContrast ? "text-hc-text" : "text-[#CAC3D8]";

  return (
    <View className={`flex-1 ${pageBackground}`}>
      <SafeAreaView className={`flex-1 ${pageBackground}`}>
        <KeyboardAvoidingView
          className="flex-1"
          behavior={Platform.OS === "ios" ? "padding" : undefined}
        >
          <View
            className={`h-16 flex-row items-center justify-between border-b px-6 ${
              highContrast ? "border-hc-border" : "border-[#2A2A2A]"
            }`}
          >
            <View className="flex-row items-center">
              <Pressable
                className="mr-3 h-10 w-10 items-center justify-center rounded-full"
                onPress={() => {
                  speak("Voltar");
                  router.back();
                }}
                accessibilityRole="button"
                accessibilityLabel="Voltar"
                accessibilityHint={
                  isEditing
                    ? "Volta para o perfil sem salvar a alteração"
                    : "Volta para o perfil sem publicar"
                }
              >
                <Ionicons name="arrow-back" size={24} color="#E5E2E1" />
              </Pressable>
              <Text className="text-2xl font-black text-[#7C4DFF]">Unify</Text>
            </View>

            <Pressable
              className={`rounded-full px-4 py-2 ${
                submitDisabled ? "bg-[#3B3841]" : "bg-[#EAEA00]"
              }`}
              onPress={() => {
                speak(submitLabel);
                void handleSubmit();
              }}
              disabled={submitDisabled}
              accessibilityRole="button"
              accessibilityLabel={submitLabel}
              accessibilityHint={
                isEditing
                  ? "Salva o novo texto da publicação"
                  : "Envia o texto e a imagem para a seção Publicações do seu perfil"
              }
              accessibilityState={{
                disabled: submitDisabled,
                busy: submitting,
              }}
            >
              {submitting ? (
                <ActivityIndicator color="#1D1D00" size="small" />
              ) : (
                <Text className="text-[14px] font-black text-[#1D1D00]">{submitLabel}</Text>
              )}
            </Pressable>
          </View>

          <ScrollView
            className="flex-1"
            contentContainerClassName="mx-auto w-full max-w-[720px] px-6 pb-10 pt-8"
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            <View className={`rounded-[28px] p-6 ${cardBackground}`}>
              <Text
                ref={headingRef}
                accessibilityRole="header"
                className={`text-[30px] font-extrabold leading-10 ${titleColor}`}
              >
                {isEditing ? "Editar publicação" : "Compartilhe algo no seu perfil"}
              </Text>
              <Text
                className={`mt-2 text-[15px] font-semibold leading-6 ${secondaryColor}`}
              >
                {isEditing
                  ? "Altere o texto da publicação. A imagem anexada continua a mesma."
                  : "A publicação aparece na aba Perfil, na seção Publicações, e no feed de quem te segue."}
              </Text>
            </View>

            <View className={`mt-6 rounded-[28px] p-6 ${cardBackground}`}>
              <Text className={`mb-3 text-[22px] font-bold ${titleColor}`}>Seu texto</Text>
              <TextInput
                className={`min-h-[180px] rounded-2xl border-2 px-4 py-4 text-[16px] leading-7 ${
                  highContrast
                    ? "border-hc-border bg-hc-bg text-hc-text"
                    : "border-[#494455] bg-[#1C1B1B] text-white"
                }`}
                multiline
                maxLength={BODY_MAX_LENGTH}
                placeholder="O que você quer compartilhar hoje?"
                placeholderTextColor="#948EA1"
                textAlignVertical="top"
                value={body}
                onChangeText={setBody}
                onFocus={() => speak("Texto da publicação")}
                accessibilityLabel="Texto da publicação"
                accessibilityHint="Obrigatório. Escreva o que quer compartilhar"
              />
              <Text
                className={`mt-2 text-right text-[12px] font-semibold ${secondaryColor}`}
              >
                {body.length} / {BODY_MAX_LENGTH}
              </Text>
            </View>

            {/* Edicao e so de texto: a secao de imagem nao aparece. */}
            {isEditing ? null : (
              <View className={`mt-6 rounded-[28px] p-6 ${cardBackground}`}>
                <View className="flex-row items-center justify-between">
                  <Text className={`text-[22px] font-bold ${titleColor}`}>
                    Imagem opcional
                  </Text>

                  <Pressable
                    className={`rounded-full border px-4 py-3 ${
                      highContrast
                        ? "border-hc-border bg-hc-bg"
                        : "border-[#494455] bg-[#1A1C1F]"
                    }`}
                    onPress={() => {
                      speak(selectedImage ? "Trocar imagem" : "Selecionar imagem");
                      setImageSourceVisible(true);
                    }}
                    disabled={pickingImage}
                    accessibilityRole="button"
                    accessibilityLabel={
                      selectedImage ? "Trocar imagem" : "Selecionar imagem"
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
                        <Text className={`ml-2 text-[14px] font-bold ${titleColor}`}>
                          {selectedImage ? "Trocar" : "Selecionar"}
                        </Text>
                      </View>
                    )}
                  </Pressable>
                </View>

                {selectedImage ? (
                  <View
                    className={`mt-5 overflow-hidden rounded-[24px] border ${
                      highContrast
                        ? "border-hc-border bg-hc-bg"
                        : "border-[#353534] bg-[#1A1C1F]"
                    }`}
                  >
                    <Image
                      source={{ uri: selectedImage.uri }}
                      className="aspect-video w-full"
                      resizeMode="cover"
                      accessibilityLabel="Pré-visualização da imagem selecionada"
                    />
                    <View className="flex-row items-center justify-between px-4 py-4">
                      <Text
                        className={`flex-1 text-[13px] font-semibold ${secondaryColor}`}
                      >
                        {selectedImage.fileName ?? "Imagem selecionada"}
                      </Text>
                      <Pressable
                        onPress={() => {
                          speak("Remover imagem");
                          setSelectedImage(null);
                        }}
                        accessibilityRole="button"
                        accessibilityLabel="Remover imagem selecionada"
                        accessibilityHint="Descarta a imagem anexada. O texto da publicação continua"
                      >
                        <Text className="text-[14px] font-bold text-[#FF8A8A]">
                          Remover
                        </Text>
                      </Pressable>
                    </View>
                  </View>
                ) : (
                  <View
                    className={`mt-5 rounded-[24px] border border-dashed px-5 py-8 ${
                      highContrast
                        ? "border-hc-border bg-hc-bg"
                        : "border-[#494455] bg-[#151619]"
                    }`}
                  >
                    <Ionicons
                      name="images-outline"
                      size={32}
                      color="#7C4DFF"
                      importantForAccessibility="no"
                    />
                    <Text className={`mt-4 text-[16px] font-bold ${titleColor}`}>
                      Nenhuma imagem selecionada
                    </Text>
                    <Text
                      className={`mt-2 text-[14px] font-semibold leading-6 ${secondaryColor}`}
                    >
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
