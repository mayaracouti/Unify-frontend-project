import { type PropsWithChildren, useEffect, useRef, useState } from "react";
import Ionicons from "@expo/vector-icons/Ionicons";
import { useRouter } from "expo-router";
import {
  ActivityIndicator,
  Modal,
  PanResponder,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import {
  buildOptionToggleSpeech,
  buildSwitchSpeech,
  joinSpeechParts,
  useTTS,
} from "../../src/accessibility/tts";
import { AuthenticatedRemoteImage } from "../../src/components/profile/authenticated-remote-image";
import { useAccessibility } from "../../src/context/AccessibilityContext";
import { useRequireCompletedOnboarding } from "../../src/hooks/useRequireCompletedOnboarding";
import { profileService } from "../../src/services/profileService";
import { getAuthSnapshot, subscribeToAuthStorage } from "../../src/storage/tokenStorage";
import type { UserProfileResponse } from "../../src/types/profile";
import { announceForAccessibility } from "../../src/utils/accessibilityAnnouncements";
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

function DiscoverySlider({
  accessibilityLabel,
  formatValue,
  max = 100,
  min = 0,
  onChange,
  step = 1,
  value,
  values,
}: {
  accessibilityLabel: string;
  formatValue: (value: number | [number, number]) => string;
  max?: number;
  min?: number;
  onChange: (value: number | [number, number]) => void;
  step?: number;
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

  /**
   * Ajuste por passo, usado tanto pelos gestos de acessibilidade
   * (TalkBack/VoiceOver) quanto pelos botoes -/+ visiveis.
   */
  function adjust(direction: 1 | -1) {
    if (!values) {
      const next = Math.min(max, Math.max(min, (value ?? min) + direction * step));
      onChange(next);
      return;
    }

    // Em modo faixa, o gesto de acessibilidade ajusta o thumb ativo.
    const [first, second] = values;

    if (activeThumbRef.current === "first") {
      onChange([Math.min(Math.max(min, first + direction * step), second), second]);
      return;
    }

    onChange([first, Math.max(Math.min(max, second + direction * step), first)]);
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
    <View className="mt-7">
      {/* O PanResponder sozinho e invisivel para o leitor de tela e impossivel
          de operar sem arrastar: `adjustable` + acoes de acessibilidade cobrem
          o TalkBack/VoiceOver, e os botoes -/+ abaixo cobrem quem nao arrasta. */}
      <View
        {...sliderPanResponder.panHandlers}
        accessible
        accessibilityRole="adjustable"
        accessibilityLabel={accessibilityLabel}
        accessibilityValue={{
          min,
          max,
          now: values ? values[0] : (value ?? min),
          text: formatValue(values ?? value ?? min),
        }}
        accessibilityActions={[
          { name: "increment", label: "Aumentar" },
          { name: "decrement", label: "Diminuir" },
        ]}
        onAccessibilityAction={(event) => {
          if (event.nativeEvent.actionName === "increment") {
            adjust(1);
            return;
          }

          if (event.nativeEvent.actionName === "decrement") {
            adjust(-1);
          }
        }}
        className="h-8 justify-center"
        onLayout={(event) => setTrackWidth(event.nativeEvent.layout.width)}
      >
        <View
          className="h-1 rounded-full bg-[#81818C]"
          importantForAccessibility="no"
        />
        <View
          className="absolute h-1 rounded-full"
          importantForAccessibility="no"
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
          importantForAccessibility="no"
          style={{
            backgroundColor: DISCOVERY_ACCENT,
            left: `${firstPercent}%`,
            marginLeft: -14,
          }}
        />
        {values ? (
          <View
            className="absolute h-7 w-7 rounded-full"
            importantForAccessibility="no"
            style={{
              backgroundColor: DISCOVERY_ACCENT,
              left: `${secondPercent}%`,
              marginLeft: -14,
            }}
          />
        ) : null}
      </View>

      {/* Alternativa motora: alvos de 44x44 para quem nao consegue arrastar. */}
      <View className="mt-3 flex-row items-center justify-between">
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`Diminuir ${accessibilityLabel}`}
          className="h-11 w-11 items-center justify-center rounded-full bg-[#1D1F24]"
          onPress={() => adjust(-1)}
        >
          <Ionicons
            name="remove"
            size={22}
            color="#FFFFFF"
            importantForAccessibility="no"
          />
        </Pressable>

        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`Aumentar ${accessibilityLabel}`}
          className="h-11 w-11 items-center justify-center rounded-full bg-[#1D1F24]"
          onPress={() => adjust(1)}
        >
          <Ionicons
            name="add"
            size={22}
            color="#FFFFFF"
            importantForAccessibility="no"
          />
        </Pressable>
      </View>
    </View>
  );
}

