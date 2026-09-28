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

/**
 * "Tem áudio de apresentação de N segundos. Use o botão Ouvir apresentação."
 * Nulo sem audio. Compartilhado com a fala do TTS (`buildPublicProfileSpeech`).
 */
export function presentationAudioNotice(seconds: number | null | undefined): string | null {
  if (typeof seconds !== "number" || !Number.isFinite(seconds) || seconds <= 0) {
    return null;
  }

  const rounded = Math.round(seconds);

  return `Tem áudio de apresentação de ${rounded} ${
    rounded === 1 ? "segundo" : "segundos"
  }. Use o botão Ouvir apresentação.`;
}

/**
 * Perfil travado (conta privada que eu nao sigo) sem nenhuma parte visivel:
 * a fala e os rotulos dizem so isto. Compartilhado com o TTS.
 */
export const LOCKED_PROFILE_NOTICE = "Conta privada. Siga para ver o perfil.";

/**
 * Perfil travado que ainda mostra alguma parte (match mutuo: dados de match
 * que o dono nao escondeu, idade/distancia).
 */
export const LOCKED_PROFILE_PARTIAL_NOTICE = "Conta privada. Siga para ver o perfil completo.";

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

  /**
   * Idade/distancia nulas (ocultadas pelo dono ou sem localizacao) sao
   * omitidas — nunca "0 anos". Com audio de apresentacao, avisa que ele existe
   * e como ouvir (nao ha autoplay). Perfil travado (conta privada) nunca fala
   * de audio e fecha com o aviso de conta privada ("perfil completo" quando
   * ainda ha partes visiveis — `hasVisibleParts`, idade ou distancia).
   */
  profileShown: (
    name: string,
    age: number | null,
    distanceKm: number | null,
    presentationAudioSeconds?: number | null,
    locked?: boolean,
    hasVisibleParts?: boolean
  ) => {
    const parts = [`Perfil de ${name}`];

    if (typeof age === "number" && age > 0) {
      parts.push(`${age} anos`);
    }

    if (typeof distanceKm === "number" && Number.isFinite(distanceKm)) {
      parts.push(`a ${Math.round(distanceKm)} quilômetros`);
    }

    if (locked) {
      const partial = hasVisibleParts === true || parts.length > 1;
      return `${parts.join(", ")}. ${partial ? LOCKED_PROFILE_PARTIAL_NOTICE : LOCKED_PROFILE_NOTICE}`;
    }

    const audioNotice = presentationAudioNotice(presentationAudioSeconds);

    return audioNotice ? `${parts.join(", ")}. ${audioNotice}` : `${parts.join(", ")}.`;
  },

  photoChanged: (index: number, total: number) => `Foto ${index} de ${total}.`,

  messageSent: () => "Mensagem enviada.",
  messageSendFailed: () => "Não foi possível enviar a mensagem. Tente novamente.",
  messageEdited: () => "Mensagem editada.",
  messageDeleted: () => "Mensagem apagada.",
  newMessages: (count: number, senderName: string) =>
    count === 1
      ? `Nova mensagem de ${senderName}.`
      : `${count} novas mensagens de ${senderName}.`,

  recordingStarted: () => "Gravação de áudio iniciada. Toque em parar quando terminar.",
  recordingStopped: (seconds: number) =>
    `Gravação finalizada com ${seconds} segundos. Enviando o áudio.`,
  recordingCancelled: () => "Gravação cancelada.",

  audioPlaybackStarted: () => "Reproduzindo áudio.",
  audioPlaybackStopped: () => "Áudio pausado.",

  locationPermissionRequired: () =>
    "Localização desativada. A descoberta de perfis precisa da localização do aparelho. Use o botão Ativar localização.",

  locationPermissionBlocked: () =>
    "Localização bloqueada nas configurações do aparelho. Use o botão Abrir configurações do celular para liberar o acesso.",

  locationPermissionGranted: () =>
    "Localização ativada. Buscando perfis compatíveis.",

  locationPermissionDenied: () =>
    "Permissão de localização negada. Sem ela não é possível descobrir novos perfis.",

  // --- Semana 03: comunidade, denúncia, seguir, feed pessoal ---
  communityCreated: () => "Comunidade criada com sucesso.",
  communityUpdated: () => "Alterações da comunidade salvas.",
  communityPostCreated: () => "Publicação criada com sucesso.",
  commentPublished: () => "Comentário publicado.",
  commentDeleted: () => "Comentário excluído.",
  memberRoleUpdated: (roleLabel: string) => `Cargo atualizado para ${roleLabel}.`,
  joinRequestApproved: (name: string) => `Entrada de ${name} aprovada.`,
  joinRequestDeclined: (name: string) => `Entrada de ${name} recusada.`,
  moreItemsLoaded: (count: number, noun: string) =>
    count === 1 ? `1 ${noun} carregada.` : `${count} ${noun} carregadas.`,

  reportSent: () => "Denúncia enviada. Nossa equipe irá analisar.",
  reportDuplicate: () =>
    "Você já denunciou este perfil ou publicação e a análise está em andamento.",

  followStarted: (name: string) => `Agora você segue ${name}.`,
  followStopped: (name: string) => `Você deixou de seguir ${name}.`,

  personalPostCreated: () => "Publicação criada com sucesso.",
  personalPostUpdated: () => "Publicação atualizada.",
  personalPostDeleted: () => "Publicação excluída.",
  postLiked: () => "Publicação curtida.",
  postUnliked: () => "Curtida removida.",
  feedRefreshed: (newCount: number) =>
    newCount === 1
      ? "Feed atualizado. 1 publicação nova."
      : `Feed atualizado. ${newCount} publicações novas.`,
  feedEmpty: () =>
    "Ainda não há publicações para mostrar. Assim que alguém publicar, elas aparecem aqui.",

  communityJoined: (name: string) =>
    `Você entrou na comunidade ${name}. Agora dá para publicar, curtir e comentar.`,
  communityLeft: (name: string) => `Você saiu da comunidade ${name}.`,
  communityPostDeleted: () => "Publicação excluída da comunidade.",

  // --- Semana 04: privacidade, bloqueio e audio de apresentacao ---
  privacySettingSaved: (label: string, enabled: boolean) =>
    `${label} ${enabled ? "ativado" : "desativado"}. Preferência salva.`,
  feedVisibilitySaved: (optionLabel: string) =>
    `Quem pode ver seus posts: ${optionLabel}. Preferência salva.`,
  profileFieldVisibilitySaved: (fieldLabel: string, visibilityLabel: string) =>
    `Quem vê ${fieldLabel}: ${visibilityLabel}. Preferência salva.`,
  allProfileFieldsVisibilitySaved: (visibilityLabel: string) =>
    `Quem vê todas as partes do seu perfil: ${visibilityLabel}. Preferência salva.`,
  privacySettingFailed: () =>
    "Não foi possível salvar a preferência de privacidade. A opção anterior foi mantida.",
  userBlocked: (name: string) =>
    `${name} foi bloqueado. Vocês não verão mais o perfil, as publicações nem poderão trocar mensagens.`,
  userUnblocked: (name: string) => `${name} foi desbloqueado.`,
  chatBlocked: () => "Não é possível enviar mensagens para este contato.",
  // --- Seguir com aprovacao ---
  followRequestSent: (name: string) => `Pedido para seguir enviado a ${name}.`,
  followRequestCanceled: () => "Pedido cancelado.",
  followRequestAccepted: (name: string) => `Pedido aceito. ${name} agora segue você.`,
  followRequestDeclined: () => "Pedido recusado.",
  /** Switch "Conta privada" (aprovar quem quer me seguir). */
  privateAccountSaved: (enabled: boolean) =>
    `Conta privada ${enabled ? "ativada" : "desativada"}. Preferência salva.`,
  followApprovalDisabled: (acceptedCount: number) =>
    acceptedCount <= 0
      ? "Conta privada desativada. Preferência salva."
      : acceptedCount === 1
        ? "Conta privada desativada. 1 pedido pendente foi aceito."
        : `Conta privada desativada. ${acceptedCount} pedidos pendentes foram aceitos.`,
  privatePosts: (name: string) =>
    `${name} só mostra publicações para seguidores. Siga para ver as postagens.`,

  presentationRecordingProgress: (seconds: number, maxSeconds: number) =>
    `${seconds} segundos gravados de ${maxSeconds}.`,
  presentationAudioSaved: () => "Áudio de apresentação salvo.",
  presentationAudioSaveFailed: () => "Não foi possível salvar o áudio. Tente novamente.",
  presentationAudioRemoved: () => "Áudio de apresentação removido.",
  presentationAudioRemoveFailed: () => "Não foi possível remover o áudio. Tente novamente.",
  microphonePermissionDenied: () =>
    "Microfone bloqueado. Use o botão Abrir configurações para liberar o acesso e gravar sua apresentação.",
};
