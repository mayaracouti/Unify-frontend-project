import { Pressable, Text, View } from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";

import type {
  LookupOptionResponse,
  SimilarityOptionResponse,
  SimilarityPreference,
} from "../../types/profile";

function isIoniconName(
  value?: string | null
): value is keyof typeof Ionicons.glyphMap {
  return typeof value === "string" && value in Ionicons.glyphMap;
}

export function OptionChip({
  label,
  selected,
  iconName,
  onPress,
}: {
  label: string;
  selected: boolean;
  iconName?: keyof typeof Ionicons.glyphMap;
  onPress: () => void;
}) {
  return (
    <Pressable
      className={`min-h-[52px] flex-row items-center rounded-full border-2 px-5 py-3 ${
        selected
          ? "border-[#EAEA00] bg-[#EAEA00]"
          : "border-[#494455] bg-transparent"
      }`}
      onPress={onPress}
    >
      {iconName ? (
        <Ionicons
          name={iconName}
          size={18}
          color={selected ? "#323200" : "#E5E2E1"}
        />
      ) : selected ? (
        <Ionicons name="checkmark-circle" size={18} color="#323200" />
      ) : null}
      <Text
        className={`text-[15px] font-bold ${(selected || iconName) ? "ml-2" : ""} ${selected ? "text-[#323200]" : "text-[#E5E2E1]"}`}
      >
        {label}
      </Text>
    </Pressable>
  );
}

export function SingleChoice({
  title,
  options,
  value,
  onChange,
}: {
  title: string;
  options: LookupOptionResponse[];
  value?: number;
  onChange: (id: number) => void;
}) {
  return (
    <View className="mb-8">
      <Text className="mb-3 text-[22px] font-bold text-white">{title}</Text>
      <View className="flex-row flex-wrap gap-3">
        {options.map((option) => (
          <OptionChip
            key={option.id}
            label={option.description}
            selected={value === option.id}
            onPress={() => onChange(option.id)}
          />
        ))}
      </View>
    </View>
  );
}

export function MultiChoice({
  title,
  options,
  values,
  onChange,
  toggleId,
  showOptionIcons = false,
}: {
  title: string;
  options: LookupOptionResponse[];
  values: number[];
  onChange: (ids: number[]) => void;
  toggleId: (currentIds: number[], id: number) => number[];
  showOptionIcons?: boolean;
}) {
  return (
    <View className="mb-8">
      <Text className="mb-3 text-[22px] font-bold text-white">{title}</Text>
      <View className="flex-row flex-wrap gap-3">
        {options.map((option) => (
          <OptionChip
            key={option.id}
            label={option.description}
            selected={values.includes(option.id)}
            iconName={
              showOptionIcons && isIoniconName(option.ionicIcon)
                ? option.ionicIcon
                : undefined
            }
            onPress={() => onChange(toggleId(values, option.id))}
          />
        ))}
      </View>
    </View>
  );
}

export function ChoiceCard({
  label,
  selected,
  onPress,
}: {
  label: string;
  selected: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      className={`min-h-[56px] flex-1 basis-[46%] flex-row items-center justify-between rounded-lg border-2 px-5 py-3 ${
        selected
          ? "border-[#EAEA00] bg-[#EAEA00]/10"
          : "border-[#262626] bg-[#201F1F]"
      }`}
      onPress={onPress}
    >
      <Text className="flex-1 text-[16px] font-bold text-white">{label}</Text>
      {selected ? (
        <Ionicons name="checkmark-circle" size={22} color="#EAEA00" />
      ) : null}
    </Pressable>
  );
}

export function SectionTitle({
  icon,
  title,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
}) {
  return (
    <View className="mb-3 flex-row items-center">
      <Ionicons name={icon} size={22} color="#00DAF3" />
      <Text className="ml-2 text-[22px] font-bold text-white">{title}</Text>
    </View>
  );
}

export function SimilaritySelector({
  title,
  value,
  options,
  onChange,
}: {
  title: string;
  value: SimilarityPreference;
  options: SimilarityOptionResponse[];
  onChange: (value: SimilarityPreference) => void;
}) {
  return (
    <View className="mb-6">
      <Text className="mb-3 text-[15px] font-bold text-[#CAC3D8]">{title}</Text>
      <View className="flex-row flex-wrap gap-3">
        {options.map((option) => {
          const selected = option.value === value;

          return (
            <Pressable
              key={option.value}
              className={`min-h-[48px] rounded-full border-2 px-4 py-3 ${
                selected
                  ? "border-[#7C4DFF] bg-[#7C4DFF]"
                  : "border-[#494455] bg-transparent"
              }`}
              onPress={() => onChange(option.value)}
            >
              <Text className="text-[14px] font-bold text-white">
                {option.description}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}