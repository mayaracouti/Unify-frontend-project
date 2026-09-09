import { useEffect, useMemo, useState, type ReactNode } from "react";
import { ActivityIndicator, Image, Platform, StyleSheet, View, type ImageProps } from "react-native";

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

/** Timeout do fetch da imagem (so web): sem ele um request pendurado trava o loading. */
const IMAGE_REQUEST_TIMEOUT_MS = 15000;

function revokeObjectUrl(objectUrl: string) {
  if (typeof URL !== "undefined" && typeof URL.revokeObjectURL === "function") {
    URL.revokeObjectURL(objectUrl);
  }
}

/** So existe no web: no nativo quem cacheia e o proprio `Image` do RN. */
const webObjectUrlCache = createObjectUrlCache({
  maxEntries: MAX_CACHED_WEB_IMAGES,
  revoke: revokeObjectUrl,
});
const pendingImageRequests = new Map<string, Promise<string>>();

async function loadImageObjectUrl(uri: string, authToken: string | null) {
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

    // Object URL em vez de data URI: nao paga a serializacao base64 (+33% de
    // memoria) e pode ser revogado na evicao do cache.
    return URL.createObjectURL(imageBlob);
  } finally {
    clearTimeout(timeoutId);
  }
}

/**
 * No web devolve um object URL pronto para o `<img>`; no nativo devolve a
 * propria URL remota, porque o `Image` do RN busca os bytes sozinho (com os
 * headers do `source`) e mantem o proprio cache.
 */
export async function resolveAuthenticatedRemoteImageUri(
  uri: string,
  authToken: string | null
) {
  const cacheKey = getAuthenticatedImageCacheKey(uri);

  if (!IS_WEB) {
    return cacheKey;
  }

  const cachedObjectUrl = webObjectUrlCache.get(cacheKey);

  if (cachedObjectUrl) {
    return cachedObjectUrl;
  }

  const pendingRequest = pendingImageRequests.get(cacheKey);

  if (pendingRequest) {
    return await pendingRequest;
  }

  const request = loadImageObjectUrl(cacheKey, authToken)
    .then((objectUrl) => {
      webObjectUrlCache.set(cacheKey, objectUrl);
      return objectUrl;
    })
    .finally(() => {
      pendingImageRequests.delete(cacheKey);
    });

  pendingImageRequests.set(cacheKey, request);

  return await request;
}

/**
 * No nativo e no-op de proposito: `Image.prefetch` nao aceita headers, entao um
 * preload autenticado exigiria baixar os bytes de novo — o cache do `Image`
 * resolve isso na primeira renderizacao. No web o preload continua valendo, ja
 * que a tag `<img>` nao manda `Authorization`.
 */
export async function preloadAuthenticatedRemoteImages(
  uris: string[],
  authToken: string | null
) {
  if (!IS_WEB) {
    return;
  }

  await Promise.all(
    Array.from(new Set(uris.map((uri) => uri.trim()).filter(Boolean))).map((uri) =>
      resolveAuthenticatedRemoteImageUri(uri, authToken).catch(() => null)
    )
  );
}

/**
 * Chamada no logout. No web revoga todos os object URLs e esvazia o cache.
 * No nativo e no-op: o cache de imagens do `Image` do RN nao tem API publica de
 * limpeza sem uma lib externa (expo-image / react-native-fast-image). Impacto
 * aceito: uma troca de usuario sem restart pode reaproveitar bytes ja baixados
 * de uma URL identica — as URLs sao por recurso e continuam exigindo
 * `Authorization` no servidor, entao nada e baixado por quem nao pode ve-las.
 */
export function clearAuthenticatedRemoteImageCache() {
  pendingImageRequests.clear();
  webObjectUrlCache.clear();
}

function LoadingPlaceholder({
  accessibilityLabel,
  isOverlay,
}: {
  accessibilityLabel?: string;
  isOverlay?: boolean;
}) {
  return (
    <View
      accessible
      accessibilityRole="image"
      accessibilityLabel={
        accessibilityLabel ? `Carregando ${accessibilityLabel}` : "Carregando imagem"
      }
      accessibilityState={{ busy: true }}
      className="flex-1 items-center justify-center bg-[#2D2A33]"
      style={isOverlay ? StyleSheet.absoluteFill : undefined}
    >
      <ActivityIndicator color="#EAEA00" size="small" />
    </View>
  );
}

/**
 * Nativo: nada de fetch/base64. O `Image` recebe a URL remota + o header
 * `Authorization` e cuida do download, do cache e da decodificacao.
 */
function NativeAuthenticatedRemoteImage({
  accessibilityLabel,
  authToken,
  className,
  fallback,
  resizeMode = "cover",
  uri,
}: AuthenticatedRemoteImageProps) {
  const source = useMemo(() => buildAuthenticatedImageSource(uri, authToken), [authToken, uri]);
  const [isLoading, setIsLoading] = useState(true);
  const [hasLoadError, setHasLoadError] = useState(false);

  useEffect(() => {
    // Troca de imagem ou de token: volta ao estado de carregando.
    setIsLoading(true);
    setHasLoadError(false);
  }, [authToken, source.uri]);

  if (hasLoadError || !source.uri) {
    return <>{fallback}</>;
  }

  return (
    <>
      <Image
        accessibilityIgnoresInvertColors
        accessible={Boolean(accessibilityLabel) && !isLoading}
        accessibilityRole={accessibilityLabel ? "image" : undefined}
        accessibilityLabel={accessibilityLabel}
        // Sem rotulo a imagem e decorativa: some da arvore de acessibilidade.
        // Durante o loading quem fala e o placeholder sobreposto.
        importantForAccessibility={
          accessibilityLabel && !isLoading ? "yes" : "no-hide-descendants"
        }
        className={className}
        resizeMode={resizeMode}
        source={source}
        onLoadStart={() => {
          setIsLoading(true);
        }}
        onLoad={() => {
          setIsLoading(false);
        }}
        onError={() => {
          setIsLoading(false);
          setHasLoadError(true);
        }}
      />
      {isLoading ? (
        <LoadingPlaceholder accessibilityLabel={accessibilityLabel} isOverlay />
      ) : null}
    </>
  );
}

/** Web: o `<img>` nao manda headers, entao os bytes vem por `fetch` + object URL. */
function WebAuthenticatedRemoteImage({
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

    const cachedObjectUrl = webObjectUrlCache.get(uri);

    if (cachedObjectUrl) {
      setResolvedUri(cachedObjectUrl);
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

      const objectUrl = await resolveAuthenticatedRemoteImageUri(uri, authToken);

      if (!disposed) {
        setResolvedUri(objectUrl);
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

export function AuthenticatedRemoteImage(props: AuthenticatedRemoteImageProps) {
  if (IS_WEB) {
    return <WebAuthenticatedRemoteImage {...props} />;
  }

  return <NativeAuthenticatedRemoteImage {...props} />;
}
