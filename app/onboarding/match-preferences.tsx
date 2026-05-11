import { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";
import { useRouter } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";

import { profileService } from "../../src/services/profileService";
import type {
  LookupOptionResponse,
  ProfileOptionsResponse,
  SimilarityPreference,
  SimilarityOptionResponse,
} from "../../src/types/profile";
import { formatApiErrorMessage } from "../../src/utils/auth";

function toggleId(currentIds: number[], id: number): number[] {
  return currentIds.includes(id)
    ? currentIds.filter((currentId) => currentId !== id)
    : [...currentIds, id];
}

function ChoiceCard({
  label,
  selected,
  onPress,
}: {
  label: string;
  selected: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      className={`min-h-[56px] flex-1 basis-[46%] flex-row items-center justify-between rounded-lg border-2 px-5 py-3 ${
        selected
          ? "border-[#EAEA00] bg-[#EAEA00]/10"
          : "border-[#262626] bg-[#201F1F]"
      }`}
      onPress={onPress}
    >
      <Text className="flex-1 text-[16px] font-bold text-white">{label}</Text>
      {selected ? <Ionicons name="checkmark-circle" size={22} color="#EAEA00" /> : null}
    </Pressable>
  );
}

function SectionTitle({ icon, title }: { icon: keyof typeof Ionicons.glyphMap; title: string }) {
  return (
    <View className="mb-3 flex-row items-center">
      <Ionicons name={icon} size={22} color="#00DAF3" />
      <Text className="ml-2 text-[22px] font-bold text-white">{title}</Text>
    </View>
  );
}

function SimilaritySelector({
  title,
  value,
  options,
  onChange,
}: {
  title: string;
  value: SimilarityPreference;
  options: SimilarityOptionResponse[];
  onChange: (value: SimilarityPreference) => void;
}) {
  return (
    <View className="mb-6">
      <Text className="mb-3 text-[15px] font-bold text-[#CAC3D8]">{title}</Text>
      <View className="flex-row flex-wrap gap-3">
        {options.map((option) => {
          const selected = option.value === value;

          return (
            <Pressable
              key={option.value}
              className={`min-h-[48px] rounded-full border-2 px-4 py-3 ${
                selected
                  ? "border-[#7C4DFF] bg-[#7C4DFF]"
                  : "border-[#494455] bg-transparent"
              }`}
              onPress={() => onChange(option.value)}
            >
              <Text className="text-[14px] font-bold text-white">
                {option.description}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

export default function MatchPreferencesOnboarding() {
  const router = useRouter();
  const [options, setOptions] = useState<ProfileOptionsResponse | null>(null);
  const [connectionTypeId, setConnectionTypeId] = useState<number | undefined>();
  const [desiredGenderIds, setDesiredGenderIds] = useState<number[]>([]);
  const [accessibilityNeedSimilarity, setAccessibilityNeedSimilarity] =
    useState<SimilarityPreference>("ANY");
  const [autonomyCompatibility, setAutonomyCompatibility] =
    useState<SimilarityPreference>("SIMILAR");
  const [lifestyleSimilarity, setLifestyleSimilarity] =
    useState<SimilarityPreference>("SIMILAR");
  const [energyLevelSimilarity, setEnergyLevelSimilarity] =
    useState<SimilarityPreference>("ANY");
  const [maxMatchDistanceKm, setMaxMatchDistanceKm] = useState("30");
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
    () =>
      Boolean(connectionTypeId) &&
      desiredGenderIds.length > 0 &&
      Number(maxMatchDistanceKm) > 0,
    [connectionTypeId, desiredGenderIds.length, maxMatchDistanceKm]
  );

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
        setAutonomyCompatibility(preferences.autonomyCompatibility ?? "SIMILAR");
        setLifestyleSimilarity(preferences.lifestyleSimilarity ?? "SIMILAR");
        setEnergyLevelSimilarity(preferences.energyLevelSimilarity ?? "ANY");
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

  async function handleSave() {
    const distance = Number(maxMatchDistanceKm);

    if (!canSave || Number.isNaN(distance)) {
      setError("Preencha objetivo, gêneros desejados e uma distância maior que zero.");
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
              <View className="mb-2 h-3 w-full overflow-hidden rounded-full border border-[#262626] bg-[#201F1F]">
                <View className="h-full w-full bg-[#7C4DFF]" />
              </View>
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
                  <View className="flex-row flex-wrap gap-3">
                    {options.genders.map((option) => (
                      <Pressable
                        key={option.id}
                        className={`min-h-[52px] flex-1 rounded-full border-2 px-5 py-3 ${
                          desiredGenderIds.includes(option.id)
                            ? "border-[#7C4DFF] bg-[#7C4DFF]"
                            : "border-[#262626] bg-[#201F1F]"
                        }`}
                        onPress={() => setDesiredGenderIds(toggleId(desiredGenderIds, option.id))}
                      >
                        <Text className="text-center text-[16px] font-bold text-white">
                          {option.description}
                        </Text>
                      </Pressable>
                    ))}
                  </View>
                </View>
              </>
            ) : null}

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
