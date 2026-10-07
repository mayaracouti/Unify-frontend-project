import { useEffect, useRef, type RefObject } from "react";
import { useGlobalAccessibilityState } from "../../accessibility/global-text-adjustments";
import Ionicons from "@expo/vector-icons/Ionicons";
import { AccessibilityInfo, findNodeHandle, Platform, Modal, Pressable, ScrollView, StyleSheet, Text, View, useWindowDimensions } from "react-native";

function focusNode(node: View | Text | null) {
  if (!node) return;
  try {
    if (Platform.OS === "web") {
      (node as unknown as HTMLElement).focus?.();
    } else {
      const handle = findNodeHandle(node);
      if (handle) AccessibilityInfo.setAccessibilityFocus(handle);
    }
  } catch {
    // O alvo pode ter sido desmontado depois de uma ação do menu.
  }
}

export type ActionSheetOption = {
  key: string;
  label: string;
  /** Explica a consequencia para o leitor de tela. */
  hint?: string;
  icon?: keyof typeof Ionicons.glyphMap;
  destructive?: boolean;
  /** Texto de apoio visivel abaixo do rotulo (ex.: o que cada modo significa). */
  description?: string;
  /** Opcao atual de uma escolha: marcada visualmente e anunciada como selecionada. */
  selected?: boolean;
  onPress: () => void;
};

/**
 * Folha de opcoes acessivel usada no chat (origem da imagem, acoes da mensagem,
 * confirmacao de exclusao). Substitui `Alert.alert`, que nao existe na web.
 *
 * Fecha ao tocar no fundo, no botao "Cancelar" ou com o botao voltar do Android.
 */
export function ActionSheet({
  cancelLabel = "Cancelar",
  message,
  onClose,
  options,
  title,
  visible,
  returnFocusRef,
}: {
  cancelLabel?: string;
  message?: string;
  onClose: () => void;
  options: ActionSheetOption[];
  title: string;
  visible: boolean;
  returnFocusRef?: RefObject<View | null>;
}) {
  // Com fonte grande, muitas opcoes nao cabem: a lista rola e "Cancelar" fica fixo.
  const { height: windowHeight } = useWindowDimensions();
  const { highContrast, reduceMotion } = useGlobalAccessibilityState();
  const titleRef = useRef<Text | null>(null);
  const wasVisible = useRef(false);
  const webPreviousFocus = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (visible) {
      wasVisible.current = true;
      if (Platform.OS === "web" && typeof document !== "undefined") {
        webPreviousFocus.current = document.activeElement as HTMLElement | null;
      }
      return;
    }
    if (!wasVisible.current) return;
    wasVisible.current = false;
    const timer = setTimeout(() => {
      if (returnFocusRef?.current) focusNode(returnFocusRef.current);
      else webPreviousFocus.current?.focus?.();
    }, 150);
    return () => clearTimeout(timer);
  }, [visible, returnFocusRef]);

  return (
    <Modal
      animationType={reduceMotion ? "none" : "fade"}
      onShow={() => focusNode(titleRef.current)}
      onRequestClose={onClose}
      statusBarTranslucent
      transparent
      visible={visible}
    >
      <View className="flex-1 justify-end">
        {/* Irmao do painel, nao pai: evita touchable aninhado nas opcoes. */}
        <Pressable
          accessible
          accessibilityRole="button"
          accessibilityLabel="Fechar opções"
          accessibilityHint="Toca fora do painel para fechar sem escolher"
          onPress={onClose}
          style={[StyleSheet.absoluteFill, { backgroundColor: "rgba(0,0,0,0.6)" }]}
        />

        <View
          accessibilityViewIsModal
          className={`rounded-t-[28px] border-t px-4 pb-8 pt-4 ${highContrast ? "border-hc-border bg-hc-surface" : "border-[#353534] bg-[#17181C]"}`}
        >
          <Text
            ref={titleRef}
            accessible
            accessibilityRole="header"
            className={`mb-1 px-2 text-[18px] font-black ${highContrast ? "text-hc-text" : "text-white"}`}
          >
            {title}
          </Text>

          {message ? (
            <Text className="mb-3 px-2 text-[14px] text-[#CAC3D8]">{message}</Text>
          ) : (
            <View className="mb-2" />
          )}

          <ScrollView bounces={false} style={{ maxHeight: windowHeight * 0.6 }}>
            {options.map((option) => (
              <Pressable
                accessible
                accessibilityRole="button"
                accessibilityLabel={option.label}
                accessibilityHint={option.hint ?? option.description}
                accessibilityState={
                  option.selected !== undefined ? { selected: option.selected } : undefined
                }
                className={`mb-2 min-h-[44px] flex-row items-center gap-3 rounded-[16px] px-4 py-4 ${
                  highContrast
                    ? option.selected ? "border-2 border-hc-accent bg-hc-bg" : "border border-hc-border bg-hc-bg"
                    : option.selected ? "border-2 border-[#EAEA00] bg-[#2A2B1A]" : "bg-[#1D1F24]"
                }`}
                key={option.key}
                onPress={option.onPress}
              >
                {option.icon ? (
                  <Ionicons
                    name={option.icon}
                    size={22}
                    color={option.destructive ? "#FF6B6B" : "#EAEA00"}
                    importantForAccessibility="no"
                  />
                ) : null}
                <View className="flex-1">
                  <Text
                    className={`text-[16px] font-bold ${
                      option.destructive ? "text-[#FF6B6B]" : "text-white"
                    }`}
                  >
                    {option.label}
                  </Text>
                  {option.description ? (
                    <Text className="mt-1 text-[14px] text-[#CAC3D8]">{option.description}</Text>
                  ) : null}
                </View>
                {option.selected ? (
                  <Ionicons
                    name="checkmark-circle"
                    size={22}
                    color="#EAEA00"
                    importantForAccessibility="no"
                  />
                ) : null}
              </Pressable>
            ))}
          </ScrollView>

          <Pressable
            accessible
            accessibilityRole="button"
            accessibilityLabel={cancelLabel}
            accessibilityHint="Fecha o painel sem escolher uma opção"
            className="mt-1 items-center rounded-[16px] border border-[#353534] px-4 py-4"
            onPress={onClose}
          >
            <Text className="text-[16px] font-bold text-[#CAC3D8]">{cancelLabel}</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}
