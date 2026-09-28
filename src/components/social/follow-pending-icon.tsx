import Ionicons from "@expo/vector-icons/Ionicons";
import { View } from "react-native";

/** Amarelo do app: "aguardando aceite". */
export const FOLLOW_PENDING_COLOR = "#F1EF00";

/**
 * Ícone único de "pedido para seguir pendente de aceite" (conta privada):
 * pessoa com um relógio no canto, em amarelo. Usado em TODO botão/estado de
 * pedido pendente para a pessoa reconhecer o mesmo símbolo no app inteiro.
 * Decorativo: o estado vai no accessibilityLabel do botão que o contém.
 */
export function FollowPendingIcon({
  size = 18,
  color = FOLLOW_PENDING_COLOR,
  badgeBackground = "#1F2023",
}: {
  size?: number;
  color?: string;
  /** Cor de fundo atrás do relógio (a do botão), para o recorte ficar limpo. */
  badgeBackground?: string;
}) {
  const badgeSize = Math.max(9, Math.round(size * 0.55));

  return (
    <View
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={{ width: size, height: size }}
    >
      <Ionicons name="person" size={size} color={color} />
      <View
        style={{
          position: "absolute",
          right: -badgeSize * 0.3,
          bottom: -badgeSize * 0.2,
          width: badgeSize,
          height: badgeSize,
          borderRadius: badgeSize / 2,
          backgroundColor: badgeBackground,
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <Ionicons name="time" size={badgeSize} color={color} />
      </View>
    </View>
  );
}
