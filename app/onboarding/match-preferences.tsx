import { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Linking,
  Platform,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";
import { useRouter } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";

import {
  ChoiceCard,
  SectionTitle,
  SimilaritySelector,
} from "../../src/components/profile/form-controls";
import { profileService } from "../../src/services/profileService";
import type {
  LookupOptionResponse,
  ProfileOptionsResponse,
  SimilarityPreference,
} from "../../src/types/profile";
import { formatApiErrorMessage } from "../../src/utils/auth";
import {
  getForegroundLocationPermissionState,
  requestForegroundLocationPermissionState,
} from "../../src/utils/location";

function toggleId(currentIds: number[], id: number): number[] {
  return currentIds.includes(id)
    ? currentIds.filter((currentId) => currentId !== id)
    : [...currentIds, id];
}

export default function MatchPreferencesOnboarding() {
  const router = useRouter();
  const [options, setOptions] = useState<ProfileOptionsResponse | null>(null);
  const [connectionTypeId, setConnectionTypeId] = useState<number | undefined>();
  const [desiredGenderIds, setDesiredGenderIds] = useState<number[]>([]);
  const [accessibilityNeedSimilarity, setAccessibilityNeedSimilarity] =
    useState<SimilarityPreference>("ANY");
  const [autonomyCompatibility, setAutonomyCompatibility] =
    useState<SimilarityPreference>("ANY");
  const [lifestyleSimilarity, setLifestyleSimilarity] =
    useState<SimilarityPreference>("ANY");
  const [energyLevelSimilarity, setEnergyLevelSimilarity] =
    useState<SimilarityPreference>("ANY");
  const [loveLanguageSimilarity, setLoveLanguageSimilarity] =
    useState<SimilarityPreference>("ANY");
  const [minAge, setMinAge] = useState("18");
  const [maxAge, setMaxAge] = useState("");
  const [maxMatchDistanceKm, setMaxMatchDistanceKm] = useState("30");
  const [hasLocationPermission, setHasLocationPermission] = useState(false);
  const [canAskLocationPermissionAgain, setCanAskLocationPermissionAgain] = useState(true);
  const [locationStatus, setLocationStatus] = useState<
    "checking" | "idle" | "requesting" | "failed"
  >("checking");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const similarityOptions = options?.similarityPreferences.length
    ? options.similarityPreferences
    : [
        { value: "ANY" as const, description: "Tanto faz" },
        { value: "SIMILAR" as const, description: "Parecido comigo" },
        { value: "DIFFERENT" as const, description: "Diferente de mim" },
      ];

  const canSave = useMemo(
    () => {
      const parsedDistance = Number(maxMatchDistanceKm);
      const parsedMinAge = Number(minAge);
      const parsedMaxAge = Number(maxAge);

      return (
        Boolean(connectionTypeId) &&
        desiredGenderIds.length > 0 &&
        loveLanguageSimilarity !== null &&
        Number.isFinite(parsedDistance) &&
        parsedDistance > 0 &&
        Number.isFinite(parsedMinAge) &&
        Number.isFinite(parsedMaxAge) &&
        parsedMinAge >= 18 &&
        parsedMaxAge >= 18 &&
        parsedMinAge <= parsedMaxAge
      );
    },
    [
      connectionTypeId,
      desiredGenderIds.length,
      loveLanguageSimilarity,
      maxMatchDistanceKm,
      maxAge,
      minAge,
    ]
  );
  const showLocationSettingsButton =
    Platform.OS !== "web" && !hasLocationPermission && !canAskLocationPermissionAgain;

  useEffect(() => {
    let active = true;

    async function loadPreferences() {
      try {
        const [nextOptions, preferences] = await Promise.all([
          profileService.getOptions(),
          profileService.getMatchPreferences(),
        ]);

        if (!active) {
          return;
        }

        setOptions(nextOptions);
        setConnectionTypeId(preferences.connectionType?.id);
        setDesiredGenderIds(preferences.desiredGenders?.map((gender) => gender.id) ?? []);
        setAccessibilityNeedSimilarity(preferences.accessibilityNeedSimilarity ?? "ANY");
        setAutonomyCompatibility(preferences.autonomyCompatibility ?? "ANY");
        setLifestyleSimilarity(preferences.lifestyleSimilarity ?? "ANY");
        setEnergyLevelSimilarity(preferences.energyLevelSimilarity ?? "ANY");
        setLoveLanguageSimilarity(preferences.loveLanguageSimilarity ?? "ANY");
        setMinAge(preferences.minAge == null ? "" : String(preferences.minAge));
        setMaxAge(preferences.maxAge == null ? "" : String(preferences.maxAge));
        setMaxMatchDistanceKm(String(preferences.maxMatchDistanceKm ?? 30));
      } catch (error) {
        if (active) {
          setError(formatApiErrorMessage(error, "Não foi possível carregar suas preferências."));
        }
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    }

    void loadPreferences();

    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    let active = true;

    async function syncLocationPermission() {
      try {
        const permission = await getForegroundLocationPermissionState();

        if (!active) {
          return;
        }

        setHasLocationPermission(permission.granted);
        setCanAskLocationPermissionAgain(permission.canAskAgain);
        setLocationStatus("idle");
      } catch {
        if (active) {
          setLocationStatus("failed");
        }
      }
    }

    void syncLocationPermission();

    return () => {
      active = false;
    };
  }, []);

  async function handleGrantLocationAccess() {
    try {
      setError("");
      setLocationStatus("requesting");

      const permission = await requestForegroundLocationPermissionState();

      setHasLocationPermission(permission.granted);
      setCanAskLocationPermissionAgain(permission.canAskAgain);

      setLocationStatus("idle");
    } catch (nextError) {
      const permission = await getForegroundLocationPermissionState().catch(() => null);

      if (permission) {
        setHasLocationPermission(permission.granted);
        setCanAskLocationPermissionAgain(permission.canAskAgain);
      }

      setError(
        formatApiErrorMessage(nextError, "Não foi possível atualizar a permissão de localização agora.")
      );
      setLocationStatus("failed");
    }
  }

  async function handleOpenLocationSettings() {
    if (Platform.OS === "web") {
      return;
    }

    await Linking.openSettings();
  }

  async function handleSave() {
    const distance = Number(maxMatchDistanceKm);
    const parsedMinAge = Number(minAge);
    const parsedMaxAge = Number(maxAge);

    if (!canSave || Number.isNaN(distance)) {
      setError(
        "Preencha objetivo, gêneros desejados, afinidade de linguagem do amor, faixa etária válida e uma distância maior que zero."
      );
      return;
    }

    if (parsedMinAge < 18 || parsedMaxAge < 18) {
      setError("A faixa etária mínima e máxima deve ser de pelo menos 18 anos.");
      return;
    }

    if (parsedMinAge > parsedMaxAge) {
      setError("A idade mínima não pode ser maior que a idade máxima.");
      return;
    }

    try {
      setSaving(true);
      setError("");

      await profileService.saveMatchPreferences({
        connectionTypeId,
        accessibilityNeedSimilarity,
        autonomyCompatibility,
        lifestyleSimilarity,
        energyLevelSimilarity,
        loveLanguageSimilarity,
        minAge: parsedMinAge,
        maxAge: parsedMaxAge,
        maxMatchDistanceKm: distance,
        desiredGenderIds,
      });

      router.replace("/home");
    } catch (error) {
      setError(formatApiErrorMessage(error, "Não foi possível salvar suas preferências."));
    } finally {
      setSaving(false);
    }
  }

  return (
    <View className="flex-1 bg-[#131313]">
      <SafeAreaView className="flex-1">
        <View className="h-16 flex-row items-center justify-between border-b-2 border-[#262626] bg-[#0E0E0E] px-6">
          <View className="flex-row items-center">
            <Pressable className="mr-3 h-10 w-10 items-center justify-center rounded-full" onPress={() => router.replace("/onboarding/profile")}>
              <Ionicons name="arrow-back" size={24} color="#E5E2E1" />
            </Pressable>
            <Text className="text-2xl font-black text-[#7C4DFF]">Unify</Text>
          </View>
          <Text className="text-[14px] font-bold text-[#CAC3D8]">Passo 2 de 2</Text>
        </View>

        {loading ? (
          <View className="flex-1 items-center justify-center">
            <ActivityIndicator color="#CDBDFF" />
          </View>
        ) : (
          <ScrollView
            className="flex-1"
            contentContainerClassName="mx-auto w-full max-w-[720px] px-6 pb-10 pt-8"
            keyboardShouldPersistTaps="handled"
          >
            <View className="mb-8">
              <Text className="mb-2 text-[32px] font-extrabold leading-10 text-white">
                Preferências de match
              </Text>
              <Text className="text-[16px] font-medium leading-6 text-[#CAC3D8]">
                Conte o que você busca para encontrarmos conexões com mais afinidade.
              </Text>
            </View>

            {options ? (
              <>
                <View className="mb-8">
                  <SectionTitle icon="flag-outline" title="Qual seu objetivo?" />
                  <View className="flex-row flex-wrap gap-3">
                    {options.connectionTypes.map((option: LookupOptionResponse) => (
                      <ChoiceCard
                        key={option.id}
                        label={option.description}
                        selected={connectionTypeId === option.id}
                        onPress={() => setConnectionTypeId(option.id)}
                      />
                    ))}
                  </View>
                </View>

                <View className="mb-8">
                  <SectionTitle icon="heart-outline" title="Interesse em" />
                  <View className="flex-row flex-wrap gap-2">
                    {options.genders.map((option) => (
                      option.id !== 4 ? (
                      <Pressable
                        key={option.id}
                        className={`min-h-[22px] rounded-full border-2 px-5 py-3 ${
                          desiredGenderIds.includes(option.id)
                            ? "border-[#7C4DFF] bg-[#7C4DFF]"
                            : "border-[#262626] bg-[#201F1F]"
                        }`}
                        onPress={() => setDesiredGenderIds(toggleId(desiredGenderIds, option.id))}
                      >
                        <View className="flex-row items-center justify-center">
                          {desiredGenderIds.includes(option.id) ? (
                            <Ionicons name="checkmark-circle" size={18} color="#FFFFFF" />
                          ) : null}
                          <Text className={`text-center text-[16px] font-bold text-white ${desiredGenderIds.includes(option.id) ? "ml-2" : ""}`}>
                            {option.description}
                          </Text>
                        </View>
                      </Pressable>
                      ) : null
                    ))}
                  </View>
                </View>
              </>
            ) : null}

            <View className="mb-8">
              <SectionTitle icon="calendar-outline" title="Faixa etária desejada" />
              <View className="flex-row gap-3">
                <TextInput
                  className="min-h-[56px] flex-1 rounded-t-lg border-b-2 border-[#948EA1] bg-[#1C1B1B] px-4 text-[16px] text-white"
                  keyboardType="numeric"
                  placeholder="Idade mínima (18)"
                  placeholderTextColor="#948EA1"
                  value={minAge}
                  onChangeText={setMinAge}
                />
                <TextInput
                  className="min-h-[56px] flex-1 rounded-t-lg border-b-2 border-[#948EA1] bg-[#1C1B1B] px-4 text-[16px] text-white"
                  keyboardType="numeric"
                  placeholder="Idade máxima (18+)"
                  placeholderTextColor="#948EA1"
                  value={maxAge}
                  onChangeText={setMaxAge}
                />
              </View>
              <Text className="mt-2 text-[13px] font-semibold text-[#CAC3D8]">
                Defina a faixa etária que você deseja encontrar.
              </Text>
            </View>

            <View className="mb-8">
              <SectionTitle icon="navigate-outline" title="Distância máxima" />
              <View className="rounded-lg border border-[#353534] bg-[#201F1F] px-4 py-4">
                <TextInput
                  className="h-14 rounded-t-lg border-b-2 border-[#948EA1] bg-[#1C1B1B] px-4 text-[18px] font-bold text-white"
                  keyboardType="numeric"
                  placeholder="30"
                  placeholderTextColor="#948EA1"
                  value={maxMatchDistanceKm}
                  onChangeText={setMaxMatchDistanceKm}
                />
                <Text className="mt-2 text-[13px] font-semibold text-[#CAC3D8]">
                  Quilômetros até a conexão sugerida.
                </Text>
                {hasLocationPermission ? (
                  <Text className="mt-3 text-[13px] font-bold text-[#5DDB85]">
                    Acesso à localização já está liberado.
                  </Text>
                ) : (
                  <Text className="mt-3 text-[13px] font-semibold text-[#CAC3D8]">
                    {showLocationSettingsButton
                      ? "O acesso foi bloqueado no celular. Abra os ajustes do aparelho para liberar a localização."
                      : "Conceda o acesso à localização para usar a distância dos matches com base no GPS."}
                  </Text>
                )}

                {!hasLocationPermission && !showLocationSettingsButton ? (
                  <Pressable
                    className={`mt-4 h-12 items-center justify-center rounded-xl ${locationStatus === "requesting" ? "bg-[#CFCF62]" : "bg-[#EAEA00]"}`}
                    disabled={locationStatus === "requesting"}
                    onPress={() => void handleGrantLocationAccess()}
                  >
                    {locationStatus === "requesting" ? (
                      <ActivityIndicator color="#323200" size="small" />
                    ) : (
                      <Text className="text-[15px] font-black text-[#323200]">
                        Conceder acesso a localização
                      </Text>
                    )}
                  </Pressable>
                ) : null}

                {showLocationSettingsButton ? (
                  <Pressable
                    className="mt-4 h-12 items-center justify-center rounded-xl border border-[#5DDB85] bg-[#132519]"
                    onPress={() => void handleOpenLocationSettings()}
                  >
                    <Text className="text-[15px] font-black text-[#5DDB85]">
                      Ir para os ajustes do celular
                    </Text>
                  </Pressable>
                ) : null}

                {locationStatus === "failed" && !hasLocationPermission ? (
                  <Text className="mt-3 text-[13px] font-semibold text-red-300">
                    Não foi possível obter a permissão de localização agora. Tente novamente.
                  </Text>
                ) : null}
              </View>
            </View>

            <View className="mb-8">
              <SectionTitle icon="options-outline" title="Afinidades" />
              <SimilaritySelector
                title="Necessidades de acessibilidade"
                value={accessibilityNeedSimilarity}
                options={similarityOptions}
                onChange={setAccessibilityNeedSimilarity}
              />
              <SimilaritySelector
                title="Autonomia"
                value={autonomyCompatibility}
                options={similarityOptions}
                onChange={setAutonomyCompatibility}
              />
              <SimilaritySelector
                title="Estilo de vida"
                value={lifestyleSimilarity}
                options={similarityOptions}
                onChange={setLifestyleSimilarity}
              />
              <SimilaritySelector
                title="Energia social"
                value={energyLevelSimilarity}
                options={similarityOptions}
                onChange={setEnergyLevelSimilarity}
              />
              <SimilaritySelector
                title="Linguagens do amor"
                value={loveLanguageSimilarity}
                options={similarityOptions}
                onChange={setLoveLanguageSimilarity}
              />
            </View>

            {error ? (
              <Text className="mb-4 text-center text-[13px] font-semibold text-red-300">
                {error}
              </Text>
            ) : null}

            <Pressable
              className={`h-14 items-center justify-center rounded-lg ${saving ? "bg-[#CDCD00]" : "bg-[#EAEA00]"}`}
              disabled={saving}
              onPress={handleSave}
            >
              {saving ? (
                <ActivityIndicator color="#323200" />
              ) : (
                <Text className="text-[17px] font-black text-[#323200]">
                  Finalizar cadastro
                </Text>
              )}
            </Pressable>
          </ScrollView>
        )}
      </SafeAreaView>
    </View>
  );
}
