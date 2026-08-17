/**
 * Motor global das preferencias de acessibilidade.
 *
 * O objetivo e fazer `fontScale` e `highContrast` valerem em TODAS as telas sem
 * precisar reescrever cada `<Text>`/`<TextInput>` do app. Para isso este modulo:
 *
 * 1. Mantem um singleton com o estado atual das preferencias. O
 *    `AccessibilityContext` alimenta esse singleton (ver `setGlobalTextAdjustments`),
 *    de modo que o patch consegue ler o valor corrente sem depender de hooks.
 * 2. Substitui os exports `Text` e `TextInput` do modulo `react-native` por
 *    versoes que ajustam o estilo ja resolvido (escala de fonte + mapeamento de
 *    cor para alto contraste) antes de delegar para o componente original.
 *
 * ## Por que substituir o export do modulo e nao `Text.render`?
 *
 * A tecnica classica ("react-native-global-props") faz monkey patch em
 * `Text.render`, o que so existe quando `Text` e um `React.forwardRef`. No
 * React Native 0.81.5 (versao deste projeto) `Libraries/Text/Text.js` exporta um
 * componente de funcao puro (sintaxe `component(...)` do Flow, compatível com o
 * `ref` como prop do React 19): nao ha `.render` nem `prototype.render` para
 * interceptar. A interceptacao equivalente e trocar o getter `Text` de
 * `module.exports` do pacote `react-native` — o Babel/Metro compila
 * `import { Text } from "react-native"` para acesso de membro no ponto de uso
 * (`_reactNative.Text`), entao o componente trocado passa a ser usado por todas
 * as telas sem que nenhuma delas mude.
 *
 * ## NativeWind
 *
 * O NativeWind v4 (react-native-css-interop 0.2.3) resolve `className` no proprio
 * jsx-runtime: `interopComponents.get(type) ?? type`. O mapa e alimentado por
 * `cssInterop(baseComponent, mapping)` e o componente registrado renderiza
 * `baseComponent` ja com a `style` resolvida. Por isso o componente ajustado
 * criado aqui e registrado com `cssInterop(...)`: assim ele vira o "base
 * component" do interop e recebe a style final (incluindo cores/tamanhos vindos
 * das classes Tailwind), que e exatamente o que precisamos ajustar.
 */
import {
  createContext,
  createElement,
  useContext,
  useSyncExternalStore,
  type ComponentType,
  type ReactElement,
} from "react";
import { cssInterop } from "nativewind";
import { StyleSheet, type StyleProp, type TextStyle } from "react-native";

export type GlobalAccessibilityState = {
  fontScaleMultiplier: number;
  highContrast: boolean;
  screenReaderOptimized: boolean;
  reduceMotion: boolean;
};

export const DEFAULT_GLOBAL_ACCESSIBILITY_STATE: GlobalAccessibilityState = {
  fontScaleMultiplier: 1,
  highContrast: false,
  screenReaderOptimized: false,
  reduceMotion: false,
};

/** Tamanho de fonte padrao do React Native quando nenhum `fontSize` e informado. */
export const DEFAULT_TEXT_FONT_SIZE = 14;

const HIGH_CONTRAST_LIGHT = "#FFFFFF";
const HIGH_CONTRAST_DARK = "#000000";

let currentState: GlobalAccessibilityState = DEFAULT_GLOBAL_ACCESSIBILITY_STATE;

const listeners = new Set<() => void>();

export function getGlobalTextAdjustments(): GlobalAccessibilityState {
  return currentState;
}

/**
 * Atualiza o singleton. Chamado pelo `AccessibilityProvider` sempre que as
 * preferencias mudam (inclusive na hidratacao do cache local).
 */
export function setGlobalTextAdjustments(
  next: Partial<GlobalAccessibilityState>
): void {
  const multiplier = next.fontScaleMultiplier;

  const merged: GlobalAccessibilityState = {
    ...currentState,
    ...next,
    fontScaleMultiplier:
      typeof multiplier === "number" && Number.isFinite(multiplier) && multiplier > 0
        ? multiplier
        : currentState.fontScaleMultiplier,
  };

  if (
    merged.fontScaleMultiplier === currentState.fontScaleMultiplier &&
    merged.highContrast === currentState.highContrast &&
    merged.screenReaderOptimized === currentState.screenReaderOptimized &&
    merged.reduceMotion === currentState.reduceMotion
  ) {
    return;
  }

  currentState = merged;

  listeners.forEach((listener) => {
    try {
      listener();
    } catch {
      // Um assinante quebrado nao pode impedir os demais de atualizar.
    }
  });
}

