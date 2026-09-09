import { decodeJwtPayload, getJwtSubject } from "../jwt";

function toBase64Url(value: string): string {
  const bytes = Array.from(new TextEncoder().encode(value));
  const alphabet =
    "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
  let base64 = "";

  for (let index = 0; index < bytes.length; index += 3) {
    const chunk = [bytes[index], bytes[index + 1], bytes[index + 2]];
    const triple =
      (chunk[0] << 16) | ((chunk[1] ?? 0) << 8) | (chunk[2] ?? 0);

    base64 += alphabet[(triple >> 18) & 0x3f];
    base64 += alphabet[(triple >> 12) & 0x3f];
    base64 += chunk[1] === undefined ? "=" : alphabet[(triple >> 6) & 0x3f];
    base64 += chunk[2] === undefined ? "=" : alphabet[triple & 0x3f];
  }

  return base64.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function createToken(payload: Record<string, unknown>): string {
  return [
    toBase64Url(JSON.stringify({ alg: "RS256", typ: "JWT" })),
    toBase64Url(JSON.stringify(payload)),
    "assinatura-nao-verificada",
  ].join(".");
}

describe("decodeJwtPayload", () => {
  it("decodifica o payload de um token valido", () => {
    const token = createToken({
      sub: "3f2b1c4d-5e6f-4a7b-8c9d-0e1f2a3b4c5d",
      upn: "usuario@indaiatuba.sp.gov.br",
      exp: 1893456000,
    });

    expect(decodeJwtPayload(token)).toEqual({
      sub: "3f2b1c4d-5e6f-4a7b-8c9d-0e1f2a3b4c5d",
      upn: "usuario@indaiatuba.sp.gov.br",
      exp: 1893456000,
    });
  });

  it("decodifica base64url com `-`, `_` e sem padding", () => {
    // Payload escolhido para que o segmento use os dois caracteres proprios
    // do base64url (`-` e `_`) e fique sem padding (comprimento nao multiplo
    // de 4). Os caracteres U+07FF tambem exercitam a decodificacao UTF-8
    // multibyte.
    const payload = {
      sub: "3f2b1c4d-5e6f-4a7b-8c9d-0e1f2a3b4c5d",
      name: "߿߿߿",
    };
    const segment = toBase64Url(JSON.stringify(payload));

    expect(segment).not.toContain("=");
    expect(/[-_]/.test(segment)).toBe(true);
    expect(segment.length % 4).not.toBe(0);

    expect(decodeJwtPayload(`cabecalho.${segment}.assinatura`)).toEqual(payload);
  });

  it("retorna null para tokens malformados", () => {
    expect(decodeJwtPayload(null)).toBeNull();
    expect(decodeJwtPayload(undefined)).toBeNull();
    expect(decodeJwtPayload("")).toBeNull();
    expect(decodeJwtPayload("sem-pontos")).toBeNull();
    expect(decodeJwtPayload("apenas.dois")).toBeNull();
    expect(decodeJwtPayload("a..c")).toBeNull();
    expect(decodeJwtPayload("cabecalho.$$$invalido$$$.assinatura")).toBeNull();
    expect(decodeJwtPayload(`cabecalho.${toBase64Url("nao e json")}.assinatura`)).toBeNull();
    expect(decodeJwtPayload(`cabecalho.${toBase64Url("[1,2,3]")}.assinatura`)).toBeNull();
  });
});

describe("getJwtSubject", () => {
  it("devolve o `sub` do token", () => {
    const token = createToken({ sub: "  3f2b1c4d-5e6f-4a7b-8c9d-0e1f2a3b4c5d  " });

    expect(getJwtSubject(token)).toBe("3f2b1c4d-5e6f-4a7b-8c9d-0e1f2a3b4c5d");
  });

  it("devolve null quando nao ha `sub` utilizavel", () => {
    expect(getJwtSubject(createToken({ upn: "usuario@exemplo.com" }))).toBeNull();
    expect(getJwtSubject(createToken({ sub: "   " }))).toBeNull();
    expect(getJwtSubject(createToken({ sub: 42 }))).toBeNull();
    expect(getJwtSubject("token.invalido")).toBeNull();
  });
});
