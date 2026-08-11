import * as ImagePicker from "expo-image-picker";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useCallback, useEffect, useMemo, useState } from "react";
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

import { CommunityCategoryChips } from "../../src/components/community/category-chips";
import { AuthenticatedRemoteImage } from "../../src/components/profile/authenticated-remote-image";
import { ScreenError } from "../../src/components/ui/screen-error";
import { ScreenLoading } from "../../src/components/ui/screen-loading";
import { useAuth } from "../../src/context/AuthContext";
import { useCommunityDangerActions } from "../../src/hooks/use-community-danger-actions";
import { useRequireCompletedOnboarding } from "../../src/hooks/useRequireCompletedOnboarding";
import { communityService } from "../../src/services/communityService";
import type {
  CommunityCategoryResponse,
  CommunitySummaryResponse,
} from "../../src/types/community";
import { formatApiErrorMessage } from "../../src/utils/auth";
import { showGlobalToast } from "../../src/utils/globalToast";

const IMAGE_MEDIA_TYPES: ImagePicker.MediaType[] = ["images"];

function normalizeRouteParam(value?: string | string[]) {
  if (Array.isArray(value)) {
    return value[0] ?? "";
  }

  return value ?? "";
}

/**
 * Regra de acesso do backend para editar comunidade e "apenas ADMIN" (mais
 * estrita que `canModerateRole`, que tambem aceita MODERATOR). Espelhamos essa
 * regra aqui para nao exibir um formulario que resultaria em 403.
 */
function canConfigureCommunity(community?: CommunitySummaryResponse | null) {
  if (!community) {
    return false;
  }

  return Boolean(community.isOwner) || community.currentUserRole === "ADMIN";
}

function buildCommunityUpdateFormData(args: {
  name: string;
  description: string;
  categoryId: number | null;
  asset: ImagePicker.ImagePickerAsset | null;
}) {
  const formData = new FormData();

  formData.append("name", args.name);
  formData.append("description", args.description.trim());

  if (args.categoryId) {
    formData.append("categoryId", String(args.categoryId));
  }

  if (!args.asset) {
    return formData;
  }

  const fileName = args.asset.fileName ?? `community-${Date.now()}.jpg`;
  const mimeType = args.asset.mimeType ?? "image/jpeg";
  const webFile = (args.asset as ImagePicker.ImagePickerAsset & { file?: File }).file;

  if (Platform.OS === "web" && webFile) {
    formData.append("icon", webFile, fileName);
    return formData;
  }

  formData.append(
    "icon",
    {
      uri: args.asset.uri,
      name: fileName,
      type: mimeType,
    } as unknown as Blob
  );

  return formData;
}

