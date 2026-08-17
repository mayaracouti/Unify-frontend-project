import { useEffect } from "react";
import { ActivityIndicator, Pressable, Text, View } from "react-native";

import { joinSpeechParts, useTTS } from "../../accessibility/tts";

export type ScreenErrorProps = {
  /** Mensagem já formatada para o usuário final (ver `formatApiErrorMessage`). */
  message: string;
  title?: string;
  onRetry?: () => void;
  retrying?: boolean;
  className?: string;
};

const DEFAULT_TITLE = "Algo deu errado";

/**
 * Estado de erro padronizado (ver plano-implementacao
 * 00-DIAGNOSTICO-E-FUNDACAO.md §4.1). `accessibilityRole="alert"` +
 * `accessibilityLiveRegion="assertive"` fazem o leitor de tela interromper
 * o que estiver anunciando para avisar do erro assim que o componente
 * aparece — diferente do estado vazio, que pode esperar o usuário navegar
 * até ele.
 */
export function ScreenError({
  message,
  title = DEFAULT_TITLE,
  onRetry,
  retrying,
  className,
}: ScreenErrorProps) {
  const { speak } = useTTS();

  // Evento deliberado de acessibilidade: o erro precisa ser audivel assim que
  // aparece (espelha o comportamento visual do alert assertivo).
  useEffect(() => {
    speak(joinSpeechParts([title, message]));
  }, [message, speak, title]);

  return (
    <View
      className={
        className ??
        "items-center rounded-[28px] border border-danger/40 bg-surface-alt px-6 py-10"
      }
      accessibilityRole="alert"
      accessibilityLiveRegion="assertive"
    >
      <Text className="text-center text-title font-black text-content">
        {title}
      </Text>
      <Text className="mt-3 text-center text-body font-semibold text-content-secondary">
        {message}
      </Text>

      {onRetry ? (
        <Pressable
          className="mt-6 flex-row items-center justify-center rounded-full border border-content-muted/40 bg-surface-muted px-6 py-3"
          onPress={() => {
            speak("Tentar novamente");
            onRetry();
          }}
          disabled={retrying}
          accessibilityRole="button"
          accessibilityLabel="Tentar novamente"
          accessibilityHint="Tenta carregar o conteúdo desta tela novamente"
          accessibilityState={{ disabled: Boolean(retrying), busy: Boolean(retrying) }}
        >
          {retrying ? (
            <ActivityIndicator color="#FFFFFF" size="small" />
          ) : (
            <Text className="text-body font-black text-content">
              Tentar novamente
            </Text>
          )}
        </Pressable>
      ) : null}
    </View>
  );
}
