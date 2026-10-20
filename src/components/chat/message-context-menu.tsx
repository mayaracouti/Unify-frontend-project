import Ionicons from "@expo/vector-icons/Ionicons";
import { useEffect, useRef, useState } from "react";
import {
  AccessibilityInfo,
  Animated,
  Easing,
  findNodeHandle,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useGlobalAccessibilityState } from "../../accessibility/global-text-adjustments";

/** Retangulo do balao na tela (coordenadas de pagina, vindas de `measure`). */
export type BubbleAnchor = { x: number; y: number; width: number; height: number };

export type MessageContextMenuOption = {
  key: string;
  label: string;
  hint?: string;
  icon: keyof typeof Ionicons.glyphMap;
  destructive?: boolean;
  onPress: () => void;
};

const SCREEN_MARGIN = 12;
const MENU_GAP = 6;
const TAIL_SIZE = 12;
const MENU_MAX_WIDTH = 248;
/** Mesmo raio do balao (`rounded-[20px]`): o recorte do fundo acompanha o formato dele. */
const BUBBLE_RADIUS = 20;
const BACKDROP_COLOR = "rgba(0,0,0,0.62)";

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), Math.max(min, max));
}

function focusNode(node: View | null) {
  if (!node) return;
  try {
    if (Platform.OS === "web") {
      (node as unknown as HTMLElement).focus?.();
    } else {
      const handle = findNodeHandle(node);
      if (handle) AccessibilityInfo.setAccessibilityFocus(handle);
    }
  } catch {
    // O alvo pode ter sido desmontado.
  }
}

/**
 * Menu de contexto do toque longo em uma mensagem: um balao que NASCE da
 * mensagem (popover ancorado nela, com "rabinho" apontando para ela), em vez
 * de uma folha vinda do rodape.
 *
 *  - o fundo escurece tudo MENOS a mensagem (recorte arredondado), que ganha
 *    um contorno de destaque;
 *  - o menu abre abaixo da mensagem quando cabe, senao acima, alinhado ao
 *    lado dela (direita para as minhas, esquerda para as recebidas);
 *  - cresce a partir do canto mais proximo da mensagem (sem animacao com
 *    "reduzir movimento").
 *
 * Fecha ao tocar fora, ao escolher uma opcao ou com o voltar do Android. O
 * foco do leitor de tela vai para a primeira opcao.
 */
