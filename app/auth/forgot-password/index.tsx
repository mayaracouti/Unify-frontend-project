import { useEffect, useState } from "react";
import {
  AccessibilityInfo,
  ActivityIndicator,
  Pressable,
  Text,
  TextInput,
  View,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { authService } from "../../../src/services/authService";
import { formatApiErrorMessage } from "../../../src/utils/auth";
import { speak } from "../../../src/accessibility/tts";

export default function ForgotPassword() {
  const router = useRouter();

  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [successMessage, setSuccessMessage] = useState("");

  // `accessibilityLiveRegion` e Android-only: no iOS os anuncios precisam
  // ser disparados manualmente quando a mensagem muda.
  useEffect(() => {
    if (error) {
      AccessibilityInfo.announceForAccessibility(error);
      speak(error);
    }
  }, [error]);

  useEffect(() => {
    if (successMessage) {
      AccessibilityInfo.announceForAccessibility(successMessage);
      speak(successMessage);
    }
  }, [successMessage]);

  async function handleSendResetLink() {
    if (!email.trim()) {
      setError("Digite seu e-mail.");
      setSuccessMessage("");
      return;
    }

    try {
      setLoading(true);
      setError("");
      setSuccessMessage("");

      const response = await authService.forgotPassword({ email });

      setSuccessMessage(response.message);
    } catch (error) {
      setError(
        formatApiErrorMessage(
          error,
          "Não foi possível enviar o link de redefinição agora."
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
          <Text
            className="mb-3 text-[34px] font-extrabold leading-[40px] text-white"
            accessibilityRole="header"
          >
            Recuperar senha
          </Text>

          <Text className="mb-8 text-[15px] font-semibold leading-6 text-white/65">
            Digite o e-mail cadastrado para receber um link de redefinição.
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
            accessibilityLabel="Endereço de e-mail cadastrado"
            accessibilityHint="Digite o e-mail usado no cadastro para receber o link de redefinição"
            onFocus={() => speak("Endereço de e-mail cadastrado")}
            onChangeText={(value) => {
              setEmail(value);

              if (error) {
                setError("");
              }

              if (successMessage) {
                setSuccessMessage("");
              }
            }}
          />

          {successMessage ? (
            <View
              className="mb-4 rounded-md border border-emerald-300/35 bg-emerald-400/10 px-4 py-3"
              accessibilityLiveRegion="polite"
            >
              <Text className="text-center text-[12px] font-semibold text-emerald-100">
                {successMessage}
              </Text>
              <Text className="mt-2 text-center text-[12px] font-medium text-white/80">
                Abra o e-mail e toque no link para redefinir sua senha no app.
              </Text>
            </View>
          ) : null}

          {error ? (
            <Text
              className="mb-4 text-center text-[12px] font-semibold text-red-300"
              accessibilityRole="alert"
              accessibilityLiveRegion="polite"
            >
              {error}
            </Text>
          ) : null}

          <Pressable
            className={`items-center justify-center rounded-md py-4 ${
              loading ? "bg-[#BFC200]" : "bg-[#EFFF00]"
            }`}
            disabled={loading}
            onPress={() => {
              speak(successMessage ? "Enviar link novamente" : "Enviar link de redefinição");
              void handleSendResetLink();
            }}
            accessibilityRole="button"
            accessibilityLabel={
              successMessage
                ? "Enviar link novamente"
                : "Enviar link de redefinição"
            }
            accessibilityHint="Envia um e-mail com o link para redefinir sua senha"
            accessibilityState={{ disabled: loading, busy: loading }}
          >
            {loading ? (
              <ActivityIndicator />
            ) : (
              <Text className="text-[16px] font-bold text-[#171717]">
                {successMessage ? "Enviar novamente" : "Enviar link"}
              </Text>
            )}
          </Pressable>

          <Pressable
            className="mt-6 items-center justify-center rounded-md border border-white/35 py-3"
            onPress={() => {
              speak("Voltar para o login");
              router.replace("/auth/login");
            }}
            accessibilityRole="button"
            accessibilityLabel="Voltar para o login"
            accessibilityHint="Retorna para a tela de login"
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
