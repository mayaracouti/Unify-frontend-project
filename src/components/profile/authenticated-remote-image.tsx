import { useEffect, useState, type ReactNode } from "react";
import { ActivityIndicator, Image, type ImageProps, View } from "react-native";

type AuthenticatedRemoteImageProps = {
  authToken: string | null;
  className: string;
  fallback: ReactNode;
  resizeMode?: ImageProps["resizeMode"];
  uri: string;
};

const resolvedImageCache = new Map<string, string>();
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

function getCacheKey(uri: string) {
  return uri.trim();
}

function getCachedResolvedUri(uri: string) {
  return resolvedImageCache.get(getCacheKey(uri)) ?? null;
}

async function loadImageDataUri(uri: string, authToken: string | null) {
  const attempts = authToken
    ? [{ Authorization: `Bearer ${authToken}` }, undefined]
    : [undefined];

  for (const headers of attempts) {
    const response = await fetch(uri, headers ? { headers } : undefined);

    if (!response.ok) {
      continue;
    }

    const imageBlob = await response.blob();
    return await blobToDataUri(imageBlob);
  }

  throw new Error("Image request did not return a successful response.");
}

export async function resolveAuthenticatedRemoteImageUri(
  uri: string,
  authToken: string | null
) {
  const cacheKey = getCacheKey(uri);
  const cachedUri = getCachedResolvedUri(uri);

  if (cachedUri) {
    return cachedUri;
  }

  const pendingRequest = pendingImageRequests.get(cacheKey);

  if (pendingRequest) {
    return await pendingRequest;
  }

  const request = loadImageDataUri(uri, authToken)
    .then((resolvedUri) => {
      resolvedImageCache.set(cacheKey, resolvedUri);
      return resolvedUri;
    })
    .finally(() => {
      pendingImageRequests.delete(cacheKey);
    });

  pendingImageRequests.set(cacheKey, request);

  return await request;
}

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

export function clearAuthenticatedRemoteImageCache() {
  resolvedImageCache.clear();
  pendingImageRequests.clear();
}

export function AuthenticatedRemoteImage({
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

    const cachedUri = getCachedResolvedUri(uri);

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

      const dataUri = await resolveAuthenticatedRemoteImageUri(uri, authToken);

      if (!disposed) {
        setResolvedUri(dataUri);
        setIsLoading(false);
      }
    };

    void loadImage().catch(() => {
      if (!disposed) {
        setHasLoadError(true);
        setIsLoading(false);
      }
    });

    return () => {
      disposed = true;
    };
  }, [authToken, uri]);

  if (hasLoadError) {
    return <>{fallback}</>;
  }

  if (isLoading || !resolvedUri) {
    return (
      <View className="flex-1 items-center justify-center bg-[#2D2A33]">
        <ActivityIndicator color="#EAEA00" size="small" />
      </View>
    );
  }

  return (
    <Image
      accessibilityIgnoresInvertColors
      className={className}
      resizeMode={resizeMode}
      source={{ uri: resolvedUri }}
    />
  );
}