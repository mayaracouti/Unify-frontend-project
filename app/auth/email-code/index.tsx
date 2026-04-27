import { useMemo, useState } from "react";
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

  if (challengeId === "123" && code === "123456") {
    return {
      accessToken: "token-fake",
    };
  }

  throw new Error("Código inválido");
}

export default function EmailCode() {
  const router = useRouter();

  const { email, challengeId } = useLocalSearchParams<{
    email?: string;
    challengeId?: string;
  }>();

  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const digits = useMemo(() => {
    const values = code.split("").slice(0, 6);
    return Array.from({ length: 6 }, (_, index) => values[index] ?? "");
  }, [code]);

  const isComplete = code.length === 6;

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

      // ENTRA NO APP
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
            className="mb-14 h-12 w-12 justify-center"
            onPress={() => router.back()}
          >
            <Text className="text-[50px] leading-[52px] text-[#777B86]">
              ‹
            </Text>
          </Pressable>

          <Text className="mb-6 text-[24px] font-semibold leading-8 text-[#F4F4F5]">
            Insira o código enviado ao seu email {email}
          </Text>

          <View className="mb-5 flex-row justify-between">
            {digits.map((digit, index) => (
              <View key={index} className="w-[15%]">
                <Text className="text-center text-[42px] font-semibold text-[#F4F4F5]">
                  {digit || " "}
                </Text>

                <View
                  className={`mt-2 h-0.5 ${
                    digit ? "bg-[#FF4F88]" : "bg-[#8A8E98]"
                  }`}
                />
              </View>
            ))}
          </View>

          <TextInput
            className="absolute h-1 w-1 opacity-0"
            keyboardType="number-pad"
            maxLength={6}
            autoFocus
            value={code}
            onChangeText={(value) =>
              setCode(value.replace(/\D/g, "").slice(0, 6))
            }
          />

          {error ? (
            <Text className="mb-4 text-[15px] text-red-400">{error}</Text>
          ) : null}

          <Text className="mb-2 text-[18px] leading-7 text-[#A7AAB2]">
            Não recebeu? Não se preocupe, vamos tentar novamente.
          </Text>

          <Pressable className="mb-10 self-start">
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