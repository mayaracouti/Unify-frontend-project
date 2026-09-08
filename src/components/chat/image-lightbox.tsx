import Ionicons from "@expo/vector-icons/Ionicons";
import { Modal, Pressable, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { AuthenticatedRemoteImage } from "../profile/authenticated-remote-image";

/**
 * Imagem do chat em tela cheia. Fecha pelo botao, tocando na imagem ou com o
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
  return (
    <Modal
      animationType="fade"
      onRequestClose={onClose}
      statusBarTranslucent
      visible={Boolean(uri)}
    >
      <View className="flex-1 bg-black">
        {/* A imagem nao e touchable: o Pressable pai e o unico alvo de toque aqui. */}
        <Pressable
          accessible={false}
          className="flex-1"
          onPress={onClose}
        >
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
        </Pressable>

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
            onPress={onClose}
          >
            <Ionicons name="close" size={26} color="#FFFFFF" importantForAccessibility="no" />
          </Pressable>
        </SafeAreaView>
      </View>
    </Modal>
  );
}
