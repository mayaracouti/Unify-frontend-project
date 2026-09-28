import Ionicons from "@expo/vector-icons/Ionicons";
import { useAudioPlayer, useAudioPlayerStatus } from "expo-audio";
import { File, Paths } from "expo-file-system";
import { forwardRef, useCallback, useEffect, useImperativeHandle, useRef, useState } from "react";
import {
  type AccessibilityActionEvent,
  type AccessibilityActionInfo,
  ActivityIndicator,
  Platform,
  Pressable,
  Text,
  View,
} from "react-native";

import {
  accessibilityAnnouncements,
  announceForAccessibility,
} from "../../utils/accessibilityAnnouncements";
import { formatAudioClock } from "../../utils/chatFormatting";

const audioFileCache = new Map<string, string>();

/**
 * Baixa o audio protegido por JWT e devolve uma URI local tocavel.
 * Cacheado em memoria por `cacheKey` — os endpoints de audio respondem com
 * id novo a cada troca de arquivo, entao a mesma chave nunca muda de conteudo
 * dentro da sessao.
 *
 * O `useAudioPlayer` aceita fonte com headers, mas o suporte varia por
 * plataforma; baixar primeiro e o caminho previsivel. No app o arquivo vai
 * para `Paths.cache`; na web (`expo-file-system` nao existe la) vira um
 * `blob:` em memoria.
 */
async function resolveLocalAudioUri(
  cacheKey: string,
  remoteUri: string,
  authToken: string | null
): Promise<string> {
  const cached = audioFileCache.get(cacheKey);
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

  if (Platform.OS === "web") {
    const blobUri = URL.createObjectURL(await response.blob());
    audioFileCache.set(cacheKey, blobUri);
    return blobUri;
  }

  const buffer = await response.arrayBuffer();
  const safeKey = cacheKey.replace(/[^a-zA-Z0-9_-]/g, "_");
  const file = new File(Paths.cache, `unify-audio-${safeKey}.m4a`);

  if (file.exists) {
    file.delete();
  }

  file.create();
  file.write(new Uint8Array(buffer));

  audioFileCache.set(cacheKey, file.uri);
  return file.uri;
}

export type AuthenticatedAudioPlayerHandle = {
  /** Para a reproducao (e um download pendente) sem anunciar nada. */
  stop: () => void;
};

export type AudioPlayerLabelState = {
  playing: boolean;
  /** Duracao informada ou, se faltar, a que o player descobriu ao carregar. */
  knownDurationSeconds: number | null;
};

export type AuthenticatedAudioPlayerProps = {
  /** URL absoluta do endpoint autenticado. */
  uri: string;
  authToken: string | null;
  /** Chave do cache local (id da mensagem, id do audio de apresentacao...). */
  cacheKey: string;
  durationSeconds: number | null;
  /**
   * Rotulo do controle. Texto fixo vale para o estado parado (ex.: "Ouvir
   * apresentação de Ana, 42 segundos") e, tocando, usa-se
   * `playingAccessibilityLabel`. A forma de funcao recebe o estado atual.
   */
  accessibilityLabel: string | ((state: AudioPlayerLabelState) => string);
  /** Rotulo enquanto toca quando `accessibilityLabel` e texto. */
  playingAccessibilityLabel?: string;
  accessibilityHint?: string;
  /** Acoes extras (editar/apagar no chat) expostas no botao de play. */
  accessibilityActions?: AccessibilityActionInfo[];
  onAccessibilityAction?: (event: AccessibilityActionEvent) => void;
  onLongPress?: () => void;
  /** Chamado imediatamente antes de tocar (a tela cala o TTS aqui). */
  onPlaybackStart?: () => void;
  /** So estilo: balao do chat ou controle da tela de perfil/Encontros. */
  variant?: "chat" | "profile";
  /** Chat: balao da propria pessoa (cores invertidas). */
  mine?: boolean;
  /** Profile: texto visivel do botao. */
  title?: string;
  playingTitle?: string;
};

/**
 * Player de audio protegido por JWT: download sob demanda (nunca pre-baixa),
 * cache local, play/pausa com anuncio para o leitor de tela e
 * `accessibilityState` com `busy` durante o download.
 *
 * Expoe `stop()` via ref para a tela parar a reproducao ao trocar de perfil,
 * perder o foco ou decidir sobre o card. Ao desmontar, o `useAudioPlayer`
 * libera o player nativo (e o som para junto).
 */
export const AuthenticatedAudioPlayer = forwardRef<
  AuthenticatedAudioPlayerHandle,
  AuthenticatedAudioPlayerProps