function DiscoveryToggle({
  accessibilityLabel,
  onValueChange,
  value,
}: {
  accessibilityLabel: string;
  onValueChange: (value: boolean) => void;
  value: boolean;
}) {
  return (
    <Pressable
      accessible
      className="h-8 w-16 flex-row items-center justify-end rounded-full border-2 pr-0.5"
      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
      onPress={() => onValueChange(!value)}
      accessibilityRole="switch"
      accessibilityLabel={accessibilityLabel}
      accessibilityState={{ checked: value }}
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
          importantForAccessibility="no"
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
  const { speak } = useTTS();
  const { settings } = useAccessibility();
  const reduceMotion = settings.reduceMotion;
  const [nextOptions, setNextOptions] = useState<string[]>(selectedOptions);

  useEffect(() => {
    if (visible) {
      setNextOptions(selectedOptions);
    }
  }, [selectedOptions, visible]);

  function toggleOption(option: string) {
    speak(buildOptionToggleSpeech(option, !nextOptions.includes(option)));
    setNextOptions((currentOptions) =>
      currentOptions.includes(option)
        ? currentOptions.filter((item) => item !== option)
        : [...currentOptions, option]
    );
  }

  return (
    <Modal
      transparent
      // reduceMotion desliga a animacao de fade.
      animationType={reduceMotion ? "none" : "fade"}
      visible={visible}
      onRequestClose={onClose}
    >
      <View
        accessibilityViewIsModal
        importantForAccessibility="yes"
        className="flex-1 justify-end bg-black/70 px-5 pb-6"
      >
        {/* Backdrop: antes era um Pressable sem rotulo nenhum. */}
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Fechar"
          accessibilityHint={`Fecha ${title} sem salvar`}
          className="absolute inset-0"
          onPress={onClose}
        />
        <View className="rounded-[28px] bg-[#111214] p-5">
          <Text
            accessibilityRole="header"
            className="text-[20px] font-black text-white"
          >
            {title}
          </Text>

          <View className="mt-4">
            {options.map((option) => {
              const selected = nextOptions.includes(option);

              return (
                <Pressable
                  key={option}
                  accessible
                  className="mb-3 h-14 flex-row items-center justify-between rounded-[18px] bg-[#1D1F24] px-4"
                  onPress={() => toggleOption(option)}
                  accessibilityRole="checkbox"
                  accessibilityLabel={option}
                  accessibilityState={{ checked: selected }}
                >
                  <Text className="text-[16px] font-bold text-white">{option}</Text>
                  {selected ? (
                    <Ionicons
                      name="checkmark-circle"
                      size={24}
                      color={DISCOVERY_ACCENT}
                      importantForAccessibility="no"
                    />
                  ) : null}
                </Pressable>
              );
            })}
          </View>

          <Pressable
            className="mt-2 h-14 items-center justify-center rounded-[18px]"
            style={{ backgroundColor: DISCOVERY_ACCENT }}
            onPress={() => {
              // Confirma com o conteudo real da selecao (dados de runtime).
              speak(
                joinSpeechParts([
                  "Seleção salva",
                  nextOptions.length > 0 ? nextOptions.join(", ") : "nenhuma opção",
                ])
              );
              onSave(nextOptions);
              onClose();
            }}
            accessibilityRole="button"
            accessibilityLabel="Salvar seleção"
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
  const { speak } = useTTS();
  const { settings } = useAccessibility();
  const reduceMotion = settings.reduceMotion;
  const [nextValue, setNextValue] = useState(value);

  useEffect(() => {
    if (visible) {
      setNextValue(value);
    }
  }, [value, visible]);

  return (
    <Modal
      transparent
      animationType={reduceMotion ? "none" : "fade"}
      visible={visible}
      onRequestClose={onClose}
    >
      <View
        accessibilityViewIsModal
        importantForAccessibility="yes"
        className="flex-1 justify-end bg-black/70 px-5 pb-6"
      >
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Fechar"
          accessibilityHint="Fecha a edição de localização sem salvar"
          className="absolute inset-0"
          onPress={onClose}
        />
        <View className="rounded-[28px] bg-[#111214] p-5">
          <Text
            accessibilityRole="header"
            className="text-[20px] font-black text-white"
          >
            Editar localização
          </Text>

          <TextInput
            accessibilityLabel="Cidade e país"
            accessibilityHint="Digite a cidade onde você quer buscar conexões"
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
                speak(`Local salvo: ${trimmedValue}`);
                onSave(trimmedValue);
              }

              onClose();
            }}
            accessibilityRole="button"
            accessibilityLabel="Salvar local"
          >
            <Text className="text-[16px] font-black text-white">Salvar local</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

export default function MatchMyProfile() {
  const { canAccessCompletedOnboardingContent } = useRequireCompletedOnboarding();

  const router = useRouter();
  const { speak } = useTTS();
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

    if (canAccessCompletedOnboardingContent) {
      void loadProfile();
    }

    const unsubscribe = subscribeToAuthStorage((snapshot) => {
      if (active) {
        setAuthToken(snapshot.session?.accessToken ?? null);
      }
    });

    return () => {
      active = false;
      unsubscribe();
    };
  }, [canAccessCompletedOnboardingContent]);

  // Sliders: fala o valor final quando o usuario para de arrastar (700 ms sem
  // mudanca), nunca durante o gesto — evita metralhadora de fala.
  const sliderSpeechInitializedRef = useRef(false);

  useEffect(() => {
    if (!sliderSpeechInitializedRef.current) {
      return;
    }

    const timer = setTimeout(() => {
      speak(`Distância máxima, ${maxDistanceKm} quilômetros`);
    }, 700);

    return () => clearTimeout(timer);
  }, [maxDistanceKm, speak]);

  useEffect(() => {
    if (!sliderSpeechInitializedRef.current) {
      return;
    }

    const timer = setTimeout(() => {
      speak(`Faixa etária, de ${ageRange[0]} a ${ageRange[1]} anos`);
    }, 700);

    return () => clearTimeout(timer);
  }, [ageRange, speak]);

  useEffect(() => {
    sliderSpeechInitializedRef.current = true;
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
              onPress={() => {
                speak("Voltar para Encontros");
                router.replace("/matches");
              }}
              accessibilityRole="button"
              accessibilityLabel="Voltar para encontros"
            >
              <Ionicons
                name="chevron-back"
                size={22}
                color="#FFFFFF"
                importantForAccessibility="no"
              />
            </Pressable>

            <Pressable
              className="h-10 w-10 items-center justify-center rounded-full bg-[#17181C]"
              onPress={() => {
                speak("Editar preferências de match");
                router.push("/profile/edit-match-preferences");
              }}
              accessibilityRole="button"
              accessibilityLabel="Editar preferências de match"
            >
              <Ionicons
                name="settings"
                size={24}
                color="#E5E2E1"
                importantForAccessibility="no"
              />
            </Pressable>
          </View>

          <View className="mt-7 rounded-[24px] bg-[#0B0B0D] p-4">
            <View className="flex-row items-center">
              <View className="relative">
                <View className="h-20 w-20 overflow-hidden rounded-full bg-[#2D2A33]">
                  {photoUrl ? (
                    <AuthenticatedRemoteImage
                      accessibilityLabel="Sua foto de perfil"
                      uri={photoUrl}
                      authToken={authToken}
                      className="h-full w-full"
                      resizeMode="cover"
                      fallback={
                        <View className="flex-1 items-center justify-center bg-[#2D2A33]">
                          <Ionicons name="person" size={38} color="#CAC3D8" />
                        </View>
                      }
                    />
                  ) : (
                    <View className="flex-1 items-center justify-center">
                      <Ionicons name="person" size={38} color="#CAC3D8" />
                    </View>
                  )}
                </View>

                <Pressable
                  className="absolute bottom-0 right-0 h-8 w-8 items-center justify-center rounded-full border-[3px] border-black bg-[#2F80ED]"
                  onPress={() => {
                    speak("Alterar foto de perfil");
                    router.push("/profile");
                  }}
                  accessibilityRole="button"
                  accessibilityLabel="Alterar foto de perfil"
                  accessibilityHint="Abre a tela de perfil para gerenciar suas fotos"
                  hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                >
                  <Ionicons
                    name="camera"
                    size={16}
                    color="#FFFFFF"
                    importantForAccessibility="no"
                  />
                </Pressable>
              </View>

              <View className="ml-4 flex-1">
                <Text
                  accessibilityRole="header"
                  className="text-[25px] font-extrabold text-white"
                  numberOfLines={1}
                  adjustsFontSizeToFit
                  minimumFontScale={0.72}
                >
                  {loading ? "..." : displayName}
                </Text>

                <Pressable
                  className="mt-4 h-12 max-w-[188px] flex-row items-center justify-center rounded-full bg-white px-5"
                  onPress={() => {
                    // Acao sobre o proprio perfil: inclui o nome de runtime.
                    speak(joinSpeechParts(["Editar perfil", displayName], ", "));
                    router.push("/profile/edit");
                  }}
                  accessibilityRole="button"
                  accessibilityLabel={`Editar perfil de ${displayName}`}
                >
                  <Ionicons
                    name="pencil"
                    size={18}
                    color="#25262A"
                    importantForAccessibility="no"
                  />
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
            <View
              accessible
              accessibilityRole="alert"
              accessibilityLabel={error}
              className="mt-8 rounded-[20px] bg-[#2A1216] p-4"
            >
              <Text className="text-[14px] font-bold text-red-200">{error}</Text>
            </View>
          ) : null}

          <View className="mt-9">
            <Text
              accessibilityRole="header"
              className="text-[24px] font-black text-white"
            >
              Ajustes de descoberta
            </Text>

            <DiscoveryCard>
              <Text
                accessibilityRole="header"
                className="text-[18px] font-black text-white"
              >
                Localização
              </Text>

              <Pressable
                className="mt-5 flex-row items-center"
                onPress={() => {
                  // Fala o local atual (dado dinamico) ao abrir a edicao.
                  speak(
                    joinSpeechParts(
                      ["Editar localização", discoveryLocation || null],
                      ", "
                    )
                  );
                  setLocationModalOpen(true);
                }}
                accessibilityRole="button"
                accessibilityLabel={`Alterar localização de busca, atualmente ${discoveryLocationLabel}`}
                accessibilityHint="Abre a edição da localização usada na descoberta"
              >
                <Ionicons
                  name="location"
                  size={34}
                  color={DISCOVERY_ACCENT}
                  importantForAccessibility="no"
                />
                <Text className="ml-4 text-[22px] font-semibold text-white">
                  {discoveryLocationLabel}
                </Text>
              </Pressable>

              <Pressable
                className="mt-5"
                onPress={() => {
                  speak("Adicionar novo local");
                  setLocationModalOpen(true);
                }}
                accessibilityRole="button"
                accessibilityLabel="Adicionar novo local"
                accessibilityHint="Abre a edição da localização usada na descoberta"
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
                <Text
                  accessibilityRole="header"
                  className="text-[20px] font-semibold text-white"
                >
                  Distância máxima
                </Text>
                <Text className="text-[20px] font-semibold text-[#CAC3D8]">
                  {maxDistanceKm}km
                </Text>
              </View>

              <DiscoverySlider
                accessibilityLabel="Distância máxima em quilômetros"
                formatValue={(next) => `${next} quilômetros`}
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
                {/* O rotulo do switch ja carrega esta frase: escondemos o texto
                    para o leitor de tela nao ler duas vezes. */}
                <Text
                  importantForAccessibility="no"
                  className="flex-1 text-[20px] font-semibold leading-8 text-white"
                >
                  Mostrar pessoas mais longe de mim se eu ficar sem perfis pra ver
                </Text>
                <DiscoveryToggle
                  accessibilityLabel="Mostrar pessoas mais distantes quando acabarem os perfis"
                  value={expandDistance}
                  onValueChange={(value) => {
                    speak(buildSwitchSpeech("Mostrar pessoas mais longe", value));
                    setExpandDistance(value);
                  }}
                />
              </View>
            </DiscoveryCard>

            <Pressable
              onPress={() => {
                // Fala a preferencia atual (dados de runtime) antes de abrir.
                speak(
                  joinSpeechParts(
                    [
                      "Tem interesse em",
                      interestedIn.length > 0 ? interestedIn.join(", ") : null,
                    ],
                    ": "
                  )
                );
                setInterestModalOpen(true);
              }}
              accessibilityRole="button"
              accessibilityLabel={`Interesse em: ${interestedInLabel}`}
              accessibilityHint="Abre a lista de opções"
            >
              <DiscoveryCard>
              <Text className="text-[16px] font-black text-white">
                Tem interesse em
              </Text>
              <View className="mt-4 flex-row items-center justify-between">
                <Text className="text-[22px] font-semibold text-white">
                  {interestedInLabel}
                </Text>
                <Ionicons
                  name="chevron-forward"
                  size={25}
                  color="#8B8C98"
                  importantForAccessibility="no"
                />
              </View>
              </DiscoveryCard>
            </Pressable>

            <DiscoveryCard>
              <View className="flex-row items-center justify-between">
                <Text
                  accessibilityRole="header"
                  className="text-[20px] font-semibold text-white"
                >
                  Faixa etária
                </Text>
                <Text className="text-[20px] font-semibold text-[#CAC3D8]">
                  {ageRange[0]} - {ageRange[1]}
                </Text>
              </View>

              <DiscoverySlider
                accessibilityLabel="Faixa etária desejada"
                formatValue={(next) =>
                  Array.isArray(next)
                    ? `de ${next[0]} a ${next[1]} anos`
                    : `${next} anos`
                }
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
                <Text
                  importantForAccessibility="no"
                  className="flex-1 text-[20px] font-semibold leading-8 text-white"
                >
                  Mostrar pessoas um pouco fora da minha faixa de preferência se eu ficar sem perfis pra ver
                </Text>
                <DiscoveryToggle
                  accessibilityLabel="Mostrar pessoas fora da faixa etária quando acabarem os perfis"
                  value={expandAgeRange}
                  onValueChange={(value) => {
                    speak(
                      buildSwitchSpeech(
                        "Mostrar pessoas fora da faixa de idade",
                        value
                      )
                    );
                    setExpandAgeRange(value);
                  }}
                />
              </View>
            </DiscoveryCard>

            <Pressable
              className="h-14 items-center justify-center rounded-[18px]"
              style={{ backgroundColor: DISCOVERY_ACCENT }}
              onPress={() => {
                speak("Ajustes aplicados nesta sessão.");
                setAppliedMessage("Ajustes aplicados nesta sessão.");
                announceForAccessibility("Ajustes aplicados nesta sessão.");
              }}
              accessibilityRole="button"
              accessibilityLabel="Aplicar ajustes"
              accessibilityHint="Aplica os ajustes de descoberta somente nesta sessão"
            >
              <Text className="text-[16px] font-black text-white">
                Aplicar ajustes
              </Text>
            </Pressable>

            {appliedMessage ? (
              // Sem `accessibilityLiveRegion` aqui: o anuncio ja sai do
              // `onPress` de "Aplicar ajustes" (uma fonte por evento) e a live
              // region so existe no Android, o que deixaria o iOS mudo.
              <Text
                accessibilityRole="alert"
                className="mt-4 text-center text-[14px] font-bold text-[#CDBDFF]"
              >
                {appliedMessage}
              </Text>
            ) : null}

            {/* Sem `onPress`: os dois botoes abaixo ainda nao fazem nada. Em vez
                de deixar um alvo morto sem sinalizacao, ficam desabilitados e
                dizem por que. */}
            <View className="mt-7 gap-3">
              <Pressable
                className="h-14 items-center justify-center rounded-[18px] border border-[#7C4DFF] bg-transparent opacity-60"
                disabled
                accessibilityRole="button"
                accessibilityLabel="Desativar perfil"
                accessibilityHint="Funcionalidade em desenvolvimento"
                accessibilityState={{ disabled: true }}
              >
                <Text className="text-[16px] font-black text-[#CDBDFF]">
                  Desativar perfil
                </Text>
              </Pressable>

              <Pressable
                className="h-14 items-center justify-center rounded-[18px] border border-[#FF6B6B] bg-transparent opacity-60"
                disabled
                accessibilityRole="button"
                accessibilityLabel="Apagar perfil"
                accessibilityHint="Funcionalidade em desenvolvimento"
                accessibilityState={{ disabled: true }}
              >
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
