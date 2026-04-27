import { useMemo, useState } from "react";
import {
  Pressable,
  SafeAreaView,
  Text,
  TextInput,
  View,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";

export default function EmailCode() {
  const router = useRouter();
  const { email } = useLocalSearchParams<{ email?: string }>();
  const [code, setCode] = useState("");

  const digits = useMemo(() => {
    const values = code.split("").slice(0, 6);
    return Array.from({ length: 6 }, (_, index) => values[index] ?? "");
  }, [code]);

  const isComplete = code.length === 6;

  return (
    <View className="flex-1 bg-[#111214]">
      <SafeAreaView className="flex-1">
        <View className="flex-1 px-8 pt-8">
          <Pressable
            className="mb-14 h-12 w-12 justify-center"
            onPress={() => router.back()}
          >
            <Text className="text-[50px] leading-[52px] text-[#777B86]">
              ‹
            </Text>
          </Pressable>

          <Text className="mb-6 text-[48px] font-semibold leading-[58px] text-[#F4F4F5]">
            Insira o código recebido 
          </Text>

          <Text className="mb-10 text-[18px] font-semibold tracking-[1px] text-[#A7AAB2]">
            {`Enviamos um código de 6 dígitos para ${email}`}
          </Text>

          <View className="mb-5 flex-row justify-between">
            {digits.map((digit, index) => (
              <View key={index} className="w-[15%]">
                <Text className="text-center text-[42px] font-semibold text-[#F4F4F5]">
                  {digit || " "}
                </Text>
                <View
                  className={`mt-2 h-0.5 ${
                    digit ? "bg-[#FF4F88]" : "bg-[#8A8E98]"
                  }`}
                />
              </View>
            ))}
          </View>

          <TextInput
            className="absolute h-1 w-1 opacity-0"
            keyboardType="number-pad"
            maxLength={6}
            autoFocus
            value={code}
            onChangeText={(value) =>
              setCode(value.replace(/\D/g, "").slice(0, 6))
            }
          />

         

          <Text className="mb-2 text-[18px] leading-7 text-[#A7AAB2]">
            Não recebeu? Não se preocupe, vamos tentar novamente.
          </Text>

          <Pressable className="mb-10 self-start">
            <Text className="text-[18px] font-bold text-[#2F90D8]">
              Reenviar
            </Text>
          </Pressable>

          <Pressable
            className={`items-center justify-center rounded-full py-5 ${
              isComplete ? "bg-white" : "bg-[#3B3D45]"
            }`}
            disabled={!isComplete}
            onPress={() => router.push("/auth/change-password")}
          >
            <Text
              className={`text-[22px] font-bold ${
                isComplete ? "text-[#18191B]" : "text-[#737782]"
              }`}
            >
              Seguinte
            </Text>
          </Pressable>
        </View>
      </SafeAreaView>
    </View>
  );
}
