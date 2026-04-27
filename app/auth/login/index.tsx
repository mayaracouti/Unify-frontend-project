import { useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  SafeAreaView,
  Text,
  TextInput,
  View,
} from "react-native";
import { useRouter } from "expo-router";

/**
 * FUNÇÃO OFICIAL - BACKEND REAL
 * Use essa quando sua API estiver pronta.
 */
/*
async function loginWithBackend(email: string, password: string) {
  const response = await fetch("https://colocar-api.com/auth/login", {
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
 * FUNÇÃO MOCK - SIMULAÇÃO DE LOGIN
 * Use essa enquanto você ainda não tem backend.
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
    <View className="flex-1 bg-[#111214]">
      <SafeAreaView className="flex-1">
        <View className="flex-1 justify-center px-8">
          <Text className="mb-8 text-[32px] font-bold text-white">
            Login
          </Text>

          <TextInput
            className="mb-4 rounded-md bg-[#F3F3F3] px-4 py-4 text-zinc-900"
            placeholder="Digite seu email"
            placeholderTextColor="#A1A1AA"
            autoCapitalize="none"
            keyboardType="email-address"
            value={email}
            onChangeText={setEmail}
          />

          <TextInput
            className="mb-4 rounded-md bg-[#F3F3F3] px-4 py-4 text-zinc-900"
            placeholder="Digite sua senha"
            placeholderTextColor="#A1A1AA"
            secureTextEntry
            value={password}
            onChangeText={setPassword}
          />

          {error ? (
            <Text className="mb-4 text-red-400">{error}</Text>
          ) : null}

          <Pressable
            className={`items-center justify-center rounded-md py-4 ${
              loading ? "bg-[#3B3D45]" : "bg-[#2B1257]"
            }`}
            disabled={loading}
            onPress={handleLogin}
          >
            {loading ? (
              <ActivityIndicator />
            ) : (
              <Text className="font-semibold text-white">Login</Text>
            )}
          </Pressable>

          <Text className="mt-6 text-center text-white/60">
            Mock ativo: teste@email.com / 123456
          </Text>
        </View>
      </SafeAreaView>
    </View>
  );
}