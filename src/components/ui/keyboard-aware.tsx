import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import {
  Keyboard,
  LayoutAnimation,
  Platform,
  ScrollView,
  TextInput,
  View,
  type KeyboardEvent,
  type LayoutChangeEvent,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
  type ScrollViewProps,
  type ViewProps,
} from "react-native";

/**
 * Tratamento de teclado sem dependência nativa.
 *
 * Por que não basta o `KeyboardAvoidingView` do RN: no Android o app roda em
 * edge-to-edge (`edgeToEdgeEnabled=true`), então `adjustResize` não encolhe
 * mais a janela e o teclado passa por cima do conteúdo. Além disso o KAV do
 * RN calcula a sobreposição com o frame relativo ao pai, o que exige acertar
 * `keyboardVerticalOffset` tela a tela (header, safe area).
 *
 * Aqui a sobreposição é medida em coordenadas da root view (`measure`, pageY)
 * contra o topo do teclado (`endCoordinates.screenY`), o que funciona igual
 * em qualquer posição da tela. Não usar `measureInWindow`: no Android ele
 * desconta a status bar e o resultado fica 24dp fora do `screenY`. Na web o navegador já cuida disso e os eventos
 * de teclado não disparam, então os componentes viram View/ScrollView comuns.
 */

type KeyboardState = {
  /** Topo do teclado em coordenadas de janela; null com o teclado fechado. */
  top: number | null;
  duration: number;
  easing: KeyboardEvent["easing"] | null;
};

const CLOSED: KeyboardState = { top: null, duration: 0, easing: null };

function toKeyboardState(event: KeyboardEvent): KeyboardState {
  const { screenY, height } = event.endCoordinates;
  // iOS reporta screenY = 0 com "Preferir transições cruzadas" ligado.
  if (!height || !screenY) {
    return CLOSED;
  }
  return { top: screenY, duration: event.duration, easing: event.easing };
}

function useKeyboardState(): KeyboardState {
  const [state, setState] = useState<KeyboardState>(() => {
    // react-native-web não implementa `metrics`/`isVisible`.
    if (Platform.OS === "web") {
      return CLOSED;
    }
    const metrics = Keyboard.metrics();
    return Keyboard.isVisible() && metrics?.screenY
      ? { top: metrics.screenY, duration: 0, easing: null }
      : CLOSED;
  });

  useEffect(() => {
    if (Platform.OS === "web") {
      return;
    }

    const onShow = (event: KeyboardEvent) => setState(toKeyboardState(event));
    const onHide = () => setState(CLOSED);

    // iOS emite os eventos "will" antes da animação, permitindo acompanhar o
    // teclado; o Android só tem os "did".
    const subscriptions =
      Platform.OS === "ios"
        ? [
            Keyboard.addListener("keyboardWillChangeFrame", onShow),
            Keyboard.addListener("keyboardWillHide", onHide),
          ]
        : [
            Keyboard.addListener("keyboardDidShow", onShow),
            Keyboard.addListener("keyboardDidHide", onHide),
          ];

    return () => subscriptions.forEach((subscription) => subscription.remove());
  }, []);

  return state;
}

/**
 * Mede quanto da View referenciada fica atrás do teclado. Reavalia quando o
 * teclado muda e quando a View muda de layout (rotação, tela que já encolheu
 * sozinha por `adjustResize` em algum aparelho etc.).
 */
