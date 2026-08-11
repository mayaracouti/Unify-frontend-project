import { useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Platform,
  Pressable,
  ScrollView,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import Ionicicons from '@expo/vector-icons/Ionicons';
import DateTimePicker, {
  type DateTimePickerEvent,
} from "@react-native-community/datetimepicker";

import { FormField, type FormFieldHandle } from "../../../src/components/ui/form-field";
import { useAuth } from "../../../src/context/AuthContext";
import { formatApiErrorMessage } from "../../../src/utils/auth";
import { isApiError } from "../../../src/types/auth";

const UNDERAGE_SIGNUP_ERROR_CODE = 3008;

const BIRTHDATE_LOCALE = "pt-BR";

function formatBirthdateForDisplay(date: Date): string {
  return date.toLocaleDateString(BIRTHDATE_LOCALE);
}

function formatBirthdateForApi(date: Date): string {
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, "0");
  const day = `${date.getDate()}`.padStart(2, "0");

  return `${year}-${month}-${day}`;
}

function validateRequiredTextField(fieldLabel: string) {
  return (value: string): string | null => {
    if (!value.trim()) {
      return `Informe ${fieldLabel}.`;
    }

    return null;
  };
}

function validateEmailField(value: string): string | null {
  if (!value.trim()) {
    return "Informe seu e-mail.";
  }

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim())) {
    return "Informe um e-mail válido.";
  }

  return null;
}

function checkPasswordRequirements(value: string) {
  return {
    minLength: value.length >= 8,
    hasUppercase: /[A-Z]/.test(value),
    hasLowercase: /[a-z]/.test(value),
    hasNumber: /\d/.test(value),
    hasSpecialCharacter: /[^A-Za-z0-9]/.test(value),
  };
}

