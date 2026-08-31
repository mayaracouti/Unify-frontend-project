import Ionicons from "@expo/vector-icons/Ionicons";
import {
  RecordingPresets,
  getRecordingPermissionsAsync,
  requestRecordingPermissionsAsync,
  setAudioModeAsync,
  useAudioRecorder,
  useAudioRecorderState,
} from "expo-audio";
import { useCallback, useEffect, useRef, useState } from "react";
import { Pressable, Text, View } from "react-native";

import type { ChatMediaUpload } from "../../types/chat";
import {
  accessibilityAnnouncements,
  announceForAccessibility,
} from "../../utils/accessibilityAnnouncements";
import { formatAudioDuration } from "../../utils/chatFormatting";
import { showGlobalToast } from "../../utils/globalToast";

/** Limite aceito pelo backend (`unify.chat.audio.max-duration-seconds`). */
const MAX_DURATION_SECONDS = 120;

/**
 * Botao de gravar audio ACESSIVEL: toque para iniciar, toque para parar.
 *
 * Nunca "segurar para gravar" — pressao longa e inacessivel para quem tem
 * limitacao motora e e incompativel com o leitor de tela, que consome o gesto.
 */
export function AudioRecorderButton({
  disabled,
  onRecorded,
}: {
  disabled?: boolean;
  onRecorded: (media: ChatMediaUpload) => void;
}) {
  const recorder = useAudioRecorder(RecordingPresets.HIGH_QUALITY);
  const recorderState = useAudioRecorderState(recorder);
  const [permissionGranted, setPermissionGranted] = useState<boolean | null>(null);

  const recording = Boolean(recorderState?.isRecording);
  const elapsedSeconds = Math.floor((recorderState?.durationMillis ?? 0) / 1000);
  const autoStoppedRef = useRef(false);

  // Consulta o estado atual SEM abrir o dialogo: a permissao so e pedida
  // quando a pessoa realmente toca em gravar.
  useEffect(() => {
    let active = true;

    void getRecordingPermissionsAsync()
      .then((status) => {
        if (active) {
          setPermissionGranted(status.granted);
        }
      })
      .catch(() => {
        if (active) {
          setPermissionGranted(null);
        }
      });

    return () => {
      active = false;
    };
  }, []);

  const stopRecording = useCallback(async () => {
    try {
      await recorder.stop();
      const uri = recorder.uri;
      const seconds = Math.max(1, elapsedSeconds);

      // Devolve a sessao de audio ao modo de reproducao (iOS): com
      // `allowsRecording` ligado o player sai baixo no alto-falante.
      await setAudioModeAsync({ allowsRecording: false, playsInSilentMode: true });

      if (!uri) {
        announceForAccessibility(accessibilityAnnouncements.recordingCancelled());
        return;
      }

      announceForAccessibility(accessibilityAnnouncements.recordingStopped(seconds));

      onRecorded({
        type: "AUDIO",
        uri,
        name: `audio-${Date.now()}.m4a`,
        mimeType: "audio/m4a",
        durationSeconds: seconds,
      });
    } catch {
      showGlobalToast({
        title: "Não foi possível finalizar",
        message: "A gravação não pôde ser salva.",
        variant: "error",
      });
    }
  }, [elapsedSeconds, onRecorded, recorder]);

  // Corte automatico no limite de duracao aceito pelo backend.
  useEffect(() => {
    if (!recording) {
      autoStoppedRef.current = false;
      return;
    }

    if (elapsedSeconds >= MAX_DURATION_SECONDS && !autoStoppedRef.current) {
      autoStoppedRef.current = true;
      announceForAccessibility(
        `Limite de ${MAX_DURATION_SECONDS} segundos atingido. Finalizando a gravação.`
      );
      void stopRecording();
    }
  }, [elapsedSeconds, recording, stopRecording]);

  const startRecording = useCallback(async () => {
    let granted = permissionGranted === true;

    if (!granted) {
      const status = await requestRecordingPermissionsAsync().catch(() => null);
      granted = Boolean(status?.granted);
      setPermissionGranted(granted);
    }

    if (!granted) {
      showGlobalToast({
        title: "Microfone bloqueado",
        message: "Autorize o uso do microfone nos ajustes do celular para gravar áudios.",
        variant: "warning",
      });
      return;
    }

    try {
      // Permite gravar mesmo com o telefone no modo silencioso (iOS).
      await setAudioModeAsync({ allowsRecording: true, playsInSilentMode: true });
      await recorder.prepareToRecordAsync();
      recorder.record();
      announceForAccessibility(accessibilityAnnouncements.recordingStarted());
    } catch {
      showGlobalToast({
        title: "Não foi possível gravar",
        message: "Tente novamente em instantes.",
        variant: "error",
      });
    }
  }, [permissionGranted, recorder]);

  return (
    <View className="flex-row items-center gap-2">
      {recording ? (
        <Text
          accessibilityLiveRegion="polite"
          accessibilityLabel={`Gravando há ${formatAudioDuration(elapsedSeconds)}`}
          className="text-[13px] font-bold text-[#FF6B6B]"
        >
          {formatAudioDuration(elapsedSeconds)}
        </Text>
      ) : null}

      <Pressable
        accessible
        accessibilityRole="button"
        accessibilityLabel={
          recording
            ? `Parar gravação. Gravando há ${formatAudioDuration(elapsedSeconds)}`
            : "Gravar mensagem de áudio"
        }
        accessibilityHint={
          recording
            ? "Toque para finalizar e enviar o áudio"
            : `Toque para começar a gravar. Duração máxima de ${MAX_DURATION_SECONDS} segundos`
        }
        accessibilityState={{ disabled: Boolean(disabled), busy: recording }}
        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        className={`h-12 w-12 items-center justify-center rounded-full ${
          recording ? "bg-[#FF2D73]" : "bg-[#1D1F24]"
        }`}
        disabled={disabled}
        onPress={() => {
          void (recording ? stopRecording() : startRecording());
        }}
      >
        <Ionicons
          name={recording ? "stop" : "mic"}
          size={24}
          color={recording ? "#FFFFFF" : "#CAC3D8"}
          importantForAccessibility="no"
        />
      </Pressable>
    </View>
  );
}
