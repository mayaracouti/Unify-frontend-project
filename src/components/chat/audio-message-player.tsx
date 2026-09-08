import Ionicons from "@expo/vector-icons/Ionicons";
import { useAudioPlayer, useAudioPlayerStatus } from "expo-audio";
import { File, Paths } from "expo-file-system";
import { useCallback, useEffect, useState } from "react";
import {
  type AccessibilityActionEvent,
  type AccessibilityActionInfo,
  ActivityIndicator,
  Pressable,
  Text,
  View,
} from "react-native";

import {
  accessibilityAnnouncements,
  announceForAccessibility,
} from "../../utils/accessibilityAnnouncements";
import { describeAudioMessage, formatAudioClock } from "../../utils/chatFormatting";

const audioFileCache = new Map<string, string>();

/**
 * Baixa o audio protegido por JWT e devolve o caminho de um arquivo local.
 * Cacheado em memoria por messageId — o endpoint responde com Cache-Control
 * imutavel, entao o arquivo nunca precisa ser rebaixado dentro da mesma sessao.
 *
 * O `useAudioPlayer` aceita fonte com headers, mas o suporte varia por
 * plataforma; baixar primeiro e o caminho previsivel em Android, iOS e web.
 */
async function resolveLocalAudioUri(
  messageId: string,
  remoteUri: string,
  authToken: string | null
): Promise<string> {
  const cached = audioFileCache.get(messageId);
  if (cached) {
    return cached;
  }

  const response = await fetch(
    remoteUri,
    authToken ? { headers: { Authorization: `Bearer ${authToken}` } } : undefined
  );

  if (!response.ok) {
    throw new Error(`Falha ao baixar o áudio (${response.status})`);
  }

  const buffer = await response.arrayBuffer();
  const file = new File(Paths.cache, `unify-chat-audio-${messageId}.m4a`);

  if (file.exists) {
    file.delete();
  }

  file.create();
  file.write(new Uint8Array(buffer));

  audioFileCache.set(messageId, file.uri);
  return file.uri;
}

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
  const [localUri, setLocalUri] = useState<string | null>(null);
  const [preparing, setPreparing] = useState(false);
  const [failed, setFailed] = useState(false);
  const [playRequested, setPlayRequested] = useState(false);

  // `useAudioPlayer` recria o player nativo quando a fonte muda (a instancia e
  // chaveada pelo source) e libera a anterior sozinho ao desmontar. Por isso
  // NAO chamamos `player.replace()` nem `player.remove()` aqui: trocar
  // `localUri` ja entrega um player novo com o arquivo certo.
  const player = useAudioPlayer(localUri ?? undefined);
  const status = useAudioPlayerStatus(player);
  const playing = Boolean(status?.playing);

  // Toque no play antes do download terminar: assim que o player novo existe
  // (fonte = arquivo local), a reproducao comeca.
  useEffect(() => {
    if (!playRequested || !localUri) {
      return;
    }

    setPlayRequested(false);
    player.play();
    announceForAccessibility(accessibilityAnnouncements.audioPlaybackStarted());
  }, [localUri, player, playRequested]);

  const handleToggle = useCallback(async () => {
    if (playing) {
      player.pause();
      announceForAccessibility(accessibilityAnnouncements.audioPlaybackStopped());
      return;
    }

    if (!localUri) {
      setPreparing(true);
      setFailed(false);
      try {
        const nextUri = await resolveLocalAudioUri(messageId, uri, authToken);
        setLocalUri(nextUri);
        setPlayRequested(true);
      } catch {
        setFailed(true);
      } finally {
        setPreparing(false);
      }
      return;
    }

    if (
      status.didJustFinish ||
      (status.duration > 0 && status.currentTime >= status.duration - 0.05)
    ) {
      // Terminou: o proximo toque recomeca do inicio. Uma pausa no meio
      // continua de onde parou.
      await player.seekTo(0);
    }

    player.play();
    announceForAccessibility(accessibilityAnnouncements.audioPlaybackStarted());
  }, [authToken, localUri, messageId, player, playing, status, uri]);

  // Duracao conhecida: a informada pelo remetente ou, se faltar, a que o player
  // descobriu ao carregar. Sem nenhuma das duas o cronometro mostra "0:00" —
  // nunca um texto de "duracao desconhecida".
  const knownDuration =
    typeof durationSeconds === "number" && durationSeconds > 0
      ? durationSeconds
      : status?.duration && status.duration > 0
        ? status.duration
        : null;
  const spokenAudio = describeAudioMessage(knownDuration);
  const clock = formatAudioClock(playing ? status.currentTime : knownDuration);

  const controlLabel = playing ? `Pausar ${spokenAudio}` : `Reproduzir ${spokenAudio}`;
  const fullLabel = messageLabel ? `${controlLabel}. ${messageLabel}` : controlLabel;

  return (
    <View className="min-w-[190px] flex-row items-center gap-3">
      <Pressable
        accessible
        accessibilityRole="button"
        accessibilityLabel={fullLabel}
        accessibilityHint={onLongPress ? "Toque e segure para apagar" : undefined}
        accessibilityState={{ busy: preparing, disabled: failed }}
        accessibilityActions={accessibilityActions}
        onAccessibilityAction={onAccessibilityAction}
        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        className={`h-12 w-12 items-center justify-center rounded-full ${
          mine ? "bg-white/25" : "bg-[#7C4DFF]"
        }`}
        delayLongPress={350}
        disabled={preparing}
        onLongPress={onLongPress}
        onPress={() => {
          void handleToggle();
        }}
      >
        {preparing ? (
          <ActivityIndicator color="#FFFFFF" size="small" />
        ) : (
          <Ionicons
            name={failed ? "alert-circle" : playing ? "pause" : "play"}
            size={24}
            color="#FFFFFF"
            importantForAccessibility="no"
          />
        )}
      </Pressable>

      <View className="flex-1" importantForAccessibility="no-hide-descendants">
        <View className="h-1.5 w-full overflow-hidden rounded-full bg-white/25">
          <View
            className="h-full rounded-full bg-white"
            style={{
              width: `${
                status?.duration
                  ? Math.min(100, ((status.currentTime ?? 0) / status.duration) * 100)
                  : 0
              }%`,
            }}
          />
        </View>
        <Text className={`mt-1 text-[12px] ${mine ? "text-white/80" : "text-[#CAC3D8]"}`}>
          {failed ? "Não foi possível carregar o áudio" : clock}
        </Text>
      </View>
    </View>
  );
}
