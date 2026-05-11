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
import * as Location from "expo-location";
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

function isIoniconName(
  value?: string | null
): value is keyof typeof Ionicons.glyphMap {
  return typeof value === "string" && value in Ionicons.glyphMap;
}

function OptionChip({
  label,
  selected,
  iconName,
  onPress,
}: {
  label: string;
  selected: boolean;
  iconName?: keyof typeof Ionicons.glyphMap;
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
      {iconName ? (
        <Ionicons
          name={iconName}
          size={18}
          color={selected ? "#323200" : "#E5E2E1"}
        />
      ) : selected ? (
        <Ionicons name="checkmark-circle" size={18} color="#323200" />
      ) : null}
      <Text
        className={`text-[15px] font-bold ${(selected || iconName) ? "ml-2" : ""} ${selected ? "text-[#323200]" : "text-[#E5E2E1]"}`}
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
  showOptionIcons = false,
}: {
  title: string;
  options: LookupOptionResponse[];
  values: number[];
  onChange: (ids: number[]) => void;
  showOptionIcons?: boolean;
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
            iconName={
              showOptionIcons && isIoniconName(option.ionicIcon)
                ? option.ionicIcon
                : undefined
            }
            onPress={() => onChange(toggleId(values, option.id))}
          />
        ))}
      </View>
    </View>
  );
}

type AutoLocation = {
  latitude: number;
  longitude: number;
};

type LocationPermissionState = {
  granted: boolean;
  canAskAgain: boolean;
  status: Location.PermissionStatus;
};

const LOCATION_REQUEST_TIMEOUT_MS = 10000;

function mapPermissionState(
  permission: Location.LocationPermissionResponse
): LocationPermissionState {
  return {
    granted: permission.status === Location.PermissionStatus.GRANTED,
    canAskAgain: permission.canAskAgain,
    status: permission.status,
  };
}

async function waitForCurrentPosition(): Promise<Location.LocationObject | null> {
  let timeoutHandle: ReturnType<typeof setTimeout> | undefined;

  try {
    const currentPosition = await Promise.race<Location.LocationObject | null>([
      Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      }),
      new Promise<null>((resolve) => {
        timeoutHandle = setTimeout(() => {
          resolve(null);
        }, LOCATION_REQUEST_TIMEOUT_MS);
      }),
    ]);

    return currentPosition;
  } finally {
    if (timeoutHandle) {
      clearTimeout(timeoutHandle);
    }
  }
}

async function getForegroundLocationPermissionState(): Promise<LocationPermissionState> {
  const permission = await Location.getForegroundPermissionsAsync();

  return mapPermissionState(permission);
}

async function getCurrentDeviceLocation(): Promise<AutoLocation> {
  const currentPosition = (await waitForCurrentPosition()) ??
    (await Location.getLastKnownPositionAsync());

  if (!currentPosition) {
    throw new Error("Unable to determine device location.");
  }

  return {
    latitude: currentPosition.coords.latitude,
    longitude: currentPosition.coords.longitude,
  };
}

