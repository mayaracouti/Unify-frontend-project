import type { Href, Router } from "expo-router";

export function goBackOrReplace(
  router: Pick<Router, "canGoBack" | "back" | "replace">,
  fallback: Href
) {
  if (router.canGoBack()) {
    router.back();
    return;
  }

  router.replace(fallback);
}
