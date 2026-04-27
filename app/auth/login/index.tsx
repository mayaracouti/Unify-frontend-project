import { useState } from "react";
import {
  ActivityIndicator,
  Platform,
  Pressable,
  Text,
  TextInput,
  type TextStyle,
  View,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import { useIsFocused } from "@react-navigation/native";
import { SafeAreaView } from "react-native-safe-area-context";
import { WormRiseText, WormRiseWrapText } from "../../../src/components/ui/hello-wave";
import { UnifyMark } from "../../../src/components/ui/unify-mark";
import { useAuth } from "../../../src/context/AuthContext";
import { formatApiErrorMessage } from "../../../src/utils/auth";


const webTitleShadowStyle = {
  textShadow: "0px 4px 6px rgba(0,0,0,0.22)",
} as unknown as TextStyle;

const nativeTitleShadowStyle: TextStyle = {
  textShadowColor: "rgba(0,0,0,0.22)",
  textShadowOffset: { width: 0, height: 4 },
  textShadowRadius: 6,
};


export default function Login() {
  const router = useRouter();

  const isFocused = useIsFocused();
  const { signIn } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const animationReplayKey = isFocused ? "login-focused" : "login-blurred";
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");


  const handleLogin = async () => {
    if (!email.trim() || !password.trim()) {
      setError("Informe seu email e sua senha para continuar.");
      return;
    }
    setLoading(true);
    try {
      const result = await signIn({ email, password });

      if (result.status === "needs-verification") {
        router.replace({
          pathname: "/auth/email-code",
          params: { email: result.email },
        });
        return;
      }

      router.replace("/home");
    } catch (error) {
      setError(
        formatApiErrorMessage(error, "Não foi possível concluir seu login agora.")
      );
    } finally {
      setLoading(false);
    }
  };

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
          <View className="items-center pb-8 pt-12">
            <UnifyMark />
          
            { Platform.OS !== "web" ? (
              
              <WormRiseWrapText
                text="Unify"
                textClassName="text-[46px] font-extrabold tracking-tight text-white tracking-tight"
                segmentStyle={nativeTitleShadowStyle}
                autoPlay={isFocused}
                delay={340}
                stagger={20}
                duration={460}
                fromX={-14}
                fromY={24}
                lift={36}
                peakScale={1.08}
                startOpacity={0}
                replayKey={animationReplayKey}
              />
            
            ) : (
            <WormRiseText
                text="Unify"
                className="text-[46px] font-extrabold tracking-tight text-white"
                delay={340}
                stagger={20}
                duration={460}
                fromX={-14}
                fromY={24}
                lift={36}
                peakScale={1.08}
                startOpacity={0}
                replayKey={animationReplayKey}
              />
            )}
            
          </View>
          
          { Platform.OS !== "web" ? (
            <View>
              <WormRiseWrapText
                  text="Bem vindo de volta!"
                  className="mb-2"
                  textClassName="text-[26px] font-extrabold tracking-tight text-white"
                  segmentStyle={nativeTitleShadowStyle}
                  autoPlay={isFocused}
                  delay={340}
                  stagger={60}
                  duration={1000}
                  fromX={-14}
                  fromY={24}
                  lift={36}
                  peakScale={1.08}
                  startOpacity={0}
                  replayKey={animationReplayKey}
                />

              <WormRiseWrapText
                text="Faça login para acessar sua comunidade inclusiva."
                className="mb-6"
                textClassName="text-[14px] font-semibold leading-5 text-white/70 text-nowrap"
                segmentStyle={nativeTitleShadowStyle}
                autoPlay={isFocused}
                delay={340}
                stagger={60}
                duration={1200}
                fromX={-14}
                fromY={24}
                lift={36}
                peakScale={1.08}
                startOpacity={0}
                replayKey={animationReplayKey}
              />
            </View>
          ) : (
          <View className="mb-6">
            <WormRiseText
              text="Bem vindo de volta!"
              className="mb-2 text-[26px] font-extrabold text-white"
              delay={340}
              stagger={20}
              duration={460}
              fromX={-14}
              fromY={24}
              lift={36}
              peakScale={1.08}
              startOpacity={0}
              replayKey={animationReplayKey}
            />

            <WormRiseText
              text="Faça login para acessar sua comunidade inclusiva."
              className="mb-6 text-[14px] font-semibold leading-5 text-white/70"
              delay={340}
              stagger={20}
              duration={460}
              fromX={-14}
              fromY={24}
              lift={36}
              peakScale={1.08}
              startOpacity={0}
              replayKey={animationReplayKey}
            />
          </View>
           )
          }

          <View className="flex-1 justify-start mt-10">
            <Text className="mb-2 text-[12px] font-extrabold text-white/80">
              Endereço de E-mail
            </Text>
            <TextInput
              className="mb-4 rounded-md bg-[#F3F3F3] px-4 py-4 text-[14px] text-zinc-900"
              placeholder="nome@example.com"
              placeholderTextColor="#A1A1AA"
              autoCapitalize="none"
              keyboardType="email-address"
              value={email}
              onChangeText={setEmail}
            />

            <Text className="mb-2 text-[12px] font-extrabold text-white/80">
              Senha
            </Text>
            <View className="mb-4 flex-row items-center rounded-md bg-[#F3F3F3] px-4">
              <TextInput
                className="flex-1 py-4 text-[14px] text-zinc-900"
                placeholder="••••••••"
                placeholderTextColor="#A1A1AA"
                secureTextEntry={!showPassword}
                value={password}
                onChangeText={setPassword}
              />
              <Pressable
                className="ml-3 rounded px-2 py-1"
                onPress={() => setShowPassword((value) => !value)}
              >
                <Text className="text-[12px] font-semibold text-[#2B1257]">
                  {showPassword ? "Ocultar" : "Mostrar"}
                </Text>
              </Pressable>
            </View>

            <Pressable
              className="mb-6 self-end"
              onPress={() => router.push("/auth/forgot-password")}
            >
              <Text className="text-[12px] font-extrabold text-[#F2F500]">
                Esqueceu a senha?
              </Text>
            </Pressable>

            <Pressable
              className="mt-1 items-center justify-center rounded-md bg-[#2B1257] py-3.5"
              onPress={handleLogin}
              disabled={loading}
            >
              {loading ? (
                <ActivityIndicator />
              ) : (
                <Text className="text-[15px] font-semibold text-white">
                  Login
                </Text>
              )}
            </Pressable>
          </View>

          <View className="pb-12 pt-8">
            <View className="mb-8 flex-row items-center">
              <View className="h-px flex-1 bg-white/50" />
              <Text className="mx-5 text-[12px] font-semibold uppercase tracking-[1.5px] text-white/90">
                ou
              </Text>
              <View className="h-px flex-1 bg-white/50" />
            </View>

            <Text className="mb-4 text-center text-[12px] font-semibold text-white/65">
              Não tem uma conta?
            </Text>

            <Pressable
              className="items-center justify-center rounded-md border border-white/70 py-3.5"
              onPress={() => router.push("/auth/cadastro")}
            >
              <Text className="text-[15px] font-extrabold text-white">
                Inscrever-se
              </Text>
            </Pressable>
          </View>
        </View>
      </SafeAreaView>
    </LinearGradient>
  );
}