export default function CommunitySettingsScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ communityId?: string | string[] }>();
  const { session } = useAuth();

  useRequireCompletedOnboarding();

  const communityId = useMemo(
    () => normalizeRouteParam(params.communityId).trim(),
    [params.communityId]
  );
  const authToken = session?.accessToken ?? null;

  const [community, setCommunity] = useState<CommunitySummaryResponse | null>(null);
  const [categories, setCategories] = useState<CommunityCategoryResponse[]>([]);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [categoryId, setCategoryId] = useState<number | null>(null);
  const [selectedImage, setSelectedImage] = useState<ImagePicker.ImagePickerAsset | null>(
    null
  );
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [pickingImage, setPickingImage] = useState(false);
  const [saving, setSaving] = useState(false);

  const { deleteBusy, handleDeleteCommunity, leaveBusy, handleLeaveCommunity } =
    useCommunityDangerActions({ communityId });

  const loadCommunity = useCallback(async () => {
    if (!communityId) {
      setLoading(false);
      setLoadError("Não foi possível identificar a comunidade selecionada.");
      return;
    }

    setLoading(true);

    try {
      setLoadError(null);

      const feed = await communityService.getFeed(communityId);
      const loadedCommunity = feed.community ?? null;

      setCommunity(loadedCommunity);
      setName(loadedCommunity?.name ?? "");
      setDescription(loadedCommunity?.description ?? "");
      setCategoryId(loadedCommunity?.category?.id ?? null);

      if (!loadedCommunity) {
        setLoadError("Não foi possível carregar os dados desta comunidade.");
      }
    } catch (error) {
      setLoadError(
        formatApiErrorMessage(error, "Não foi possível carregar os dados desta comunidade.")
      );
    } finally {
      setLoading(false);
    }
  }, [communityId]);

  useEffect(() => {
    void loadCommunity();
  }, [loadCommunity]);

  useEffect(() => {
    let active = true;

    const loadCategories = async () => {
      try {
        const response = await communityService.listCategories();

        if (active) {
          setCategories(Array.isArray(response) ? response : []);
        }
      } catch {
        // A categoria e opcional: sem a lista o formulario segue utilizavel.
      }
    };

    void loadCategories();

    return () => {
      active = false;
    };
  }, []);

  const trimmedName = useMemo(() => name.trim(), [name]);
  const canConfigure = canConfigureCommunity(community);
  const currentIconUrl = communityService.resolveAssetUrl(community?.iconData);

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
          message: "Libere o acesso à galeria para trocar o ícone da comunidade.",
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

  const handleSave = useCallback(async () => {
    if (saving || !communityId) {
      return;
    }

    if (trimmedName.length === 0) {
      showGlobalToast({
        title: "Nome obrigatório",
        variant: "warning",
        message: "Defina um nome para a comunidade antes de salvar.",
      });
      return;
    }

    setSaving(true);

    try {
      const formData = buildCommunityUpdateFormData({
        name: trimmedName,
        description,
        categoryId,
        asset: selectedImage,
      });

      await communityService.updateCommunity(communityId, formData);

      showGlobalToast({
        title: "Comunidade atualizada",
        variant: "success",
        message: "As novas informações já aparecem para os membros.",
      });

      router.replace({
        pathname: "/community/[communityId]",
        params: { communityId },
      });
    } catch {
      // Global API error toast already explains the failure.
    } finally {
      setSaving(false);
    }
  }, [categoryId, communityId, description, router, saving, selectedImage, trimmedName]);

  const handleBack = useCallback(() => {
    if (communityId) {
      router.replace({
        pathname: "/community/[communityId]",
        params: { communityId },
      });
      return;
    }

    router.replace("/community");
  }, [communityId, router]);

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
                onPress={handleBack}
                accessibilityRole="button"
                accessibilityLabel="Voltar para a comunidade"
              >
                <Ionicons name="arrow-back" size={24} color="#E5E2E1" />
              </Pressable>
              <Text className="text-2xl font-black text-[#7C4DFF]">Unify</Text>
            </View>

            <Text className="text-[14px] font-bold text-[#CAC3D8]">Configurações</Text>
          </View>

          {loading ? (
            <View className="flex-1 items-center justify-center">
              <ScreenLoading label="Carregando configurações..." />
            </View>
          ) : loadError && !community ? (
            <View className="flex-1 items-center justify-center px-6">
              <ScreenError
                title="Comunidade indisponível"
                message={loadError}
                onRetry={() => {
                  void loadCommunity();
                }}
              />
            </View>
          ) : !canConfigure ? (
            <View className="flex-1 items-center justify-center px-6">
              <View className="w-full rounded-[28px] border border-[#6A4456] bg-[#2A1C24] px-6 py-8">
                <View
                  accessible
                  accessibilityRole="alert"
                  accessibilityLabel="Acesso restrito. Apenas administradores podem configurar esta comunidade."
                >
                  <Ionicons name="lock-closed-outline" size={32} color="#FFD3DD" />
                  <Text className="mt-4 text-[22px] font-black text-[#FFD3DD]">
                    Acesso restrito
                  </Text>
                  <Text className="mt-3 text-[15px] font-semibold leading-7 text-[#FFEAF0]">
                    Apenas administradores podem configurar esta comunidade.
                  </Text>
                </View>

                <Pressable
                  className="mt-6 self-start rounded-full border border-[#494455] bg-[#1A1C1F] px-5 py-3"
                  onPress={handleBack}
                  accessibilityRole="button"
                  accessibilityLabel="Voltar para a comunidade"
                >
                  <Text className="text-[14px] font-black text-white">Voltar</Text>
                </Pressable>
              </View>
            </View>
          ) : (
            <ScrollView
              className="flex-1"
              contentContainerClassName="mx-auto w-full max-w-[720px] px-6 pb-16 pt-8"
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
            >
              <View className="rounded-[28px] bg-[#111214] p-6">
                <Text className="text-[30px] font-extrabold leading-10 text-white">
                  Configurações da comunidade
                </Text>
                <Text className="mt-2 text-[15px] font-semibold leading-6 text-[#CAC3D8]">
                  Atualize nome, descrição, categoria e ícone. As mudanças valem para todos os
                  membros.
                </Text>
              </View>

              {loadError ? (
                <View className="mt-6 rounded-2xl border border-[#6A4456] bg-[#2A1C24] px-4 py-4">
                  <Text className="text-[15px] font-bold text-[#FFD3DD]">
                    Atualização parcial
                  </Text>
                  <Text className="mt-2 text-[14px] font-semibold leading-6 text-[#FFEAF0]">
                    {loadError}
                  </Text>
                </View>
              ) : null}

              <View className="mt-6 rounded-[28px] bg-[#111214] p-6">
                <Text className="mb-3 text-[22px] font-bold text-white">Nome</Text>
                <TextInput
                  className="rounded-2xl border-2 border-[#494455] bg-[#1C1B1B] px-4 py-4 text-[16px] text-white"
                  maxLength={80}
                  placeholder="Ex.: Acessibilidade em foco"
                  placeholderTextColor="#948EA1"
                  value={name}
                  onChangeText={setName}
                  accessibilityLabel="Nome da comunidade"
                  accessibilityHint="Texto exibido como título da comunidade"
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
                  placeholder="Explique o propósito da comunidade."
                  placeholderTextColor="#948EA1"
                  textAlignVertical="top"
                  value={description}
                  onChangeText={setDescription}
                  accessibilityLabel="Descrição da comunidade"
                  accessibilityHint="Texto exibido abaixo do nome da comunidade"
                />
                <Text className="mt-2 text-right text-[12px] font-semibold text-[#948EA1]">
                  {description.length} / 400
                </Text>
              </View>

              {categories.length > 0 ? (
                <View className="mt-6 rounded-[28px] bg-[#111214] p-6">
                  <Text className="mb-1 text-[22px] font-bold text-white">Categoria</Text>
                  <Text className="text-[14px] font-semibold leading-6 text-[#CAC3D8]">
                    Ajuda outras pessoas a encontrarem a comunidade pela busca.
                  </Text>

                  <CommunityCategoryChips
                    categories={categories}
                    selectedCategoryId={categoryId}
                    onSelect={setCategoryId}
                  />
                </View>
              ) : null}

              <View className="mt-6 rounded-[28px] bg-[#111214] p-6">
                <View className="flex-row items-center justify-between">
                  <View className="flex-1 pr-4">
                    <Text className="text-[22px] font-bold text-white">Ícone</Text>
                    <Text className="mt-1 text-[14px] font-semibold leading-6 text-[#CAC3D8]">
                      Selecione uma nova imagem para substituir o ícone atual.
                    </Text>
                  </View>

                  <Pressable
                    className="rounded-full border border-[#494455] bg-[#1A1C1F] px-4 py-3"
                    onPress={() => {
                      void handlePickImage();
                    }}
                    disabled={pickingImage}
                    accessibilityRole="button"
                    accessibilityLabel={
                      selectedImage ? "Trocar ícone da comunidade" : "Selecionar ícone da comunidade"
                    }
                    accessibilityState={{ disabled: pickingImage, busy: pickingImage }}
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
                      accessible
                      accessibilityLabel="Pré-visualização do novo ícone da comunidade"
                    />
                    <View className="flex-row items-center justify-between px-4 py-4">
                      <Text className="flex-1 text-[13px] font-semibold text-[#CAC3D8]">
                        {selectedImage.fileName ?? "Novo ícone selecionado"}
                      </Text>
                      <Pressable
                        onPress={() => setSelectedImage(null)}
                        accessibilityRole="button"
                        accessibilityLabel="Remover o ícone selecionado"
                      >
                        <Text className="text-[14px] font-bold text-[#FF8A8A]">Remover</Text>
                      </Pressable>
                    </View>
                  </View>
                ) : currentIconUrl ? (
                  <View className="mt-5 h-24 w-24 overflow-hidden rounded-[20px] border border-[#353534] bg-[#1A1C1F]">
                    <AuthenticatedRemoteImage
                      uri={currentIconUrl}
                      authToken={authToken}
                      className="h-full w-full"
                      resizeMode="cover"
                      fallback={
                        <View className="flex-1 items-center justify-center bg-[#7C4DFF]">
                          <Ionicons name="people" size={28} color="#FCF6FF" />
                        </View>
                      }
                    />
                  </View>
                ) : (
                  <View className="mt-5 rounded-[24px] border border-dashed border-[#494455] bg-[#151619] px-5 py-8">
                    <Ionicons name="images-outline" size={32} color="#7C4DFF" />
                    <Text className="mt-4 text-[16px] font-bold text-white">
                      Nenhum ícone definido
                    </Text>
                  </View>
                )}
              </View>

              <Pressable
                className={`mt-6 h-14 flex-row items-center justify-center gap-3 rounded-2xl ${
                  trimmedName.length > 0 && !saving ? "bg-[#EAEA00]" : "bg-[#3B3841]"
                }`}
                onPress={() => {
                  void handleSave();
                }}
                disabled={trimmedName.length === 0 || saving}
                accessibilityRole="button"
                accessibilityLabel="Salvar alterações da comunidade"
                accessibilityState={{
                  disabled: trimmedName.length === 0 || saving,
                  busy: saving,
                }}
              >
                {saving ? (
                  <ActivityIndicator color="#1D1D00" size="small" />
                ) : (
                  <>
                    <Ionicons name="save-outline" size={20} color="#1D1D00" />
                    <Text className="text-[16px] font-black text-[#1D1D00]">
                      Salvar alterações
                    </Text>
                  </>
                )}
              </Pressable>

              <View className="mt-8 rounded-[28px] border border-[#6A4456] bg-[#1A1113] p-6">
                <Text className="text-[20px] font-black text-[#FFD3DD]">Zona de risco</Text>
                <Text className="mt-2 text-[14px] font-semibold leading-6 text-[#FFEAF0]">
                  {community?.isOwner
                    ? "Como pessoa proprietária você não pode sair da comunidade, apenas excluí-la."
                    : "Sair remove seu acesso às publicações desta comunidade."}
                </Text>

                {!community?.isOwner ? (
                  <Pressable
                    className="mt-5 h-14 flex-row items-center justify-center gap-3 rounded-2xl border-2 border-[#494455] bg-[#2E2B33]"
                    onPress={handleLeaveCommunity}
                    disabled={leaveBusy}
                    accessibilityRole="button"
                    accessibilityLabel="Sair da comunidade"
                    accessibilityHint="Pede confirmação antes de remover você desta comunidade"
                    accessibilityState={{ disabled: leaveBusy, busy: leaveBusy }}
                  >
                    {leaveBusy ? (
                      <ActivityIndicator color="#E5E2E1" size="small" />
                    ) : (
                      <>
                        <Ionicons name="exit-outline" size={20} color="#E5E2E1" />
                        <Text className="text-[16px] font-black text-[#E5E2E1]">
                          Sair da comunidade
                        </Text>
                      </>
                    )}
                  </Pressable>
                ) : null}

                {community?.isOwner ? (
                  <Pressable
                    className="mt-5 h-14 flex-row items-center justify-center gap-3 rounded-2xl border-2 border-[#6A4456] bg-[#2A1C24]"
                    onPress={handleDeleteCommunity}
                    disabled={deleteBusy}
                    accessibilityRole="button"
                    accessibilityLabel="Excluir comunidade"
                    accessibilityHint="Pede confirmação antes de apagar a comunidade permanentemente"
                    accessibilityState={{ disabled: deleteBusy, busy: deleteBusy }}
                  >
                    {deleteBusy ? (
                      <ActivityIndicator color="#FFD3DD" size="small" />
                    ) : (
                      <>
                        <Ionicons name="trash-outline" size={20} color="#FFD3DD" />
                        <Text className="text-[16px] font-black text-[#FFD3DD]">
                          Excluir comunidade
                        </Text>
                      </>
                    )}
                  </Pressable>
                ) : null}
              </View>
            </ScrollView>
          )}
        </KeyboardAvoidingView>
      </SafeAreaView>
    </View>
  );
}
