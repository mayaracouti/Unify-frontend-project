import type { Href, router as expoRouter } from "expo-router";

export function goBackOrReplace(
  router: Pick<typeof expoRouter, "canGoBack" | "back" | "replace">,
  fallback: Href
) {
  if (router.canGoBack()) {
    router.back();
    return;
  }

  router.replace(fallback);
}