function subscribeToGlobalTextAdjustments(listener: () => void): () => void {
  listeners.add(listener);

  return () => {
    listeners.delete(listener);
  };
}

/**
 * Hook para componentes que precisam reagir as preferencias sem estar dentro do
 * `AccessibilityProvider` (por exemplo o viewport global de toasts).
 */
export function useGlobalAccessibilityState(): GlobalAccessibilityState {
  return useSyncExternalStore(
    subscribeToGlobalTextAdjustments,
    getGlobalTextAdjustments,
    getGlobalTextAdjustments
  );
}

// ---------------------------------------------------------------------------
// Cores: conversao + luminancia relativa (WCAG 2.x), sem dependencia externa.
// ---------------------------------------------------------------------------

type Rgb = { red: number; green: number; blue: number };

const HEX_COLOR_PATTERN = /^#([0-9a-fA-F]{3,8})$/;
const RGB_COLOR_PATTERN = /^rgba?\(([^)]*)\)$/i;

function clampChannel(value: number): number {
  if (value < 0) {
    return 0;
  }

  if (value > 255) {
    return 255;
  }

  return value;
}

function parseHexColor(value: string): Rgb | null {
  const match = HEX_COLOR_PATTERN.exec(value);

  if (!match) {
    return null;
  }

  const digits = match[1];

  // #RGB e #RGBA
  if (digits.length === 3 || digits.length === 4) {
    return {
      red: Number.parseInt(`${digits[0]}${digits[0]}`, 16),
      green: Number.parseInt(`${digits[1]}${digits[1]}`, 16),
      blue: Number.parseInt(`${digits[2]}${digits[2]}`, 16),
    };
  }

  // #RRGGBB e #RRGGBBAA
  if (digits.length === 6 || digits.length === 8) {
    return {
      red: Number.parseInt(digits.slice(0, 2), 16),
      green: Number.parseInt(digits.slice(2, 4), 16),
      blue: Number.parseInt(digits.slice(4, 6), 16),
    };
  }

  return null;
}

function parseColorChannel(raw: string): number | null {
  if (raw.endsWith("%")) {
    const percentage = Number.parseFloat(raw.slice(0, -1));

    if (!Number.isFinite(percentage)) {
      return null;
    }

    return clampChannel(Math.round((percentage / 100) * 255));
  }

  const parsed = Number.parseFloat(raw);

  if (!Number.isFinite(parsed)) {
    return null;
  }

  return clampChannel(Math.round(parsed));
}

function parseRgbColor(value: string): Rgb | null {
  const match = RGB_COLOR_PATTERN.exec(value);

  if (!match) {
    return null;
  }

  // Aceita `rgb(1, 2, 3)`, `rgba(1, 2, 3, 0.5)` e `rgb(1 2 3 / 50%)`.
  const parts = match[1].split(/[\s,/]+/).filter((part) => part.length > 0);

  if (parts.length < 3) {
    return null;
  }

  const red = parseColorChannel(parts[0]);
  const green = parseColorChannel(parts[1]);
  const blue = parseColorChannel(parts[2]);

  if (red === null || green === null || blue === null) {
    return null;
  }

  return { red, green, blue };
}

function linearizeChannel(channel: number): number {
  const srgb = channel / 255;

  return srgb <= 0.03928 ? srgb / 12.92 : Math.pow((srgb + 0.055) / 1.055, 2.4);
}

function parseColor(color: string): Rgb | null {
  const normalized = color.trim();

  return parseHexColor(normalized) ?? parseRgbColor(normalized);
}

/**
 * Luminancia relativa WCAG 2.x (0 = preto, 1 = branco). Retorna `null` quando o
 * formato da cor nao e reconhecido. Metrica usada para raciocinar sobre
 * contraste; a decisao de mapeamento usa `isLightColor` (ver abaixo).
 */
