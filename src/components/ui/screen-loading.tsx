import { ActivityIndicator, Text, View, type ViewProps } from "react-native";

export type ScreenLoadingProps = {
  /** Texto anunciado pelo leitor de tela e exibido abaixo do indicador. */
  label?: string;
  /** Classe do container. Por padrao preenche o espaço disponivel e centraliza o conteudo. */
  className?: string;
} & Pick<ViewProps, "testID">;

const DEFAULT_LABEL = "Carregando";

/**
 * Estado de carregamento padronizado (ver plano-implementacao
 * 00-DIAGNOSTICO-E-FUNDACAO.md §4.1). Substitui os `ActivityIndicator`
 * soltos espalhados pelas telas, ja com semantica de acessibilidade:
 * `accessibilityRole="progressbar"` + `accessibilityLiveRegion="polite"`
 * garantem que o TalkBack/VoiceOver anunciem o carregamento e suas
 * mudancas sem exigir foco manual do usuario.
 */
export function ScreenLoading({
  label = DEFAULT_LABEL,
  className,
  testID,
}: ScreenLoadingProps) {
  return (
    <View
      className={className ?? "flex-1 items-center justify-center px-8 py-16"}
      accessibilityRole="progressbar"
      accessibilityLabel={label}
      accessibilityLiveRegion="polite"
      testID={testID}
    >
      <ActivityIndicator color="#F2F500" size="large" />
      <Text className="mt-4 text-center text-body font-semibold text-content-secondary">
        {label}
      </Text>
    </View>
  );
}
