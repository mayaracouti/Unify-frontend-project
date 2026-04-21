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

export default function GmailLogin() {
  const router = useRouter();
  const [email, setEmail] = useState("");

  return (
    <LinearGradient
      colors={["#4D52B5", "#724BCE", "#906DDE"]}
      locations={[0, 0.55, 0.96]}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={{ flex: 1 }}
    >
      <View className="absolute inset-0 bg-black/5" />

      <SafeAreaView className="flex-1">
        <View className="flex-1 px-8">
          <View className="flex-[0.9] items-center justify-center pt-8">
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

          <View className="flex-[1.25] justify-start">
            <View className="mb-6 items-center">
              <View className="mb-5 h-16 w-16 items-center justify-center rounded-full bg-[#F7F1F1]">
                <Text className="text-[34px] font-bold text-[#EA4335]">G</Text>
              </View>

              <Text className="mb-2 text-center text-[24px] font-bold text-white">
                Entrar com Gmail
              </Text>
              <Text className="text-center text-[13px] leading-5 text-white/70">
                Use sua conta Gmail para continuar acessando o Unify.
              </Text>
            </View>

            <TextInput
              className="mb-4 rounded-md bg-[#F3F3F3] px-4 py-4 text-[14px] text-zinc-900"
              placeholder="Digite seu Gmail"
              placeholderTextColor="#A1A1AA"
              autoCapitalize="none"
              keyboardType="email-address"
              value={email}
              onChangeText={setEmail}
            />

            <Pressable className="mb-4 flex-row items-center justify-center rounded-md bg-[#F7F1F1] py-3.5">
              <Text className="mr-3 text-[20px] font-bold text-[#EA4335]">
                G
              </Text>
              <Text className="text-[15px] font-medium text-[#3B82F6]">
                continuar com Gmail
              </Text>
            </Pressable>

            <Text className="text-center text-[11px] leading-4 text-white/55">
              Ao continuar, você autoriza o Unify a usar seu Gmail para login.
            </Text>
          </View>

          <View className="flex-[0.45] justify-end pb-12">
            <Pressable
              className="items-center justify-center rounded-md border border-white/45 py-3.5"
              onPress={() => router.back()}
            >
              <Text className="text-[14px] font-semibold text-white">
                voltar para login
              </Text>
            </Pressable>
          </View>
        </View>
      </SafeAreaView>
    </LinearGradient>
  );
}
