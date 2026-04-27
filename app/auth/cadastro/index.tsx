import { useState } from "react";
import {
  Pressable,
  SafeAreaView,
  ScrollView,
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
async function createAccountWithBackend(data: {
  name: string;
  email: string;
  password: string;
}) {
  const response = await fetch("https://sua-api.com/auth/register", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(data),
  });

  const responseData = await response.json();

  if (!response.ok) {
    throw new Error(responseData.message || "Erro ao criar conta.");
  }

  return responseData;
}
*/

/**
 * FUNÇÃO MOCK - SIMULA CADASTRO COM SUCESSO
 * Mantenha essa ativa enquanto o backend real não estiver pronto.
 */
async function createAccountWithBackend(_data: {
  name: string;
  email: string;
  password: string;
}) {
  await new Promise((resolve) => setTimeout(resolve, 700));

  return {
    userId: "user-fake-123",
  };
}

export default function Cadastro() {
  const router = useRouter();

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleCreateAccount() {
    if (!name.trim()) {
      setError("Digite seu nome.");
      return;
    }

    if (!email.trim()) {
      setError("Digite seu e-mail.");
      return;
    }

    if (password.length < 8) {
      setError("A senha deve ter pelo menos 8 caracteres.");
      return;
    }

    if (password !== confirmPassword) {
      setError("As senhas não conferem.");
      return;
    }

    try {
      setLoading(true);
      setError("");

      const data = await createAccountWithBackend({
        name,
        email,
        password,
      });

      router.push({
        pathname: "/auth/cadastro/accessibility",
        params: {
          userId: data.userId,
          name,
          email,
        },
      });
    } catch (error) {
      if (error instanceof Error) {
        setError(error.message);
      } else {
        setError("Erro ao criar conta.");
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <View className="flex-1 bg-[#202225]">
      <SafeAreaView className="flex-1">
        <View className="border-b border-white/30 bg-[#070B1D] px-5 py-4">
          <View className="flex-row items-center">
            <Pressable
              className="mr-5 h-8 w-8 items-center justify-center"
              onPress={() => router.back()}
            >
              <Text className="text-[24px] font-bold text-white">‹</Text>
            </Pressable>
            <Text className="text-[15px] font-bold text-white">Unify</Text>
          </View>
        </View>

        <ScrollView
          className="flex-1 bg-[#111111]"
          contentContainerClassName="px-6 pb-8 pt-7"
          keyboardShouldPersistTaps="handled"
        >
          <View className="mb-5 items-center">
            <View className="mb-5 h-16 w-16 items-center justify-center rounded-md bg-[#814DFF]">
              <Text className="text-[26px] font-black text-white">♣</Text>
            </View>

            <Text className="mb-3 text-center text-[25px] font-extrabold text-white">
              Criar Conta
            </Text>

            <Text className="max-w-[260px] text-center text-[13px] font-semibold leading-5 text-[#B9BAC4]">
              Junte-se à nossa comunidade vibrante e acessível hoje.
            </Text>
          </View>

          <TextInput
            className="mb-4 border-b border-[#7B7D86] bg-[#191919] px-4 py-4 text-[14px] text-white"
            placeholder="Nome"
            placeholderTextColor="#8F90A0"
            value={name}
            onChangeText={setName}
          />

          <TextInput
            className="mb-4 border-b border-[#8BFFF3] bg-[#191919] px-4 py-4 text-[14px] text-white"
            placeholder="E-mail"
            placeholderTextColor="#8F90A0"
            autoCapitalize="none"
            keyboardType="email-address"
            value={email}
            onChangeText={setEmail}
          />

          <View className="mb-4 flex-row items-center border-b border-[#7B7D86] bg-[#191919] px-4">
            <TextInput
              className="flex-1 py-4 text-[14px] text-white"
              placeholder="Senha"
              placeholderTextColor="#8F90A0"
              secureTextEntry={!showPassword}
              value={password}
              onChangeText={setPassword}
            />
            <Pressable onPress={() => setShowPassword((value) => !value)}>
              <Text className="text-[12px] font-bold text-[#B7A8D8]">
                {showPassword ? "Ocultar" : "Ver"}
              </Text>
            </Pressable>
          </View>

          <View className="mb-5 flex-row items-center border-b border-[#7B7D86] bg-[#191919] px-4">
            <TextInput
              className="flex-1 py-4 text-[14px] text-white"
              placeholder="Confirmar Senha"
              placeholderTextColor="#8F90A0"
              secureTextEntry={!showConfirmPassword}
              value={confirmPassword}
              onChangeText={setConfirmPassword}
            />
            <Pressable
              onPress={() => setShowConfirmPassword((value) => !value)}
            >
              <Text className="text-[12px] font-bold text-[#B7A8D8]">
                {showConfirmPassword ? "Ocultar" : "Ver"}
              </Text>
            </Pressable>
          </View>

          <View className="mb-5 flex-row rounded-md bg-[#252528] px-4 py-3">
            <Text className="mr-3 text-[18px] font-black text-[#10E5FF]">
              i
            </Text>
            <Text className="flex-1 text-[12px] font-bold leading-4 text-[#D7D7DE]">
              As senhas devem ter pelo menos 8 caracteres para garantir alta
              segurança para o seu perfil.
            </Text>
          </View>

          {error ? (
            <Text className="mb-4 text-center text-[12px] font-semibold text-red-300">
              {error}
            </Text>
          ) : null}

          <Pressable
            className={`mb-8 items-center justify-center rounded-md py-4 ${
              loading ? "bg-[#BFC200]" : "bg-[#F2F500]"
            }`}
            disabled={loading}
            onPress={handleCreateAccount}
          >
            <Text className="text-[15px] font-extrabold text-[#191919]">
              {loading ? "Cadastrando..." : "Cadastrar  →"}
            </Text>
          </Pressable>

          <Pressable
            className="items-center"
            onPress={() => router.replace("/auth/login")}
          >
            <Text className="text-[13px] font-bold text-[#D9D2F4]">
              ↩ Voltar para o Login
            </Text>
          </Pressable>
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}