export function getRelativeLuminance(color: string): number | null {
  const rgb = parseColor(color);

  if (!rgb) {
    return null;
  }

  return (
    0.2126 * linearizeChannel(rgb.red) +
    0.7152 * linearizeChannel(rgb.green) +
    0.0722 * linearizeChannel(rgb.blue)
  );
}

/**
 * A cor esta mais proxima do branco ou do preto no espaco sRGB?
 *
 * Equivale a comparar a distancia euclidiana ate `#FFFFFF` e ate `#000000`
 * (a desigualdade se reduz a `(r + g + b) / 3 > 127,5`).
 *
 * Por que nao usar a luminancia relativa com corte em 0,5? Porque ela e
 * fortemente ponderada pelo gama e joga para "escuro" praticamente todo o texto
 * secundario deste app: `#909099` (Y=0,28), `#A9A9B2` (Y=0,40), `#B9BAC4`
 * (Y=0,49) e `#FF6B6B` (Y=0,33) virariam preto puro sobre as superficies
 * escuras (#0B0B10 / #111214 / #19191C) — ou seja, texto invisivel. O criterio
 * de proximidade classifica corretamente as duas familias reais da paleta: os
 * quase-pretos usados sobre chips claros (#323200, #171717, #1D1D00, #686800)
 * vao para preto, e todo o texto claro/de marca (#A9A9B2, #B9BAC4, #7C4DFF,
 * #F2F500, #FF6B6B) vai para branco.
 */
function isLightColor(rgb: Rgb): boolean {
  return (rgb.red + rgb.green + rgb.blue) / 3 > 127.5;
}

/**
 * Leva a cor do texto para o extremo mais proximo (branco puro ou preto puro).
 * Isso aumenta o contraste sem inverter a interface: texto escuro sobre um chip
 * amarelo vira preto puro; cinza claro sobre fundo escuro vira branco puro.
 */
export function mapColorToHighContrast(color: unknown): string | null {
  if (typeof color !== "string") {
    return null;
  }

  const rgb = parseColor(color);

  if (!rgb) {
    return null;
  }

  return isLightColor(rgb) ? HIGH_CONTRAST_LIGHT : HIGH_CONTRAST_DARK;
}

// ---------------------------------------------------------------------------
// Ajuste de estilo
// ---------------------------------------------------------------------------

export type TextStyleAdjustmentOptions = {
  /**
   * Quando `true` e o estilo nao declara `fontSize`, aplica
   * `DEFAULT_TEXT_FONT_SIZE * multiplier`. Usado apenas em `Text` de primeiro
   * nivel: em `Text` aninhado o tamanho e herdado do pai (que ja foi escalado).
   */
  applyDefaultFontSize?: boolean;
};

export function isTextAdjustmentActive(state: GlobalAccessibilityState): boolean {
  return state.fontScaleMultiplier !== 1 || state.highContrast;
}

/**
 * Funcao pura (testavel isoladamente) que calcula os overrides de estilo.
 * Retorna o proprio `style` quando nada precisa ser alterado.
 */
export function adjustTextStyle(
  style: StyleProp<TextStyle>,
  state: GlobalAccessibilityState,
  options: TextStyleAdjustmentOptions = {}
): StyleProp<TextStyle> {
  if (!isTextAdjustmentActive(state)) {
    return style;
  }

  const flattened = StyleSheet.flatten(style) as TextStyle | undefined;
  const overrides: TextStyle = {};
  let hasOverrides = false;

  const multiplier = state.fontScaleMultiplier;

  if (multiplier !== 1) {
    const fontSize = typeof flattened?.fontSize === "number" ? flattened.fontSize : null;

    if (fontSize !== null) {
      overrides.fontSize = Math.round(fontSize * multiplier);
      hasOverrides = true;
    } else if (options.applyDefaultFontSize === true) {
      overrides.fontSize = Math.round(DEFAULT_TEXT_FONT_SIZE * multiplier);
      hasOverrides = true;
    }

    // Sem escalar o `lineHeight` o texto ampliado e cortado verticalmente.
    if (typeof flattened?.lineHeight === "number") {
      overrides.lineHeight = Math.round(flattened.lineHeight * multiplier);
      hasOverrides = true;
    }
  }

  if (state.highContrast) {
    const highContrastColor = mapColorToHighContrast(flattened?.color);

    if (highContrastColor !== null) {
      overrides.color = highContrastColor;
      hasOverrides = true;
    }
  }

  if (!hasOverrides) {
    return style;
  }

  // A ordem importa: o override precisa vir depois do estilo original.
  return style == null ? overrides : [style, overrides];
}

