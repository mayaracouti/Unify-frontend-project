import { useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  Text,
  TextInput,
  View,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { useLocalSearchParams, useRouter } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";

import { authService } from "../../../src/services/authService";
import { formatApiErrorMessage } from "../../../src/utils/auth";

function readTokenParam(tokenParam: string | string[] | undefined): string {
  if (Array.isArray(tokenParam)) {
    return tokenParam[0] ?? "";
  }

  return tokenParam ?? "";
}

export default function ResetPassword() {
  const router = useRouter();
  const params = useLocalSearchParams<{ token?: string | string[] }>();
  const token = readTokenParam(params.token).trim();
  const isTokenMissing = token.length === 0;

  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [successMessage, setSuccessMessage] = useState("");

  async function handleResetPassword() {
    if (isTokenMissing) {
      setError("Esse link de redefinição está inválido. Solicite um novo e-mail.");
      return;
    }

    if (!password.trim() || !confirmPassword.trim()) {
      setError("Digite e confirme sua nova senha.");
      return;
    }

    if (password.length < 8) {
      setError("A senha deve ter pelo menos 8 caracteres.");
      return;
    }

    if (password !== confirmPassword) {
      setError("As senhas não coincidem.");
      return;
    }

    try {
      setLoading(true);
      setError("");
      setSuccessMessage("");

      const response = await authService.resetPassword({ token, password });

      setPassword("");
      setConfirmPassword("");
      setSuccessMessage(response.message);
    } catch (error) {
      setError(
        formatApiErrorMessage(
          error,
          "Não foi possível redefinir sua senha agora."
        )
      );
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
        <View className="flex-1 px-6 pt-6 mt-10">
          <Text className="mb-3 text-[34px] font-extrabold leading-[40px] text-white">
            Nova senha
          </Text>

          <Text className="mb-8 text-[15px] font-semibold leading-6 text-white/65">
            {isTokenMissing
              ? "Esse link não trouxe um token válido. Solicite um novo e-mail de recuperação."
              : "Defina sua nova senha para concluir a recuperação da conta."}
          </Text>

          {successMessage ? (
            <View className="mb-6 rounded-md border border-emerald-300/35 bg-emerald-400/10 px-4 py-4">
              <Text className="text-center text-[13px] font-semibold text-emerald-100">
                {successMessage}
              </Text>
            </View>
          ) : null}

          {error ? (
            <Text className="mb-4 text-center text-[12px] font-semibold text-red-300">
              {error}
            </Text>
          ) : null}

          {!successMessage && !isTokenMissing ? (
            <>
              <Text className="mb-2 text-[12px] font-extrabold text-white/80">
                Nova senha
              </Text>

              <TextInput
                className="mb-5 rounded-md bg-[#F4F4F5] px-4 py-4 text-[15px] text-zinc-900"
                placeholder="••••••••"
                placeholderTextColor="#8C8F99"
                secureTextEntry
                value={password}
                onChangeText={(value) => {
                  setPassword(value);

                  if (error) {
                    setError("");
                  }
                }}
              />

              <Text className="mb-2 text-[12px] font-extrabold text-white/80">
                Confirmar nova senha
              </Text>

              <TextInput
                className="mb-5 rounded-md bg-[#F4F4F5] px-4 py-4 text-[15px] text-zinc-900"
                placeholder="••••••••"
                placeholderTextColor="#8C8F99"
                secureTextEntry
                value={confirmPassword}
                onChangeText={(value) => {
                  setConfirmPassword(value);

                  if (error) {
                    setError("");
                  }
                }}
              />

              <Pressable
                className={`items-center justify-center rounded-md py-4 ${
                  loading ? "bg-[#BFC200]" : "bg-[#EFFF00]"
                }`}
                disabled={loading}
                onPress={handleResetPassword}
              >
                {loading ? (
                  <ActivityIndicator />
                ) : (
                  <Text className="text-[16px] font-bold text-[#171717]">
                    Redefinir senha
                  </Text>
                )}
              </Pressable>
            </>
          ) : null}

          <Pressable
            className="mt-6 items-center justify-center rounded-md border border-white/35 py-3"
            onPress={() => router.replace("/auth/forgot-password")}
          >
            <Text className="text-[14px] font-extrabold text-white">
              {successMessage || isTokenMissing
                ? "Solicitar novo link"
                : "Voltar para recuperar senha"}
            </Text>
          </Pressable>

          <Pressable
            className="mt-4 items-center justify-center rounded-md border border-white/20 py-3"
            onPress={() => router.replace("/auth/login")}
          >
            <Text className="text-[14px] font-extrabold text-white/90">
              Ir para o login
            </Text>
          </Pressable>
        </View>
      </SafeAreaView>
    </LinearGradient>
  );
}