import { useState } from "react";
import {
  Pressable,
  SafeAreaView,
  Text,
  TextInput,
  View,
} from "react-native";

function UnifyMark() {
  return (
    <View className="relative mb-4 h-16 w-16 items-center justify-center">
      <View className="absolute h-7 w-7 -translate-x-2.5 -translate-y-2 rounded-full bg-violet-900/95" />
      <View className="absolute h-7 w-7 translate-x-2.5 -translate-y-2 rounded-full bg-sky-400/95" />
      <View className="absolute h-7 w-7 -translate-x-1 translate-y-2.5 rounded-full bg-fuchsia-500/95" />
      <View className="absolute h-7 w-7 -translate-x-5 rounded-full bg-indigo-700/95" />
      <View className="absolute h-7 w-7 translate-x-5 rounded-full bg-cyan-400/95" />
      <View className="h-3.5 w-3.5 rounded-full bg-white/85" />
    </View>
  );
}

export default function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  return (
    <SafeAreaView className="flex-1 bg-[#6B42D9]">
      <View className="flex-1 bg-[#6B42D9]">
        <View className="absolute inset-0 bg-[#7B50E8]" />
        <View className="absolute inset-0 bg-black/5" />

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

            <View className="mb-3 flex-row items-center rounded-md bg-[#F3F3F3] px-4">
              <TextInput
                className="flex-1 py-4 text-[14px] text-zinc-900"
                placeholder="Senha"
                placeholderTextColor="#A1A1AA"
                secureTextEntry={!showPassword}
                value={password}
                onChangeText={setPassword}
              />
              <Pressable onPress={() => setShowPassword((value) => !value)}>
                <Text className="text-[12px] text-zinc-400">
                  {showPassword ? "Ocultar" : "◔"}
                </Text>
              </Pressable>
            </View>

            <Text className="text-center text-[11px] text-white/55">
              Não possui uma Conta?{" "}
              <Text className="font-semibold text-[#2B1257]">
                clique aqui e faça seu cadastro.
              </Text>
            </Text>
          </View>

          <View className="flex-[0.85] justify-end pb-12">
            <View className="mb-7 flex-row items-center">
              <View className="h-px flex-1 bg-white/50" />
              <Text className="mx-5 text-[12px] font-semibold uppercase tracking-[1.5px] text-white/90">
                ou
              </Text>
              <View className="h-px flex-1 bg-white/50" />
            </View>

            <Pressable className="flex-row items-center justify-center rounded-md bg-[#F7F1F1] py-3.5">
              <Text className="mr-3 text-[20px] font-bold text-[#EA4335]">
                G
              </Text>
              <Text className="text-[15px] font-medium text-[#3B82F6]">
                continue com o Gmail
              </Text>
            </Pressable>
          </View>
        </View>
      </View>
    </SafeAreaView>
  );
}