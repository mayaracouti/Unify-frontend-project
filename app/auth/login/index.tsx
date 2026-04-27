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

function UnifyMark() {
  return (
    <View className="relative mb-2 h-10 w-10 items-center justify-center">
      <View className="absolute h-4 w-4 -translate-x-1.5 -translate-y-1.5 rounded-full bg-violet-900/95" />
      <View className="absolute h-4 w-4 translate-x-1.5 -translate-y-1.5 rounded-full bg-sky-400/95" />
      <View className="absolute h-4 w-4 -translate-x-0.5 translate-y-2 rounded-full bg-fuchsia-500/95" />
      <View className="absolute h-4 w-4 -translate-x-3 rounded-full bg-indigo-700/95" />
      <View className="absolute h-4 w-4 translate-x-3 rounded-full bg-cyan-400/95" />
      <View className="h-2 w-2 rounded-full bg-white/85" />
    </View>
  );
}

/**
 * FUNÇÃO OFICIAL - BACKEND REAL
 * Use essa quando sua API estiver pronta.
 */
/*
async function loginWithBackend(email: string, password: string) {
  const response = await fetch("https://sua-api.com/auth/login", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      email,
      password,
    }),
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.message || "Email ou senha inválidos.");
  }

  return data;
}
*/

/**
 * FUNÇÃO MOCK - SIMULA LOGIN COM SUCESSO
 * Mantenha essa ativa enquanto o backend real não estiver pronto.
 *
 * Dados para testar:
 * email: teste@email.com
 * senha: 123456
 */
async function loginWithBackend(email: string, password: string) {
  await new Promise((resolve) => setTimeout(resolve, 1000));

  if (email === "teste@email.com" && password === "123456") {
    return {
      challengeId: "123",
    };
  }

  throw new Error("Email ou senha inválidos.");
}

export default function Login() {
  const router = useRouter();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleLogin() {
    if (!email) {
      setError("Digite seu email.");
      return;
    }

    if (!password) {
      setError("Digite sua senha.");
      return;
    }

    try {
      setLoading(true);
      setError("");

      const data = await loginWithBackend(email, password);

      router.push({
        pathname: "/auth/email-code",
        params: {
          email,
          challengeId: data.challengeId,
        },
      });
    } catch (error) {
      if (error instanceof Error) {
        setError(error.message);
      } else {
        setError("Erro ao fazer login.");
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <LinearGradient
      colors={["#4D52B5", "#724BCE", "#906DDE"]}
      locations={[0, 0.55, 0.96]}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={{ flex: 1 }}
    >
      <View className="absolute inset-0 bg-black/5" />

      <SafeAreaView className="flex-1">
        <View className="flex-1 px-8">
          <View className="flex-[1.05] items-center justify-center pt-8">
            <UnifyMark />

            <Text
              className="text-center text-[46px] font-extrabold tracking-tight text-white"
              style={{
                textShadowColor: "rgba(0,0,0,0.22)",
                textShadowOffset: { width: 0, height: 4 },
                textShadowRadius: 6,
              }}
            >
              Unify
            </Text>
          </View>

          <View className="flex-[1.05] justify-start">
            <TextInput
              className="mb-4 rounded-md bg-[#F3F3F3] px-4 py-4 text-[14px] text-zinc-900"
              placeholder="Digite seu email"
              placeholderTextColor="#A1A1AA"
              autoCapitalize="none"
              keyboardType="email-address"
              value={email}
              onChangeText={setEmail}
            />

            <View className="mb-4 flex-row items-center rounded-md bg-[#F3F3F3] px-4">
              <TextInput
                className="flex-1 py-4 text-[14px] text-zinc-900"
                placeholder="Senha"
                placeholderTextColor="#A1A1AA"
                secureTextEntry={!showPassword}
                value={password}
                onChangeText={setPassword}
              />
              <Pressable
                className="ml-3 rounded px-2 py-1"
                onPress={() => setShowPassword((value) => !value)}
              >
                <Text className="text-[12px] font-semibold text-[#2B1257]">
                  {showPassword ? "Ocultar" : "Mostrar"}
                </Text>
              </Pressable>
            </View>

            {error ? (
              <Text className="mb-4 text-center text-[12px] text-red-200">
                {error}
              </Text>
            ) : null}

            <Pressable
              className="mb-4 items-center justify-center rounded-md bg-[#2B1257] py-3.5"
              onPress={handleLogin}
              disabled={loading}
            >
              {loading ? (
                <ActivityIndicator />
              ) : (
                <Text className="text-[15px] font-semibold text-white">
                  Login
                </Text>
              )}
            </Pressable>

            <View className="flex-row flex-wrap justify-center">
              <Text className="text-center text-[11px] text-white/55">
                Não possui uma Conta?{" "}
              </Text>
              <Pressable onPress={() => router.push("/auth/cadastro")}>
                <Text className="text-[11px] font-semibold text-[#2B1257]">
                  clique aqui e faça seu cadastro.
                </Text>
              </Pressable>
            </View>
          </View>

          <View className="flex-[0.85] justify-end pb-12">
            <View className="mb-7 flex-row items-center">
              <View className="h-px flex-1 bg-white/50" />
              <Text className="mx-5 text-[12px] font-semibold uppercase tracking-[1.5px] text-white/90">
                ou
              </Text>
              <View className="h-px flex-1 bg-white/50" />
            </View>

            <Pressable
              className="flex-row items-center justify-center rounded-md bg-[#F7F1F1] py-3.5"
              onPress={() => router.push("/auth/gmail")}
            >
              <Text className="mr-3 text-[20px] font-bold text-[#EA4335]">
                G
              </Text>
              <Text className="text-[15px] font-medium text-[#3B82F6]">
                continue com o Gmail
              </Text>
            </Pressable>
          </View>
        </View>
      </SafeAreaView>
    </LinearGradient>
  );
}