// ---------------------------------------------------------------------------
// Componentes ajustados + aplicacao do patch
// ---------------------------------------------------------------------------

type AnyTextProps = Record<string, unknown> & { style?: StyleProp<TextStyle> };

/**
 * Marca a subarvore de um `Text` de primeiro nivel para que os `Text` aninhados
 * herdem o tamanho do pai em vez de receberem o default escalado.
 */
const NestedTextContext = createContext(false);

type AdjustedComponentOptions = TextStyleAdjustmentOptions & {
  provideNestedContext?: boolean;
};

function createAdjustedComponent(
  BaseComponent: ComponentType<AnyTextProps>,
  displayName: string,
  options: AdjustedComponentOptions
): ComponentType<AnyTextProps> {
  function AdjustedComponent(props: AnyTextProps): ReactElement {
    const state = useGlobalAccessibilityState();
    const isNested = useContext(NestedTextContext);

    // Preferencias no padrao: o patch fica transparente.
    if (!isTextAdjustmentActive(state)) {
      return createElement(BaseComponent, props);
    }

    const style = adjustTextStyle(props.style, state, {
      applyDefaultFontSize: options.applyDefaultFontSize === true && !isNested,
    });

    const element = createElement(
      BaseComponent,
      style === props.style ? props : { ...props, style }
    );

    if (options.provideNestedContext !== true || isNested) {
      return element;
    }

    return createElement(NestedTextContext.Provider, { value: true }, element);
  }

  AdjustedComponent.displayName = displayName;

  return AdjustedComponent;
}

type CssInteropRegister = (
  component: ComponentType<AnyTextProps>,
  mapping: Record<string, unknown>
) => unknown;

function patchReactNativeExport(
  reactNativeModule: Record<string, unknown>,
  exportName: "Text" | "TextInput",
  options: AdjustedComponentOptions,
  cssInteropMapping: Record<string, unknown>
): void {
  const original = reactNativeModule[exportName] as
    | ComponentType<AnyTextProps>
    | undefined;

  if (original == null) {
    return;
  }

  const adjusted = createAdjustedComponent(
    original,
    `Accessible${exportName}`,
    options
  );

  try {
    // Registra o componente ajustado como base do interop do NativeWind, para
    // que ele receba a `style` ja resolvida a partir do `className`.
    (cssInterop as unknown as CssInteropRegister)(adjusted, cssInteropMapping);
  } catch {
    // Sem NativeWind o ajuste continua valendo para estilos inline.
  }

  try {
    Object.defineProperty(reactNativeModule, exportName, {
      configurable: true,
      enumerable: true,
      get: () => adjusted,
    });
  } catch {
    // No web (react-native-web via ESM) o export pode ser nao-configuravel.
    // O app segue funcionando sem o patch global de Text/TextInput.
  }
}

const PATCH_FLAG = "__unifyGlobalTextAdjustmentsApplied__";

/**
 * Aplica o patch uma unica vez (idempotente contra hot reload). Deve ser
 * chamado na inicializacao, em `app/_layout.tsx`.
 */
export function applyGlobalTextAdjustmentsPatch(): void {
  const globalScope = globalThis as unknown as Record<string, unknown>;

  if (globalScope[PATCH_FLAG] === true) {
    return;
  }

  let reactNativeModule: Record<string, unknown>;

  try {
    // `require` (e nao `import`) porque precisamos do objeto `module.exports`
    // vivo do pacote react-native para reescrever o getter do componente.
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    reactNativeModule = require("react-native") as Record<string, unknown>;
  } catch {
    return;
  }

  globalScope[PATCH_FLAG] = true;

  patchReactNativeExport(
    reactNativeModule,
    "Text",
    { applyDefaultFontSize: true, provideNestedContext: true },
    { className: "style" }
  );

  patchReactNativeExport(
    reactNativeModule,
    "TextInput",
    { applyDefaultFontSize: false },
    { className: { target: "style", nativeStyleToProp: { textAlign: true } } }
  );
}
