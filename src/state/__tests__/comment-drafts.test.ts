import { clearCommentDrafts, getCommentDraft, saveCommentDraft } from "../comment-drafts";

beforeEach(clearCommentDrafts);

it("mantém rascunhos separados por usuário e publicação", () => {
  saveCommentDraft("ana", "post1", "Olá!");
  expect(getCommentDraft("ana", "post1")).toBe("Olá!");
  expect(getCommentDraft("bia", "post1")).toBe("");
  expect(getCommentDraft("ana", "post2")).toBe("");
});

it("remove após envio e limpa todos ao encerrar a sessão", () => {
  saveCommentDraft("ana", "post1", "Olá!");
  saveCommentDraft("ana", "post1", "");
  expect(getCommentDraft("ana", "post1")).toBe("");
  saveCommentDraft("ana", "post2", "Rascunho");
  clearCommentDrafts();
  expect(getCommentDraft("ana", "post2")).toBe("");
});
