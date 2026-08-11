import {
  forwardRef,
  useImperativeHandle,
  useRef,
  useState,
  type ReactNode,
} from "react";
import {
  AccessibilityInfo,
  findNodeHandle,
  Platform,
  Text,
  TextInput,
  View,
  type TextInputProps,
} from "react-native";

export type FormFieldValidator = (value: string) => string | null | undefined;

export type FormFieldHandle = {
  /** Move o foco (visual e de acessibilidade) para o campo. */
  focus: () => void;
  /** Roda o validador manualmente (ex.: no submit) e retorna se o campo é válido. */
  validate: () => boolean;
};

type TextInputBlurEvent = Parameters<NonNullable<TextInputProps["onBlur"]>>[0];

export type FormFieldProps = Omit<
  TextInputProps,
  "onBlur" | "onChangeText" | "value" | "className"
> & {
  label: string;
  value: string;
  onChangeText: (value: string) => void;
  /** Instrução lida pelo leitor de tela (ex.: regras de senha). */
  hint?: string;
  disabled?: boolean;
  /** Validado em onBlur. Retorne a mensagem de erro, ou null/undefined se válido. */
  validator?: FormFieldValidator;
  /** Erro controlado externamente (ex.: retornado pela API no submit). Tem prioridade sobre o erro local. */
  error?: string | null;
  onValidate?: (errorMessage: string | null) => void;
  onBlur?: (event: TextInputBlurEvent) => void;
  /** Elemento renderizado à direita do input (ex.: botão de mostrar/ocultar senha). */
  rightElement?: ReactNode;
  containerClassName?: string;
  labelClassName?: string;
  /** Classe do wrapper que envolve o TextInput (e o rightElement, se houver). */
  fieldClassName?: string;
  inputClassName?: string;
  errorClassName?: string;
};

const DEFAULT_CONTAINER_CLASS = "mb-4";
const DEFAULT_LABEL_CLASS = "mb-2 text-caption font-extrabold text-content-secondary";
const DEFAULT_FIELD_CLASS = "flex-row items-center rounded-md bg-[#F3F3F3] px-4";
const DEFAULT_INPUT_CLASS = "flex-1 py-4 text-[14px] text-zinc-900";
const DEFAULT_ERROR_CLASS = "mt-2 text-caption font-semibold text-danger";

/**
 * Label + TextInput + mensagem de erro, com semântica de acessibilidade
 * embutida (ver plano-implementacao 00-DIAGNOSTICO-E-FUNDACAO.md §4.2):
 * - `accessibilityLabel` vem do label.
 * - `accessibilityHint` carrega instruções (ex.: regras de senha).
 * - `accessibilityState={{ disabled }}` reflete o estado do campo.
 * - a mensagem de erro usa `accessibilityLiveRegion="polite"` para ser
 *   anunciada assim que aparecer, sem exigir foco manual.
 * - a validação roda em `onBlur` (não só no submit) via a prop `validator`.
 * - expõe `ref` com `focus()`/`validate()` para que o formulário mova o
 *   foco ao primeiro campo inválido no submit falho.
 */
export const FormField = forwardRef<FormFieldHandle, FormFieldProps>(
  function FormField(
    {
      label,
      value,
      onChangeText,
      hint,
      disabled,
      validator,
      error: externalError,
      onValidate,
      onBlur,
      rightElement,
      containerClassName,
      labelClassName,
      fieldClassName,
      inputClassName,
      errorClassName,
      ...textInputProps
    },
    ref
  ) {
    const inputRef = useRef<TextInput>(null);
    const [localError, setLocalError] = useState<string | null>(null);
    const displayedError = externalError ?? localError;

    useImperativeHandle(ref, () => ({
      focus: () => {
        inputRef.current?.focus();

        if (Platform.OS === "web") {
          return;
        }

        const node = inputRef.current ? findNodeHandle(inputRef.current) : null;

        if (node) {
          AccessibilityInfo.setAccessibilityFocus(node);
        }
      },
      validate: () => {
        if (!validator) {
          return true;
        }

        const message = validator(value) ?? null;
        setLocalError(message);
        onValidate?.(message);
        return !message;
      },
    }));

    function handleBlur(event: TextInputBlurEvent) {
      if (validator) {
        const message = validator(value) ?? null;
        setLocalError(message);
        onValidate?.(message);
      }

      onBlur?.(event);
    }

    return (
      <View className={containerClassName ?? DEFAULT_CONTAINER_CLASS}>
        <Text className={labelClassName ?? DEFAULT_LABEL_CLASS}>{label}</Text>

        <View className={fieldClassName ?? DEFAULT_FIELD_CLASS}>
          <TextInput
            ref={inputRef}
            className={inputClassName ?? DEFAULT_INPUT_CLASS}
            value={value}
            onChangeText={onChangeText}
            onBlur={handleBlur}
            accessibilityLabel={label}
            accessibilityHint={hint}
            accessibilityState={{ disabled: Boolean(disabled) }}
            editable={!disabled}
            {...textInputProps}
          />
          {rightElement}
        </View>

        {displayedError ? (
          <Text
            className={errorClassName ?? DEFAULT_ERROR_CLASS}
            accessibilityRole="alert"
            accessibilityLiveRegion="polite"
          >
            {displayedError}
          </Text>
        ) : null}
      </View>
    );
  }
);
