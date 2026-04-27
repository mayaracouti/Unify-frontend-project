import { useState } from "react";
import {
  Pressable,
  SafeAreaView,
  ScrollView,
  Switch,
  Text,
  View,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { useLocalSearchParams, useRouter } from "expo-router";

type SupportFocus = "Visual" | "Auditiva" | "Motora" | "Cognitiva";
type FontSize = "Pequena" | "Média" | "Grande" | "Extra";

const supportOptions: Array<{
  label: SupportFocus;
  icon: string;
}> = [
  { label: "Visual", icon: "◉" },
  { label: "Auditiva", icon: "◔" },
  { label: "Motora", icon: "♿" },
  { label: "Cognitiva", icon: "●" },
];

const fontSizes: Array<{
  label: FontSize;
  previewSize: number;
}> = [
  { label: "Pequena", previewSize: 12 },
  { label: "Média", previewSize: 14 },
  { label: "Grande", previewSize: 17 },
  { label: "Extra", previewSize: 20 },
];

/**
 * FUNÇÃO OFICIAL - BACKEND REAL
 * Use essa quando sua API estiver pronta.
 */
/*
async function saveAccessibilityPreferencesWithBackend(data: {
  userId?: string;
  supportFocuses: SupportFocus[];
  fontSize: FontSize;
  highContrast: boolean;
  screenReader: boolean;
}) {
  const response = await fetch("https://sua-api.com/users/accessibility", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(data),
  });

  const responseData = await response.json();

  if (!response.ok) {
    throw new Error(responseData.message || "Erro ao salvar preferências.");
  }

  return responseData;
}
*/

/**
 * FUNÇÃO MOCK - SIMULA SALVAR PREFERÊNCIAS COM SUCESSO
 * Mantenha essa ativa enquanto o backend real não estiver pronto.
 */
async function saveAccessibilityPreferencesWithBackend(_data: {
  userId?: string;
  supportFocuses: SupportFocus[];
  fontSize: FontSize;
  highContrast: boolean;
  screenReader: boolean;
}) {
  await new Promise((resolve) => setTimeout(resolve, 700));

  return {
    success: true,
  };
}

export default function CadastroAccessibility() {
  const router = useRouter();
  const { userId } = useLocalSearchParams<{ userId?: string }>();

  const [supportFocuses, setSupportFocuses] = useState<SupportFocus[]>([
    "Visual",
  ]);
  const [fontSize, setFontSize] = useState<FontSize>("Média");
  const [highContrast, setHighContrast] = useState(true);
  const [screenReader, setScreenReader] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  function handleToggleSupportFocus(option: SupportFocus) {
    setSupportFocuses((currentOptions) => {
      if (currentOptions.includes(option)) {
        return currentOptions.filter(
          (currentOption) => currentOption !== option
        );
      }

      return [...currentOptions, option];
    });
  }

  async function handleSavePreferences() {
    try {
      setLoading(true);
      setError("");

      await saveAccessibilityPreferencesWithBackend({
        userId,
        supportFocuses,
        fontSize,
        highContrast,
        screenReader,
      });

      router.replace("/auth/login");
    } catch (error) {
      if (error instanceof Error) {
        setError(error.message);
      } else {
        setError("Erro ao salvar preferências.");
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <View className="flex-1 bg-[#202225]">
      <SafeAreaView className="flex-1">
        <View className="border-b border-white/30 bg-[#070B1D] px-5 py-5">
          <View className="flex-row items-center">
            <Pressable
              className="mr-5 h-12 w-12 items-center justify-center rounded-full bg-white/8"
              onPress={() => router.back()}
            >
              <Text className="text-[40px] font-bold leading-[42px] text-white">
                ‹
              </Text>
            </Pressable>
            <Text className="text-[17px] font-bold text-white">Unify</Text>
          </View>
        </View>

        <ScrollView
          className="flex-1 bg-[#111111]"
          contentContainerClassName="px-5 pb-8 pt-6"
          keyboardShouldPersistTaps="handled"
        >
          <Text className="mb-3 text-[27px] font-extrabold leading-8 text-white">
            Personalize sua Experiência
          </Text>

          <Text className="mb-6 text-[14px] font-semibold leading-6 text-[#B9BAC4]">
            Configure o Unify para melhor atender às suas necessidades. Você
            pode alterar isso mais tarde nas configurações.
          </Text>

          <Text className="mb-3 text-[12px] font-extrabold uppercase tracking-[2px] text-[#DCD5FF]">
            Foco de Suporte
          </Text>

          <View className="mb-6 flex-row flex-wrap justify-between">
            {supportOptions.map((option) => {
              const selected = supportFocuses.includes(option.label);

              return (
                <Pressable
                  key={option.label}
                  className={`mb-3 w-[48%] rounded-md border px-4 py-4 ${
                    selected
                      ? "border-[#8C55FF] bg-[#303033]"
                      : "border-transparent bg-[#28282B]"
                  }`}
                  onPress={() => handleToggleSupportFocus(option.label)}
                >
                  <View className="mb-3 h-11 w-11 items-center justify-center rounded-md bg-[#814DFF]">
                    <Text className="text-[22px] font-black text-white">
                      {option.icon}
                    </Text>
                  </View>
                  <Text className="text-[14px] font-extrabold text-white">
                    {option.label}
                  </Text>
                </Pressable>
              );
            })}
          </View>

          <Text className="mb-3 text-[12px] font-extrabold uppercase tracking-[2px] text-[#DCD5FF]">
            Ajustes
          </Text>

          <View className="mb-4 rounded-md border border-[#5A5A61] bg-[#19191C] p-4">
            <View className="mb-4 flex-row items-center justify-between">
              <Text className="text-[18px] font-extrabold text-white">
                Tamanho da Fonte
              </Text>
              <Text className="text-[11px] font-extrabold text-[#F2F500]">
                {fontSize === "Média" ? "Padrão" : fontSize}
              </Text>
            </View>

            <View className="mb-4 flex-row items-center">
              <Text className="mr-3 text-[12px] font-bold text-[#999AA3]">
                A
              </Text>
              <View className="relative h-8 flex-1 justify-center">
                <View className="absolute left-0 right-0 h-2 rounded-full bg-[#3B3B40]" />
                <View className="flex-row items-center justify-between">
                  {fontSizes.map((size) => {
                    const selected = fontSize === size.label;

                    return (
                      <Pressable
                        key={size.label}
                        className="h-8 w-8 items-center justify-center"
                        onPress={() => setFontSize(size.label)}
                      >
                        <View
                          className={`rounded-full ${
                            selected
                              ? "h-6 w-6 bg-[#F2F500]"
                              : "h-3 w-3 bg-[#686A72]"
                          }`}
                        />
                      </Pressable>
                    );
                  })}
                </View>
              </View>
              <Text className="ml-3 text-[18px] font-bold text-[#999AA3]">
                A
              </Text>
            </View>

            <View className="mb-4 flex-row justify-between">
              {fontSizes.map((size) => (
                <Pressable
                  key={size.label}
                  onPress={() => setFontSize(size.label)}
                >
                  <Text
                    className={`text-[10px] font-bold ${
                      fontSize === size.label
                        ? "text-[#F2F500]"
                        : "text-[#8D8D96]"
                    }`}
                  >
                    {size.label}
                  </Text>
                </Pressable>
              ))}
            </View>

            <Text
              className="font-semibold leading-5 text-[#D7D7DE]"
              style={{
                fontSize:
                  fontSizes.find((size) => size.label === fontSize)
                    ?.previewSize ?? 14,
              }}
            >
              Texto de exemplo
            </Text>
          </View>

          <View className="mb-4 flex-row items-center justify-between rounded-md border border-[#5A5A61] bg-[#19191C] p-4">
            <View>
              <Text className="mb-1 text-[17px] font-extrabold text-white">
                Alto Contraste
              </Text>
              <Text className="text-[12px] font-semibold text-[#A9A9B2]">
                Texto e bordas mais nítidos
              </Text>
            </View>
            <Switch
              value={highContrast}
              onValueChange={setHighContrast}
              trackColor={{ false: "#5F6068", true: "#F2F500" }}
              thumbColor="#FFFFFF"
            />
          </View>

          <View className="mb-5 flex-row items-center justify-between rounded-md border border-[#5A5A61] bg-[#19191C] p-4">
            <View>
              <Text className="mb-1 text-[17px] font-extrabold text-white">
                Leitor de Tela
              </Text>
              <Text className="text-[12px] font-semibold text-[#A9A9B2]">
                Orientação por voz
              </Text>
            </View>
            <Switch
              value={screenReader}
              onValueChange={setScreenReader}
              trackColor={{ false: "#5F6068", true: "#F2F500" }}
              thumbColor="#FFFFFF"
            />
          </View>

          <LinearGradient
            colors={["#8752FF", "#5328AA"]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={{ borderRadius: 6, marginBottom: 20, padding: 20 }}
          >
            <Text className="mb-2 text-[13px] font-bold leading-5 text-white">
              Feito para Autonomia
            </Text>
            <Text className="text-[13px] font-semibold leading-5 text-white/90">
              O Unify se adapta a você, garantindo que cada conexão seja
              significativa e acessível.
            </Text>
          </LinearGradient>

          {error ? (
            <Text className="mb-4 text-center text-[12px] font-semibold text-red-300">
              {error}
            </Text>
          ) : null}

          <Pressable
            className={`items-center justify-center rounded-md py-4 ${
              loading ? "bg-[#BFC200]" : "bg-[#F2F500]"
            }`}
            disabled={loading}
            onPress={handleSavePreferences}
          >
            <Text className="text-[15px] font-extrabold text-[#191919]">
              {loading ? "Salvando..." : "Salvar e Continuar  ›"}
            </Text>
          </Pressable>

          <Text className="mt-3 text-center text-[9px] font-bold uppercase tracking-[1px] text-[#B9BAC4]">
            Passo 1 de 1: Configuração do Perfil
          </Text>
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}
