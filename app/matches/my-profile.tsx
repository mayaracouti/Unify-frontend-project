import { type PropsWithChildren, useEffect, useRef, useState } from "react";
import Ionicons from "@expo/vector-icons/Ionicons";
import { useRouter } from "expo-router";
import {
  ActivityIndicator,
  Image,
  Modal,
  PanResponder,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { useRequireCompletedOnboarding } from "../../src/hooks/useRequireCompletedOnboarding";
import { profileService } from "../../src/services/profileService";
import { getAuthSnapshot, subscribeToAuthStorage } from "../../src/storage/tokenStorage";
import type { UserProfileResponse } from "../../src/types/profile";
import { formatApiErrorMessage } from "../../src/utils/auth";

const DISCOVERY_ACCENT = "#7C4DFF";

function buildDisplayName(profile: UserProfileResponse | null) {
  const firstName = profile?.user?.name ?? profile?.name;
  const displayName = firstName?.trim();

  return displayName || "Perfil";
}

function getPrimaryProfilePhotoUrl(profile: UserProfileResponse | null) {
  const firstAttachedPhoto = profile?.profilePicture ?? profile?.galleryImages?.[0];

  return profileService.resolveProfileImageUrl(firstAttachedPhoto?.url);
}

function AuthenticatedProfileImage({
  authToken,
  uri,
}: {
  authToken: string | null;
  uri: string;
}) {
  const [resolvedUri, setResolvedUri] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let disposed = false;

    async function blobToDataUri(blob: Blob) {
      return await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();

        reader.onloadend = () => {
          if (typeof reader.result === "string") {
            resolve(reader.result);
            return;
          }

          reject(new Error("Unable to read image."));
        };
        reader.onerror = () => reject(reader.error ?? new Error("Unable to read image."));
        reader.readAsDataURL(blob);
      });
    }

    async function loadImage() {
      setFailed(false);
      setResolvedUri(null);

      const attempts = authToken
        ? [{ Authorization: `Bearer ${authToken}` }, undefined]
        : [undefined];

      for (const headers of attempts) {
        const response = await fetch(uri, headers ? { headers } : undefined);

        if (!response.ok) {
          continue;
        }

        const dataUri = await blobToDataUri(await response.blob());

        if (!disposed) {
          setResolvedUri(dataUri);
        }

        return;
      }

      throw new Error("Image request failed.");
    }

    void loadImage().catch(() => {
      if (!disposed) {
        setFailed(true);
      }
    });

    return () => {
      disposed = true;
    };
  }, [authToken, uri]);

  if (failed) {
    return (
      <View className="flex-1 items-center justify-center bg-[#2D2A33]">
        <Ionicons name="person" size={58} color="#CAC3D8" />
      </View>
    );
  }

  if (!resolvedUri) {
    return (
      <View className="flex-1 items-center justify-center bg-[#2D2A33]">
        <ActivityIndicator color="#EAEA00" size="small" />
      </View>
    );
  }

  return (
    <Image
      accessibilityIgnoresInvertColors
      className="h-full w-full"
      resizeMode="cover"
      source={{ uri: resolvedUri }}
    />
  );
}

