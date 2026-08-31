/**
 * Anuncios para o leitor de tela DO SISTEMA (TalkBack/VoiceOver).
 *
 * Canal separado do servico de TTS in-app (`src/accessibility/tts`): o `speak()`
 * do TTS e silenciado quando o leitor de tela nativo esta ligado, e
 * `AccessibilityInfo.announceForAccessibility` so produz som quando ele esta
 * ligado. Os dois nunca falam ao mesmo tempo — nao ha anuncio duplicado.
 *
 * Todos os textos ficam centralizados aqui para nao espalhar string solta pelas
 * telas e para manter a voz do produto consistente (pt-BR).
 */
import { AccessibilityInfo } from "react-native";

/**
 * Anuncia uma mensagem para o leitor de tela.
 * Seguro de chamar sempre: quando nao ha leitor de tela ativo, o sistema ignora.
 */
export function announceForAccessibility(message: string) {
  const normalized = message?.trim();

  if (!normalized) {
    return;
  }

  AccessibilityInfo.announceForAccessibility(normalized);
}

export const accessibilityAnnouncements = {
  newMutualMatch: (name: string) =>
    `Novo match com ${name}. Vocês demonstraram interesse mútuo. Agora dá para conversar.`,

  interestSent: (name: string) =>
    `Interesse enviado para ${name}. Se a pessoa também curtir você, o match aparece na aba Encontros.`,

  profileDeclined: (name: string) =>
    `Perfil de ${name} recusado. Mostrando o próximo perfil.`,

  queueEnded: () =>
    "Você chegou ao fim da lista de perfis. Use o botão Ver novamente para buscar novos perfis.",

  queueLoading: () => "Buscando perfis compatíveis.",

  profileShown: (name: string, age: number | null, distanceKm: number | null) => {
    const parts = [`Perfil de ${name}`];

    if (typeof age === "number" && age > 0) {
      parts.push(`${age} anos`);
    }

    if (typeof distanceKm === "number") {
      parts.push(`a ${Math.round(distanceKm)} quilômetros`);
    }

    return `${parts.join(", ")}.`;
  },

  photoChanged: (index: number, total: number) => `Foto ${index} de ${total}.`,

  messageSent: () => "Mensagem enviada.",
  messageSendFailed: () => "Não foi possível enviar a mensagem. Tente novamente.",
  newMessages: (count: number, senderName: string) =>
    count === 1
      ? `Nova mensagem de ${senderName}.`
      : `${count} novas mensagens de ${senderName}.`,

  recordingStarted: () => "Gravação de áudio iniciada. Toque em parar quando terminar.",
  recordingStopped: (seconds: number) =>
    `Gravação finalizada com ${seconds} segundos. Toque em enviar para mandar o áudio.`,
  recordingCancelled: () => "Gravação cancelada.",

  audioPlaybackStarted: () => "Reproduzindo áudio.",
  audioPlaybackStopped: () => "Áudio pausado.",
};
