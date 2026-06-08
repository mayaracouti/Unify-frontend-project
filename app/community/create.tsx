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
import Ionicons from "@expo/vector-icons/Ionicons";
import { SafeAreaView } from "react-native-safe-area-context";

import { useRequireCompletedOnboarding } from "../../src/hooks/useRequireCompletedOnboarding";
import { communityService } from "../../src/services/communityService";
import { showGlobalToast } from "../../src/utils/globalToast";

const IMAGE_MEDIA_TYPES: ImagePicker.MediaType[] = ["images"];

function normalizeRouteParam(value?: string | string[]) {
  if (Array.isArray(value)) {
    return value[0] ?? "";
  }

  return value ?? "";
}

function createCommunityPostFormData(
  body: string,
  asset: ImagePicker.ImagePickerAsset | null
) {
  const formData = new FormData();

  formData.append("body", body);

  if (!asset) {
    return formData;
  }

  const fileName = asset.fileName ?? `community-post-${Date.now()}.jpg`;
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

export default function CommunityCreatePostScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ communityId?: string | string[] }>();

  useRequireCompletedOnboarding();

  const communityId = useMemo(
    () => normalizeRouteParam(params.communityId).trim(),
    [params.communityId]
  );
  const [body, setBody] = useState("");
  const [selectedImage, setSelectedImage] = useState<ImagePicker.ImagePickerAsset | null>(
    null
  );
  const [pickingImage, setPickingImage] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const trimmedBody = useMemo(() => body.trim(), [body]);

  const handlePickImage = useCallback(async () => {
    if (pickingImage) {
      return;
    }

    setPickingImage(true);

    try {
      const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();

      if (permission.status !== ImagePicker.PermissionStatus.GRANTED) {
        showGlobalToast({
          title: "Permissão necessária",
          variant: "warning",
          message: "Libere o acesso à galeria para anexar uma imagem ao post.",
        });
        return;
      }

      const pickerResult = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: IMAGE_MEDIA_TYPES,
        allowsEditing: true,
        quality: 0.8,
      });

      if (!pickerResult.canceled) {
        setSelectedImage(pickerResult.assets[0] ?? null);
      }
    } catch {
      showGlobalToast({
        title: "Falha ao abrir a galeria",
        variant: "error",
        message: "Não foi possível selecionar uma imagem agora.",
      });
    } finally {
      setPickingImage(false);
    }
  }, [pickingImage]);

  const handleSubmit = useCallback(async () => {
    if (submitting) {
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

    setSubmitting(true);

    try {
      const formData = createCommunityPostFormData(trimmedBody, selectedImage);
      await communityService.createPost(communityId, formData);

      showGlobalToast({
        title: "Publicação criada",
        variant: "success",
        message: "Seu post já está visível na comunidade.",
      });
      router.replace({
        pathname: "/community/[communityId]",
        params: { communityId },
      });
    } catch {
      // Global API error toast already explains the failure.
    } finally {
      setSubmitting(false);
    }
  }, [communityId, router, selectedImage, submitting, trimmedBody]);

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
                onPress={() => router.back()}
              >
                <Ionicons name="arrow-back" size={24} color="#E5E2E1" />
              </Pressable>
              <Text className="text-2xl font-black text-[#7C4DFF]">Unify</Text>
            </View>

            <Pressable
              className={`rounded-full px-4 py-2 ${
                trimmedBody.length > 0 && !submitting
                  ? "bg-[#EAEA00]"
                  : "bg-[#3B3841]"
              }`}
              onPress={handleSubmit}
              disabled={trimmedBody.length === 0 || submitting}
            >
              {submitting ? (
                <ActivityIndicator color="#1D1D00" size="small" />
              ) : (
                <Text className="text-[14px] font-black text-[#1D1D00]">Publicar</Text>
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
              <Text className="text-[30px] font-extrabold leading-10 text-white">
                Compartilhe algo com a comunidade
              </Text>
              <Text className="mt-2 text-[15px] font-semibold leading-6 text-[#CAC3D8]">
                Publique uma atualização rápida ou anexe uma imagem para acompanhar o texto.
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
              />
              <Text className="mt-2 text-right text-[12px] font-semibold text-[#948EA1]">
                {body.length} / 600
              </Text>
            </View>

            <View className="mt-6 rounded-[28px] bg-[#111214] p-6">
              <View className="flex-row items-center justify-between">
                <View>
                  <Text className="text-[22px] font-bold text-white">Imagem opcional</Text>
                </View>

                <Pressable
                  className="rounded-full border border-[#494455] bg-[#1A1C1F] px-4 py-3"
                  onPress={handlePickImage}
                  disabled={pickingImage}
                >
                  {pickingImage ? (
                    <ActivityIndicator color="#EAEA00" size="small" />
                  ) : (
                    <View className="flex-row items-center">
                      <Ionicons name="image-outline" size={18} color="#E5E2E1" />
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
                  />
                  <View className="flex-row items-center justify-between px-4 py-4">
                    <Text className="flex-1 text-[13px] font-semibold text-[#CAC3D8]">
                      {selectedImage.fileName ?? "Imagem selecionada"}
                    </Text>
                    <Pressable onPress={() => setSelectedImage(null)}>
                      <Text className="text-[14px] font-bold text-[#FF8A8A]">Remover</Text>
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
                    Você pode publicar apenas com texto ou anexar uma imagem para complementar.
                  </Text>
                </View>
              )}
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </View>
  );
}