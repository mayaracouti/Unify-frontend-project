import Ionicons from "@expo/vector-icons/Ionicons";
import { Modal, Pressable, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useTTS } from "../../accessibility/tts";
import { splitPostSpeech } from "../../utils/personalPostContent";

import { AuthenticatedRemoteImage } from "../profile/authenticated-remote-image";

/**
 * Imagem do chat em tela cheia. Fecha pelo botao ou com o
 * botao voltar do Android (`onRequestClose`).
 */
export function ImageLightbox({
  accessibilityLabel,
  authToken,
  onClose,
  uri,
}: {
  accessibilityLabel: string;
  authToken: string | null;
  onClose: () => void;
  /** Nulo = fechado. */
  uri: string | null;
}) {
  const { speakSequence, stop } = useTTS();
  const close = () => { stop(); onClose(); };
  return (
    <Modal
      animationType="fade"
      onRequestClose={close}
      statusBarTranslucent
      visible={Boolean(uri)}
    >
      <View
        accessibilityViewIsModal
        importantForAccessibility="yes"
        className="flex-1 bg-black"
      >
        <View className="flex-1">
          {uri ? (
            <AuthenticatedRemoteImage
              accessibilityLabel={accessibilityLabel}
              authToken={authToken}
              className="h-full w-full"
              fallback={
                <View className="flex-1 items-center justify-center px-8">
                  <Ionicons name="image-outline" size={48} color="#CAC3D8" />
                  <Text className="mt-3 text-center text-[16px] font-semibold text-[#CAC3D8]">
                    Não foi possível carregar a imagem.
                  </Text>
                </View>
              }
              resizeMode="contain"
              uri={uri}
            />
          ) : null}
        </View>
        <SafeAreaView edges={["bottom"]} className="bg-black px-4 pb-3">
          <Text className="text-[14px] text-white">{accessibilityLabel}</Text>
          <Pressable accessibilityRole="button" accessibilityLabel="Ler descrição da imagem"
            accessibilityHint="Lê em voz alta o conteúdo informado junto da imagem"
            className="min-h-[44px] justify-center" onPress={() => speakSequence(splitPostSpeech(accessibilityLabel))}>
            <Text className="font-bold text-[#EAEA00]">Ler descrição</Text>
          </Pressable>
        </SafeAreaView>

        <SafeAreaView
          className="absolute left-0 right-0 top-0 flex-row justify-end px-4 pt-2"
          edges={["top"]}
          pointerEvents="box-none"
        >
          <Pressable
            accessible
            accessibilityRole="button"
            accessibilityLabel="Fechar imagem"
            accessibilityHint="Volta para a conversa"
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            className="h-11 w-11 items-center justify-center rounded-full bg-black/60"
            onPress={close}
          >
            <Ionicons name="close" size={26} color="#FFFFFF" importantForAccessibility="no" />
          </Pressable>
        </SafeAreaView>
      </View>
    </Modal>
  );
}
