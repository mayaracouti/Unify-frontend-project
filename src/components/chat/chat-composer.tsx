import Ionicons from "@expo/vector-icons/Ionicons";
import * as ImagePicker from "expo-image-picker";
import { useState } from "react";
import { ActivityIndicator, Pressable, TextInput, View } from "react-native";

import type { ChatMediaUpload } from "../../types/chat";
import { showGlobalToast } from "../../utils/globalToast";
import { AudioRecorderButton } from "./audio-recorder-button";

export function ChatComposer({
  onSendMedia,
  onSendText,
  sending,
}: {
  onSendMedia: (media: ChatMediaUpload) => void;
  onSendText: (body: string) => void;
  sending: boolean;
}) {
  const [draft, setDraft] = useState("");
  const canSend = draft.trim().length > 0 && !sending;

  async function pickImage() {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();

    if (!permission.granted) {
      showGlobalToast({
        title: "Galeria bloqueada",
        message: "Autorize o acesso às fotos nos ajustes do celular para enviar imagens.",
        variant: "warning",
      });
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"], // SDK 54: array de strings (MediaTypeOptions esta depreciado)
      quality: 0.8,
      allowsEditing: false,
    });

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

  return (
    <View
      accessibilityRole="toolbar"
      accessibilityLabel="Escrever mensagem"
      className="flex-row items-end gap-2 border-t border-[#353534] bg-[#111214] px-4 py-3"
    >
      <Pressable
        accessible
        accessibilityRole="button"
        accessibilityLabel="Enviar imagem"
        accessibilityHint="Abre a galeria de fotos do celular"
        accessibilityState={{ disabled: sending }}
        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        className="h-12 w-12 items-center justify-center rounded-full bg-[#1D1F24]"
        disabled={sending}
        onPress={() => {
          void pickImage();
        }}
      >
        <Ionicons name="image" size={24} color="#CAC3D8" importantForAccessibility="no" />
      </Pressable>

      <AudioRecorderButton disabled={sending} onRecorded={onSendMedia} />

      <TextInput
        accessibilityLabel="Mensagem"
        accessibilityHint="Digite o texto e toque em enviar"
        className="max-h-28 flex-1 rounded-[20px] bg-[#1D1F24] px-4 py-3 text-[16px] text-white"
        cursorColor="#7C4DFF"
        editable={!sending}
        multiline
        onChangeText={setDraft}
        placeholder="Escreva uma mensagem..."
        placeholderTextColor="#8B8C98"
        value={draft}
      />

      <Pressable
        accessible
        accessibilityRole="button"
        accessibilityLabel="Enviar mensagem"
        accessibilityState={{ disabled: !canSend, busy: sending }}
        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        className={`h-12 w-12 items-center justify-center rounded-full ${
          canSend ? "bg-[#EAEA00]" : "bg-[#2A2B30]"
        }`}
        disabled={!canSend}
        onPress={() => {
          const body = draft.trim();
          if (!body) {
            return;
          }
          setDraft("");
          onSendText(body);
        }}
      >
        {sending ? (
          <ActivityIndicator color="#686800" size="small" />
        ) : (
          <Ionicons
            name="send"
            size={20}
            color={canSend ? "#686800" : "#6B6C78"}
            importantForAccessibility="no"
          />
        )}
      </Pressable>
    </View>
  );
}
