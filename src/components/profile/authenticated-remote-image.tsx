import { useEffect, useState, type ReactNode } from "react";
import { ActivityIndicator, Image, Platform, View, type ImageProps } from "react-native";

import {
  buildAuthenticatedImageSource,
  createObjectUrlCache,
  getAuthenticatedImageCacheKey,
  MAX_CACHED_WEB_IMAGES,
} from "./authenticated-remote-image-source";

type AuthenticatedRemoteImageProps = {
  /** Rotulo lido pelo leitor de tela. Quando ausente, a imagem e tratada como decorativa. */
  accessibilityLabel?: string;
  authToken: string | null;
  className: string;
  fallback: ReactNode;
  resizeMode?: ImageProps["resizeMode"];
  uri: string;
};

const IS_WEB = Platform.OS === "web";

/** Timeout do fetch da imagem: sem ele um request pendurado trava o loading. */
const IMAGE_REQUEST_TIMEOUT_MS = 15000;

function revokeObjectUrl(objectUrl: string) {
  // Data URIs (nativo) nao tem o que revogar; so object URLs do web.
  if (
    objectUrl.startsWith("blob:") &&
    typeof URL !== "undefined" &&
    typeof URL.revokeObjectURL === "function"
  ) {
    URL.revokeObjectURL(objectUrl);
  }
}

/**
 * Cache FIFO de URIs resolvidas: object URL no web, data URI no nativo.
 *
 * NATIVO NAO USA `Image` COM `source.headers`: no Android (Expo Go / RN 0.81 com
 * nova arquitetura) o header `Authorization` simplesmente nao e enviado e o
 * backend responde 401 (confirmado no access log da API). Por isso os bytes
 * sao buscados via `fetch`, que respeita os headers, e entregues ao `Image`
 * como data URI.
 */
const resolvedUriCache = createObjectUrlCache({
  maxEntries: MAX_CACHED_WEB_IMAGES,
  revoke: revokeObjectUrl,
});
const pendingImageRequests = new Map<string, Promise<string>>();

async function blobToDataUri(blob: Blob): Promise<string> {
  return await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();

    reader.onloadend = () => {
      if (typeof reader.result === "string") {
        resolve(reader.result);
        return;
      }

      reject(new Error("Unable to convert image blob to data URI."));
    };

    reader.onerror = () => {
      reject(reader.error ?? new Error("Unable to read image blob."));
    };

    reader.readAsDataURL(blob);
  });
}

async function loadImageUri(uri: string, authToken: string | null) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => {
    controller.abort();
  }, IMAGE_REQUEST_TIMEOUT_MS);

  try {
    const { headers } = buildAuthenticatedImageSource(uri, authToken);
    const response = await fetch(uri, { headers, signal: controller.signal });

    // 401/403 sao erro de verdade: repetir sem `Authorization` so mascarava o
    // problema (e vazava a imagem para um request anonimo quando o backend
    // aceitava). Sem retry silencioso — a tela cai no fallback.
    if (response.status === 401 || response.status === 403) {
      throw new Error(`Image request was not authorized (${response.status}).`);
    }

    if (!response.ok) {
      throw new Error("Image request did not return a successful response.");
    }

    const imageBlob = await response.blob();

    if (IS_WEB) {
      // Object URL em vez de data URI: nao paga a serializacao base64 (+33% de
      // memoria) e pode ser revogado na evicao do cache.
      return URL.createObjectURL(imageBlob);
    }

    // Nativo: o `Image` do RN nao aceita blob e nao manda headers no Android,
    // entao a data URI e o caminho que funciona nas duas plataformas nativas.
    return await blobToDataUri(imageBlob);
  } finally {
    clearTimeout(timeoutId);
  }
}

/**
 * Devolve uma URI pronta para o `Image`: object URL no web, data URI no
 * nativo. Requests iguais em voo sao compartilhados.
 */
