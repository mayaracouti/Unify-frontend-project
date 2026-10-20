import type { ChatMessageResponse } from "../../types/chat";
import {
  buildReplyQuote,
  describeReplyForSpeech,
  describeReplyQuote,
  syncReplyQuotes,
} from "../chatReply";

function message(overrides: Partial<ChatMessageResponse>): ChatMessageResponse {
  return {
    id: "m1",
    conversationId: "c1",
    senderUserProfileId: "p-bruno",
    senderName: "Bruno Lima",
    fromMe: false,
    type: "TEXT",
    body: "bora no cinema sábado?",
    mediaUrl: null,
    mediaContentType: null,
    mediaSizeBytes: null,
    mediaDurationSeconds: null,
    createdAt: "2026-10-20T12:00:00Z",
    deliveredAt: null,
    readAt: null,
    editedAt: null,
    deletedAt: null,
    replyTo: null,
    ...overrides,
  };
}

it("builds the same quote shape the backend returns", () => {
  expect(buildReplyQuote(message({ body: `  ${"a".repeat(200)}  ` }))).toEqual({
    id: "m1",
    senderUserProfileId: "p-bruno",
    senderName: "Bruno Lima",
    fromMe: false,
    type: "TEXT",
    preview: "a".repeat(120),
    mediaDurationSeconds: null,
    deleted: false,
  });

  const deleted = buildReplyQuote(message({ body: null, deletedAt: "2026-10-20T12:05:00Z" }));
  expect(deleted.deleted).toBe(true);
  expect(deleted.preview).toBeNull();
});

it("describes media quotes without leaking the accessibility description as a caption", () => {
  expect(
    describeReplyQuote(
      buildReplyQuote(message({ type: "IMAGE", body: "Descrição da imagem: Um gato" }))
    )
  ).toEqual({ icon: "image-outline", text: "Foto" });
  expect(
    describeReplyQuote(buildReplyQuote(message({ type: "IMAGE", body: "olha isso" }))).text
  ).toBe("olha isso");
  expect(
    describeReplyQuote(
      buildReplyQuote(message({ type: "AUDIO", body: null, mediaDurationSeconds: 12 }))
    )
  ).toEqual({ icon: "mic-outline", text: "Áudio (0:12)" });
});

it("speaks whose message is being answered", () => {
  expect(describeReplyForSpeech(buildReplyQuote(message({})), "Bruno")).toBe(
    "Em resposta à mensagem de Bruno: bora no cinema sábado?"
  );
  expect(describeReplyForSpeech(buildReplyQuote(message({ fromMe: true })))).toBe(
    "Em resposta à sua mensagem: bora no cinema sábado?"
  );
  expect(
    describeReplyForSpeech(
      buildReplyQuote(message({ type: "AUDIO", body: null, mediaDurationSeconds: 5 })),
      "Bruno"
    )
  ).toBe("Em resposta à mensagem de Bruno: Mensagem de áudio de 5 segundos");
});

it("updates quotes when the original is edited or deleted, keeping untouched objects", () => {
  const original = message({ id: "orig" });
  const reply = message({
    id: "reply",
    fromMe: true,
    body: "bora!",
    replyTo: buildReplyQuote(original),
  });
  const loose = message({ id: "loose", body: "solta" });
  const list = [reply, loose, original];

  expect(syncReplyQuotes(list, [original])).toBe(list);

  const deletedOriginal = { ...original, body: null, deletedAt: "2026-10-20T12:10:00Z" };
  const synced = syncReplyQuotes(list, [deletedOriginal]);

  expect(synced).not.toBe(list);
  expect(synced[0].replyTo).toMatchObject({ id: "orig", deleted: true, preview: null });
  expect(synced[0].body).toBe("bora!");
  expect(synced[1]).toBe(loose);
});
