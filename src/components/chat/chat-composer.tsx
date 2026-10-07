import Ionicons from "@expo/vector-icons/Ionicons";
import * as ImagePicker from "expo-image-picker";
import { useEffect, useRef, useState } from "react";
import { ActivityIndicator, KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, Text, TextInput, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { useTTS } from "../../accessibility/tts";
import { MAX_AUDIO_DURATION_SECONDS, useAudioRecorder } from "../../hooks/useAudioRecorder";
import type { ChatMediaUpload } from "../../types/chat";
import { formatAudioClock, formatAudioDuration } from "../../utils/chatFormatting";
import { showGlobalToast } from "../../utils/globalToast";
import { buildChatImageCaption, CHAT_IMAGE_DESCRIPTION_MAX_LENGTH } from "../../utils/chatImageDescription";
import { PostImage } from "../community/post/post-image";
import { ActionSheet } from "../ui/action-sheet";

export type ChatComposerEditTarget = {
  messageId: string;
  body: string;
};

type ImageSource = "camera" | "library";

export function ChatComposer({
  editing,
  onCancelEdit,
  onSendMedia,
  onSendText,
  onSubmitEdit,
  sending,
}: {
  /** Mensagem em edicao: o compositor vira "Editando" e o envio confirma a edicao. */
  editing: ChatComposerEditTarget | null;
  onCancelEdit: () => void;
  onSendMedia: (media: ChatMediaUpload) => Promise<boolean>;
  onSendText: (body: string) => Promise<boolean>;
  onSubmitEdit: (messageId: string, body: string) => void;
  sending: boolean;
}) {
  const [draft, setDraft] = useState("");
  const textSendInFlight = useRef(false);
  const imageSendInFlight = useRef(false);
  const pickingImage = useRef(false);
  const [selectedImage, setSelectedImage] = useState<ChatMediaUpload | null>(null);
  const [imageDescription, setImageDescription] = useState("");
  const [imageSourceVisible, setImageSourceVisible] = useState(false);
  const recorder = useAudioRecorder({ onRecorded: (media) => { void onSendMedia(media); } });
  // TTS in-app: cada controle fala o proprio nome ao ser tocado/focado. O
  // gravador ja anuncia inicio/fim pelo canal do leitor nativo
  // (`announceForAccessibility`); os dois canais nunca soam juntos.
  const { speak } = useTTS();

  // Entrar em edicao carrega o texto atual; sair limpa o rascunho.
  useEffect(() => {
    setDraft(editing ? editing.body : "");
  }, [editing]);

  const trimmed = draft.trim();
  const canSend =
    trimmed.length > 0 && !sending && (!editing || trimmed !== editing.body.trim());

  async function pickImage(source: ImageSource) {
    setImageSourceVisible(false);
    if (pickingImage.current || sending) return;
    pickingImage.current = true;
    try {
      const permission =
        source === "camera"
          ? await ImagePicker.requestCameraPermissionsAsync()
          : await ImagePicker.requestMediaLibraryPermissionsAsync();

      if (!permission.granted) {
        showGlobalToast({
          title: source === "camera" ? "Câmera bloqueada" : "Galeria bloqueada",
          message:
            source === "camera"
              ? "Autorize o uso da câmera nos ajustes do celular para tirar fotos."
              : "Autorize o acesso às fotos nos ajustes do celular para enviar imagens.",
          variant: "warning",
        });
        return;
      }

      const pickerOptions: ImagePicker.ImagePickerOptions = {
        mediaTypes: ["images"], // SDK 54: array de strings (MediaTypeOptions esta depreciado)
        quality: 0.8,
        allowsEditing: false,
      };

      const result =
        source === "camera"
          ? await ImagePicker.launchCameraAsync(pickerOptions)
          : await ImagePicker.launchImageLibraryAsync(pickerOptions);

      if (result.canceled || !result.assets?.[0]) {
        return;
      }

      const asset = result.assets[0];

      setSelectedImage({
        type: "IMAGE",
        uri: asset.uri,
        name: asset.fileName ?? `imagem-${Date.now()}.jpg`,
        mimeType: asset.mimeType ?? "image/jpeg",
        file: asset.file,
      });
      setImageDescription("");
      speak("Imagem selecionada. Você pode descrever a imagem antes de enviar.");
    } catch {
      showGlobalToast({ title: "Não foi possível selecionar a imagem", message: "Tente novamente.", variant: "error" });
    } finally {
      pickingImage.current = false;
    }
  }

  async function sendSelectedImage() {
    if (!selectedImage || sending || imageSendInFlight.current) return;
    imageSendInFlight.current = true;
    try {
      if (await onSendMedia({ ...selectedImage, caption: buildChatImageCaption(imageDescription) })) {
        setSelectedImage(null);
        setImageDescription("");
      }
    } finally {
      imageSendInFlight.current = false;
    }
  }

  async function handleSubmit() {
    const body = draft.trim();
    if (!canSend || textSendInFlight.current) {
      return;
    }

    if (editing) {
      onSubmitEdit(editing.messageId, body);
      return;
    }

    textSendInFlight.current = true;
    try {
      if (await onSendText(body)) {
        setDraft((current) => current === draft ? "" : current);
      }
    } finally {
      textSendInFlight.current = false;
    }
  }

  // ---- gravando: cronometro + descartar + enviar (sem caixa de texto) ----
  if (recorder.recording) {
    const clock = formatAudioClock(recorder.elapsedSeconds);
    const spoken = formatAudioDuration(recorder.elapsedSeconds) || "menos de um segundo";

    return (
      <View
        accessibilityRole="toolbar"
        accessibilityLabel="Gravando mensagem de áudio"
        className="flex-row items-center gap-3 border-t border-[#353534] bg-[#111214] px-4 py-3"
      >
        <Pressable
          accessible
          accessibilityRole="button"
          accessibilityLabel="Descartar gravação"
          accessibilityHint="Cancela o áudio sem enviar"
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          className="h-12 w-12 items-center justify-center rounded-full bg-[#1D1F24]"
          onPress={() => {
            speak("Descartar gravação");
            void recorder.cancel();
          }}
        >
          <Ionicons
            name="trash-outline"
            size={24}
            color="#FF6B6B"
            importantForAccessibility="no"
          />
        </Pressable>

        <View
          accessible
          accessibilityLiveRegion="polite"
          accessibilityLabel={`Gravando há ${spoken}. Limite de ${MAX_AUDIO_DURATION_SECONDS} segundos`}
          className="h-12 flex-1 flex-row items-center gap-3 rounded-[20px] bg-[#1D1F24] px-4"
        >
          <View className="h-3 w-3 rounded-full bg-[#FF2D73]" />
          <Text className="text-[16px] font-bold text-white">{clock}</Text>
          <Text className="text-[13px] text-[#8B8C98]">
            / {formatAudioClock(MAX_AUDIO_DURATION_SECONDS)}
          </Text>
        </View>

        <Pressable
          accessible
          accessibilityRole="button"
          accessibilityLabel="Parar e enviar áudio"
          accessibilityHint={`Finaliza a gravação de ${spoken} e envia`}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          className="h-12 w-12 items-center justify-center rounded-full bg-[#EAEA00]"
          onPress={() => {
            speak("Parar e enviar áudio");
            void recorder.stop();
          }}
        >
          <Ionicons name="send" size={20} color="#686800" importantForAccessibility="no" />
        </Pressable>
      </View>
    );
  }

  // ---- texto (ou edicao) ------------------------------------------------
  return (
    <View className="border-t border-[#353534] bg-[#111214]">
      {selectedImage && !editing ? (
        <Modal visible animationType="none" onRequestClose={() => {
          if (!sending && !imageSendInFlight.current) { setSelectedImage(null); setImageDescription(""); }
        }}>
          <SafeAreaView className="flex-1 bg-[#111214]" accessibilityViewIsModal>
            <KeyboardAvoidingView className="flex-1" behavior={Platform.OS === "ios" ? "padding" : "height"}>
              <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ padding: 16 }}>
                <Text accessibilityRole="header" className="text-[20px] font-bold text-white">Enviar imagem</Text>
                <PostImage uri={selectedImage.uri} description={imageDescription} authorName="você" authToken={null} />
                <Text className="mt-3 font-bold text-white">Descrição da imagem (opcional)</Text>
                <Text className="mt-1 text-[#CAC3D8]">Conte o que aparece para quem não pode ver. A descrição será enviada junto da imagem.</Text>
                <TextInput
                  accessibilityLabel="Descrição da imagem"
                  accessibilityHint="Opcional. Até 240 caracteres. Enviada junto da imagem e lida por voz."
                  className="mt-2 min-h-[80px] rounded-xl border border-[#494455] p-3 text-white"
                  editable={!sending}
                  maxLength={CHAT_IMAGE_DESCRIPTION_MAX_LENGTH}
                  multiline
                  onChangeText={setImageDescription}
                  placeholder="Ex.: Duas pessoas conversando em um parque."
                  placeholderTextColor="#909099"
                  value={imageDescription}
                />
                <Text className="mt-1 text-right text-[#CAC3D8]">{imageDescription.length} / {CHAT_IMAGE_DESCRIPTION_MAX_LENGTH}</Text>
                <View className="mt-2 flex-row justify-between">
                  <Pressable accessibilityRole="button" accessibilityLabel="Remover imagem selecionada"
                    accessibilityHint="Descarta a imagem e sua descrição. O texto da mensagem permanece."
                    disabled={sending} accessibilityState={{ disabled: sending }} className="min-h-[44px] justify-center"
                    onPress={() => { setSelectedImage(null); setImageDescription(""); }}>
                    <Text className="font-bold text-[#FF8A8A]">Remover imagem</Text>
                  </Pressable>
                  <Pressable accessibilityRole="button" accessibilityLabel="Enviar imagem selecionada"
                    accessibilityHint="Envia a imagem com a descrição, se preenchida."
                    disabled={sending} accessibilityState={{ disabled: sending, busy: sending }} className="min-h-[44px] justify-center px-3"
                    onPress={() => { void sendSelectedImage(); }}>
                    <Text className="font-bold text-[#EAEA00]">{sending ? "Enviando…" : "Enviar imagem"}</Text>
                  </Pressable>
                </View>
              </ScrollView>
            </KeyboardAvoidingView>
          </SafeAreaView>
        </Modal>
      ) : null}
      {editing ? (
        <View className="flex-row items-center gap-2 border-b border-[#353534] px-4 py-2">
          <Ionicons
            name="pencil-outline"
            size={18}
            color="#EAEA00"
            importantForAccessibility="no"
          />
          <Text
            accessible
            accessibilityRole="text"
            accessibilityLabel="Editando mensagem. Altere o texto e toque em confirmar."
            accessibilityLiveRegion="polite"
            className="flex-1 text-[13px] font-bold text-[#EAEA00]"
          >
            Editando mensagem
          </Text>
          <Pressable
            accessible
            accessibilityRole="button"
            accessibilityLabel="Cancelar edição"
            accessibilityHint="Descarta a alteração e volta a escrever uma mensagem nova"
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            className="h-9 w-9 items-center justify-center rounded-full bg-[#1D1F24]"
            onPress={onCancelEdit}
          >
            <Ionicons name="close" size={18} color="#CAC3D8" importantForAccessibility="no" />
          </Pressable>
        </View>
      ) : null}

      <View
        accessibilityRole="toolbar"
        accessibilityLabel={editing ? "Editar mensagem" : "Escrever mensagem"}
        className="flex-row items-end gap-2 px-4 py-3"
      >
        {!editing ? (
          <>
            <Pressable
              accessible
              accessibilityRole="button"
              accessibilityLabel="Enviar imagem"
              accessibilityHint="Escolhe entre tirar uma foto ou abrir a galeria"
              accessibilityState={{ disabled: sending }}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              className="h-12 w-12 items-center justify-center rounded-full bg-[#1D1F24]"
              disabled={sending}
              onPress={() => {
                speak("Enviar imagem");
                setImageSourceVisible(true);
              }}
            >
              <Ionicons name="image" size={24} color="#CAC3D8" importantForAccessibility="no" />
            </Pressable>

            <Pressable
              accessible
              accessibilityRole="button"
              accessibilityLabel="Gravar mensagem de áudio"
              accessibilityHint={`Toque para começar a gravar. Duração máxima de ${MAX_AUDIO_DURATION_SECONDS} segundos`}
              accessibilityState={{ disabled: sending }}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              className="h-12 w-12 items-center justify-center rounded-full bg-[#1D1F24]"
              disabled={sending}
              onPress={() => {
                speak("Gravar mensagem de áudio");
                void recorder.start();
              }}
            >
              <Ionicons name="mic" size={24} color="#CAC3D8" importantForAccessibility="no" />
            </Pressable>
          </>
        ) : null}

        <TextInput
          accessibilityLabel={editing ? "Novo texto da mensagem" : "Mensagem"}
          accessibilityHint={
            editing ? "Altere o texto e toque em confirmar" : "Digite o texto e toque em enviar"
          }
          className="max-h-28 flex-1 rounded-[20px] bg-[#1D1F24] px-4 py-3 text-[16px] text-white"
          cursorColor="#7C4DFF"
          editable={!sending}
          multiline
          onChangeText={setDraft}
          onFocus={() => speak(editing ? "Editar mensagem" : "Escrever mensagem")}
          placeholder={editing ? "Edite a mensagem..." : "Escreva uma mensagem..."}
          placeholderTextColor="#8B8C98"
          value={draft}
        />

        <Pressable
          accessible
          accessibilityRole="button"
          accessibilityLabel={editing ? "Confirmar edição" : "Enviar mensagem"}
          accessibilityHint={
            editing
              ? "Salva o novo texto da mensagem"
              : "Envia a mensagem para a conversa"
          }
          accessibilityState={{ disabled: !canSend, busy: sending }}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          className={`h-12 w-12 items-center justify-center rounded-full ${
            canSend ? "bg-[#EAEA00]" : "bg-[#2A2B30]"
          }`}
          disabled={!canSend}
          onPress={() => {
            speak(editing ? "Confirmar edição" : "Enviar mensagem");
            void handleSubmit();
          }}
        >
          {sending ? (
            <ActivityIndicator color="#686800" size="small" />
          ) : (
            <Ionicons
              name={editing ? "checkmark" : "send"}
              size={editing ? 24 : 20}
              color={canSend ? "#686800" : "#6B6C78"}
              importantForAccessibility="no"
            />
          )}
        </Pressable>
      </View>

      <ActionSheet
        onClose={() => setImageSourceVisible(false)}
        options={[
          {
            key: "camera",
            label: "Tirar foto",
            hint: "Abre a câmera do celular",
            icon: "camera-outline",
            onPress: () => {
              speak("Tirar foto");
              void pickImage("camera");
            },
          },
          {
            key: "library",
            label: "Escolher da galeria",
            hint: "Abre as fotos salvas no celular",
            icon: "images-outline",
            onPress: () => {
              speak("Escolher da galeria");
              void pickImage("library");
            },
          },
        ]}
        title="Enviar imagem"
        visible={imageSourceVisible}
      />
    </View>
  );
}
