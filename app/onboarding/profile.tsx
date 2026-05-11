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
import type { LookupOptionResponse, ProfileOptionsResponse } from "../../src/types/profile";
import { formatApiErrorMessage } from "../../src/utils/auth";

function idsFromOptions(options?: LookupOptionResponse[] | null): number[] {
  return options?.map((option) => option.id) ?? [];
}

function toggleId(currentIds: number[], id: number): number[] {
  return currentIds.includes(id)
    ? currentIds.filter((currentId) => currentId !== id)
    : [...currentIds, id];
}

function OptionChip({
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
      className={`min-h-[52px] flex-row items-center rounded-full border-2 px-5 py-3 ${
        selected
          ? "border-[#EAEA00] bg-[#EAEA00]"
          : "border-[#494455] bg-transparent"
      }`}
      onPress={onPress}
    >
      {selected ? (
        <Ionicons name="checkmark-circle" size={18} color="#323200" />
      ) : null}
      <Text
        className={`text-[15px] font-bold ${selected ? "ml-2 text-[#323200]" : "text-[#E5E2E1]"}`}
      >
        {label}
      </Text>
    </Pressable>
  );
}

function SingleChoice({
  title,
  options,
  value,
  onChange,
}: {
  title: string;
  options: LookupOptionResponse[];
  value?: number;
  onChange: (id: number) => void;
}) {
  return (
    <View className="mb-8">
      <Text className="mb-3 text-[22px] font-bold text-white">{title}</Text>
      <View className="flex-row flex-wrap gap-3">
        {options.map((option) => (
          <OptionChip
            key={option.id}
            label={option.description}
            selected={value === option.id}
            onPress={() => onChange(option.id)}
          />
        ))}
      </View>
    </View>
  );
}

function MultiChoice({
  title,
  options,
  values,
  onChange,
}: {
  title: string;
  options: LookupOptionResponse[];
  values: number[];
  onChange: (ids: number[]) => void;
}) {
  return (
    <View className="mb-8">
      <Text className="mb-3 text-[22px] font-bold text-white">{title}</Text>
      <View className="flex-row flex-wrap gap-3">
        {options.map((option) => (
          <OptionChip
            key={option.id}
            label={option.description}
            selected={values.includes(option.id)}
            onPress={() => onChange(toggleId(values, option.id))}
          />
        ))}
      </View>
    </View>
  );
}

