import * as ImagePicker from "expo-image-picker";
import { useRouter } from "expo-router";
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

function createCommunityFormData(
  name: string,
  description: string,
  asset: ImagePicker.ImagePickerAsset | null
) {
  const formData = new FormData();

  formData.append("name", name);

  if (description.trim().length > 0) {
    formData.append("description", description.trim());
  }

  if (!asset) {
    return formData;
  }

  const fileName = asset.fileName ?? `community-${Date.now()}.jpg`;
  const mimeType = asset.mimeType ?? "image/jpeg";
  const webFile = (asset as ImagePicker.ImagePickerAsset & { file?: File }).file;

  if (Platform.OS === "web" && webFile) {
    formData.append("icon", webFile, fileName);
    return formData;
  }

  formData.append(
    "icon",
    {
      uri: asset.uri,
      name: fileName,
      type: mimeType,
    } as unknown as Blob
  );

  return formData;
}

export default function CommunityCreateScreen() {
  const router = useRouter();

  useRequireCompletedOnboarding();

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [selectedImage, setSelectedImage] = useState<ImagePicker.ImagePickerAsset | null>(
    null
  );
  const [pickingImage, setPickingImage] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const trimmedName = useMemo(() => name.trim(), [name]);

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
          message: "Libere o acesso à galeria para definir um ícone para a comunidade.",
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

    if (trimmedName.length === 0) {
      showGlobalToast({
        title: "Nome obrigatório",
        variant: "warning",
        message: "Defina um nome para a comunidade antes de criar.",
      });
      return;
    }

    setSubmitting(true);

    try {
      const formData = createCommunityFormData(trimmedName, description, selectedImage);
      const community = await communityService.createCommunity(formData);

      showGlobalToast({
        title: "Comunidade criada",
        variant: "success",
        message: "Sua comunidade já está pronta para receber membros e publicações.",
      });

      router.replace({
        pathname: "/community/[communityId]",
        params: { communityId: community.id },
      });
    } catch {
      // Global API error toast already explains the failure.
    } finally {
      setSubmitting(false);
    }
  }, [description, router, selectedImage, submitting, trimmedName]);

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
                trimmedName.length > 0 && !submitting ? "bg-[#EAEA00]" : "bg-[#3B3841]"
              }`}
              onPress={handleSubmit}
              disabled={trimmedName.length === 0 || submitting}
            >
              {submitting ? (
                <ActivityIndicator color="#1D1D00" size="small" />
              ) : (
                <Text className="text-[14px] font-black text-[#1D1D00]">Criar</Text>
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
                Crie uma comunidade
              </Text>
              <Text className="mt-2 text-[15px] font-semibold leading-6 text-[#CAC3D8]">
                Defina nome, descrição e um ícone opcional. Você entra automaticamente como owner e admin.
              </Text>
            </View>

            <View className="mt-6 rounded-[28px] bg-[#111214] p-6">
              <Text className="mb-3 text-[22px] font-bold text-white">Nome</Text>
              <TextInput
                className="rounded-2xl border-2 border-[#494455] bg-[#1C1B1B] px-4 py-4 text-[16px] text-white"
                maxLength={80}
                placeholder="Ex.: Acessibilidade em foco"
                placeholderTextColor="#948EA1"
                value={name}
                onChangeText={setName}
              />
              <Text className="mt-2 text-right text-[12px] font-semibold text-[#948EA1]">
                {name.length} / 80
              </Text>
            </View>

            <View className="mt-6 rounded-[28px] bg-[#111214] p-6">
              <Text className="mb-3 text-[22px] font-bold text-white">Descrição</Text>
              <TextInput
                className="min-h-[160px] rounded-2xl border-2 border-[#494455] bg-[#1C1B1B] px-4 py-4 text-[16px] leading-7 text-white"
                multiline
                maxLength={400}
                placeholder="Explique o propósito da comunidade e que tipo de conversa faz sentido nela."
                placeholderTextColor="#948EA1"
                textAlignVertical="top"
                value={description}
                onChangeText={setDescription}
              />
              <Text className="mt-2 text-right text-[12px] font-semibold text-[#948EA1]">
                {description.length} / 400
              </Text>
            </View>

            <View className="mt-6 rounded-[28px] bg-[#111214] p-6">
              <View className="flex-row items-center justify-between">
                <View className="flex-1 pr-4">
                  <Text className="text-[22px] font-bold text-white">Ícone opcional</Text>
                  <Text className="mt-1 text-[14px] font-semibold leading-6 text-[#CAC3D8]">
                    O backend recebe o ícone como multipart, comprime e converte para JPEG automaticamente.
                  </Text>
                </View>

                <Pressable
                  className="rounded-full border border-[#494455] bg-[#1A1C1F] px-4 py-3"
                  onPress={handlePickImage}
                  disabled={pickingImage}
                >
                  {pickingImage ? (
                    <ActivityIndicator color="#EAEA00" size="small" />
                  ) : (
                    <View className="flex-row items-center gap-2">
                      <Ionicons name="image-outline" size={18} color="#E5E2E1" />
                      <Text className="text-[14px] font-bold text-white">
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
                      {selectedImage.fileName ?? "Ícone selecionado"}
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
                    Nenhum ícone selecionado
                  </Text>
                  <Text className="mt-2 text-[14px] font-semibold leading-6 text-[#CAC3D8]">
                    Você pode criar a comunidade sem ícone e definir isso depois quando existir essa ação no backend.
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