function useKeyboardOverlap(viewRef: React.RefObject<View | null>) {
  const keyboard = useKeyboardState();
  const [overlap, setOverlap] = useState(0);

  const measure = useCallback(() => {
    if (keyboard.top === null) {
      setOverlap(0);
      return;
    }
    const keyboardTop = keyboard.top;
    viewRef.current?.measure((_x, _y, _width, height, _pageX, pageY) => {
      setOverlap(Math.max(0, Math.round(pageY + height - keyboardTop)));
    });
  }, [keyboard.top, viewRef]);

  useEffect(() => {
    if (Platform.OS === "ios" && keyboard.duration) {
      LayoutAnimation.configureNext({
        duration: Math.max(keyboard.duration, 10),
        update: {
          duration: Math.max(keyboard.duration, 10),
          type: LayoutAnimation.Types[keyboard.easing ?? "keyboard"] ?? "keyboard",
        },
      });
    }
    measure();
    // A animação só deve acompanhar mudanças do teclado, não cada re-medida.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [keyboard.top]);

  return { overlap, keyboardTop: keyboard.top, measure };
}

type KeyboardAvoidingContainerProps = ViewProps & {
  className?: string;
  children?: ReactNode;
};

/**
 * Substitui o `KeyboardAvoidingView` em telas com input fixo no rodapé
 * (chat, comentários): ganha `paddingBottom` igual à parte coberta pelo
 * teclado, empurrando o composer para logo acima dele.
 */
export function KeyboardAvoidingContainer({
  style,
  onLayout,
  children,
  ...props
}: KeyboardAvoidingContainerProps) {
  const viewRef = useRef<View>(null);
  const { overlap, measure } = useKeyboardOverlap(viewRef);

  return (
    <View
      {...props}
      ref={viewRef}
      style={[style, overlap ? { paddingBottom: overlap } : null]}
      onLayout={(event: LayoutChangeEvent) => {
        measure();
        onLayout?.(event);
      }}
    >
      {children}
    </View>
  );
}

const SCROLL_SETTLE_MS = 80;

type KeyboardAwareScrollViewProps = ScrollViewProps & {
  className?: string;
  contentContainerClassName?: string;
  /** Folga entre o campo focado e o topo do teclado. */
  extraScrollHeight?: number;
};

/**
 * ScrollView de formulário que "eleva" o campo focado: ao abrir o teclado (ou
 * trocar de campo com ele aberto) rola até o input ficar visível acima do
 * teclado, e acrescenta ao fim do conteúdo um espaço do tamanho da área
 * coberta, para que até o último campo consiga subir.
 */
export const KeyboardAwareScrollView = forwardRef<
  ScrollView,
  KeyboardAwareScrollViewProps
>(function KeyboardAwareScrollView(
  {
    children,
    extraScrollHeight = 24,
    keyboardShouldPersistTaps = "handled",
    onScroll,
    onLayout,
    onContentSizeChange,
    scrollEventThrottle = 16,
    ...props
  },
  ref
) {
  const scrollRef = useRef<ScrollView>(null);
  // A instância da ScrollView é a classe JS; medir exige o host nativo.
  const measureRef = useMemo<React.RefObject<View | null>>(
    () => ({
      get current() {
        return (scrollRef.current?.getNativeScrollRef() ?? null) as View | null;
      },
    }),
    []
  );
  const scrollYRef = useRef(0);
  // O evento de foco do TextInput borbulha até aqui: só rolamos por inputs
  // que estão dentro desta ScrollView (e não, por exemplo, de um modal).
  const focusInsideRef = useRef(false);
  const { overlap, keyboardTop, measure } = useKeyboardOverlap(measureRef);

  useImperativeHandle(ref, () => scrollRef.current as ScrollView, []);

  const scrollFocusedIntoView = useCallback(() => {
    const scroll = scrollRef.current;
    if (!scroll || keyboardTop === null || !focusInsideRef.current) {
      return;
    }
    // `?.`: um wrapper de TextInput sem os estaticos (ou o react-native-web,
    // que nao tem `currentlyFocusedInput`) nao deve derrubar a tela.
    const input = TextInput.State?.currentlyFocusedInput?.();
    if (!input) {
      return;
    }

    measureRef.current?.measure((_sx, _sy, _sw, scrollHeight, _spx, scrollTop) => {
      input.measure((_x, _y, _w, inputHeight, _px, inputTop) => {
        const visibleTop = scrollTop + extraScrollHeight;
        const visibleBottom =
          Math.min(scrollTop + scrollHeight, keyboardTop) - extraScrollHeight;
        let delta = 0;

        if (inputHeight > visibleBottom - visibleTop) {
          // Campo maior que a área livre (multiline): alinha o topo.
          delta = inputTop - visibleTop;
        } else if (inputTop + inputHeight > visibleBottom) {
          delta = inputTop + inputHeight - visibleBottom;
        } else if (inputTop < visibleTop) {
          delta = inputTop - visibleTop;
        }
        if (Math.abs(delta) > 1) {
          scroll.scrollTo({ y: Math.max(0, scrollYRef.current + delta), animated: true });
        }
      });
    });
  }, [extraScrollHeight, keyboardTop, measureRef]);

  // Foco, teclado, espaçador e conteúdo mudam quase juntos: agrupa tudo numa
  // rolagem só, depois que o espaçador entrou no layout (antes disso o
  // scrollTo é limitado ao conteúdo antigo e a folga se perde).
  const scrollTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const scheduleScroll = useCallback(() => {
    if (scrollTimerRef.current) {
      clearTimeout(scrollTimerRef.current);
    }
    scrollTimerRef.current = setTimeout(() => {
      scrollTimerRef.current = null;
      scrollFocusedIntoView();
    }, SCROLL_SETTLE_MS);
  }, [scrollFocusedIntoView]);

  useEffect(
    () => () => {
      if (scrollTimerRef.current) {
        clearTimeout(scrollTimerRef.current);
      }
    },
    []
  );

  useEffect(() => {
    if (keyboardTop !== null) {
      scheduleScroll();
    }
  }, [keyboardTop, overlap, scheduleScroll]);

  const focusHandlers = {
    onFocus: () => {
      focusInsideRef.current = true;
      // Troca de campo com o teclado aberto não gera novo evento de teclado.
      scheduleScroll();
    },
    onBlur: () => {
      focusInsideRef.current = false;
    },
  };

  return (
    <ScrollView
      {...props}
      {...focusHandlers}
      ref={scrollRef}
      keyboardShouldPersistTaps={keyboardShouldPersistTaps}
      scrollEventThrottle={scrollEventThrottle}
      onScroll={(event: NativeSyntheticEvent<NativeScrollEvent>) => {
        scrollYRef.current = event.nativeEvent.contentOffset.y;
        onScroll?.(event);
      }}
      onLayout={(event: LayoutChangeEvent) => {
        measure();
        onLayout?.(event);
      }}
      onContentSizeChange={(width: number, height: number) => {
        // Multiline crescendo enquanto a pessoa digita.
        if (keyboardTop !== null) {
          scheduleScroll();
        }
        onContentSizeChange?.(width, height);
      }}
    >
      {children}
      {overlap ? (
        <View
          style={{ height: overlap }}
          importantForAccessibility="no-hide-descendants"
          accessibilityElementsHidden
        />
      ) : null}
    </ScrollView>
  );
});
