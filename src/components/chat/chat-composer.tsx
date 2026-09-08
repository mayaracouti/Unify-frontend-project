import Ionicons from "@expo/vector-icons/Ionicons";
import * as ImagePicker from "expo-image-picker";
import { useEffect, useState } from "react";
import { ActivityIndicator, Pressable, Text, TextInput, View } from "react-native";

import { MAX_AUDIO_DURATION_SECONDS, useAudioRecorder } from "../../hooks/useAudioRecorder";
import type { ChatMediaUpload } from "../../types/chat";
import { formatAudioClock, formatAudioDuration } from "../../utils/chatFormatting";
import { showGlobalToast } from "../../utils/globalToast";
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
  onSendMedia: (media: ChatMediaUpload) => void;
  onSendText: (body: string) => void;
  onSubmitEdit: (messageId: string, body: string) => void;
  sending: boolean;
}) {
  const [draft, setDraft] = useState("");
  const [imageSourceVisible, setImageSourceVisible] = useState(false);
  const recorder = useAudioRecorder({ onRecorded: onSendMedia });

  // Entrar em edicao carrega o texto atual; sair limpa o rascunho.
  useEffect(() => {
    setDraft(editing ? editing.body : "");
  }, [editing]);

  const trimmed = draft.trim();
  const canSend =
    trimmed.length > 0 && !sending && (!editing || trimmed !== editing.body.trim());

  async function pickImage(source: ImageSource) {
    setImageSourceVisible(false);

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

    onSendMedia({
      type: "IMAGE",
      uri: asset.uri,
      name: asset.fileName ?? `imagem-${Date.now()}.jpg`,
      mimeType: asset.mimeType ?? "image/jpeg",
    });
  }

  function handleSubmit() {
    const body = draft.trim();
    if (!body) {
      return;
    }

    if (editing) {
      onSubmitEdit(editing.messageId, body);
      return;
    }

    setDraft("");
    onSendText(body);
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
              onPress={() => setImageSourceVisible(true)}
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
          placeholder={editing ? "Edite a mensagem..." : "Escreva uma mensagem..."}
          placeholderTextColor="#8B8C98"
          value={draft}
        />

        <Pressable
          accessible
          accessibilityRole="button"
          accessibilityLabel={editing ? "Confirmar edição" : "Enviar mensagem"}
          accessibilityState={{ disabled: !canSend, busy: sending }}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          className={`h-12 w-12 items-center justify-center rounded-full ${
            canSend ? "bg-[#EAEA00]" : "bg-[#2A2B30]"
          }`}
          disabled={!canSend}
          onPress={handleSubmit}
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
              void pickImage("camera");
            },
          },
          {
            key: "library",
            label: "Escolher da galeria",
            hint: "Abre as fotos salvas no celular",
            icon: "images-outline",
            onPress: () => {
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
