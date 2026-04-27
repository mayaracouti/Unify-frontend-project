import { useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  SafeAreaView,
  Text,
  TextInput,
  View,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";

/**
 * FUNÇÃO OFICIAL - BACKEND REAL
 * Use essa quando sua API estiver pronta.
 */
/*
async function requestPasswordResetWithBackend(email: string) {
  const response = await fetch("https://sua-api.com/auth/forgot-password", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ email }),
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.message || "Erro ao enviar código.");
  }

  return data;
}
*/

/**
 * FUNÇÃO MOCK - SIMULA ENVIO DO CÓDIGO POR E-MAIL
 * Código para testar na próxima tela: 123456
 */
async function requestPasswordResetWithBackend(email: string) {
  await new Promise((resolve) => setTimeout(resolve, 800));

  if (!email.includes("@")) {
    throw new Error("Digite um e-mail válido.");
  }

  return {
    challengeId: "123",
  };
}

export default function ForgotPassword() {
  const router = useRouter();

  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleSendCode() {
    if (!email.trim()) {
      setError("Digite seu e-mail.");
      return;
    }

    try {
      setLoading(true);
      setError("");

      const data = await requestPasswordResetWithBackend(email);

      router.push({
        pathname: "/auth/email-code",
        params: {
          email,
          challengeId: data.challengeId,
          next: "/auth/change-password",
        },
      });
    } catch (error) {
      if (error instanceof Error) {
        setError(error.message);
      } else {
        setError("Erro ao enviar código.");
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <LinearGradient
      colors={["#080A17", "#171323", "#2A1748"]}
      locations={[0, 0.58, 1]}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={{ flex: 1 }}
    >
      <View className="absolute inset-0 bg-black/10" />

      <SafeAreaView className="flex-1">
        <View className="flex-1 px-6 pt-6">
          <View className="mb-10 flex-row items-center">
            <Pressable
              className="mr-4 h-11 w-11 items-center justify-center rounded-full bg-white/8"
              onPress={() => router.back()}
            >
              <Text className="text-[34px] leading-[36px] text-white/75">
                ‹
              </Text>
            </Pressable>

            <Text className="text-[15px] font-extrabold text-white">
              Unify
            </Text>
          </View>

          <Text className="mb-3 text-[34px] font-extrabold leading-[40px] text-white">
            Recuperar senha
          </Text>

          <Text className="mb-8 text-[15px] font-semibold leading-6 text-white/65">
            Digite o e-mail cadastrado para receber o código de validação.
          </Text>

          <Text className="mb-2 text-[12px] font-extrabold text-white/80">
            Endereço de E-mail
          </Text>

          <TextInput
            className="mb-5 rounded-md bg-[#F4F4F5] px-4 py-4 text-[15px] text-zinc-900"
            placeholder="nome@example.com"
            placeholderTextColor="#8C8F99"
            autoCapitalize="none"
            keyboardType="email-address"
            value={email}
            onChangeText={setEmail}
          />

          {error ? (
            <Text className="mb-4 text-center text-[12px] font-semibold text-red-300">
              {error}
            </Text>
          ) : null}

          <Pressable
            className={`items-center justify-center rounded-md py-4 ${
              loading ? "bg-[#BFC200]" : "bg-[#EFFF00]"
            }`}
            disabled={loading}
            onPress={handleSendCode}
          >
            {loading ? (
              <ActivityIndicator />
            ) : (
              <Text className="text-[16px] font-bold text-[#171717]">
                Enviar código
              </Text>
            )}
          </Pressable>

          <Pressable
            className="mt-6 items-center justify-center rounded-md border border-white/35 py-3"
            onPress={() => router.replace("/auth/login")}
          >
            <Text className="text-[14px] font-extrabold text-white">
              Voltar para o login
            </Text>
          </Pressable>
        </View>
      </SafeAreaView>
    </LinearGradient>
  );
}
