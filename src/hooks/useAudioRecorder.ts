import {
  RecordingPresets,
  getRecordingPermissionsAsync,
  requestRecordingPermissionsAsync,
  setAudioModeAsync,
  useAudioRecorder as useExpoAudioRecorder,
  useAudioRecorderState,
} from "expo-audio";
import { File } from "expo-file-system";
import { useCallback, useEffect, useRef, useState } from "react";

import type { ChatMediaUpload } from "../types/chat";
import {
  accessibilityAnnouncements,
  announceForAccessibility,
} from "../utils/accessibilityAnnouncements";
import { showGlobalToast } from "../utils/globalToast";

/** Limite aceito pelo backend (`unify.chat.audio.max-duration-seconds`). */
export const MAX_AUDIO_DURATION_SECONDS = 120;

type UseAudioRecorderArgs = {
  /** Chamado quando a gravacao termina com sucesso (toque em parar ou limite atingido). */
  onRecorded: (media: ChatMediaUpload) => void;
};

/**
 * Gravacao de audio ACESSIVEL: toque para iniciar, toque para parar (ou descartar).
 *
 * Nunca "segurar para gravar" — pressao longa e inacessivel para quem tem
 * limitacao motora e e incompativel com o leitor de tela, que consome o gesto.
 *
 * A UI fica por conta de quem usa o hook (`ChatComposer`): enquanto `recording`
 * e true o compositor troca a caixa de texto pelo cronometro e pelos botoes
 * de descartar/enviar.
 */
export function useAudioRecorder({ onRecorded }: UseAudioRecorderArgs) {
  const recorder = useExpoAudioRecorder(RecordingPresets.HIGH_QUALITY);
  const recorderState = useAudioRecorderState(recorder);
  const [permissionGranted, setPermissionGranted] = useState<boolean | null>(null);

  const recording = Boolean(recorderState?.isRecording);
  const elapsedSeconds = Math.floor((recorderState?.durationMillis ?? 0) / 1000);
  const autoStoppedRef = useRef(false);

  // O callback muda a cada render do compositor; a ref evita recriar `stop`.
  const onRecordedRef = useRef(onRecorded);
  useEffect(() => {
    onRecordedRef.current = onRecorded;
  }, [onRecorded]);

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

  const restorePlaybackMode = useCallback(async () => {
    // Devolve a sessao de audio ao modo de reproducao (iOS): com
    // `allowsRecording` ligado o player sai baixo no alto-falante.
    await setAudioModeAsync({ allowsRecording: false, playsInSilentMode: true }).catch(
      () => undefined
    );
  }, []);

  const stop = useCallback(async () => {
    try {
      await recorder.stop();
      const uri = recorder.uri;
      const seconds = Math.max(1, elapsedSeconds);

      await restorePlaybackMode();

      if (!uri) {
        announceForAccessibility(accessibilityAnnouncements.recordingCancelled());
        return;
      }

      announceForAccessibility(accessibilityAnnouncements.recordingStopped(seconds));

      onRecordedRef.current({
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
  }, [elapsedSeconds, recorder, restorePlaybackMode]);

  /** Descarta a gravacao em andamento: nada e enviado e o arquivo local e apagado. */
  const cancel = useCallback(async () => {
    try {
      await recorder.stop();
    } catch {
      // Ja parado ou nunca comecou: seguir para a limpeza mesmo assim.
    }

    await restorePlaybackMode();

    const uri = recorder.uri;
    if (uri) {
      try {
        const file = new File(uri);
        if (file.exists) {
          file.delete();
        }
      } catch {
        // Na web a URI e um blob: nao ha arquivo para apagar.
      }
    }

    announceForAccessibility(accessibilityAnnouncements.recordingCancelled());
  }, [recorder, restorePlaybackMode]);

  // Corte automatico no limite de duracao aceito pelo backend.
  useEffect(() => {
    if (!recording) {
      autoStoppedRef.current = false;
      return;
    }

    if (elapsedSeconds >= MAX_AUDIO_DURATION_SECONDS && !autoStoppedRef.current) {
      autoStoppedRef.current = true;
      announceForAccessibility(
        `Limite de ${MAX_AUDIO_DURATION_SECONDS} segundos atingido. Finalizando a gravação.`
      );
      void stop();
    }
  }, [elapsedSeconds, recording, stop]);

  const start = useCallback(async () => {
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

  return { cancel, elapsedSeconds, recording, start, stop };
}
