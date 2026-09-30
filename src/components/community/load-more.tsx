import { ActivityIndicator, Pressable, Text, View } from "react-native";

export function CommunityLoadMore({ visible, busy, onPress, label = "Carregar mais" }: {
  visible: boolean; busy: boolean; onPress: () => void; label?: string;
}) {
  if (!visible) return null;
  return (
    <View className="px-6 py-5">
      <Pressable className="items-center rounded-2xl border border-[#494455] bg-[#1A1C1F] px-5 py-4"
        accessibilityRole="button" accessibilityLabel={label}
        accessibilityHint="Carrega a próxima página da lista"
        accessibilityState={{ busy, disabled: busy }} disabled={busy} onPress={onPress}>
        {busy ? <ActivityIndicator color="#CDBDFF" /> : <Text className="font-bold text-white">{label}</Text>}
      </Pressable>
    </View>
  );
}
