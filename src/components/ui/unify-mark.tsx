import { Image } from "react-native";

type UnifyMarkProps = {
  size?: "large" | "small";
};

// Mesmo recorte do icone do app (assets/icon.png), com cantos arredondados.
const MARK = require("../../../assets/unify-mark.png");

const SIZES = {
  large: 72,
  small: 40,
} as const;

/**
 * Marca oficial da Unify. Decorativa: as telas que a usam ja trazem o nome
 * "Unify" em texto logo abaixo, entao o leitor de tela nao precisa dela.
 */
export function UnifyMark({ size = "large" }: UnifyMarkProps) {
  const side = SIZES[size];

  return (
    <Image
      source={MARK}
      style={{ width: side, height: side, borderRadius: side * 0.22 }}
      resizeMode="contain"
      accessible={false}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    />
  );
}
