import { ActivityIndicator, Pressable, Text } from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";
import type { ComponentProps } from "react";
export function PostAction({
  accessibilityHint,
  accessibilityLabel,
  disabled,
  icon,
  count,
  active,
  loading,
  onPress,
}: {
  accessibilityHint?: string;
  accessibilityLabel: string;
  disabled?: boolean;
  icon: ComponentProps<typeof Ionicons>["name"];
  count?: number | null;
  active?: boolean | null;
  loading?: boolean;
  onPress: () => void;
}) {
  const busy = Boolean(loading);

  return (
    <Pressable
      className={`h-14 flex-1 flex-row items-center justify-center gap-2 rounded-lg ${
        disabled ? "opacity-60" : ""
      }`}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      accessibilityHint={accessibilityHint}
      accessibilityState={{
        busy,
        disabled: Boolean(disabled) || busy,
        selected: Boolean(active),
      }}
      onPress={onPress}
      disabled={disabled || loading}
    >
      {loading ? (
        <ActivityIndicator color="#7C4DFF" size="small" />
      ) : (
        <Ionicons
          name={icon}
          size={26}
          color={active ? "#7C4DFF" : "#CAC3D8"}
        />
      )}
      {typeof count === "number" ? (
        <Text
          className={`text-[16px] font-bold ${
            active ? "text-[#7C4DFF]" : "text-[#E5E2E1]"
          }`}
        >
          {count}
        </Text>
      ) : null}
    </Pressable>
  );
}