export function MessageContextMenu({
  align,
  anchor,
  onClose,
  options,
  title,
}: {
  /** "end" = mensagem minha (lado direito). */
  align: "start" | "end";
  /** Nulo = fechado. */
  anchor: BubbleAnchor | null;
  onClose: () => void;
  options: MessageContextMenuOption[];
  /** Rotulo do grupo para o leitor de tela (ex.: "Opções da mensagem"). */
  title: string;
}) {
  const { width: screenWidth, height: screenHeight } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const { highContrast, reduceMotion } = useGlobalAccessibilityState();
  const [menuSize, setMenuSize] = useState<{ width: number; height: number } | null>(null);
  const appear = useRef(new Animated.Value(0)).current;
  const firstOptionRef = useRef<View | null>(null);
  const visible = Boolean(anchor) && options.length > 0;

  // Cada abertura mede o menu de novo (fonte/opcoes podem ter mudado).
  useEffect(() => {
    if (!visible) {
      setMenuSize(null);
      appear.setValue(0);
    }
  }, [appear, visible]);

  useEffect(() => {
    if (!visible || !menuSize) {
      return;
    }
    if (reduceMotion) {
      appear.setValue(1);
    } else {
      Animated.timing(appear, {
        toValue: 1,
        duration: 170,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: Platform.OS !== "web",
      }).start();
    }
    const timer = setTimeout(() => focusNode(firstOptionRef.current), 60);
    return () => clearTimeout(timer);
  }, [appear, menuSize, reduceMotion, visible]);

  if (!anchor || options.length === 0) {
    return null;
  }

  const menuWidth = Math.min(MENU_MAX_WIDTH, screenWidth - SCREEN_MARGIN * 2);
  const menuHeight = menuSize?.height ?? 0;

  const safeTop = insets.top + SCREEN_MARGIN;
  const safeBottom = screenHeight - insets.bottom - SCREEN_MARGIN;
  const anchorBottom = anchor.y + anchor.height;
  const needed = menuHeight + MENU_GAP + TAIL_SIZE / 2;
  const spaceBelow = safeBottom - anchorBottom;
  const spaceAbove = anchor.y - safeTop;
  const placeBelow = spaceBelow >= needed || spaceBelow >= spaceAbove;

  const menuTop = clamp(
    placeBelow ? anchorBottom + MENU_GAP + TAIL_SIZE / 2 : anchor.y - needed,
    safeTop,
    safeBottom - menuHeight
  );
  const menuLeft = clamp(
    align === "end" ? anchor.x + anchor.width - menuWidth : anchor.x,
    SCREEN_MARGIN,
    screenWidth - SCREEN_MARGIN - menuWidth
  );

  // Mensagem enorme (mais alta que a tela): o menu fica por cima dela e o
  // rabinho some, porque nao ha borda da mensagem para apontar.
  const detached = placeBelow
    ? menuTop >= anchorBottom + MENU_GAP
    : menuTop + menuHeight <= anchor.y - MENU_GAP;
  const tailCenter = clamp(
    align === "end" ? anchor.x + anchor.width - 28 : anchor.x + 28,
    menuLeft + 22,
    menuLeft + menuWidth - 22
  );

  // Recorte arredondado no fundo: uma borda gigante em volta do retangulo da
  // mensagem escurece o resto da tela e deixa a mensagem visivel.
  const cutoutBorder = Math.max(screenWidth, screenHeight) * 2;

  const surfaceClass = highContrast
    ? "border-2 border-hc-border bg-hc-surface"
    : "border border-[#3A3545] bg-[#1D1F24]";
  const surfaceColor = highContrast ? "#101010" : "#1D1F24";
  const accent = highContrast ? "#FFD400" : "#9B7BFF";

  const scale = appear.interpolate({ inputRange: [0, 1], outputRange: [0.7, 1] });

  return (
    <Modal
      animationType="none"
      onRequestClose={onClose}
      statusBarTranslucent
      transparent
      visible
    >
      <Pressable
        accessible
        accessibilityRole="button"
        accessibilityLabel="Fechar opções"
        accessibilityHint="Fecha o menu sem escolher"
        onPress={onClose}
        style={StyleSheet.absoluteFill}
      />

      <View
        importantForAccessibility="no-hide-descendants"
        pointerEvents="none"
        style={{
          position: "absolute",
          left: anchor.x - cutoutBorder,
          top: anchor.y - cutoutBorder,
          width: anchor.width + cutoutBorder * 2,
          height: anchor.height + cutoutBorder * 2,
          borderWidth: cutoutBorder,
          borderRadius: cutoutBorder + BUBBLE_RADIUS,
          borderColor: BACKDROP_COLOR,
        }}
      />
      <View
        importantForAccessibility="no-hide-descendants"
        pointerEvents="none"
        style={{
          position: "absolute",
          left: anchor.x - 2,
          top: anchor.y - 2,
          width: anchor.width + 4,
          height: anchor.height + 4,
          borderRadius: BUBBLE_RADIUS + 2,
          borderWidth: 2,
          borderColor: accent,
        }}
      />

      <Animated.View
        accessibilityViewIsModal
        accessibilityLabel={title}
        onLayout={(event) => {
          const { width, height } = event.nativeEvent.layout;
          if (!menuSize || menuSize.height !== height || menuSize.width !== width) {
            setMenuSize({ width, height });
          }
        }}
        style={{
          position: "absolute",
          left: menuLeft,
          top: menuTop,
          width: menuWidth,
          // Primeira passada so mede (invisivel); a segunda ja nasce no lugar.
          opacity: menuSize ? appear : 0,
          transform: [{ scale: menuSize ? scale : 1 }],
          transformOrigin: `${align === "end" ? "right" : "left"} ${placeBelow ? "top" : "bottom"}`,
        }}
      >
        {detached ? null : (
          <View
            pointerEvents="none"
            className={surfaceClass}
            style={{
              position: "absolute",
              left: tailCenter - menuLeft - TAIL_SIZE / 2,
              width: TAIL_SIZE,
              height: TAIL_SIZE,
              transform: [{ rotate: "45deg" }],
              backgroundColor: surfaceColor,
              ...(placeBelow ? { top: -TAIL_SIZE / 2 } : { bottom: -TAIL_SIZE / 2 }),
            }}
          />
        )}

        <View className={`overflow-hidden rounded-[18px] py-1 ${surfaceClass}`}>
          {options.map((option, index) => (
            <Pressable
              accessible
              accessibilityRole="button"
              accessibilityLabel={option.label}
              accessibilityHint={option.hint}
              className={`min-h-[48px] flex-row items-center gap-3 px-4 py-3 ${
                index > 0 ? (highContrast ? "border-t border-hc-border" : "border-t border-[#2C2A33]") : ""
              }`}
              key={option.key}
              onPress={option.onPress}
              ref={index === 0 ? firstOptionRef : undefined}
              style={({ pressed }) =>
                pressed ? { backgroundColor: highContrast ? "#000000" : "#2A2B31" } : undefined
              }
            >
              <Ionicons
                name={option.icon}
                size={20}
                color={option.destructive ? "#FF6B6B" : highContrast ? "#FFD400" : "#CDBDFF"}
                importantForAccessibility="no"
              />
              <Text
                className={`flex-1 text-[16px] font-semibold ${
                  option.destructive ? "text-[#FF6B6B]" : highContrast ? "text-hc-text" : "text-white"
                }`}
              >
                {option.label}
              </Text>
            </Pressable>
          ))}
        </View>
      </Animated.View>
    </Modal>
  );
}