async function requestForegroundLocationPermissionState(): Promise<LocationPermissionState> {
  const currentPermission = await Location.getForegroundPermissionsAsync();

  if (currentPermission.status === Location.PermissionStatus.GRANTED) {
    return mapPermissionState(currentPermission);
  }

  const permission = await Location.requestForegroundPermissionsAsync();

  return mapPermissionState(permission);
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
  const [autoLocation, setAutoLocation] = useState<AutoLocation | null>(null);
  const [hasLocationPermission, setHasLocationPermission] = useState(false);
  const [canAskLocationPermissionAgain, setCanAskLocationPermissionAgain] = useState(true);
  const [locationStatus, setLocationStatus] = useState<
    "idle" | "checking" | "requesting" | "failed"
  >("checking");
  const [isRefreshingLocation, setIsRefreshingLocation] = useState(false);
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
  const showLocationSettingsButton =
    Platform.OS !== "web" && !hasLocationPermission && !canAskLocationPermissionAgain;

  useEffect(() => {
    let active = true;

    async function syncAutomaticLocation(existingLocation: AutoLocation | null) {
      setAutoLocation(existingLocation);
      setLocationStatus("checking");

      if (!active) {
        return;
      }

      try {
        const permission = await getForegroundLocationPermissionState();

        if (!active) {
          return;
        }

        setHasLocationPermission(permission.granted);
        setCanAskLocationPermissionAgain(permission.canAskAgain);

        if (!permission.granted) {
          setLocationStatus("idle");
          return;
        }

        if (existingLocation) {
          setLocationStatus("idle");
          return;
        }

        const currentLocation = await getCurrentDeviceLocation();

        if (!active) {
          return;
        }

        setAutoLocation(currentLocation);
        setLocationStatus("idle");
      } catch {
        if (active) {
          setLocationStatus("failed");
        }
      }
    }

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

        void syncAutomaticLocation(
          profile.activeLocation?.latitude != null &&
            profile.activeLocation?.longitude != null
            ? {
                latitude: profile.activeLocation.latitude,
                longitude: profile.activeLocation.longitude,
              }
            : null
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

  async function handleGrantLocationAccess() {
    try {
      setError("");
      setLocationStatus("requesting");

      const permission = await requestForegroundLocationPermissionState();

      setHasLocationPermission(permission.granted);
      setCanAskLocationPermissionAgain(permission.canAskAgain);

      if (!permission.granted) {
        setLocationStatus("idle");
        return;
      }

      setLocationStatus("idle");
    } catch (nextError) {
      const permission = await getForegroundLocationPermissionState().catch(() => null);

      if (permission) {
        setHasLocationPermission(permission.granted);
        setCanAskLocationPermissionAgain(permission.canAskAgain);
      }

      setError(
        formatApiErrorMessage(nextError, "Não foi possível salvar sua localização agora.")
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
    if (!canSave) {
      setError("Preencha gênero, comunicação, estilo de vida e interesses para continuar.");
      return;
    }

    try {
      setSaving(true);
      setError("");

      let nextLocation = autoLocation ?? undefined;

      if (hasLocationPermission) {
        try {
          setIsRefreshingLocation(true);
          nextLocation = await getCurrentDeviceLocation();
          setAutoLocation(nextLocation);
        } catch {
          nextLocation = autoLocation ?? undefined;
        } finally {
          setIsRefreshingLocation(false);
        }
      }

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
        location: nextLocation,
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
                <MultiChoice title="Tipo de deficiência" options={options.disabilities} values={disabilityIds} onChange={setDisabilityIds} showOptionIcons />
                <MultiChoice title="Necessidades de acessibilidade" options={options.accessibilityNeeds} values={accessibilityNeedIds} onChange={setAccessibilityNeedIds} />
                <SingleChoice title="Nível de autonomia" options={options.autonomyLevels} value={autonomyLevelId} onChange={setAutonomyLevelId} />
                <MultiChoice title="Formas de comunicação" options={options.communicationForms} values={communicationFormIds} onChange={setCommunicationFormIds} />
                <MultiChoice title="Estilo de vida" options={options.lifestyleTypes} values={lifestyleTypeIds} onChange={setLifestyleTypeIds} />
                <SingleChoice title="Nível de energia" options={options.energyLevels} value={energyLevelId} onChange={setEnergyLevelId} />
                <MultiChoice title="Interesses & Hobbies" options={options.interestTypes} values={interestTypeIds} onChange={setInterestTypeIds} />
              </>
            ) : null}

            <View className="mb-8">
              <Text className="mb-3 text-[22px] font-bold text-white">Localização</Text>
              <View className="rounded-lg border border-[#353534] bg-[#201F1F] px-4 py-4">
                <View className="flex-row items-start">
                  <Ionicons
                    name={
                      hasLocationPermission
                        ? "checkmark-circle"
                        : locationStatus === "requesting"
                          ? "radio-outline"
                          : locationStatus === "failed"
                            ? "alert-circle-outline"
                            : "location-outline"
                    }
                    size={20}
                    color={hasLocationPermission ? "#5DDB85" : "#00DAF3"}
                  />
                  <View className="ml-3 flex-1">
                    <Text className="text-[16px] font-bold text-white">
                      {hasLocationPermission
                        ? "Localização liberada"
                        : locationStatus === "requesting"
                          ? "Solicitando acesso à localização"
                          : "Localização automática"}
                    </Text>
                    {hasLocationPermission ? (
                      <Text className="mt-2 text-[13px] font-bold text-[#5DDB85]">
                        Acesso à localização já está liberado.
                      </Text>
                    ) : null}
                    <Text className="mt-1 text-[13px] font-semibold leading-5 text-[#CAC3D8]">
                      {locationStatus === "failed"
                          ? "Não conseguimos atualizar sua localização agora. Você ainda pode continuar e tentar novamente depois."
                          : hasLocationPermission
                            ? autoLocation
                              ? "Sua localização atual será usada para alimentar as preferências de distância."
                              : "O acesso já foi concedido. Assim que a posição estiver disponível, ela será usada nos matches por distância."
                            : showLocationSettingsButton
                              ? "O acesso foi bloqueado no celular. Abra os ajustes do aparelho para liberar a localização."
                              : "Conceda o acesso à sua localização para melhorar os matches por distância. Você ainda pode continuar sem isso."}
                    </Text>

                    {!hasLocationPermission ? (
                      <Pressable
                        className={`mt-4 h-12 items-center justify-center rounded-xl ${locationStatus === "requesting" ? "bg-[#CFCF62]" : "bg-[#EAEA00]"}`}
                        disabled={locationStatus === "requesting"}
                        onPress={() => void handleGrantLocationAccess()}
                      >
                        {locationStatus === "requesting" ? (
                          <ActivityIndicator color="#323200" size="small" />
                        ) : (
                          <Text className="text-[15px] font-black text-[#323200]">
                            Habilitar GPS
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
                  </View>
                </View>
              </View>
            </View>

            {error ? (
              <Text className="mb-4 text-center text-[13px] font-semibold text-red-300">
                {error}
              </Text>
            ) : null}

            {isRefreshingLocation ? (
              <View className="mb-4 flex-row items-center justify-center rounded-lg border border-[#2E4952] bg-[#112028] px-4 py-3">
                <ActivityIndicator color="#00DAF3" size="small" />
                <Text className="ml-3 text-center text-[13px] font-semibold text-[#BFEFFF]">
                  Atualizando sua localização antes de salvar o perfil...
                </Text>
              </View>
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
