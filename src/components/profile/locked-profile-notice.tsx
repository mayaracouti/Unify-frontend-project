import Ionicons from "@expo/vector-icons/Ionicons";
import { Text, View } from "react-native";

export const LOCKED_PROFILE_TITLE = "Esta conta é privada";
export const LOCKED_PROFILE_MESSAGE = "Siga esta conta para ver o perfil e as publicações.";
/** Travado mas com dados de match visíveis (ex.: match mútuo): parte do perfil já aparece. */
export const LOCKED_PROFILE_PARTIAL_MESSAGE =
  "Siga esta conta para ver o perfil completo e as publicações.";

/**
 * Estado do perfil travado (conta privada que eu nao sigo): cadeado, titulo e
 * o convite para seguir. Um unico foco para o leitor de tela.
 */
export function LockedProfileNotice({
  className = "",
  highContrast = false,
  partial = false,
}: {
  className?: string;
  highContrast?: boolean;
  /** Alguma parte do perfil continua visível abaixo do aviso. */
  partial?: boolean;
}) {
  const message = partial ? LOCKED_PROFILE_PARTIAL_MESSAGE : LOCKED_PROFILE_MESSAGE;
  return (
    <View
      accessible
      accessibilityRole="text"
      accessibilityLabel={`${LOCKED_PROFILE_TITLE}. ${message}`}
      className={`items-center rounded-[22px] border px-5 py-6 ${
        highContrast ? "border-hc-border bg-hc-surface" : "border-[#3A3246] bg-[#17181C]"
      } ${className}`}
    >
      <View
        className={`h-14 w-14 items-center justify-center rounded-full ${
          highContrast ? "border-2 border-hc-accent" : "bg-[#2B2338]"
        }`}
      >
        <Ionicons
          name="lock-closed"
          size={26}
          color={highContrast ? "#FFD400" : "#F1EF00"}
          importantForAccessibility="no"
        />
      </View>
      <Text
        className={`mt-4 text-center text-[18px] font-black ${
          highContrast ? "text-hc-text" : "text-white"
        }`}
      >
        {LOCKED_PROFILE_TITLE}
      </Text>
      <Text
        className={`mt-2 max-w-[300px] text-center text-[15px] font-semibold leading-6 ${
          highContrast ? "text-hc-text" : "text-[#CAC3D8]"
        }`}
      >
        {message}
      </Text>
    </View>
  );
}
