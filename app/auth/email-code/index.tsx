import { useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  Text,
  TextInput,
  View,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";

import { useAuth } from "../../../src/context/AuthContext";
import { formatApiErrorMessage, normalizeVerificationCode } from "../../../src/utils/auth";
import { clearPendingVerificationEmail } from "../../../src/storage/tokenStorage";
import { showGlobalToast } from "../../../src/utils/globalToast";
import Ionicicons from '@expo/vector-icons/Ionicons';

export default function EmailCode() {
  const router = useRouter();
  const inputRef = useRef<TextInput>(null);
  const { email } = useLocalSearchParams<{ email?: string }>();
  const { pendingVerificationEmail, resendVerificationCode, verifyEmail } = useAuth();
  const [code, setCode] = useState("");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [infoMessage, setInfoMessage] = useState<string | null>(null);
  const [isResending, setIsResending] = useState(false);
  const [loading, setLoading] = useState(false);

  const isComplete = code.length === 6;

  const resolvedEmail =
    (typeof email === "string" && email.length > 0 ? email : null) ??
    pendingVerificationEmail ??
    "";

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const handleVerifyEmail = async () => {
    if (!resolvedEmail) {
      setErrorMessage("Nenhum email pendente foi encontrado para validação.");
      return;
    }

    setLoading(true);
    setErrorMessage(null);
    setInfoMessage(null);



    try {
      await verifyEmail({ email: resolvedEmail, code });
      router.replace("/auth/login");
      showGlobalToast({
            title: "Sucesso",
            message: "Email verificado com sucesso! Faça login para continuar.",
            variant: "success",
          });
    } catch (error) {
      setErrorMessage(
        formatApiErrorMessage(error, "Não foi possível validar o código informado.")
      );
    } finally {
      setLoading(false);
    }
  };

  const handleResendCode = async () => {
    if (!resolvedEmail) {
      setErrorMessage("Nenhum email pendente foi encontrado para reenvio.");
      return;
    }

    setIsResending(true);
    setErrorMessage(null);

    try {
      const response = await resendVerificationCode(resolvedEmail);
      setInfoMessage(response.message);
    } catch (error) {
      setErrorMessage(
        formatApiErrorMessage(error, "Não foi possível reenviar o código agora.")
      );
    } finally {
      setIsResending(false);
    }
  };

  const goBackLoginScreen = async () => {
    await clearPendingVerificationEmail();
    router.push("/auth/login");
  }

  return (
    <View className="flex-1 bg-[#111214]">
      <SafeAreaView className="flex-1">
        <View className="flex-1 px-8 pt-8">
          <Pressable
            className="mb-14 h-14 w-14 items-center justify-center rounded-full bg-white/8"
            onPress={goBackLoginScreen}
          >
            <Ionicicons name="arrow-back-outline" size={24} color="#fff" />
          </Pressable>

          <Text className="mb-6 text-[48px] font-semibold leading-[58px] text-[#F4F4F5]">
            Insira o código recebido 
          </Text>

          <Text className="mb-10 text-[18px] font-semibold tracking-[1px] text-[#A7AAB2]">
            {`Enviamos um código de 6 dígitos para ${email}`}
          </Text>

          <TextInput
            className="mb-5 rounded-md bg-[#F3F3F3] px-4 py-4 text-center text-[22px] font-semibold tracking-[6px] text-zinc-900"
            keyboardType="default"
            textContentType="oneTimeCode"
            maxLength={6}
            autoFocus
            placeholder="000000"
            placeholderTextColor="#A1A1AA"
            value={code}
            onChangeText={(value) => {
              setCode(normalizeVerificationCode(value));

              if (errorMessage) {
                setErrorMessage(null);
              }

              if (infoMessage) {
                setInfoMessage(null);
              }
            }}
          />

          <Text className="mb-2 text-[18px] leading-7 text-[#A7AAB2]">
            Digite o código de 6 caracteres enviado para seu email. Enquanto a
            conta não for confirmada, o app mantém você nesta etapa.
          </Text>

          <Pressable className="mb-10 self-start" onPress={handleResendCode} disabled={isResending}>
            <Text className="text-[18px] font-bold text-[#2F90D8]">
              {isResending ? "Reenviando..." : "Reenviar código"}
            </Text>
          </Pressable>

          <Pressable
            className={`items-center justify-center rounded-full py-5 ${
              isComplete && !loading ? "bg-white" : "bg-[#3B3D45]"
            }`}
            disabled={!isComplete || loading}
            onPress={handleVerifyEmail}
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
