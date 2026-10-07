import { stripGenericErrorPrefix } from "../client";

describe("stripGenericErrorPrefix", () => {
  it("remove o prefixo tecnico dos codigos genericos", () => {
    expect(
      stripGenericErrorPrefix("Conflito ao processar recurso: Não é possível enviar mensagens para este usuário")
    ).toBe("Não é possível enviar mensagens para este usuário");
    expect(stripGenericErrorPrefix("Requisicao invalida: Informe a duração do áudio em segundos")).toBe(
      "Informe a duração do áudio em segundos"
    );
  });

  it("mantem mensagens com prefixo proprio ou sem detalhe", () => {
    expect(stripGenericErrorPrefix("Usuário já existe: Email já cadastrado")).toBe(
      "Usuário já existe: Email já cadastrado"
    );
    expect(stripGenericErrorPrefix("Conflito ao processar recurso: ")).toBe("Conflito ao processar recurso: ");
    expect(stripGenericErrorPrefix("Recurso não encontrado")).toBe("Recurso não encontrado");
  });
});