>(function AuthenticatedAudioPlayer(
  {
    accessibilityActions,
    accessibilityHint,
    accessibilityLabel,
    authToken,
    cacheKey,
    durationSeconds,
    mine = false,
    onAccessibilityAction,
    onLongPress,
    onPlaybackStart,
    playingAccessibilityLabel,
    playingTitle = "Pausar",
    title = "Ouvir apresentação",
    uri,
    variant = "chat",
  },
  ref
) {
  const [localUri, setLocalUri] = useState<string | null>(null);
  const [preparing, setPreparing] = useState(false);
  const [failed, setFailed] = useState(false);
  const [playRequested, setPlayRequested] = useState(false);
  // Incrementa a cada `stop()`: um download iniciado antes dele nao toca ao terminar.
  const stopGenerationRef = useRef(0);

  // `useAudioPlayer` recria o player nativo quando a fonte muda (a instancia e
  // chaveada pelo source) e libera a anterior sozinho ao desmontar. Por isso
  // NAO chamamos `player.replace()` nem `player.remove()` aqui: trocar
  // `localUri` ja entrega um player novo com o arquivo certo.
  const player = useAudioPlayer(localUri ?? undefined);
  const status = useAudioPlayerStatus(player);
  const playing = Boolean(status?.playing);

  // A fonte mudou (outro audio no mesmo lugar da arvore): recomeca do zero.
  useEffect(() => {
    setLocalUri(null);
    setFailed(false);
    setPlayRequested(false);
    stopGenerationRef.current += 1;
  }, [cacheKey, uri]);

  const onPlaybackStartRef = useRef(onPlaybackStart);
  useEffect(() => {
    onPlaybackStartRef.current = onPlaybackStart;
  }, [onPlaybackStart]);

  const startPlayback = useCallback(() => {
    onPlaybackStartRef.current?.();
    player.play();
    announceForAccessibility(accessibilityAnnouncements.audioPlaybackStarted());
  }, [player]);

  // Toque no play antes do download terminar: assim que o player novo existe
  // (fonte = arquivo local), a reproducao comeca.
  useEffect(() => {
    if (!playRequested || !localUri) {
      return;
    }

    setPlayRequested(false);
    startPlayback();
  }, [localUri, playRequested, startPlayback]);

  useImperativeHandle(
    ref,
    () => ({
      stop: () => {
        stopGenerationRef.current += 1;
        setPlayRequested(false);

        try {
          if (player.playing) {
            player.pause();
          }
          if (player.currentTime > 0) {
            void player.seekTo(0);
          }
        } catch {
          // Player ja liberado (tela saindo): nada a parar.
        }
      },
    }),
    [player]
  );

  const handleToggle = useCallback(async () => {
    if (playing) {
      player.pause();
      announceForAccessibility(accessibilityAnnouncements.audioPlaybackStopped());
      return;
    }

    if (!localUri) {
      const generation = stopGenerationRef.current;
      setPreparing(true);
      setFailed(false);
      try {
        const nextUri = await resolveLocalAudioUri(cacheKey, uri, authToken);
        if (generation !== stopGenerationRef.current) {
          return;
        }
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

    startPlayback();
  }, [authToken, cacheKey, localUri, player, playing, startPlayback, status, uri]);

  // Duracao conhecida: a informada ou, se faltar, a que o player descobriu ao
  // carregar. Sem nenhuma das duas o cronometro mostra "0:00" — nunca um texto
  // de "duracao desconhecida".
  const knownDuration =
    typeof durationSeconds === "number" && durationSeconds > 0
      ? durationSeconds
      : status?.duration && status.duration > 0
        ? status.duration
        : null;
  const clock = formatAudioClock(playing ? status.currentTime : knownDuration);
  const progressPercent = status?.duration
    ? Math.min(100, ((status.currentTime ?? 0) / status.duration) * 100)
    : 0;

  const label =
    typeof accessibilityLabel === "function"
      ? accessibilityLabel({ playing, knownDurationSeconds: knownDuration })
      : playing
        ? playingAccessibilityLabel ?? "Pausar áudio"
        : accessibilityLabel;
  const iconName = failed ? "alert-circle" : playing ? "pause" : "play";

  if (variant === "profile") {
    return (
      <Pressable
        accessible
        accessibilityRole="button"
        accessibilityLabel={failed ? `${label}. Não foi possível carregar o áudio` : label}
        accessibilityHint={accessibilityHint}
        accessibilityState={{ busy: preparing, disabled: preparing, selected: playing }}
        accessibilityActions={accessibilityActions}
        onAccessibilityAction={onAccessibilityAction}
        className="min-h-[56px] flex-row items-center rounded-[18px] border border-[#7C4DFF] bg-[#221A33] px-4 py-2"
        disabled={preparing}
        onLongPress={onLongPress}
        onPress={() => {
          void handleToggle();
        }}
      >
        <View className="h-10 w-10 items-center justify-center rounded-full bg-[#7C4DFF]">
          {preparing ? (
            <ActivityIndicator color="#FFFFFF" size="small" />
          ) : (
            <Ionicons name={iconName} size={22} color="#FFFFFF" importantForAccessibility="no" />
          )}
        </View>

        <View className="ml-3 flex-1" importantForAccessibility="no-hide-descendants">
          <Text className="text-[15px] font-black text-white">
            {failed ? "Tentar de novo" : playing ? playingTitle : title}
          </Text>
          <View className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-white/20">
            <View
              className="h-full rounded-full bg-[#EAEA00]"
              style={{ width: `${progressPercent}%` }}
            />
          </View>
        </View>

        <Text
          className="ml-3 text-[13px] font-bold text-[#CAC3D8]"
          importantForAccessibility="no"
        >
          {clock}
        </Text>
      </Pressable>
    );
  }

  return (
    <View className="min-w-[190px] flex-row items-center gap-3">
      <Pressable
        accessible
        accessibilityRole="button"
        accessibilityLabel={label}
        accessibilityHint={accessibilityHint}
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
          <Ionicons name={iconName} size={24} color="#FFFFFF" importantForAccessibility="no" />
        )}
      </Pressable>

      <View className="flex-1" importantForAccessibility="no-hide-descendants">
        <View className="h-1.5 w-full overflow-hidden rounded-full bg-white/25">
          <View className="h-full rounded-full bg-white" style={{ width: `${progressPercent}%` }} />
        </View>
        <Text className={`mt-1 text-[12px] ${mine ? "text-white/80" : "text-[#CAC3D8]"}`}>
          {failed ? "Não foi possível carregar o áudio" : clock}
        </Text>
      </View>
    </View>
  );
});