export async function resolveAuthenticatedRemoteImageUri(
  uri: string,
  authToken: string | null
) {
  const cacheKey = getAuthenticatedImageCacheKey(uri);

  const cachedUri = resolvedUriCache.get(cacheKey);

  if (cachedUri) {
    return cachedUri;
  }

  const pendingRequest = pendingImageRequests.get(cacheKey);

  if (pendingRequest) {
    return await pendingRequest;
  }

  const request = loadImageUri(cacheKey, authToken)
    .then((resolvedUri) => {
      resolvedUriCache.set(cacheKey, resolvedUri);
      return resolvedUri;
    })
    .finally(() => {
      pendingImageRequests.delete(cacheKey);
    });

  pendingImageRequests.set(cacheKey, request);

  return await request;
}

/** Aquece o cache para uma lista de URLs (falhas individuais sao ignoradas). */
export async function preloadAuthenticatedRemoteImages(
  uris: string[],
  authToken: string | null
) {
  await Promise.all(
    Array.from(new Set(uris.map((uri) => uri.trim()).filter(Boolean))).map((uri) =>
      resolveAuthenticatedRemoteImageUri(uri, authToken).catch(() => null)
    )
  );
}

/** Chamada no logout: revoga os object URLs (web) e esvazia o cache. */
export function clearAuthenticatedRemoteImageCache() {
  pendingImageRequests.clear();
  resolvedUriCache.clear();
}

function LoadingPlaceholder({ accessibilityLabel }: { accessibilityLabel?: string }) {
  return (
    <View
      accessible
      accessibilityRole="image"
      accessibilityLabel={
        accessibilityLabel ? `Carregando ${accessibilityLabel}` : "Carregando imagem"
      }
      accessibilityState={{ busy: true }}
      className="flex-1 items-center justify-center bg-[#2D2A33]"
    >
      <ActivityIndicator color="#EAEA00" size="small" />
    </View>
  );
}

/** Os bytes vem por `fetch` (com `Authorization`) e viram object URL (web) ou data URI (nativo). */
export function AuthenticatedRemoteImage({
  accessibilityLabel,
  authToken,
  className,
  fallback,
  resizeMode = "cover",
  uri,
}: AuthenticatedRemoteImageProps) {
  const [resolvedUri, setResolvedUri] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [hasLoadError, setHasLoadError] = useState(false);

  useEffect(() => {
    let disposed = false;

    const cachedUri = resolvedUriCache.get(uri);

    if (cachedUri) {
      setResolvedUri(cachedUri);
      setHasLoadError(false);
      setIsLoading(false);

      return () => {
        disposed = true;
      };
    }

    const loadImage = async () => {
      setIsLoading(true);
      setHasLoadError(false);
      setResolvedUri(null);

      const nextUri = await resolveAuthenticatedRemoteImageUri(uri, authToken);

      if (!disposed) {
        setResolvedUri(nextUri);
        setIsLoading(false);
      }
    };

    void loadImage().catch(() => {
      if (!disposed) {
        setHasLoadError(true);
        setIsLoading(false);
      }
    });

    // Nada de revoke aqui: o object URL pertence ao cache e pode estar em uso
    // por outra tela. A revogacao acontece na evicao FIFO e no logout.
    return () => {
      disposed = true;
    };
  }, [authToken, uri]);

  if (hasLoadError) {
    return <>{fallback}</>;
  }

  if (isLoading || !resolvedUri) {
    return <LoadingPlaceholder accessibilityLabel={accessibilityLabel} />;
  }

  return (
    <Image
      accessibilityIgnoresInvertColors
      accessible={Boolean(accessibilityLabel)}
      accessibilityRole={accessibilityLabel ? "image" : undefined}
      accessibilityLabel={accessibilityLabel}
      // Sem rotulo a imagem e decorativa: some da arvore de acessibilidade.
      importantForAccessibility={accessibilityLabel ? "yes" : "no-hide-descendants"}
      className={className}
      resizeMode={resizeMode}
      source={{ uri: resolvedUri }}
    />
  );
}
