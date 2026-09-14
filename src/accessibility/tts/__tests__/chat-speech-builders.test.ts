/**
 * Builders de fala do chat: sequencia de entrada na lista de conversas e na
 * conversa, e leitura de cada mensagem (tipo so quando nao e texto).
 */
import type { ChatMessageResponse, ConversationSummaryResponse } from "../../../types/chat";
import {
  buildChatMessageSpeech,
  buildConversationEntrySpeech,
  buildConversationListEntrySpeech,
  buildIncomingMessagesSpeech,
} from "../speech-builders";

const TODAY_14_29 = (() => {
  const date = new Date();
  date.setHours(14, 29, 0, 0);
  return date.toISOString();
})();

const TODAY_14_30 = (() => {
  const date = new Date();
  date.setHours(14, 30, 0, 0);
  return date.toISOString();
})();

function conversation(
  overrides: Partial<ConversationSummaryResponse> = {}
): ConversationSummaryResponse {
  return {
    conversationId: "c1",
    matchId: null,
    otherUserId: null,
    otherUserProfileId: null,
    otherUserName: "Marina",
    otherUserPhoto: null,
    lastMessage: {
      id: "m1",
      type: "TEXT",
      preview: "Oi, tudo bem?",
      fromMe: false,
      createdAt: TODAY_14_29,
    },
    unreadCount: 2,
    lastMessageAt: TODAY_14_29,
    ...overrides,
  };
}

function message(overrides: Partial<ChatMessageResponse> = {}): ChatMessageResponse {
  return {
    id: "m1",
    conversationId: "c1",
    senderUserProfileId: "p2",
    senderName: "Marina",
    fromMe: false,
    type: "TEXT",
    body: "Oi, tudo bem?",
    mediaUrl: null,
    mediaContentType: null,
    mediaSizeBytes: null,
    mediaDurationSeconds: null,
    createdAt: TODAY_14_29,
    deliveredAt: null,
    readAt: null,
    editedAt: null,
    deletedAt: null,
    ...overrides,
  };
}

describe("buildConversationListEntrySpeech", () => {
  it("fala nome da tela, total de conversas pendentes e pessoa + ultima mensagem", () => {
    const parts = buildConversationListEntrySpeech([
      conversation(),
      conversation({
        conversationId: "c2",
        otherUserName: "João",
        unreadCount: 0,
        lastMessage: { id: "m2", type: "TEXT", preview: "Até mais", fromMe: true, createdAt: TODAY_14_29 },
      }),
      conversation({
        conversationId: "c3",
        otherUserName: "Ana",
        unreadCount: 1,
        lastMessage: { id: "m3", type: "IMAGE", preview: "Imagem", fromMe: false, createdAt: TODAY_14_29 },
      }),
    ]);

    expect(parts).toEqual([
      "Conversas",
      "2 conversas com mensagens não lidas",
      "Marina: Oi, tudo bem?",
      "Ana: Imagem",
    ]);
  });

  it("usa singular para uma unica conversa pendente", () => {
    expect(buildConversationListEntrySpeech([conversation()])[1]).toBe(
      "1 conversa com mensagem não lida"
    );
  });

  it("avisa quando nao ha pendencia e quando nao ha conversas", () => {
    expect(buildConversationListEntrySpeech([conversation({ unreadCount: 0 })])).toEqual([
      "Conversas",
      "Nenhuma conversa com mensagem não lida",
    ]);
    expect(buildConversationListEntrySpeech([])).toEqual([
      "Conversas",
      "Você ainda não tem conversas",
    ]);
  });

  it("nunca fala id: pessoa sem nome recebe rotulo generico", () => {
    expect(buildConversationListEntrySpeech([conversation({ otherUserName: null })])[2]).toBe(
      "Pessoa sem nome: Oi, tudo bem?"
    );
  });
});

describe("buildChatMessageSpeech", () => {
  it("texto: so horario e conteudo, sem dizer que e texto", () => {
    expect(buildChatMessageSpeech(message())).toBe("hoje às 14:29. Oi, tudo bem?");
  });

  it("imagem: tipo, horario e legenda", () => {
    expect(
      buildChatMessageSpeech(message({ type: "IMAGE", body: "olha isso", mediaUrl: "/x" }))
    ).toBe("Imagem, hoje às 14:29. Legenda: olha isso");
    expect(buildChatMessageSpeech(message({ type: "IMAGE", body: null, mediaUrl: "/x" }))).toBe(
      "Imagem, hoje às 14:29"
    );
  });

  it("audio: duracao e horario", () => {
    expect(
      buildChatMessageSpeech(
        message({ type: "AUDIO", body: null, mediaUrl: "/x", mediaDurationSeconds: 12 })
      )
    ).toBe("Mensagem de áudio de 12 segundos, hoje às 14:29");
  });

  it("apagada: so aviso e horario", () => {
    expect(buildChatMessageSpeech(message({ deletedAt: TODAY_14_30, body: null }))).toBe(
      "Mensagem apagada, hoje às 14:29"
    );
  });
});

describe("buildConversationEntrySpeech", () => {
  it("fala pessoa, total nao lido e cada mensagem em ordem cronologica", () => {
    const parts = buildConversationEntrySpeech(
      "Marina",
      [
        message({ id: "m2", type: "IMAGE", body: null, mediaUrl: "/x", createdAt: TODAY_14_30 }),
        message({ id: "m1", createdAt: TODAY_14_29 }),
      ],
      2
    );

    expect(parts).toEqual([
      "Conversa com Marina",
      "2 mensagens não lidas",
      "hoje às 14:29. Oi, tudo bem?",
      "Imagem, hoje às 14:30",
    ]);
  });

  it("fala o total do backend quando a pagina nao alcanca todas as pendentes", () => {
    expect(buildConversationEntrySpeech("Marina", [message()], 40)[1]).toBe(
      "40 mensagens não lidas"
    );
  });

  it("sem pendencia fala so pessoa e aviso", () => {
    expect(buildConversationEntrySpeech("Marina", [], 0)).toEqual([
      "Conversa com Marina",
      "Nenhuma mensagem não lida",
    ]);
  });
});

describe("buildIncomingMessagesSpeech", () => {
  it("avisa a chegada e le cada mensagem", () => {
    expect(buildIncomingMessagesSpeech([message()], "Marina")).toEqual([
      "Nova mensagem de Marina",
      "hoje às 14:29. Oi, tudo bem?",
    ]);
    expect(
      buildIncomingMessagesSpeech([message(), message({ id: "m2", body: "E aí?" })], "Marina")[0]
    ).toBe("2 novas mensagens de Marina");
  });

  it("lista vazia nao fala nada", () => {
    expect(buildIncomingMessagesSpeech([], "Marina")).toEqual([]);
  });
});
