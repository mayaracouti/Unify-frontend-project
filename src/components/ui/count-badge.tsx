import { Text, View } from "react-native";

import { formatBadgeCount } from "../../utils/countBadge";

type CountBadgeProps = {
  count: number | null | undefined;
  highContrast?: boolean;
  /** `sm` para cantos de icones pequenos (menu); `md` para botoes de 56dp. */
  size?: "sm" | "md";
  /** Posicionamento (ex.: `absolute -right-1 -top-1`). */
  className?: string;
};

/**
 * Badge numerico decorativo ("3", "99+"); some com 0. Fica escondido do leitor
 * de tela: quem usa o badge poe a contagem no rotulo acessivel do botao.
 */
export function CountBadge({ count, highContrast = false, size = "md", className = "" }: CountBadgeProps) {
  const text = formatBadgeCount(count);

  if (!text) {
    return null;
  }

  return (
    <View
      accessible={false}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      aria-hidden
      pointerEvents="none"
      className={`items-center justify-center rounded-full border-2 border-[#151515] ${
        size === "sm" ? "min-w-[20px] px-1 py-px" : "min-w-[24px] px-1.5 py-0.5"
      } ${highContrast ? "bg-hc-accent" : "bg-[#F1EF00]"} ${className}`}
    >
      <Text
        className={`font-black text-[#1D1D00] ${size === "sm" ? "text-[10px]" : "text-[12px]"}`}
      >
        {text}
      </Text>
    </View>
  );
}
