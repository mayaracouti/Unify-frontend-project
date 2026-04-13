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
    <View className="relative mb-5 h-20 w-20 items-center justify-center">
      <View className="absolute h-8 w-8 -translate-x-3 -translate-y-2 rounded-full bg-violet-900/90" />
      <View className="absolute h-8 w-8 translate-x-3 -translate-y-2 rounded-full bg-sky-400/90" />
      <View className="absolute h-8 w-8 -translate-x-1 translate-y-3 rounded-full bg-fuchsia-500/90" />
      <View className="absolute h-8 w-8 -translate-x-6 rounded-full bg-indigo-700/90" />
      <View className="absolute h-8 w-8 translate-x-6 rounded-full bg-cyan-400/90" />
      <View className="h-4 w-4 rounded-full bg-white/80" />
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
        <View className="absolute -left-16 top-24 h-72 w-72 rounded-full bg-white/10" />
        <View className="absolute -right-20 bottom-24 h-80 w-80 rounded-full bg-fuchsia-400/10" />

        <View className="flex-1 px-7">
          <View className="flex-[1.2] items-center justify-center">
            <UnifyMark />
            <Text className="text-center text-[54px] font-extrabold tracking-tight text-white">
              Unify
            </Text>
            <View className="mt-2 h-2 w-36 rounded-full bg-black/20" />
          </View>

          <View className="flex-1">
            <TextInput
              className="mb-4 rounded-lg bg-white px-4 py-4 text-[15px] text-zinc-900"
              placeholder="Digite seu email"
              placeholderTextColor="#A1A1AA"
              autoCapitalize="none"
              keyboardType="email-address"
              value={email}
              onChangeText={setEmail}
            />

            <View className="mb-4 flex-row items-center rounded-lg bg-white px-4">
              <TextInput
                className="flex-1 py-4 text-[15px] text-zinc-900"
                placeholder="Senha"
                placeholderTextColor="#A1A1AA"
                secureTextEntry={!showPassword}
                value={password}
                onChangeText={setPassword}
              />
              <Pressable onPress={() => setShowPassword((value) => !value)}>
                <Text className="text-xs font-semibold text-zinc-500">
                  {showPassword ? "Ocultar" : "Mostrar"}
                </Text>
              </Pressable>
            </View>

            <Text className="text-center text-[12px] text-white/65">
              Não possui uma Conta?{" "}
              <Text className="font-semibold text-[#24124F]">
                clique aqui e faça seu cadastro.
              </Text>
            </Text>
          </View>

          <View className="flex-[0.9] justify-end pb-10">
            <View className="mb-7 flex-row items-center">
              <View className="h-px flex-1 bg-white/60" />
              <Text className="mx-5 text-base font-medium uppercase tracking-[1.5px] text-white/90">
                ou
              </Text>
              <View className="h-px flex-1 bg-white/60" />
            </View>

            <Pressable className="flex-row items-center justify-center rounded-lg bg-[#FFF7F7] px-4 py-4">
              <Text className="mr-3 text-[22px] font-bold text-[#EA4335]">
                G
              </Text>
              <Text className="text-[16px] font-medium text-[#3B82F6]">
                continue com o Gmail
              </Text>
            </Pressable>
          </View>
        </View>
      </View>
    </SafeAreaView>
  );
}
