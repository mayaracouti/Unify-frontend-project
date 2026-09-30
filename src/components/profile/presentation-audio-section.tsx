import Ionicons from "@expo/vector-icons/Ionicons";
import { useIsFocused } from "expo-router/react-navigation";
import { useEffect, useRef, useState } from "react";
import {
  AccessibilityInfo,
  ActivityIndicator,
  Linking,
  Platform,
  Pressable,
  Text,
  View,
} from "react-native";

import { speak, stopSpeaking } from "../../accessibility/tts";
import { useAudioRecorder } from "../../hooks/useAudioRecorder";
import { profileService } from "../../services/profileService";
import {
  hasSeenPresentationAudioIntro,
  markPresentationAudioIntroSeen,
} from "../../storage/presentationAudioIntroStorage";
import type { ChatMediaUpload } from "../../types/chat";
import type { UserProfileAudioResponse } from "../../types/profile";
import {
  accessibilityAnnouncements,
  announceForAccessibility,
} from "../../utils/accessibilityAnnouncements";
import { formatAudioDuration } from "../../utils/chatFormatting";
import { ActionSheet } from "../ui/action-sheet";
import {
  AuthenticatedAudioPlayer,
  type AuthenticatedAudioPlayerHandle,
} from "../media/authenticated-audio-player";

/** Limite do backend para o audio de apresentacao (`durationSeconds` 1..60). */
export const PRESENTATION_AUDIO_MAX_SECONDS = 60;

/**
 * Explicacao mostrada so no PRIMEIRO toque em Gravar (depois fica guardado
 * que a pessoa ja viu). Fora da tela para nao poluir a secao.
 */
export const PRESENTATION_AUDIO_INTRO_MESSAGE =
  `Grave até ${PRESENTATION_AUDIO_MAX_SECONDS} segundos se apresentando. Quem estiver no ` +
  "Encontros poderá ouvir sua voz — é a forma acessível de conhecer você para quem não vê as fotos.";

/** De quantos em quantos segundos o cronometro e anunciado ao leitor de tela. */
const RECORDING_ANNOUNCE_INTERVAL_SECONDS = 10;

/** "00:42" — cronometro visual MM:SS. */
function formatRecordingClock(seconds: number) {
  const total = Math.max(0, Math.floor(seconds));
  const minutes = Math.floor(total / 60);
  const remaining = total % 60;

  return `${String(minutes).padStart(2, "0")}:${String(remaining).padStart(2, "0")}`;
}

/**
 * Mesmo formato de `chatService.sendMediaMessage`: arquivo `{ uri, name, type }`
 * + `durationSeconds` como inteiro em string (o backend exige 1..60).
 */
function createPresentationAudioFormData(media: ChatMediaUpload): FormData {
  const formData = new FormData();
  const seconds = Math.min(
    PRESENTATION_AUDIO_MAX_SECONDS,
    Math.max(1, Math.round(media.durationSeconds ?? 1))
  );

  formData.append("audio", {
    uri: media.uri,
    name: media.name,
    type: media.mimeType,
  } as unknown as Blob);
  formData.append("durationSeconds", String(seconds));

  return formData;
}

/**
 * Secao "Audio de apresentacao" da aba Perfil: gravar (toque para iniciar,
 * toque para parar — nunca segurar), ouvir, regravar e remover.
 *
 * Quem estiver no Encontros ouve a voz da pessoa — a forma acessivel de
 * conhecer alguem para quem nao ve as fotos. Na web a gravacao nao e
 * oferecida (o navegador grava em formato que o backend nao aceita).
 */
