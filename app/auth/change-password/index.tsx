import { useMemo, useState } from "react";
import {
  Pressable,
  SafeAreaView,
  ScrollView,
  Text,
  TextInput,
  View,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";

function PasswordRequirement({
  isValid,
  label,
}: {
  isValid: boolean;
  label: string;
}) {
  return (
    <View className="mb-3 flex-row items-center">
      <View
        className={`mr-3 h-5 w-5 items-center justify-center rounded-full ${
          isValid ? "bg-[#EFFF00]" : "bg-white/12"
        }`}
      >
        <Text
          className={`text-[11px] font-black ${
            isValid ? "text-[#171717]" : "text-white/45"
          }`}
        >
          ✓
        </Text>
      </View>
      <Text
        className={`text-[13px] ${
          isValid ? "font-bold text-white" : "font-semibold text-white/60"
        }`}
      >
        {label}
      </Text>
    </View>
  );
}

export default function ChangePassword() {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const checks = useMemo(
    () => ({
      minLength: password.length >= 8,
      hasNumber: /\d/.test(password),
      hasUppercase: /[A-Z]/.test(password),
      matches: password.length > 0 && password === confirmPassword,
    }),
    [confirmPassword, password]
  );

  const canSave =
    checks.minLength &&
    checks.hasNumber &&
    checks.hasUppercase &&
    checks.matches;

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
        <ScrollView
          className="flex-1"
          contentContainerClassName="px-6 pb-8 pt-6"
          keyboardShouldPersistTaps="handled"
        >
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

          <View>
            <Text className="mb-3 text-[34px] font-extrabold leading-[40px] text-white">
              Alterar senha
            </Text>

            <Text className="mb-8 text-[15px] font-semibold leading-6 text-white/65">
              Crie uma senha segura para proteger sua conta e continuar usando
              o Unify.
            </Text>

            <Text className="mb-2 text-[12px] font-extrabold text-white/80">
              Nova senha
            </Text>
            <View className="mb-5 flex-row items-center rounded-md border border-white/12 bg-[#F4F4F5] px-4">
              <TextInput
                className="flex-1 py-4 text-[15px] text-zinc-900"
                placeholder="Digite sua nova senha"
                placeholderTextColor="#8C8F99"
                secureTextEntry={!showPassword}
                value={password}
                onChangeText={setPassword}
              />
              <Pressable onPress={() => setShowPassword((value) => !value)}>
                <Text className="text-[12px] font-semibold text-[#4F2D83]">
                  {showPassword ? "Ocultar" : "Mostrar"}
                </Text>
              </Pressable>
            </View>

            <Text className="mb-2 text-[12px] font-extrabold text-white/80">
              Confirmar senha
            </Text>
            <View className="mb-6 flex-row items-center rounded-md border border-white/12 bg-[#F4F4F5] px-4">
              <TextInput
                className="flex-1 py-4 text-[15px] text-zinc-900"
                placeholder="Digite novamente"
                placeholderTextColor="#8C8F99"
                secureTextEntry={!showConfirmPassword}
                value={confirmPassword}
                onChangeText={setConfirmPassword}
              />
              <Pressable
                onPress={() => setShowConfirmPassword((value) => !value)}
              >
                <Text className="text-[12px] font-semibold text-[#4F2D83]">
                  {showConfirmPassword ? "Ocultar" : "Mostrar"}
                </Text>
              </Pressable>
            </View>

            <View className="mb-8 rounded-md border border-white/10 bg-white/8 p-4">
              <Text className="mb-4 text-[14px] font-extrabold text-white">
                Sua senha precisa conter:
              </Text>

              <PasswordRequirement
                isValid={checks.minLength}
                label="No mínimo 8 caracteres"
              />
              <PasswordRequirement
                isValid={checks.hasUppercase}
                label="Uma letra maiúscula"
              />
              <PasswordRequirement
                isValid={checks.hasNumber}
                label="Um número"
              />
              <PasswordRequirement
                isValid={checks.matches}
                label="As senhas precisam ser iguais"
              />
            </View>

            <Pressable
              className={`items-center justify-center rounded-md py-4 ${
                canSave ? "bg-[#EFFF00]" : "bg-white/18"
              }`}
              disabled={!canSave}
              onPress={() => router.replace("/auth/login")}
            >
              <Text
                className={`text-[16px] font-bold ${
                  canSave ? "text-[#171717]" : "text-white/50"
                }`}
              >
                Salvar nova senha
              </Text>
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
        </ScrollView>
      </SafeAreaView>
    </LinearGradient>
  );
}
