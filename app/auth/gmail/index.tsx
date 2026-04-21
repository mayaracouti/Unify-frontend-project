import { useState } from "react";
import {
  Pressable,
  SafeAreaView,
  Text,
  TextInput,
  View,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";

function UnifyMark() {
  return (
    <View className="relative mb-2 h-10 w-10 items-center justify-center">
      <View className="absolute h-4 w-4 -translate-x-1.5 -translate-y-1.5 rounded-full bg-violet-900/95" />
      <View className="absolute h-4 w-4 translate-x-1.5 -translate-y-1.5 rounded-full bg-sky-400/95" />
      <View className="absolute h-4 w-4 -translate-x-0.5 translate-y-2 rounded-full bg-fuchsia-500/95" />
      <View className="absolute h-4 w-4 -translate-x-3 rounded-full bg-indigo-700/95" />
      <View className="absolute h-4 w-4 translate-x-3 rounded-full bg-cyan-400/95" />
      <View className="h-2 w-2 rounded-full bg-white/85" />
    </View>
  );
}

export default function GmailLogin() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const canContinue = email.trim().length > 0;

  return (
    <LinearGradient
      colors={["#373B92", "#5F42B7", "#7A5CD4"]}
      locations={[0, 0.58, 1]}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={{ flex: 1 }}
    >
      <View className="absolute inset-0 bg-black/5" />

      <SafeAreaView className="flex-1">
        <View className="flex-1 px-8 pt-6">
          <View className="mb-12 flex-row items-center justify-between">
            <Pressable
              className="h-12 w-12 justify-center"
              onPress={() => router.back()}
            >
              <Text className="text-[42px] leading-[44px] text-white/75">
                ‹
              </Text>
            </Pressable>

            <View className="items-center">
              <UnifyMark />
              <Text className="text-[18px] font-bold text-white">Unify</Text>
            </View>

            <View className="h-12 w-12" />
          </View>

          <View className="flex-1 justify-center pb-20">
            <Text className="mb-3 text-[34px] font-bold leading-[42px] text-white">
              Entrar com Gmail
            </Text>

            <Text className="mb-10 text-[15px] leading-6 text-white/70">
              Informe o Gmail vinculado à sua conta para continuar com
              segurança.
            </Text>

            <TextInput
              className="mb-4 rounded-md border border-white/20 bg-white/95 px-4 py-4 text-[15px] text-zinc-900"
              placeholder="email@gmail.com"
              placeholderTextColor="#8C8F99"
              autoCapitalize="none"
              keyboardType="email-address"
              value={email}
              onChangeText={setEmail}
            />

            <Pressable
              className={`mb-5 items-center justify-center rounded-md py-4 ${
                canContinue ? "bg-white" : "bg-white/35"
              }`}
            >
              <Text
                className={`text-[15px] font-bold ${
                  canContinue ? "text-[#2B1257]" : "text-white/55"
                }`}
              >
                Continuar
              </Text>
            </Pressable>

            <Text className="text-[12px] leading-5 text-white/58">
              Ao continuar, você confirma que este endereço pertence a você e
              autoriza o Unify a usá-lo para autenticação.
            </Text>
          </View>
        </View>
      </SafeAreaView>
    </LinearGradient>
  );
}