function validatePasswordField(value: string): string | null {
  if (!value.trim()) {
    return "Informe uma senha.";
  }

  const checks = checkPasswordRequirements(value);
  const isValid = Object.values(checks).every(Boolean);

  return isValid ? null : "A senha precisa atender a todos os requisitos abaixo.";
}

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
          isValid ? "bg-[#8BFFF3]" : "bg-white/20"
        }`}
      />
      <Text
        className={`text-[12px] font-semibold leading-4 ${
          isValid ? "text-[#8BFFF3]" : "text-[#D7D7DE]"
        }`}
      >
        {label}
      </Text>
    </View>
  );
}

export default function Cadastro() {
  const router = useRouter();
  const { signUp } = useAuth();

  const [name, setName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [birthdate, setBirthdate] = useState<Date | null>(null);
  const [showBirthdatePicker, setShowBirthdatePicker] = useState(false);
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const nameFieldRef = useRef<FormFieldHandle>(null);
  const lastNameFieldRef = useRef<FormFieldHandle>(null);
  const emailFieldRef = useRef<FormFieldHandle>(null);
  const passwordFieldRef = useRef<FormFieldHandle>(null);

  const clearError = () => {
    if (error) {
      setError(null);
    }
  };

  const passwordChecks = useMemo(() => checkPasswordRequirements(password), [password]);

  const isPasswordValid =
    passwordChecks.minLength &&
    passwordChecks.hasUppercase &&
    passwordChecks.hasLowercase &&
    passwordChecks.hasNumber &&
    passwordChecks.hasSpecialCharacter;

  const birthdateForApi = birthdate ? formatBirthdateForApi(birthdate) : "";

  function handleBirthdateChange(
    event: DateTimePickerEvent,
    selectedDate?: Date
  ) {
    if (Platform.OS === "android") {
      setShowBirthdatePicker(false);
    }

    if (event.type === "dismissed" || !selectedDate) {
      return;
    }

    setBirthdate(selectedDate);
    clearError();
  }

  async function handleCreateAccount() {
    const isNameValid = nameFieldRef.current?.validate() ?? true;
    const isLastNameValid = lastNameFieldRef.current?.validate() ?? true;
    const isEmailValid = emailFieldRef.current?.validate() ?? true;
    const isPasswordFieldValid = passwordFieldRef.current?.validate() ?? true;

    if (!isNameValid) {
      nameFieldRef.current?.focus();
      return;
    }

    if (!isLastNameValid) {
      lastNameFieldRef.current?.focus();
      return;
    }

    if (!isEmailValid) {
      emailFieldRef.current?.focus();
      return;
    }

    if (!birthdate) {
      setError("Informe sua data de nascimento para continuar.");
      setShowBirthdatePicker(true);
      return;
    }

    if (!isPasswordFieldValid) {
      setError("A senha precisa atender a todos os requisitos exibidos abaixo.");
      passwordFieldRef.current?.focus();
      return;
    }

    try {
      setLoading(true);
      setError(null);

      const response = await signUp({
        name,
        lastName,
        email,
        password,
        birthdate: birthdateForApi,
      });

      router.replace({
        pathname: "/auth/email-code",
        params: {
          email: response.email,
        },
      });
    } catch (error) {
      if (
        isApiError(error) &&
        (error.code === UNDERAGE_SIGNUP_ERROR_CODE ||
          error.error === "VALIDATION_UNDERAGE_USER")
      ) {
        router.replace("/auth/underage");
        return;
      }

      setError(
        formatApiErrorMessage(error, "Não foi possível criar sua conta agora.")
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <LinearGradient
      colors={["#2B0B4F", "#38156A", "#533F78"]}
      locations={[0, 0.52, 1]}
      start={{ x: 0, y: 0 }}
      end={{ x: 0.95, y: 1 }}
      style={{ flex: 1 }}
    >
      <View className="absolute inset-0 bg-black/10" />

      <SafeAreaView className="flex-1">
        <ScrollView
          className="flex-1"
          contentContainerClassName="px-6 pb-8 pt-7"
          keyboardShouldPersistTaps="handled"
        >
          <View className="mb-5 items-center">
            <View className="mb-5 h-16 w-16 items-center justify-center rounded-md bg-[#814DFF]">
              <Ionicicons name="person-add-outline" size={28} color="#fff" />
            </View>

            <Text className="mb-3 text-center text-[25px] font-extrabold text-white">
              Criar Conta
            </Text>

            <Text className="max-w-[260px] text-center text-[13px] font-semibold leading-5 text-[#B9BAC4]">
              Junte-se à nossa comunidade vibrante e acessível hoje.
            </Text>
          </View>

          <View className="mb-4 flex-row">
            <FormField
              ref={nameFieldRef}
              label="Nome"
              containerClassName="mr-3 flex-1 mb-0"
              labelClassName="mb-1 text-[11px] font-bold text-white/70"
              fieldClassName="border-b border-white/35 bg-black/24 px-4"
              inputClassName="py-4 text-[14px] text-white"
              placeholder="Nome"
              placeholderTextColor="#8F90A0"
              value={name}
              onChangeText={(value) => {
                setName(value);
                clearError();
              }}
              validator={validateRequiredTextField("seu nome")}
              disabled={loading}
            />

            <FormField
              ref={lastNameFieldRef}
              label="Sobrenome"
              containerClassName="flex-1 mb-0"
              labelClassName="mb-1 text-[11px] font-bold text-white/70"
              fieldClassName="border-b border-white/35 bg-black/24 px-4"
              inputClassName="py-4 text-[14px] text-white"
              placeholder="Sobrenome"
              placeholderTextColor="#8F90A0"
              value={lastName}
              onChangeText={(value) => {
                setLastName(value);
                clearError();
              }}
              validator={validateRequiredTextField("seu sobrenome")}
              disabled={loading}
            />
          </View>

          <FormField
            ref={emailFieldRef}
            label="E-mail"
            labelClassName="sr-only"
            containerClassName="mb-4"
            fieldClassName="border-b border-[#8BFFF3] bg-black/24 px-4"
            inputClassName="py-4 text-[14px] text-white"
            placeholder="E-mail"
            placeholderTextColor="#8F90A0"
            autoCapitalize="none"
            autoComplete="email"
            keyboardType="email-address"
            value={email}
            onChangeText={(value) => {
              setEmail(value);
              clearError();
            }}
            validator={validateEmailField}
            disabled={loading}
          />

          <Pressable
            className="mb-4 flex-row items-center border-b border-white/35 bg-black/24 px-4 py-4"
            onPress={() => setShowBirthdatePicker((currentValue) => !currentValue)}
            accessibilityRole="button"
            accessibilityLabel="Data de nascimento"
            accessibilityHint="Abre o seletor de data para informar quando você nasceu"
            accessibilityValue={birthdate ? { text: formatBirthdateForDisplay(birthdate) } : undefined}
          >
            <Text
              className={`flex-1 text-[14px] ${
                birthdate ? "text-white" : "text-[#8F90A0]"
              }`}
            >
              {birthdate
                ? formatBirthdateForDisplay(birthdate)
                : "Data de nascimento"}
            </Text>
            <Ionicicons name="calendar-outline" size={20} color="#B7A8D8" />
          </Pressable>

          {showBirthdatePicker ? (
            <View className="mb-4 overflow-hidden rounded-md bg-black/24 px-2 py-2">
              <DateTimePicker
                value={birthdate ?? new Date()}
                mode="date"
                display={Platform.OS === "ios" ? "spinner" : "default"}
                locale={BIRTHDATE_LOCALE}
                maximumDate={new Date()}
                onChange={handleBirthdateChange}
              />
            </View>
          ) : null}

          <FormField
            ref={passwordFieldRef}
            label="Senha"
            labelClassName="mb-1 text-[11px] font-bold text-white/70"
            containerClassName="mb-5"
            fieldClassName="flex-row items-center border-b border-white/35 bg-black/24 px-4"
            inputClassName="flex-1 py-4 text-[14px] text-white"
            placeholder="Senha"
            placeholderTextColor="#8F90A0"
            secureTextEntry={!showPassword}
            value={password}
            onChangeText={(value) => {
              setPassword(value);
              clearError();
            }}
            validator={validatePasswordField}
            hint="Veja a lista de requisitos logo abaixo do campo."
            disabled={loading}
            rightElement={
              <Pressable
                onPress={() => setShowPassword((value) => !value)}
                accessibilityRole="button"
                accessibilityLabel={showPassword ? "Ocultar senha" : "Mostrar senha"}
              >
                <Text className="text-[12px] font-bold text-[#B7A8D8]">
                  {showPassword ? "Ocultar" : "Ver"}
                </Text>
              </Pressable>
            }
          />

          <View className="mb-5 rounded-md bg-black/28 px-4 py-3">
            <Text className="mb-3 text-[12px] font-bold leading-4 text-[#D7D7DE]">
              A senha precisa atender os seguintes requisitos:
            </Text>

            <PasswordRequirement
              isValid={passwordChecks.minLength}
              label="Conter no mínimo 8 caracteres"
            />
            <PasswordRequirement
              isValid={passwordChecks.hasUppercase}
              label="Conter pelo menos uma letra maiúscula"
            />
            <PasswordRequirement
              isValid={passwordChecks.hasLowercase}
              label="Conter pelo menos uma letra minúscula"
            />
            <PasswordRequirement
              isValid={passwordChecks.hasNumber}
              label="Conter pelo menos um número"
            />
            <PasswordRequirement
              isValid={passwordChecks.hasSpecialCharacter}
              label="Conter pelo menos um caractere especial"
            />
          </View>

          {error ? (
            <Text
              className="mb-4 text-center text-[12px] font-semibold text-red-300"
              accessibilityRole="alert"
              accessibilityLiveRegion="polite"
            >
              {error}
            </Text>
          ) : null}

          <Pressable
            className={`mb-8 items-center justify-center rounded-md py-4 ${
              loading ? "bg-[#BFC200]" : "bg-[#F2F500]"
            }`}
            disabled={loading}
            onPress={handleCreateAccount}
            accessibilityRole="button"
            accessibilityLabel={loading ? "Cadastrando…" : "Cadastrar"}
            accessibilityState={{ disabled: loading, busy: loading }}
          >
            {loading ? (
              <ActivityIndicator color="#191919" />
            ) : (
              <Text className="text-[15px] font-extrabold text-[#191919]">
                Cadastrar  →
              </Text>
            )}
          </Pressable>

          <Pressable
            className="items-center justify-center rounded-md border border-white/35 py-3"
            onPress={() => router.replace("/auth/login")}
          >
            <Text className="text-[14px] font-extrabold text-white">
              Voltar para o Login
            </Text>
          </Pressable>
        </ScrollView>
      </SafeAreaView>
    </LinearGradient>
  );
}
