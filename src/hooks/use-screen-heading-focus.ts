/**
 * Move o foco do leitor de tela NATIVO (TalkBack/VoiceOver) para o titulo da
 * tela sempre que ela ganha foco.
 *
 * Sem isso, ao navegar entre telas o foco costuma ficar preso no botao que
 * disparou a navegacao (ou volta para o topo da arvore anterior), e quem usa
 * leitor de tela precisa varrer a tela inteira para descobrir onde chegou.
 *
 * Espelha o padrao ja usado em `src/components/ui/form-field.tsx`:
 * `findNodeHandle` + `AccessibilityInfo.setAccessibilityFocus`, no-op no web
 * (onde `setAccessibilityFocus` nao existe e o proprio navegador cuida do
 * foco de documento).
 */
import { useFocusEffect } from "expo-router";
import { useCallback, useEffect, useRef, type Component } from "react";
import { AccessibilityInfo, findNodeHandle, Platform } from "react-native";

/**
 * O foco so "pega" depois que o nó existe na arvore nativa de acessibilidade;
 * pedir no mesmo tick da montagem e ignorado silenciosamente pelo TalkBack.
 */
const HEADING_FOCUS_DELAY_MS = 200;

/**
 * Retorna o `ref` que deve ser colocado no titulo da tela (um `Text` com
 * `accessibilityRole="header"`).
 */
export function useScreenHeadingFocus<T extends Component>() {
  const headingRef = useRef<T | null>(null);

  useFocusEffect(
    useCallback(() => {
      if (Platform.OS === "web") {
        return;
      }

      let cancelled = false;

      const timeoutId = setTimeout(() => {
        void AccessibilityInfo.isScreenReaderEnabled()
          .then((enabled) => {
            if (cancelled || !enabled) {
              return;
            }

            const node = headingRef.current
              ? findNodeHandle(headingRef.current)
              : null;

            if (node) {
              AccessibilityInfo.setAccessibilityFocus(node);
            }
          })
          .catch(() => {
            // Consulta de acessibilidade nunca derruba a tela.
          });
      }, HEADING_FOCUS_DELAY_MS);

      return () => {
        cancelled = true;
        clearTimeout(timeoutId);
      };
    }, [])
  );

  return headingRef;
}

/**
 * Mesma logica de foco, porem disparada na MONTAGEM e nao no foco de rota.
 *
 * Existe para o que roda FORA de uma tela do `Stack` — hoje o gate de
 * onboarding no `app/_layout.tsx`, que renderiza a tela de erro no lugar do
 * navegador. La nao existe contexto de navegacao e `useFocusEffect` nao pode
 * ser usado.
 */
export function useHeadingFocusOnMount<T extends Component>() {
  const headingRef = useRef<T | null>(null);

  useEffect(() => {
    if (Platform.OS === "web") {
      return;
    }

    let cancelled = false;

    const timeoutId = setTimeout(() => {
      void AccessibilityInfo.isScreenReaderEnabled()
        .then((enabled) => {
          if (cancelled || !enabled) {
            return;
          }

          const node = headingRef.current ? findNodeHandle(headingRef.current) : null;

          if (node) {
            AccessibilityInfo.setAccessibilityFocus(node);
          }
        })
        .catch(() => {
          // Consulta de acessibilidade nunca derruba a tela.
        });
    }, HEADING_FOCUS_DELAY_MS);

    return () => {
      cancelled = true;
      clearTimeout(timeoutId);
    };
  }, []);

  return headingRef;
}