export function PresentationAudioSection({
  audio,
  authToken,
  highContrast,
  loading,
  onChanged,
}: {
  audio: UserProfileAudioResponse | null;
  authToken: string | null;
  highContrast: boolean;
  loading: boolean;
  /** Recarrega o perfil (o audio vem em `GET /users/me/profile`). */
  onChanged: () => Promise<void>;
}) {
  const isFocused = useIsFocused();
  const playerRef = useRef<AuthenticatedAudioPlayerHandle>(null);
  const [saving, setSaving] = useState(false);
  const [removing, setRemoving] = useState(false);
  const [confirmRemoveVisible, setConfirmRemoveVisible] = useState(false);
  const [permissionDenied, setPermissionDenied] = useState(false);
  const [progressMessage, setProgressMessage] = useState("");
  const [introVisible, setIntroVisible] = useState(false);
  // null = ainda lendo o storage; nesse intervalo conta como "nao viu".
  const [introSeen, setIntroSeen] = useState<boolean | null>(null);
  const recordingSupported = Platform.OS !== "web";

  useEffect(() => {
    let active = true;
    void hasSeenPresentationAudioIntro().then((seen) => {
      if (active) {
        setIntroSeen(seen);
      }
    });
    return () => {
      active = false;
    };
  }, []);

  async function handleRecorded(media: ChatMediaUpload) {
    setSaving(true);

    try {
      await profileService.uploadPresentationAudio(createPresentationAudioFormData(media));
      await onChanged();
      announceForAccessibility(accessibilityAnnouncements.presentationAudioSaved());
    } catch {
      announceForAccessibility(accessibilityAnnouncements.presentationAudioSaveFailed());
      // Global API error toast already explains the failure.
    } finally {
      setSaving(false);
    }
  }

  const recorder = useAudioRecorder({
    onRecorded: (media) => {
      void handleRecorded(media);
    },
    maxDurationSeconds: PRESENTATION_AUDIO_MAX_SECONDS,
  });
  const { cancel: cancelRecording, recording, elapsedSeconds } = recorder;

  // Cronometro para o leitor de tela: so a cada 10 s, nunca a cada segundo.
  // No Android a `accessibilityLiveRegion` abaixo fala a mudanca; no iOS (sem
  // live region) o anuncio e explicito.
  useEffect(() => {
    if (!recording) {
      setProgressMessage("");
      return;
    }

    if (
      elapsedSeconds === 0 ||
      elapsedSeconds % RECORDING_ANNOUNCE_INTERVAL_SECONDS !== 0 ||
      elapsedSeconds >= PRESENTATION_AUDIO_MAX_SECONDS
    ) {
      return;
    }

    const message = accessibilityAnnouncements.presentationRecordingProgress(
      elapsedSeconds,
      PRESENTATION_AUDIO_MAX_SECONDS
    );
    setProgressMessage(message);

    if (Platform.OS === "ios") {
      AccessibilityInfo.announceForAccessibility(message);
    }
  }, [elapsedSeconds, recording]);

  // Saiu da aba: para o player e descarta uma gravacao em andamento (nada e
  // enviado sem a pessoa ver).
  useEffect(() => {
    if (isFocused) {
      return;
    }

    playerRef.current?.stop();

    if (recording) {
      void cancelRecording();
    }
  }, [cancelRecording, isFocused, recording]);

  async function startRecording() {
    // A fala do TTS seria gravada junto: cala antes de abrir o microfone.
    stopSpeaking();
    playerRef.current?.stop();
    setPermissionDenied(false);

    const result = await recorder.start();

    if (result === "permission-denied") {
      setPermissionDenied(true);
      announceForAccessibility(accessibilityAnnouncements.microphonePermissionDenied());
    }
  }

  /** Primeiro toque de todos: mostra a explicacao em vez de abrir o microfone. */
  function handleRecordPress() {
    if (introSeen) {
      void startRecording();
      return;
    }

    setIntroSeen(true);
    void markPresentationAudioIntroSeen();
    setIntroVisible(true);
    speak(`Áudio de apresentação. ${PRESENTATION_AUDIO_INTRO_MESSAGE}`);
  }

  async function handleRemove() {
    setConfirmRemoveVisible(false);
    playerRef.current?.stop();
    setRemoving(true);

    try {
      await profileService.deletePresentationAudio();
      await onChanged();
      announceForAccessibility(accessibilityAnnouncements.presentationAudioRemoved());
    } catch {
      announceForAccessibility(accessibilityAnnouncements.presentationAudioRemoveFailed());
      // Global API error toast already explains the failure.
    } finally {
      setRemoving(false);
    }
  }

  const cardClassName = `rounded-[22px] border p-5 ${
    highContrast ? "border-hc-border bg-hc-surface" : "border-[#3A3246] bg-[#17181C]"
  }`;
  const textColor = highContrast ? "text-hc-text" : "text-white";
  const secondaryColor = highContrast ? "text-hc-text" : "text-[#CAC3D8]";
  const spokenDuration = audio ? formatAudioDuration(audio.durationSeconds) : "";
  const busy = saving || removing;

  const renderRecording = () => (
    <View>
      <View className="flex-row items-center">
        <View className="mr-3 h-3 w-3 rounded-full bg-[#FF2D73]" importantForAccessibility="no" />
        <Text
          accessible
          accessibilityRole="text"
          accessibilityLabel={`Gravando: ${
            formatAudioDuration(elapsedSeconds) || "menos de um segundo"
          } de ${PRESENTATION_AUDIO_MAX_SECONDS} segundos`}
          className={`text-[28px] font-black ${textColor}`}
        >
          {formatRecordingClock(elapsedSeconds)}
          <Text className={`text-[16px] font-bold ${secondaryColor}`}>
            {" "}
            / {formatRecordingClock(PRESENTATION_AUDIO_MAX_SECONDS)}
          </Text>
        </Text>
      </View>

      {/* So muda a cada 10 s: o leitor de tela nao e inundado segundo a segundo. */}
      <View accessibilityLiveRegion="polite" importantForAccessibility="yes">
        {progressMessage ? (
          <Text className={`mt-1 text-[13px] font-semibold ${secondaryColor}`}>
            {progressMessage}
          </Text>
        ) : null}
      </View>

      <View className="mt-4 flex-row flex-wrap gap-3">
        <Pressable
          className="min-h-[52px] flex-grow flex-row items-center justify-center rounded-[18px] bg-[#F1EF00] px-5 py-3"
          onPress={() => {
            void recorder.stop();
          }}
          accessibilityRole="button"
          accessibilityLabel="Parar e salvar"
          accessibilityHint="Encerra a gravação e salva o áudio no seu perfil"
        >
          <Ionicons name="stop" size={20} color="#212000" importantForAccessibility="no" />
          <Text className="ml-2 text-[16px] font-black text-[#212000]">Parar e salvar</Text>
        </Pressable>

        <Pressable
          className="min-h-[52px] flex-grow flex-row items-center justify-center rounded-[18px] border border-[#494455] bg-[#1A1C1F] px-5 py-3"
          onPress={() => {
            void recorder.cancel();
          }}
          accessibilityRole="button"
          accessibilityLabel="Descartar gravação"
          accessibilityHint="Cancela a gravação sem salvar"
        >
          <Ionicons name="trash-outline" size={20} color="#FF6B6B" importantForAccessibility="no" />
          <Text className="ml-2 text-[16px] font-black text-white">Descartar</Text>
        </Pressable>
      </View>
    </View>
  );

  const renderRecordButton = (label: string, primary: boolean) => (
    <Pressable
      className={`min-h-[52px] flex-grow flex-row items-center justify-center rounded-[18px] px-5 py-3 ${
        primary ? "bg-[#F1EF00]" : "border border-[#494455] bg-[#1A1C1F]"
      }`}
      disabled={busy}
      onPress={handleRecordPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityHint={`Toque para começar a gravar; toque de novo para parar. Máximo de ${PRESENTATION_AUDIO_MAX_SECONDS} segundos`}
      accessibilityState={{ disabled: busy, busy: saving }}
    >
      {saving ? (
        <ActivityIndicator color={primary ? "#212000" : "#EAEA00"} size="small" />
      ) : (
        <Ionicons
          name="mic-outline"
          size={20}
          color={primary ? "#212000" : "#FFFFFF"}
          importantForAccessibility="no"
        />
      )}
      <Text
        className={`ml-2 text-[16px] font-black ${primary ? "text-[#212000]" : "text-white"}`}
      >
        {saving ? "Salvando áudio..." : label}
      </Text>
    </Pressable>
  );

  const renderBody = () => {
    if (loading) {
      return (
        <View
          accessible
          accessibilityRole="progressbar"
          accessibilityLabel="Carregando seu áudio de apresentação"
          accessibilityState={{ busy: true }}
          className="items-center py-2"
        >
          <ActivityIndicator color="#EAEA00" size="small" />
        </View>
      );
    }

    if (recording) {
      return renderRecording();
    }

    return (
      <View>
        {audio ? (
          <AuthenticatedAudioPlayer
            ref={playerRef}
            accessibilityHint="Toque para ouvir ou pausar"
            accessibilityLabel={`Ouvir meu áudio de apresentação, ${spokenDuration}`}
            authToken={authToken}
            cacheKey={`presentation-${audio.id}`}
            durationSeconds={audio.durationSeconds}
            onPlaybackStart={stopSpeaking}
            playingAccessibilityLabel="Pausar meu áudio de apresentação"
            title="Ouvir meu áudio"
            uri={profileService.resolveProfileAudioUrl(audio.url) ?? audio.url}
            variant="profile"
          />
        ) : null}

        {recordingSupported ? (
          <View className={`${audio ? "mt-4 " : ""}flex-row flex-wrap gap-3`}>
            {renderRecordButton(audio ? "Regravar" : "Gravar áudio de apresentação", !audio)}

            {audio ? (
              <Pressable
                className="min-h-[52px] flex-grow flex-row items-center justify-center rounded-[18px] border border-[#494455] bg-[#1A1C1F] px-5 py-3"
                disabled={busy}
                onPress={() => {
                  speak("Remover áudio");
                  setConfirmRemoveVisible(true);
                }}
                accessibilityRole="button"
                accessibilityLabel="Remover áudio"
                accessibilityHint="Pede confirmação antes de remover o áudio do seu perfil"
                accessibilityState={{ disabled: busy, busy: removing }}
              >
                {removing ? (
                  <ActivityIndicator color="#EAEA00" size="small" />
                ) : (
                  <Ionicons
                    name="trash-outline"
                    size={20}
                    color="#FF6B6B"
                    importantForAccessibility="no"
                  />
                )}
                <Text className="ml-2 text-[16px] font-black text-white">Remover áudio</Text>
              </Pressable>
            ) : null}
          </View>
        ) : (
          <View className={audio ? "mt-4" : undefined}>
            <Text
              accessibilityRole="text"
              className={`text-[14px] font-bold ${
                highContrast ? "text-hc-accent" : "text-[#F2F500]"
              }`}
            >
              Gravação disponível no aplicativo.
            </Text>
            {audio ? (
              <Pressable
                className="mt-3 min-h-[48px] flex-row items-center justify-center self-start rounded-[18px] border border-[#494455] bg-[#1A1C1F] px-5 py-3"
                disabled={busy}
                onPress={() => {
                  speak("Remover áudio");
                  setConfirmRemoveVisible(true);
                }}
                accessibilityRole="button"
                accessibilityLabel="Remover áudio"
                accessibilityHint="Pede confirmação antes de remover o áudio do seu perfil"
                accessibilityState={{ disabled: busy, busy: removing }}
              >
                <Text className="text-[15px] font-black text-white">Remover áudio</Text>
              </Pressable>
            ) : null}
          </View>
        )}

        {permissionDenied ? (
          <View
            accessibilityLiveRegion="polite"
            className="mt-4 rounded-2xl border border-[#6A4456] bg-[#2A1C24] px-4 py-4"
          >
            <Text className="text-[14px] font-semibold leading-6 text-[#FFEAF0]">
              O microfone está bloqueado para o Unify. Libere o acesso nas configurações do
              celular para gravar sua apresentação.
            </Text>
            <Pressable
              className="mt-3 min-h-[48px] items-center justify-center rounded-full border border-[#5DDB85] bg-[#132519] px-5"
              onPress={() => {
                speak("Abrir configurações");
                void Linking.openSettings();
              }}
              accessibilityRole="button"
              accessibilityLabel="Abrir configurações"
              accessibilityHint="Abre as configurações do sistema, fora do aplicativo, para liberar o microfone"
            >
              <Text className="text-[15px] font-black text-[#5DDB85]">Abrir configurações</Text>
            </Pressable>
          </View>
        ) : null}
      </View>
    );
  };

  return (
    <View className="mt-8">
      <View className="mb-2 flex-row items-center">
        <Ionicons
          name="mic-circle-outline"
          size={22}
          color="#D6C5FF"
          importantForAccessibility="no"
        />
        <Text accessibilityRole="header" className={`ml-3 flex-1 text-[20px] font-black ${textColor}`}>
          Áudio de apresentação
        </Text>
      </View>
      <View className={`mt-2 ${cardClassName}`}>{renderBody()}</View>

      <ActionSheet
        message={PRESENTATION_AUDIO_INTRO_MESSAGE}
        onClose={() => setIntroVisible(false)}
        options={[
          {
            key: "start-presentation-recording",
            label: "Começar a gravar",
            hint: `Toque para começar a gravar; toque em Parar e salvar para terminar. Máximo de ${PRESENTATION_AUDIO_MAX_SECONDS} segundos`,
            icon: "mic-outline",
            onPress: () => {
              setIntroVisible(false);
              void startRecording();
            },
          },
        ]}
        title="Áudio de apresentação"
        visible={introVisible}
      />

      <ActionSheet
        message="Quem estiver no Encontros deixa de ouvir sua apresentação. Você pode gravar outra quando quiser."
        onClose={() => setConfirmRemoveVisible(false)}
        options={[
          {
            key: "confirm-remove-audio",
            label: "Remover áudio",
            hint: "Remove o áudio de apresentação do seu perfil",
            icon: "trash-outline",
            destructive: true,
            onPress: () => {
              void handleRemove();
            },
          },
        ]}
        title="Remover áudio de apresentação?"
        visible={confirmRemoveVisible}
      />
    </View>
  );
}