function DiscoverySlider({
  max = 100,
  min = 0,
  onChange,
  value,
  values,
}: {
  max?: number;
  min?: number;
  onChange: (value: number | [number, number]) => void;
  value?: number;
  values?: [number, number];
}) {
  const [trackWidth, setTrackWidth] = useState(0);
  const activeThumbRef = useRef<"first" | "second">("first");
  const activeValues = values ?? [value ?? min, value ?? min];
  const firstPercent = ((activeValues[0] - min) / (max - min)) * 100;
  const secondPercent = ((activeValues[1] - min) / (max - min)) * 100;

  function updateFromGesture(locationX: number, thumb: "first" | "second") {
    if (trackWidth <= 0) {
      return;
    }

    const boundedX = Math.min(Math.max(locationX, 0), trackWidth);
    const nextValue = Math.round(min + (boundedX / trackWidth) * (max - min));

    if (!values) {
      onChange(nextValue);
      return;
    }

    if (thumb === "first") {
      onChange([Math.min(nextValue, values[1]), values[1]]);
      return;
    }

    onChange([values[0], Math.max(nextValue, values[0])]);
  }

  function getNearestThumb(locationX: number) {
    if (!values || trackWidth <= 0) {
      return "first" as const;
    }

    const firstX = (firstPercent / 100) * trackWidth;
    const secondX = (secondPercent / 100) * trackWidth;

    return Math.abs(locationX - firstX) <= Math.abs(locationX - secondX)
      ? "first"
      : "second";
  }

  const sliderPanResponder = PanResponder.create({
    onMoveShouldSetPanResponder: () => true,
    onStartShouldSetPanResponder: () => true,
    onPanResponderGrant: (event) => {
      const nextThumb = getNearestThumb(event.nativeEvent.locationX);
      activeThumbRef.current = nextThumb;
      updateFromGesture(event.nativeEvent.locationX, nextThumb);
    },
    onPanResponderMove: (event) => {
      updateFromGesture(event.nativeEvent.locationX, activeThumbRef.current);
    },
  });

  return (
    <View
      {...sliderPanResponder.panHandlers}
      className="mt-7 h-8 justify-center"
      onLayout={(event) => setTrackWidth(event.nativeEvent.layout.width)}
    >
      <View className="h-1 rounded-full bg-[#81818C]" />
      <View
        className="absolute h-1 rounded-full"
        style={{
          backgroundColor: DISCOVERY_ACCENT,
          left: values ? `${firstPercent}%` : 0,
          width: values
            ? `${secondPercent - firstPercent}%`
            : `${firstPercent}%`,
        }}
      />
      <View
        className="absolute h-7 w-7 rounded-full"
        style={{
          backgroundColor: DISCOVERY_ACCENT,
          left: `${firstPercent}%`,
          marginLeft: -14,
        }}
      />
      {values ? (
        <View
          className="absolute h-7 w-7 rounded-full"
          style={{
            backgroundColor: DISCOVERY_ACCENT,
            left: `${secondPercent}%`,
            marginLeft: -14,
          }}
        />
      ) : null}
    </View>
  );
}

function DiscoveryToggle({
  onValueChange,
  value,
}: {
  onValueChange: (value: boolean) => void;
  value: boolean;
}) {
  return (
    <Pressable
      className="h-8 w-16 flex-row items-center justify-end rounded-full border-2 pr-0.5"
      onPress={() => onValueChange(!value)}
      style={{
        alignItems: "center",
        borderColor: DISCOVERY_ACCENT,
        justifyContent: value ? "flex-end" : "flex-start",
        paddingLeft: value ? 0 : 2,
      }}
    >
      <View
        className="h-9 w-9 items-center justify-center rounded-full"
        style={{ backgroundColor: value ? DISCOVERY_ACCENT : "#3A3A43" }}
      >
        <Ionicons
          name={value ? "checkmark" : "close"}
          size={value ? 23 : 20}
          color="#FFFFFF"
        />
      </View>
    </Pressable>
  );
}

function DiscoveryCard({ children }: PropsWithChildren) {
  return (
    <View className="mb-6 rounded-[28px] bg-[#111214] p-5">
      {children}
    </View>
  );
}

