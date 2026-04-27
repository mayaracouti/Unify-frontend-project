import { useMemo, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import Ionicicons from '@expo/vector-icons/Ionicons';

import { useAuth } from "../../../src/context/AuthContext";
import { formatApiErrorMessage } from "../../../src/utils/auth";

function PasswordRequirement({
  isValid,
  label,
}: {
  isValid: boolean;
  label: string;
}) {
  return (
    <View className="mb-2 flex-row items-center">
      <View
        className={`mr-3 h-2.5 w-2.5 rounded-full ${
          isValid ? "bg-[#8BFFF3]" : "bg-white/20"
        }`}
      />
      <Text
        className={`text-[12px] font-semibold leading-4 ${
          isValid ? "text-[#8BFFF3]" : "text-[#D7D7DE]"
        }`}
      >
        {label}
      </Text>
    </View>
  );
}

export default function Cadastro() {
  const router = useRouter();
  const { signUp } = useAuth();

  const [name, setName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const clearError = () => {
    if (error) {
      setError(null);
    }
  };

  const passwordChecks = useMemo(
    () => ({
      minLength: password.length >= 8,
      hasUppercase: /[A-Z]/.test(password),
      hasLowercase: /[a-z]/.test(password),
      hasNumber: /\d/.test(password),
      hasSpecialCharacter: /[^A-Za-z0-9]/.test(password),
    }),
    [password]
  );

  const isPasswordValid =
    passwordChecks.minLength &&
    passwordChecks.hasUppercase &&
    passwordChecks.hasLowercase &&
    passwordChecks.hasNumber &&
    passwordChecks.hasSpecialCharacter;

  async function handleCreateAccount() {
    if (!name.trim() || !lastName.trim() || !email.trim() || !password.trim()) {
      setError("Preencha nome, sobrenome, email e senha para continuar.");
      return;
    }

    if (!isPasswordValid) {
      setError("A senha precisa atender a todos os requisitos exibidos abaixo.");
      return;
    }

    try {
      setLoading(true);
      setError(null);

      const response = await signUp({
        name,
        lastName,
        email,
        password,
      });

      router.replace({
        pathname: "/auth/email-code",
        params: {
          email: response.email,
        },
      });
    } catch (error) {
      setError(
        formatApiErrorMessage(error, "Não foi possível criar sua conta agora.")
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <LinearGradient
      colors={["#2B0B4F", "#38156A", "#533F78"]}
      locations={[0, 0.52, 1]}
      start={{ x: 0, y: 0 }}
      end={{ x: 0.95, y: 1 }}
      style={{ flex: 1 }}
    >
      <View className="absolute inset-0 bg-black/10" />

      <SafeAreaView className="flex-1">
        <View className="border-b border-white/20 bg-black/25 px-5 py-5">
          <View className="flex-row items-center">
            <Pressable
              className="mr-5 h-12 w-12 items-center justify-center rounded-full bg-white/8"
              onPress={() => router.back()}
            >
              <Ionicicons name="arrow-back-outline" size={24} color="#fff" />
            </Pressable>
            <Text className="text-[17px] font-bold text-white">Unify</Text>
          </View>
        </View>

        <ScrollView
          className="flex-1"
          contentContainerClassName="px-6 pb-8 pt-7"
          keyboardShouldPersistTaps="handled"
        >
          <View className="mb-5 items-center">
            <View className="mb-5 h-16 w-16 items-center justify-center rounded-md bg-[#814DFF]">
              <Ionicicons name="person-add-outline" size={28} color="#fff" />
            </View>

            <Text className="mb-3 text-center text-[25px] font-extrabold text-white">
              Criar Conta
            </Text>

            <Text className="max-w-[260px] text-center text-[13px] font-semibold leading-5 text-[#B9BAC4]">
              Junte-se à nossa comunidade vibrante e acessível hoje.
            </Text>
          </View>

          <View className="mb-4 flex-row">
            <TextInput
              className="mr-3 flex-1 border-b border-white/35 bg-black/24 px-4 py-4 text-[14px] text-white"
              placeholder="Nome"
              placeholderTextColor="#8F90A0"
              value={name}
              onChangeText={(value) => {
                setName(value);
                clearError();
              }}
            />

            <TextInput
              className="flex-1 border-b border-white/35 bg-black/24 px-4 py-4 text-[14px] text-white"
              placeholder="Sobrenome"
              placeholderTextColor="#8F90A0"
              value={lastName}
              onChangeText={(value) => {
                setLastName(value);
                clearError();
              }}
            />
          </View>

          <TextInput
            className="mb-4 border-b border-[#8BFFF3] bg-black/24 px-4 py-4 text-[14px] text-white"
            placeholder="E-mail"
            placeholderTextColor="#8F90A0"
            autoCapitalize="none"
            keyboardType="email-address"
            value={email}
            onChangeText={(value) => {
              setEmail(value);
              clearError();
            }}
          />

          <View className="mb-5 flex-row items-center border-b border-white/35 bg-black/24 px-4">
            <TextInput
              className="flex-1 py-4 text-[14px] text-white"
              placeholder="Senha"
              placeholderTextColor="#8F90A0"
              secureTextEntry={!showPassword}
              value={password}
              onChangeText={(value) => {
                setPassword(value);
                clearError();
              }}
            />
            <Pressable onPress={() => setShowPassword((value) => !value)}>
              <Text className="text-[12px] font-bold text-[#B7A8D8]">
                {showPassword ? "Ocultar" : "Ver"}
              </Text>
            </Pressable>
          </View>

          <View className="mb-5 rounded-md bg-black/28 px-4 py-3">
            <Text className="mb-3 text-[12px] font-bold leading-4 text-[#D7D7DE]">
              A senha precisa atender os seguintes requisitos:
            </Text>

            <PasswordRequirement
              isValid={passwordChecks.minLength}
              label="Conter no mínimo 8 caracteres"
            />
            <PasswordRequirement
              isValid={passwordChecks.hasUppercase}
              label="Conter pelo menos uma letra maiúscula"
            />
            <PasswordRequirement
              isValid={passwordChecks.hasLowercase}
              label="Conter pelo menos uma letra minúscula"
            />
            <PasswordRequirement
              isValid={passwordChecks.hasNumber}
              label="Conter pelo menos um número"
            />
            <PasswordRequirement
              isValid={passwordChecks.hasSpecialCharacter}
              label="Conter pelo menos um caractere especial"
            />
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
            {loading ? (
              <ActivityIndicator color="#191919" />
            ) : (
              <Text className="text-[15px] font-extrabold text-[#191919]">
                Cadastrar  →
              </Text>
            )}
          </Pressable>

          <Pressable
            className="items-center justify-center rounded-md border border-white/35 py-3"
            onPress={() => router.replace("/auth/login")}
          >
            <Text className="text-[14px] font-extrabold text-white">
              Voltar para o Login
            </Text>
          </Pressable>
        </ScrollView>
      </SafeAreaView>
    </LinearGradient>
  );
}
