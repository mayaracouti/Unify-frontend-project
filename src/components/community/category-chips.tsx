import { Pressable, ScrollView, Text } from "react-native";

import { buildOptionToggleSpeech, useTTS } from "../../accessibility/tts";
import type { CommunityCategoryResponse } from "../../types/community";

export type CommunityCategoryChipsProps = {
  categories: CommunityCategoryResponse[];
  selectedCategoryId: number | null;
  onSelect: (categoryId: number | null) => void;
  /**
   * Rotulo da opcao "sem filtro". Quando ausente (telas de criacao/edicao,
   * onde a selecao e unica e opcional), o chip neutro nao e renderizado.
   */
  allOptionLabel?: string | null;
  className?: string;
};

/**
 * Chips horizontais de categoria de comunidade. Usados na listagem (com a
 * opcao "Todas") e nos formularios de criacao/edicao (selecao unica).
 * Cada chip usa `accessibilityRole="radio"` + `accessibilityState.selected`
 * para que o leitor de tela anuncie o grupo como escolha exclusiva.
 */
export function CommunityCategoryChips({
  categories,
  selectedCategoryId,
  onSelect,
  allOptionLabel,
  className,
}: CommunityCategoryChipsProps) {
  const { speak } = useTTS();

  if (categories.length === 0) {
    return null;
  }

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      className={className ?? "mt-4"}
      contentContainerClassName="gap-2 pr-2"
      accessibilityRole="radiogroup"
      accessibilityLabel="Categorias de comunidade"
    >
      {allOptionLabel ? (
        <Pressable
          className={`rounded-full border px-4 py-2 ${
            selectedCategoryId === null
              ? "border-[#EAEA00] bg-[#EAEA00]"
              : "border-[#3A3246] bg-[#17181C]"
          }`}
          onPress={() => {
            speak(buildOptionToggleSpeech(allOptionLabel, true));
            onSelect(null);
          }}
          accessibilityRole="radio"
          accessibilityLabel="Todas as categorias"
          accessibilityState={{ selected: selectedCategoryId === null }}
        >
          <Text
            className={
              selectedCategoryId === null
                ? "text-[13px] font-bold text-[#323200]"
                : "text-[13px] font-bold text-white"
            }
          >
            {allOptionLabel}
          </Text>
        </Pressable>
      ) : null}

      {categories.map((category) => {
        const selected = selectedCategoryId === category.id;

        return (
          <Pressable
            key={category.id}
            className={`rounded-full border px-4 py-2 ${
              selected ? "border-[#EAEA00] bg-[#EAEA00]" : "border-[#3A3246] bg-[#17181C]"
            }`}
            onPress={() => {
              // O texto vem do dado de runtime (`category.description`).
              speak(buildOptionToggleSpeech(category.description, !selected));
              onSelect(selected ? null : category.id);
            }}
            accessibilityRole="radio"
            accessibilityLabel={category.description}
            accessibilityState={{ selected }}
          >
            <Text
              className={
                selected
                  ? "text-[13px] font-bold text-[#323200]"
                  : "text-[13px] font-bold text-white"
              }
            >
              {category.description}
            </Text>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}
