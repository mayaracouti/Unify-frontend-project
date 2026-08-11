import type { ReactNode } from "react";
import { Pressable, Text, View } from "react-native";

export type ScreenEmptyAction = {
  label: string;
  onPress: () => void;
  /** Instrucao adicional lida pelo leitor de tela ao focar a acao. */
  accessibilityHint?: string;
};

export type ScreenEmptyProps = {
  title: string;
  description: string;
  action?: ScreenEmptyAction;
  /** Icone/ilustracao opcional acima do titulo. Nao participa do anuncio de a11y. */
  icon?: ReactNode;
  className?: string;
};

/**
 * Estado vazio padronizado (ver plano-implementacao
 * 00-DIAGNOSTICO-E-FUNDACAO.md §4.1). Titulo e descricao formam um unico
 * bloco com `accessibilityRole="text"`, para que o leitor de tela anuncie
 * as duas frases juntas em vez de exigir duas paradas de foco.
 */
export function ScreenEmpty({
  title,
  description,
  action,
  icon,
  className,
}: ScreenEmptyProps) {
  return (
    <View
      className={
        className ?? "items-center rounded-[28px] bg-surface-alt px-6 py-10"
      }
    >
      {icon}

      <View
        accessible
        accessibilityRole="text"
        accessibilityLabel={`${title}. ${description}`}
      >
        <Text className="text-center text-title font-black text-content">
          {title}
        </Text>
        <Text className="mt-3 text-center text-body font-semibold text-content-secondary">
          {description}
        </Text>
      </View>

      {action ? (
        <Pressable
          className="mt-6 rounded-full bg-accent px-6 py-3"
          onPress={action.onPress}
          accessibilityRole="button"
          accessibilityLabel={action.label}
          accessibilityHint={action.accessibilityHint}
        >
          <Text className="text-body font-black text-[#1D1D00]">
            {action.label}
          </Text>
        </Pressable>
      ) : null}
    </View>
  );
}