function MultiOptionModal({
  onClose,
  onSave,
  options,
  selectedOptions,
  title,
  visible,
}: {
  onClose: () => void;
  onSave: (options: string[]) => void;
  options: string[];
  selectedOptions: string[];
  title: string;
  visible: boolean;
}) {
  const [nextOptions, setNextOptions] = useState<string[]>(selectedOptions);

  useEffect(() => {
    if (visible) {
      setNextOptions(selectedOptions);
    }
  }, [selectedOptions, visible]);

  function toggleOption(option: string) {
    setNextOptions((currentOptions) =>
      currentOptions.includes(option)
        ? currentOptions.filter((item) => item !== option)
        : [...currentOptions, option]
    );
  }

  return (
    <Modal transparent animationType="fade" visible={visible} onRequestClose={onClose}>
      <View className="flex-1 justify-end bg-black/70 px-5 pb-6">
        <Pressable className="absolute inset-0" onPress={onClose} />
        <View className="rounded-[28px] bg-[#111214] p-5">
          <Text className="text-[20px] font-black text-white">{title}</Text>

          <View className="mt-4">
            {options.map((option) => {
              const selected = nextOptions.includes(option);

              return (
                <Pressable
                  key={option}
                  className="mb-3 h-14 flex-row items-center justify-between rounded-[18px] bg-[#1D1F24] px-4"
                  onPress={() => toggleOption(option)}
                >
                  <Text className="text-[16px] font-bold text-white">{option}</Text>
                  {selected ? (
                    <Ionicons name="checkmark-circle" size={24} color={DISCOVERY_ACCENT} />
                  ) : null}
                </Pressable>
              );
            })}
          </View>

          <Pressable
            className="mt-2 h-14 items-center justify-center rounded-[18px]"
            style={{ backgroundColor: DISCOVERY_ACCENT }}
            onPress={() => {
              onSave(nextOptions);
              onClose();
            }}
          >
            <Text className="text-[16px] font-black text-white">Salvar seleção</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

function LocationModal({
  onClose,
  onSave,
  value,
  visible,
}: {
  onClose: () => void;
  onSave: (value: string) => void;
  value: string;
  visible: boolean;
}) {
  const [nextValue, setNextValue] = useState(value);

  useEffect(() => {
    if (visible) {
      setNextValue(value);
    }
  }, [value, visible]);

  return (
    <Modal transparent animationType="fade" visible={visible} onRequestClose={onClose}>
      <View className="flex-1 justify-end bg-black/70 px-5 pb-6">
        <Pressable className="absolute inset-0" onPress={onClose} />
        <View className="rounded-[28px] bg-[#111214] p-5">
          <Text className="text-[20px] font-black text-white">Editar localização</Text>

          <TextInput
            className="mt-5 h-14 rounded-[18px] border border-[#494455] bg-[#1D1F24] px-4 text-[16px] font-bold text-white"
            cursorColor={DISCOVERY_ACCENT}
            onChangeText={setNextValue}
            placeholder="Cidade, país"
            placeholderTextColor="#8B8C98"
            value={nextValue}
          />

          <Pressable
            className="mt-4 h-14 items-center justify-center rounded-[18px]"
            style={{ backgroundColor: DISCOVERY_ACCENT }}
            onPress={() => {
              const trimmedValue = nextValue.trim();

              if (trimmedValue) {
                onSave(trimmedValue);
              }

              onClose();
            }}
          >
            <Text className="text-[16px] font-black text-white">Salvar local</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

export default function MatchMyProfile() {
  useRequireCompletedOnboarding();

  const router = useRouter();
  const [profile, setProfile] = useState<UserProfileResponse | null>(null);
  const [authToken, setAuthToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [maxDistanceKm, setMaxDistanceKm] = useState(37);
  const [expandDistance, setExpandDistance] = useState(true);
  const [ageRange, setAgeRange] = useState<[number, number]>([25, 27]);
  const [expandAgeRange, setExpandAgeRange] = useState(true);
  const [discoveryLocation, setDiscoveryLocation] = useState("");
  const [interestedIn, setInterestedIn] = useState<string[]>([]);
  const [locationModalOpen, setLocationModalOpen] = useState(false);
  const [interestModalOpen, setInterestModalOpen] = useState(false);
  const [appliedMessage, setAppliedMessage] = useState("");

  useEffect(() => {
    let active = true;

    async function loadProfile() {
      try {
        const [nextProfile, authSnapshot] = await Promise.all([
          profileService.getProfile(),
          getAuthSnapshot(),
        ]);

        if (!active) {
          return;
        }

        setProfile(nextProfile);
        setAuthToken(authSnapshot.session?.accessToken ?? null);
      } catch (nextError) {
        if (active) {
          setError(
            formatApiErrorMessage(nextError, "Não foi possível carregar seu perfil.")
          );
        }
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    }

    void loadProfile();

    const unsubscribe = subscribeToAuthStorage((snapshot) => {
      if (active) {
        setAuthToken(snapshot.session?.accessToken ?? null);
      }
    });

    return () => {
      active = false;
      unsubscribe();
    };
  }, []);

  const displayName = buildDisplayName(profile);
  const photoUrl = getPrimaryProfilePhotoUrl(profile);
  const interestedInOptions = [
    "Mulheres",
    "Homens",
    "Todos",
    "Pessoas não binárias",
  ];
  const discoveryLocationLabel = discoveryLocation || "Definir localização";
  const interestedInLabel =
    interestedIn.length > 0 ? interestedIn.join(", ") : "Definir preferência";

  return (
    <View className="flex-1 bg-black">
      <SafeAreaView className="flex-1">
        <LocationModal
          visible={locationModalOpen}
          value={discoveryLocation}
          onClose={() => setLocationModalOpen(false)}
          onSave={(nextLocation) => {
            setDiscoveryLocation(nextLocation);
            setAppliedMessage("");
          }}
        />

        <MultiOptionModal
          visible={interestModalOpen}
          title="Tem interesse em"
          options={interestedInOptions}
          selectedOptions={interestedIn}
          onClose={() => setInterestModalOpen(false)}
          onSave={(options) => {
            setInterestedIn(options);
            setAppliedMessage("");
          }}
        />

        <ScrollView
          className="flex-1"
          contentContainerClassName="px-6 pb-10 pt-5"
          showsVerticalScrollIndicator={false}
        >
          <View className="flex-row items-center justify-between">
            <Pressable
              className="h-10 w-10 items-center justify-center rounded-full bg-[#17181C]"
              onPress={() => router.replace("/matches")}
            >
              <Ionicons name="chevron-back" size={22} color="#FFFFFF" />
            </Pressable>

            <Pressable
              className="h-10 w-10 items-center justify-center rounded-full bg-[#17181C]"
              onPress={() => router.push("/profile/edit-match-preferences")}
            >
              <Ionicons name="settings" size={24} color="#E5E2E1" />
            </Pressable>
          </View>

          <View className="mt-7 rounded-[24px] bg-[#0B0B0D] p-4">
            <View className="flex-row items-center">
              <View className="relative">
                <View className="h-20 w-20 overflow-hidden rounded-full bg-[#2D2A33]">
                  {photoUrl ? (
                    <AuthenticatedProfileImage uri={photoUrl} authToken={authToken} />
                  ) : (
                    <View className="flex-1 items-center justify-center">
                      <Ionicons name="person" size={38} color="#CAC3D8" />
                    </View>
                  )}
                </View>

                <Pressable
                  className="absolute bottom-0 right-0 h-8 w-8 items-center justify-center rounded-full border-[3px] border-black bg-[#2F80ED]"
                  onPress={() => router.push("/profile")}
                >
                  <Ionicons name="camera" size={16} color="#FFFFFF" />
                </Pressable>
              </View>

              <View className="ml-4 flex-1">
                <Text
                  className="text-[25px] font-extrabold text-white"
                  numberOfLines={1}
                  adjustsFontSizeToFit
                  minimumFontScale={0.72}
                >
                  {loading ? "..." : displayName}
                </Text>

                <Pressable
                  className="mt-4 h-12 max-w-[188px] flex-row items-center justify-center rounded-full bg-white px-5"
                  onPress={() => router.push("/profile/edit")}
                >
                  <Ionicons name="pencil" size={18} color="#25262A" />
                  <Text
                    className="ml-2 text-[15px] font-black text-[#25262A]"
                    numberOfLines={1}
                  >
                    Editar perfil
                  </Text>
                </Pressable>
              </View>
            </View>
          </View>

          {error ? (
            <View className="mt-8 rounded-[20px] bg-[#2A1216] p-4">
              <Text className="text-[14px] font-bold text-red-200">{error}</Text>
            </View>
          ) : null}

          <View className="mt-9">
            <Text className="text-[24px] font-black text-white">
              Ajustes de descoberta
            </Text>

            <DiscoveryCard>
              <Text className="text-[18px] font-black text-white">
                Localização
              </Text>

              <Pressable
                className="mt-5 flex-row items-center"
                onPress={() => setLocationModalOpen(true)}
              >
                <Ionicons name="location" size={34} color={DISCOVERY_ACCENT} />
                <Text className="ml-4 text-[22px] font-semibold text-white">
                  {discoveryLocationLabel}
                </Text>
              </Pressable>

              <Pressable
                className="mt-5"
                onPress={() => setLocationModalOpen(true)}
              >
                <Text
                  className="text-[18px] font-black"
                  style={{ color: DISCOVERY_ACCENT }}
                >
                  Adicionar novo local
                </Text>
              </Pressable>
            </DiscoveryCard>

            <Text className="-mt-4 mb-6 text-[19px] font-semibold leading-7 text-[#CAC3D8]">
              Mude a localização pra dar match em qualquer lugar.
            </Text>

            <DiscoveryCard>
              <View className="flex-row items-center justify-between">
                <Text className="text-[20px] font-semibold text-white">
                  Distância máxima
                </Text>
                <Text className="text-[20px] font-semibold text-[#CAC3D8]">
                  {maxDistanceKm}km
                </Text>
              </View>

              <DiscoverySlider
                min={1}
                max={150}
                value={maxDistanceKm}
                onChange={(nextValue) => {
                  if (typeof nextValue === "number") {
                    setMaxDistanceKm(nextValue);
                  }
                }}
              />

              <View className="mt-8 flex-row items-center justify-between gap-5">
                <Text className="flex-1 text-[20px] font-semibold leading-8 text-white">
                  Mostrar pessoas mais longe de mim se eu ficar sem perfis pra ver
                </Text>
                <DiscoveryToggle
                  value={expandDistance}
                  onValueChange={setExpandDistance}
                />
              </View>
            </DiscoveryCard>

            <Pressable onPress={() => setInterestModalOpen(true)}>
              <DiscoveryCard>
              <Text className="text-[16px] font-black text-white">
                Tem interesse em
              </Text>
              <View className="mt-4 flex-row items-center justify-between">
                <Text className="text-[22px] font-semibold text-white">
                  {interestedInLabel}
                </Text>
                <Ionicons name="chevron-forward" size={25} color="#8B8C98" />
              </View>
              </DiscoveryCard>
            </Pressable>

            <DiscoveryCard>
              <View className="flex-row items-center justify-between">
                <Text className="text-[20px] font-semibold text-white">
                  Faixa etária
                </Text>
                <Text className="text-[20px] font-semibold text-[#CAC3D8]">
                  {ageRange[0]} - {ageRange[1]}
                </Text>
              </View>

              <DiscoverySlider
                min={18}
                max={80}
                values={ageRange}
                onChange={(nextValue) => {
                  if (Array.isArray(nextValue)) {
                    setAgeRange(nextValue);
                  }
                }}
              />

              <View className="mt-8 flex-row items-center justify-between gap-5">
                <Text className="flex-1 text-[20px] font-semibold leading-8 text-white">
                  Mostrar pessoas um pouco fora da minha faixa de preferência se eu ficar sem perfis pra ver
                </Text>
                <DiscoveryToggle
                  value={expandAgeRange}
                  onValueChange={setExpandAgeRange}
                />
              </View>
            </DiscoveryCard>

            <Pressable
              className="h-14 items-center justify-center rounded-[18px]"
              style={{ backgroundColor: DISCOVERY_ACCENT }}
              onPress={() => setAppliedMessage("Ajustes aplicados nesta sessão.")}
            >
              <Text className="text-[16px] font-black text-white">
                Aplicar ajustes
              </Text>
            </Pressable>

            {appliedMessage ? (
              <Text className="mt-4 text-center text-[14px] font-bold text-[#CDBDFF]">
                {appliedMessage}
              </Text>
            ) : null}

            <View className="mt-7 gap-3">
              <Pressable className="h-14 items-center justify-center rounded-[18px] border border-[#7C4DFF] bg-transparent">
                <Text className="text-[16px] font-black text-[#CDBDFF]">
                  Desativar perfil
                </Text>
              </Pressable>

              <Pressable className="h-14 items-center justify-center rounded-[18px] border border-[#FF6B6B] bg-transparent">
                <Text className="text-[16px] font-black text-[#FFB4AB]">
                  Apagar perfil
                </Text>
              </Pressable>
            </View>
          </View>
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}
