/**
 * Logica pura por tras do <AuthenticatedRemoteImage />, isolada da arvore React
 * para poder ser testada sem renderizador (o projeto nao tem RNTL instalado).
 *
 * Dois assuntos vivem aqui:
 * 1. o builder do `source` com o header `Authorization` (usado no nativo, onde o
 *    `Image` do RN sabe mandar headers e cuidar do proprio cache em disco);
 * 2. o cache de object URLs do web, onde o `Image` NAO envia headers e ainda
 *    precisamos buscar os bytes via `fetch`.
 */

export type AuthenticatedImageSource = {
  headers?: Record<string, string>;
  uri: string;
};

/** Teto do cache em memoria do web. Evicao FIFO simples. */
export const MAX_CACHED_WEB_IMAGES = 60;

export function getAuthenticatedImageCacheKey(uri: string) {
  return uri.trim();
}

/**
 * Monta o `source` do `Image`. Sem token o header e omitido (em vez de mandar
 * `Bearer null`), o que deixa o backend responder 401 e a tela cair no fallback.
 */
export function buildAuthenticatedImageSource(
  uri: string,
  authToken: string | null | undefined
): AuthenticatedImageSource {
  const resolvedUri = getAuthenticatedImageCacheKey(uri);
  const resolvedToken = authToken?.trim();

  if (!resolvedToken) {
    return { uri: resolvedUri };
  }

  return {
    headers: { Authorization: `Bearer ${resolvedToken}` },
    uri: resolvedUri,
  };
}

export type ObjectUrlCache = {
  clear: () => void;
  get: (uri: string) => string | null;
  set: (uri: string, objectUrl: string) => void;
  readonly size: number;
};

/**
 * Cache FIFO de object URLs. O cache e o dono do URL: quem consome nunca revoga,
 * senao um segundo consumidor da mesma imagem ficaria com um blob morto. A
 * revogacao acontece so na evicao e no `clear()` (logout).
 */
export function createObjectUrlCache({
  maxEntries = MAX_CACHED_WEB_IMAGES,
  revoke,
}: {
  maxEntries?: number;
  revoke: (objectUrl: string) => void;
}): ObjectUrlCache {
  const entries = new Map<string, string>();

  return {
    clear() {
      for (const objectUrl of entries.values()) {
        revoke(objectUrl);
      }

      entries.clear();
    },
    get(uri) {
      return entries.get(getAuthenticatedImageCacheKey(uri)) ?? null;
    },
    set(uri, objectUrl) {
      const cacheKey = getAuthenticatedImageCacheKey(uri);
      const previousObjectUrl = entries.get(cacheKey);

      if (previousObjectUrl !== undefined) {
        if (previousObjectUrl === objectUrl) {
          return;
        }

        revoke(previousObjectUrl);
        entries.delete(cacheKey);
      }

      // Map preserva ordem de insercao: a primeira chave e a mais antiga.
      while (entries.size >= maxEntries) {
        const oldestKey = entries.keys().next().value;

        if (oldestKey === undefined) {
          break;
        }

        const oldestObjectUrl = entries.get(oldestKey);

        entries.delete(oldestKey);

        if (oldestObjectUrl !== undefined) {
          revoke(oldestObjectUrl);
        }
      }

      entries.set(cacheKey, objectUrl);
    },
    get size() {
      return entries.size;
    },
  };
}
