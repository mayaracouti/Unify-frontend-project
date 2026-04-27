import { useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  SafeAreaView,
  Text,
  TextInput,
  View,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
//import * as SecureStore from "expo-secure-store";

/**async function verifyCodeWithBackend(challengeId: string, code: string) {
  const response = await fetch("https://sua-api.com/auth/verify-code", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      challengeId,
      code,
    }),
  });

  const data = await response.json();

  // AQUI VERIFICA SE O CÓDIGO ESTÁ CORRETO
  if (!response.ok) {
    throw new Error(data.message || "Código inválido.");
  }

  return data;
}*/
async function verifyCodeWithBackend(challengeId: string, code: string) {
  await new Promise((resolve) => setTimeout(resolve, 1000));

  if (challengeId === "123" && code === "A123456") {
    return {
      accessToken: "token-fake",
    };
  }

  throw new Error("Código incorreto.");
}

export default function EmailCode() {
  const router = useRouter();

  const { email, challengeId, next } = useLocalSearchParams<{
    email?: string;
    challengeId?: string;
    next?: string;
  }>();

  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const isComplete = code.length === 6;

  function handleResendCode() {
    if (next === "/auth/change-password") {
      router.replace("/auth/forgot-password");
      return;
    }

    router.replace("/auth/login");
  }

  async function handleVerifyCode() {
    if (!challengeId) {
      setError("Código de autenticação não encontrado.");
      return;
    }

    if (code.length !== 6) {
      setError("Digite o código de 6 números.");
      return;
    }

    try {
      setLoading(true);
      setError("");

      const data = await verifyCodeWithBackend(challengeId, code);

      // SE CHEGOU AQUI, O BACKEND VALIDOU O CÓDIGO
      // AGORA SALVA O TOKEN COM SEGURANÇA
      //await SecureStore.setItemAsync("accessToken", data.accessToken);

      if (next === "/auth/change-password") {
        router.replace("/auth/change-password");
        return;
      }

      router.replace("/home");
    } catch (error) {
      if (error instanceof Error) {
        setError(error.message);
      } else {
        setError("Erro ao validar código.");
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <View className="flex-1 bg-[#111214]">
      <SafeAreaView className="flex-1">
        <View className="flex-1 px-8 pt-8">
          <Pressable
            className="mb-14 h-14 w-14 items-center justify-center rounded-full bg-white/8"
            onPress={() => router.back()}
          >
            <Text className="text-[52px] leading-[54px] text-[#A5A8B0]">
              ‹
            </Text>
          </Pressable>

          <Text className="mb-6 text-[48px] font-semibold leading-[58px] text-[#F4F4F5]">
            Insira o código recebido 
          </Text>

          <Text className="mb-10 text-[18px] font-semibold tracking-[1px] text-[#A7AAB2]">
            {`Enviamos um código de 6 dígitos para ${email}`}
          </Text>

          <TextInput
            className="mb-5 rounded-md bg-[#F3F3F3] px-4 py-4 text-center text-[22px] font-semibold tracking-[6px] text-zinc-900"
            keyboardType="number-pad"
            textContentType="oneTimeCode"
            maxLength={6}
            autoFocus
            placeholder="000000"
            placeholderTextColor="#A1A1AA"
            value={code}
            onChangeText={(value) =>
              setCode(value.replace(/\D/g, "").slice(0, 6))
            }
          />

          <Text className="mb-2 text-[18px] leading-7 text-[#A7AAB2]">
            Não recebeu? Não se preocupe, vamos tentar novamente.
          </Text>

          <Pressable className="mb-10 self-start" onPress={handleResendCode}>
            <Text className="text-[18px] font-bold text-[#2F90D8]">
              Reenviar
            </Text>
          </Pressable>

          <Pressable
            className={`items-center justify-center rounded-full py-5 ${
              isComplete && !loading ? "bg-white" : "bg-[#3B3D45]"
            }`}
            disabled={!isComplete || loading}
            onPress={handleVerifyCode}
          >
            {loading ? (
              <ActivityIndicator />
            ) : (
              <Text
                className={`text-[22px] font-bold ${
                  isComplete ? "text-[#18191B]" : "text-[#737782]"
                }`}
              >
                Seguinte
              </Text>
            )}
          </Pressable>
        </View>
      </SafeAreaView>
    </View>
  );
}
