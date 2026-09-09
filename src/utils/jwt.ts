/**
 * Decodificador MINIMO de JWT para uso EXCLUSIVAMENTE LOCAL.
 *
 * A assinatura NAO e verificada: a autoridade sobre a sessao continua sendo o
 * backend. O unico proposito aqui e ler o `sub` (o UUID do usuario, veja
 * `TokenService.java`) para usar como chave estavel de particionamento de
 * cache/estado local. O refresh token NAO serve para isso porque rotaciona a
 * cada `/auth/refresh`, o que invalidava todo o estado local do usuario.
 *
 * O decoder base64url e proprio de proposito: `atob` nao e garantido no Hermes
 * nem em todos os runtimes RN, e sao poucas linhas.
 */

const BASE64_ALPHABET =
  "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";

function base64UrlToUtf8(segment: string): string | null {
  const base64 = segment.replace(/-/g, "+").replace(/_/g, "/");
  const padded = base64 + "=".repeat((4 - (base64.length % 4)) % 4);
  const bytes: number[] = [];
  let buffer = 0;
  let bits = 0;

  for (const character of padded) {
    if (character === "=") {
      break;
    }

    const value = BASE64_ALPHABET.indexOf(character);

    if (value < 0) {
      // Caractere fora do alfabeto base64url: segmento invalido.
      return null;
    }

    buffer = (buffer << 6) | value;
    bits += 6;

    if (bits >= 8) {
      bits -= 8;
      bytes.push((buffer >> bits) & 0xff);
    }
  }

  if (bytes.length === 0) {
    return null;
  }

  // Decodificacao UTF-8 manual: o payload pode conter acentos (nome do
  // usuario), e `String.fromCharCode` sozinho os corromperia.
  let result = "";
  let index = 0;

  while (index < bytes.length) {
    const byte = bytes[index];
    let codePoint: number;
    let extraBytes: number;

    if (byte < 0x80) {
      codePoint = byte;
      extraBytes = 0;
    } else if ((byte & 0xe0) === 0xc0) {
      codePoint = byte & 0x1f;
      extraBytes = 1;
    } else if ((byte & 0xf0) === 0xe0) {
      codePoint = byte & 0x0f;
      extraBytes = 2;
    } else if ((byte & 0xf8) === 0xf0) {
      codePoint = byte & 0x07;
      extraBytes = 3;
    } else {
      return null;
    }

    for (let offset = 1; offset <= extraBytes; offset += 1) {
      const continuationByte = bytes[index + offset];

      if (continuationByte === undefined || (continuationByte & 0xc0) !== 0x80) {
        return null;
      }

      codePoint = (codePoint << 6) | (continuationByte & 0x3f);
    }

    result += String.fromCodePoint(codePoint);
    index += extraBytes + 1;
  }

  return result;
}

/**
 * Payload (segundo segmento) do JWT, sem validar assinatura nem expiracao.
 * Retorna `null` para qualquer token malformado.
 */
export function decodeJwtPayload(
  token: string | null | undefined
): Record<string, unknown> | null {
  const parts = token?.trim().split(".");

  if (!parts || parts.length !== 3 || !parts[1]) {
    return null;
  }

  const json = base64UrlToUtf8(parts[1]);

  if (json === null) {
    return null;
  }

  try {
    const payload: unknown = JSON.parse(json);

    if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
      return null;
    }

    return payload as Record<string, unknown>;
  } catch {
    return null;
  }
}

/**
 * `sub` do token (o UUID do usuario no backend). `null` quando o token e
 * invalido ou nao traz `sub`.
 */
export function getJwtSubject(token: string | null | undefined): string | null {
  const payload = decodeJwtPayload(token);
  const subject = payload?.sub;

  return typeof subject === "string" && subject.trim().length > 0
    ? subject.trim()
    : null;
}
