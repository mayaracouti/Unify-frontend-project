import { useMemo, useState } from "react";
import {
  Pressable,
  SafeAreaView,
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
    <View className="mb-2 flex-row items-center">
      <View
        className={`mr-3 h-2.5 w-2.5 rounded-full ${
          isValid ? "bg-[#5EE6A8]" : "bg-white/30"
        }`}
      />
      <Text
        className={`text-[13px] ${
          isValid ? "font-semibold text-white" : "text-white/62"
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
      colors={["#211235", "#4F2D83", "#7C4CD6"]}
      locations={[0, 0.56, 1]}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={{ flex: 1 }}
    >
      <View className="absolute inset-0 bg-black/10" />

      <SafeAreaView className="flex-1">
        <View className="flex-1 px-8 pt-8">
          <Pressable
            className="mb-12 h-12 w-12 justify-center"
            onPress={() => router.back()}
          >
            <Text className="text-[50px] leading-[52px] text-white/70">‹</Text>
          </Pressable>

          <View className="flex-1 justify-center pb-16">
            <Text className="mb-4 text-[42px] font-bold leading-[50px] text-white">
              Alterar senha
            </Text>

            <Text className="mb-9 text-[15px] leading-6 text-white/68">
              Crie uma nova senha forte para manter sua conta protegida.
            </Text>

            <View className="mb-4 flex-row items-center rounded-md border border-white/15 bg-white/95 px-4">
              <TextInput
                className="flex-1 py-4 text-[15px] text-zinc-900"
                placeholder="Nova senha"
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

            <View className="mb-5 flex-row items-center rounded-md border border-white/15 bg-white/95 px-4">
              <TextInput
                className="flex-1 py-4 text-[15px] text-zinc-900"
                placeholder="Confirmar senha"
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

            <View className="mb-8">
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
                canSave ? "bg-white" : "bg-white/30"
              }`}
              disabled={!canSave}
              onPress={() => router.replace("/auth/login")}
            >
              <Text
                className={`text-[16px] font-bold ${
                  canSave ? "text-[#2B1257]" : "text-white/55"
                }`}
              >
                Salvar nova senha
              </Text>
            </Pressable>
          </View>
        </View>
      </SafeAreaView>
    </LinearGradient>
  );
}
