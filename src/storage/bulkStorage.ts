/**
 * Camada de storage NAO SENSIVEL, para estado local volumoso.
 *
 * Motivo: `expo-secure-store` avisa (SecureStore.js) que valores acima de
 * **2048 bytes** podem nao ser gravados e que uma SDK futura vai lancar erro.
 * O estado de descoberta de matches guarda ate 500 UUIDs (~19 KB), o que
 * estoura esse limite com folga assim que o escopo da sessao passa a ser
 * estavel (antes disso a lista era zerada a cada refresh e o problema ficava
 * escondido).
 *
 * Nada aqui e segredo: sao apenas ids de perfis ja vistos. Tokens continuam
 * exclusivamente no `tokenStorage`/SecureStore.
 */
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Platform } from "react-native";

const webStorageFallback = (() => {
  if (Platform.OS !== "web") {
    return null;
  }

  try {
    return globalThis.localStorage;
  } catch {
    return null;
  }
})();

export async function getBulkItem(key: string): Promise<string | null> {
  try {
    if (webStorageFallback) {
      return webStorageFallback.getItem(key);
    }

    return await AsyncStorage.getItem(key);
  } catch {
    return null;
  }
}

export async function setBulkItem(key: string, value: string): Promise<void> {
  try {
    if (webStorageFallback) {
      webStorageFallback.setItem(key, value);
      return;
    }

    await AsyncStorage.setItem(key, value);
  } catch {
    // Estado local de conveniencia: uma falha de escrita nunca pode derrubar
    // o fluxo do usuario.
  }
}

export async function removeBulkItem(key: string): Promise<void> {
  try {
    if (webStorageFallback) {
      webStorageFallback.removeItem(key);
      return;
    }

    await AsyncStorage.removeItem(key);
  } catch {
    // Idem: melhor deixar a chave orfa do que quebrar o logout.
  }
}
