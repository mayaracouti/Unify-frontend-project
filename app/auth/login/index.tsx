import { useEffect, useRef, useState } from "react";
import {
  AccessibilityInfo,
  ActivityIndicator,
  Platform,
  Pressable,
  Text,
  type TextStyle,
  View,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import { useIsFocused } from "@react-navigation/native";
import { SafeAreaView } from "react-native-safe-area-context";
import { WormRiseText, WormRiseWrapText } from "../../../src/components/ui/hello-wave";
import { UnifyMark } from "../../../src/components/ui/unify-mark";
import { FormField, type FormFieldHandle } from "../../../src/components/ui/form-field";
import { useAuth } from "../../../src/context/AuthContext";
import { profileService } from "../../../src/services/profileService";
import { formatApiErrorMessage } from "../../../src/utils/auth";
import { speak } from "../../../src/accessibility/tts";

function validateEmailField(value: string): string | null {
  if (!value.trim()) {
    return "Informe seu e-mail.";
  }

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim())) {
    return "Informe um e-mail válido.";
  }

  return null;
}

function validatePasswordField(value: string): string | null {
  if (!value.trim()) {
    return "Informe sua senha.";
  }

  return null;
}


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
  const emailFieldRef = useRef<FormFieldHandle>(null);
  const passwordFieldRef = useRef<FormFieldHandle>(null);

  // `accessibilityLiveRegion` e Android-only; no iOS o anuncio precisa ser
  // disparado manualmente quando a mensagem muda.
  useEffect(() => {
    if (error) {
      AccessibilityInfo.announceForAccessibility(error);
      speak(error);
    }
  }, [error]);

  const handleLogin = async () => {
    const isEmailValid = emailFieldRef.current?.validate() ?? true;
    const isPasswordValid = passwordFieldRef.current?.validate() ?? true;

    if (!isEmailValid) {
      emailFieldRef.current?.focus();
      return;
    }

    if (!isPasswordValid) {
      passwordFieldRef.current?.focus();
      return;
    }

    setError("");
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

      try {
        const completion = await profileService.getCompletion();

        if (!completion.profileCompleted) {
          // Primeira vez do usuario: configura acessibilidade antes do
          // onboarding de perfil (a tela de acessibilidade segue para
          // /onboarding/profile ao salvar).
          router.replace("/auth/cadastro/accessibility");
          return;
        }

        if (!completion.matchPreferencesCompleted) {
          router.replace("/onboarding/match-preferences");
          return;
        }
      } catch {
        // Fall back to home when completion cannot be resolved immediately.
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
            <FormField
              ref={emailFieldRef}
              label="Endereço de E-mail"
              labelClassName="mb-2 text-[12px] font-extrabold text-white/80"
              containerClassName="mb-4"
              value={email}
              onChangeText={(value) => {
                setEmail(value);
                if (error) {
                  setError("");
                }
              }}
              validator={validateEmailField}
              hint="Use o mesmo e-mail cadastrado na sua conta Unify."
              placeholder="nome@example.com"
              placeholderTextColor="#A1A1AA"
              autoCapitalize="none"
              autoComplete="email"
              keyboardType="email-address"
              disabled={loading}
            />

            <FormField
              ref={passwordFieldRef}
              label="Senha"
              labelClassName="mb-2 text-[12px] font-extrabold text-white/80"
              containerClassName="mb-4"
              value={password}
              onChangeText={(value) => {
                setPassword(value);
                if (error) {
                  setError("");
                }
              }}
              validator={validatePasswordField}
              hint="Informe a senha da sua conta."
              placeholder="••••••••"
              placeholderTextColor="#A1A1AA"
              secureTextEntry={!showPassword}
              disabled={loading}
              rightElement={
                <Pressable
                  className="ml-3 rounded px-2 py-1"
                  onPress={() => {
                    speak(showPassword ? "Senha oculta" : "Senha visível");
                    setShowPassword((value) => !value);
                  }}
                  accessibilityRole="button"
                  accessibilityLabel={showPassword ? "Ocultar senha" : "Mostrar senha"}
                >
                  <Text className="text-[12px] font-semibold text-[#2B1257]">
                    {showPassword ? "Ocultar" : "Mostrar"}
                  </Text>
                </Pressable>
              }
            />

            {error ? (
              <Text
                className="mb-4 text-center text-[13px] font-semibold text-danger"
                accessibilityRole="alert"
                accessibilityLiveRegion="polite"
              >
                {error}
              </Text>
            ) : null}

            <Pressable
              className="mb-6 self-end"
              onPress={() => {
                speak("Recuperar senha");
                router.push("/auth/forgot-password");
              }}
              accessibilityRole="button"
              accessibilityLabel="Esqueci minha senha"
              accessibilityHint="Abre a tela de recuperacao de senha"
            >
              <Text className="text-[12px] font-extrabold text-[#F2F500]">
                Esqueceu a senha?
              </Text>
            </Pressable>

            <Pressable
              className="mt-1 items-center justify-center rounded-md bg-[#2B1257] py-3.5"
              onPress={() => {
                speak("Entrar");
                void handleLogin();
              }}
              disabled={loading}
              accessibilityRole="button"
              accessibilityLabel={loading ? "Entrando…" : "Entrar"}
              accessibilityState={{ disabled: loading, busy: loading }}
            >
              {loading ? (
                <ActivityIndicator />
              ) : (
                <Text className="text-[15px] font-semibold text-white">
                  Entrar
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
              onPress={() => {
                speak("Criar uma conta");
                router.push("/auth/cadastro");
              }}
              accessibilityRole="button"
              accessibilityLabel="Criar uma conta"
              accessibilityHint="Abre a tela de cadastro"
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
