import Ionicons from "@expo/vector-icons/Ionicons";
import { useEffect, useRef, type ReactNode } from "react";
import {
  Animated,
  PanResponder,
  Platform,
  type StyleProp,
  Vibration,
  View,
  type ViewStyle,
} from "react-native";

import { getGlobalTextAdjustments } from "../../accessibility/global-text-adjustments";

/** Distancia (dp) que dispara a resposta ao soltar. */
const SWIPE_TRIGGER = 64;
/** O balao para de acompanhar o dedo aqui (com resistencia depois do gatilho). */
const SWIPE_MAX = 96;
const SWIPE_RESISTANCE = 0.35;
/** Movimento minimo e predominancia horizontal: rolagem vertical da lista nao vira resposta. */
const SWIPE_SLOP = 10;
const HORIZONTAL_DOMINANCE = 1.6;

/**
 * Puxar o balao para o CENTRO da conversa responde a mensagem (estilo
 * WhatsApp): mensagem recebida (a esquerda) puxa para a direita, mensagem
 * minha (a direita) puxa para a esquerda. Um icone de responder aparece no
 * espaco revelado e, ao passar do gatilho, o celular vibra de leve.
 *
 * PanResponder + Animated do proprio RN (sem gesture-handler/reanimated: nao
 * exige novo build nativo). O gesto e invisivel para o leitor de tela — a
 * mesma acao fica no menu de contexto e nas acoes de acessibilidade do balao.
 */
export function SwipeToReply({
  children,
  direction,
  enabled,
  onReply,
  style,
}: {
  children: ReactNode;
  /** Sentido do puxao: "right" para mensagens recebidas, "left" para as minhas. */
  direction: "left" | "right";
  enabled: boolean;
  onReply: () => void;
  /** Estilo da linha inteira (ex.: destaque ao pular para a mensagem). */
  style?: StyleProp<ViewStyle>;
}) {
  const translateX = useRef(new Animated.Value(0)).current;
  const sign = direction === "right" ? 1 : -1;

  // O PanResponder e criado uma vez: props mudam por ref, sem recriar handlers.
  const latest = useRef({ enabled, onReply, sign });
  useEffect(() => {
    latest.current = { enabled, onReply, sign };
  }, [enabled, onReply, sign]);

  const triggeredRef = useRef(false);

  const panResponder = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_event, gesture) =>
        latest.current.enabled &&
        gesture.dx * latest.current.sign > SWIPE_SLOP &&
        Math.abs(gesture.dx) > Math.abs(gesture.dy) * HORIZONTAL_DOMINANCE,
      onPanResponderGrant: () => {
        triggeredRef.current = false;
      },
      onPanResponderMove: (_event, gesture) => {
        const pulled = Math.max(0, gesture.dx * latest.current.sign);
        const resisted =
          pulled <= SWIPE_TRIGGER
            ? pulled
            : Math.min(SWIPE_MAX, SWIPE_TRIGGER + (pulled - SWIPE_TRIGGER) * SWIPE_RESISTANCE);

        translateX.setValue(resisted * latest.current.sign);

        const reached = pulled >= SWIPE_TRIGGER;
        if (reached && !triggeredRef.current) {
          triggeredRef.current = true;
          // So Android: no iOS `Vibration` dura ~400 ms (forte demais para um toque).
          if (Platform.OS === "android") {
            Vibration.vibrate(12);
          }
        } else if (!reached) {
          triggeredRef.current = false;
        }
      },
      onPanResponderRelease: () => {
        if (triggeredRef.current) {
          latest.current.onReply();
        }
        triggeredRef.current = false;
        settle();
      },
      onPanResponderTerminate: () => {
        triggeredRef.current = false;
        settle();
      },
      // Depois que o puxao horizontal comecou, a lista nao toma o gesto de volta.
      onPanResponderTerminationRequest: () => false,
      onShouldBlockNativeResponder: () => true,
    })
  ).current;

  function settle() {
    if (getGlobalTextAdjustments().reduceMotion) {
      translateX.setValue(0);
      return;
    }
    Animated.spring(translateX, {
      toValue: 0,
      bounciness: 6,
      speed: 18,
      useNativeDriver: Platform.OS !== "web",
    }).start();
  }

  const progressRange = sign > 0 ? [0, SWIPE_TRIGGER] : [-SWIPE_TRIGGER, 0];
  const iconOpacity = translateX.interpolate({
    inputRange: progressRange,
    outputRange: sign > 0 ? [0, 1] : [1, 0],
    extrapolate: "clamp",
  });
  const iconScale = translateX.interpolate({
    inputRange: progressRange,
    outputRange: sign > 0 ? [0.4, 1] : [1, 0.4],
    extrapolate: "clamp",
  });

  return (
    <View style={style}>
      {/* Icone decorativo no espaco que o balao revela ao ser puxado. */}
      <Animated.View
        importantForAccessibility="no-hide-descendants"
        pointerEvents="none"
        style={{
          position: "absolute",
          top: 0,
          bottom: 12,
          justifyContent: "center",
          [sign > 0 ? "left" : "right"]: 4,
          opacity: iconOpacity,
          transform: [{ scale: iconScale }],
        }}
      >
        <View className="h-9 w-9 items-center justify-center rounded-full bg-[#2D2A33]">
          <Ionicons name="arrow-undo" size={18} color="#CDBDFF" />
        </View>
      </Animated.View>

      <Animated.View {...panResponder.panHandlers} style={{ transform: [{ translateX }] }}>
        {children}
      </Animated.View>
    </View>
  );
}
