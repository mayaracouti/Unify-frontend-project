import type { AccessibilityActionEvent, AccessibilityActionInfo } from "react-native";

import { describeAudioMessage } from "../../utils/chatFormatting";
import { AuthenticatedAudioPlayer } from "../media/authenticated-audio-player";

/**
 * Mensagem de audio do chat: wrapper fino sobre `AuthenticatedAudioPlayer`
 * (download autenticado + cache + play/pausa acessivel), mantendo o rotulo
 * "Reproduzir/Pausar mensagem de áudio de N segundos" seguido do rotulo da
 * mensagem, as acoes de acessibilidade e o toque longo para apagar.
 */
export function AudioMessagePlayer({
  accessibilityActions,
  authToken,
  durationSeconds,
  messageId,
  messageLabel,
  mine,
  onAccessibilityAction,
  onLongPress,
  uri,
}: {
  /** Acoes extras (editar/apagar) expostas no botao de play, o unico elemento focavel do balao. */
  accessibilityActions?: AccessibilityActionInfo[];
  authToken: string | null;
  durationSeconds: number | null;
  messageId: string;
  /** Rotulo completo da mensagem (autor, horario, status) lido junto com o controle. */
  messageLabel?: string;
  mine: boolean;
  onAccessibilityAction?: (event: AccessibilityActionEvent) => void;
  onLongPress?: () => void;
  uri: string;
}) {
  return (
    <AuthenticatedAudioPlayer
      accessibilityActions={accessibilityActions}
      accessibilityHint={onLongPress ? "Toque e segure para apagar" : undefined}
      accessibilityLabel={({ playing, knownDurationSeconds }) => {
        const spokenAudio = describeAudioMessage(knownDurationSeconds);
        const controlLabel = playing ? `Pausar ${spokenAudio}` : `Reproduzir ${spokenAudio}`;

        return messageLabel ? `${controlLabel}. ${messageLabel}` : controlLabel;
      }}
      authToken={authToken}
      cacheKey={`chat-${messageId}`}
      durationSeconds={durationSeconds}
      mine={mine}
      onAccessibilityAction={onAccessibilityAction}
      onLongPress={onLongPress}
      uri={uri}
      variant="chat"
    />
  );
}
