import { Alert, Platform } from "react-native";

export function confirmCommunityAction(title: string, message: string, label: string, onConfirm: () => void) {
  if (Platform.OS === "web") {
    if (typeof window !== "undefined" && window.confirm(`${title}\n\n${message}`)) onConfirm();
    return;
  }
  Alert.alert(title, message, [
    { text: "Cancelar", style: "cancel" },
    { text: label, style: "destructive", onPress: onConfirm },
  ]);
}