export default function ProfileOnboarding() {
  const router = useRouter();
  const [options, setOptions] = useState<ProfileOptionsResponse | null>(null);
  const [bio, setBio] = useState("");
  const [genderId, setGenderId] = useState<number | undefined>();
  const [disabilityIds, setDisabilityIds] = useState<number[]>([]);
  const [accessibilityNeedIds, setAccessibilityNeedIds] = useState<number[]>([]);
  const [autonomyLevelId, setAutonomyLevelId] = useState<number | undefined>();
  const [communicationFormIds, setCommunicationFormIds] = useState<number[]>([]);
  const [lifestyleTypeIds, setLifestyleTypeIds] = useState<number[]>([]);
  const [energyLevelId, setEnergyLevelId] = useState<number | undefined>();
  const [interestTypeIds, setInterestTypeIds] = useState<number[]>([]);
  const [latitude, setLatitude] = useState("");
  const [longitude, setLongitude] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const bioLength = bio.trim().length;
  const canSave = useMemo(
    () =>
      Boolean(genderId) &&
      communicationFormIds.length > 0 &&
      lifestyleTypeIds.length > 0 &&
      interestTypeIds.length > 0,
    [communicationFormIds.length, genderId, interestTypeIds.length, lifestyleTypeIds.length]
  );

  useEffect(() => {
    let active = true;

    async function loadProfile() {
      try {
        const [nextOptions, profile] = await Promise.all([
          profileService.getOptions(),
          profileService.getProfile(),
        ]);

        if (!active) {
          return;
        }

        setOptions(nextOptions);
        setBio(profile.bio ?? "");
        setGenderId(profile.gender?.id);
        setDisabilityIds(idsFromOptions(profile.disabilities));
        setAccessibilityNeedIds(idsFromOptions(profile.accessibilityNeeds));
        setAutonomyLevelId(profile.autonomyLevel?.id);
        setCommunicationFormIds(idsFromOptions(profile.communicationForms));
        setLifestyleTypeIds(idsFromOptions(profile.lifestyleTypes));
        setEnergyLevelId(profile.energyLevel?.id);
        setInterestTypeIds(idsFromOptions(profile.interestTypes));
        setLatitude(
          profile.activeLocation?.latitude == null
            ? ""
            : String(profile.activeLocation.latitude)
        );
        setLongitude(
          profile.activeLocation?.longitude == null
            ? ""
            : String(profile.activeLocation.longitude)
        );
      } catch (error) {
        if (active) {
          setError(formatApiErrorMessage(error, "Não foi possível carregar seu perfil."));
        }
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    }

    void loadProfile();

    return () => {
      active = false;
    };
  }, []);

  async function handleSave() {
    if (!canSave) {
      setError("Preencha gênero, comunicação, estilo de vida e interesses para continuar.");
      return;
    }

    const parsedLatitude = latitude.trim() ? Number(latitude.replace(",", ".")) : null;
    const parsedLongitude = longitude.trim() ? Number(longitude.replace(",", ".")) : null;

    if (
      (parsedLatitude === null) !== (parsedLongitude === null) ||
      (parsedLatitude !== null && (Number.isNaN(parsedLatitude) || parsedLatitude < -90 || parsedLatitude > 90)) ||
      (parsedLongitude !== null && (Number.isNaN(parsedLongitude) || parsedLongitude < -180 || parsedLongitude > 180))
    ) {
      setError("Informe latitude e longitude válidas, ou deixe os dois campos vazios.");
      return;
    }

    try {
      setSaving(true);
      setError("");

      await profileService.saveProfile({
        bio: bio.trim(),
        genderId,
        disabilityIds,
        accessibilityNeedIds,
        autonomyLevelId,
        communicationFormIds,
        lifestyleTypeIds,
        energyLevelId,
        interestTypeIds,
        location:
          parsedLatitude !== null && parsedLongitude !== null
            ? { latitude: parsedLatitude, longitude: parsedLongitude }
            : undefined,
      });

      router.replace("/onboarding/match-preferences");
    } catch (error) {
      setError(formatApiErrorMessage(error, "Não foi possível salvar seu perfil."));
    } finally {
      setSaving(false);
    }
  }

  return (
    <View className="flex-1 bg-[#131313]">
      <SafeAreaView className="flex-1">
        <View className="h-16 flex-row items-center justify-between border-b-2 border-[#262626] bg-[#0E0E0E] px-6">
          <View className="flex-row items-center">
            <Pressable className="mr-3 h-10 w-10 items-center justify-center rounded-full" onPress={() => router.back()}>
              <Ionicons name="arrow-back" size={24} color="#E5E2E1" />
            </Pressable>
            <Text className="text-2xl font-black text-[#7C4DFF]">Unify</Text>
          </View>
          <Text className="text-[14px] font-bold text-[#CAC3D8]">Passo 1 de 2</Text>
        </View>

        {loading ? (
          <View className="flex-1 items-center justify-center">
            <ActivityIndicator color="#CDBDFF" />
          </View>
        ) : (
          <ScrollView
            className="flex-1"
            contentContainerClassName="mx-auto w-full max-w-[640px] px-6 pb-10 pt-8"
            keyboardShouldPersistTaps="handled"
          >
            <View className="mb-8">
              <Text className="mb-2 text-[32px] font-extrabold leading-10 text-white">
                Complete seu perfil
              </Text>
              <Text className="text-[16px] font-medium leading-6 text-[#CAC3D8]">
                Mostre quem você é e encontre conexões que fazem sentido.
              </Text>
            </View>

            <View className="mb-8">
              <Text className="mb-3 text-[22px] font-bold text-white">Sobre você</Text>
              <TextInput
                className="min-h-[128px] rounded-lg border-2 border-[#494455] bg-[#1C1B1B] px-4 py-4 text-[16px] leading-6 text-white"
                multiline
                maxLength={500}
                placeholder="Conte-nos um pouco sobre você..."
                placeholderTextColor="#948EA1"
                textAlignVertical="top"
                value={bio}
                onChangeText={setBio}
              />
              <Text className="mt-1 text-right text-[12px] font-semibold text-[#948EA1]">
                {bioLength} / 500
              </Text>
            </View>

            {options ? (
              <>
                <SingleChoice title="Gênero" options={options.genders} value={genderId} onChange={setGenderId} />
                <MultiChoice title="Tipo de deficiência" options={options.disabilities} values={disabilityIds} onChange={setDisabilityIds} />
                <MultiChoice title="Necessidades de acessibilidade" options={options.accessibilityNeeds} values={accessibilityNeedIds} onChange={setAccessibilityNeedIds} />
                <SingleChoice title="Nível de autonomia" options={options.autonomyLevels} value={autonomyLevelId} onChange={setAutonomyLevelId} />
                <MultiChoice title="Formas de comunicação" options={options.communicationForms} values={communicationFormIds} onChange={setCommunicationFormIds} />
                <MultiChoice title="Estilo de vida" options={options.lifestyleTypes} values={lifestyleTypeIds} onChange={setLifestyleTypeIds} />
                <SingleChoice title="Nível de energia" options={options.energyLevels} value={energyLevelId} onChange={setEnergyLevelId} />
                <MultiChoice title="Interesses & Hobbies" options={options.interestTypes} values={interestTypeIds} onChange={setInterestTypeIds} />
              </>
            ) : null}

            <View className="mb-8">
              <Text className="mb-3 text-[22px] font-bold text-white">Onde você está?</Text>
              <View className="flex-row gap-3">
                <TextInput
                  className="min-h-[56px] flex-1 rounded-t-lg border-b-2 border-[#948EA1] bg-[#1C1B1B] px-4 text-[16px] text-white"
                  keyboardType="numeric"
                  placeholder="Latitude"
                  placeholderTextColor="#948EA1"
                  value={latitude}
                  onChangeText={setLatitude}
                />
                <TextInput
                  className="min-h-[56px] flex-1 rounded-t-lg border-b-2 border-[#948EA1] bg-[#1C1B1B] px-4 text-[16px] text-white"
                  keyboardType="numeric"
                  placeholder="Longitude"
                  placeholderTextColor="#948EA1"
                  value={longitude}
                  onChangeText={setLongitude}
                />
              </View>
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
                  Continuar
                </Text>
              )}
            </Pressable>
          </ScrollView>
        )}
      </SafeAreaView>
    </View>
  );
}
