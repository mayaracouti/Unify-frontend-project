import { useRef, useState } from "react";
import { ActivityIndicator, Pressable, View } from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";
import { useTTS } from "../../../accessibility/tts";
import { ActionSheet, type ActionSheetOption } from "../../ui/action-sheet";

/** Permissions belong to the caller: only authorized callbacks are supplied. */
export function CommunityPostMenu({ authorName, deleting, onEdit, onDelete, onReport }: {
  authorName: string; deleting: boolean; onEdit?: () => void; onDelete?: () => void; onReport?: () => void;
}) {
  const [visible, setVisible] = useState(false);
  const buttonRef = useRef<View | null>(null);
  const { speak } = useTTS();
  const options: ActionSheetOption[] = [];
  if (onEdit) options.push({ key: "edit", label: "Editar publicação", hint: "Altera texto, imagem e descrição", icon: "pencil-outline", onPress: onEdit });
  if (onDelete) options.push({ key: "delete", label: "Excluir publicação", hint: "Pede confirmação antes de remover a publicação", icon: "trash-outline", destructive: true, onPress: onDelete });
  if (onReport) options.push({ key: "report", label: "Denunciar publicação", hint: "Abre o formulário de denúncia desta publicação", icon: "flag-outline", onPress: onReport });
  if (!options.length) return null;
  return <>
    <Pressable ref={buttonRef} className="h-9 w-9 items-center justify-center rounded-full"
      hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }} disabled={deleting}
      accessibilityRole="button" accessibilityLabel="Mais opções da publicação"
      accessibilityHint="Abre as ações disponíveis para esta publicação"
      accessibilityState={{ busy: deleting, disabled: deleting }}
      onPress={() => { speak("Mais opções da publicação"); setVisible(true); }}>
      {deleting ? <ActivityIndicator color="#CAC3D8" size="small" /> : <Ionicons name="ellipsis-horizontal" size={20} color="#CAC3D8" />}
    </Pressable>
    <ActionSheet title={`Publicação de ${authorName}`} visible={visible} returnFocusRef={buttonRef}
      onClose={() => setVisible(false)} options={options.map((option) => ({ ...option, onPress: () => {
        setVisible(false); if (option.key === "edit") speak("Editar publicação"); option.onPress();
      } }))} />
  </>;
}
