import { View } from "react-native";

type UnifyMarkProps = {
  size?: "large" | "small";
};

const VARIANTS = {
  large: {
    container: 64,
    bubble: 28,
    center: 14,
    positions: [
      { x: -10, y: -10, color: "#312E81" },
      { x: 10, y: -10, color: "#38BDF8" },
      { x: -4, y: 18, color: "#D946EF" },
      { x: -20, y: 0, color: "#4338CA" },
      { x: 20, y: 0, color: "#22D3EE" },
    ],
  },
  small: {
    container: 40,
    bubble: 16,
    center: 8,
    positions: [
      { x: -6, y: -6, color: "#312E81" },
      { x: 6, y: -6, color: "#38BDF8" },
      { x: -2, y: 10, color: "#D946EF" },
      { x: -12, y: 0, color: "#4338CA" },
      { x: 12, y: 0, color: "#22D3EE" },
    ],
  },
} as const;

export function UnifyMark({ size = "large" }: UnifyMarkProps) {
  const variant = VARIANTS[size];

  return (
    <View
      style={{
        position: "relative",
        width: variant.container,
        height: variant.container,
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      {variant.positions.map((bubble, index) => (
        <View
          key={index}
          style={{
            position: "absolute",
            width: variant.bubble,
            height: variant.bubble,
            borderRadius: 999,
            backgroundColor: bubble.color,
            transform: [{ translateX: bubble.x }, { translateY: bubble.y }],
          }}
        />
      ))}

      <View
        style={{
          width: variant.center,
          height: variant.center,
          borderRadius: 999,
          backgroundColor: "rgba(255,255,255,0.9)",
        }}
      />
    </View>
  );
}