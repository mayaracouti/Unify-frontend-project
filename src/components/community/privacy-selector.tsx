import { Pressable, Text, View } from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";
import type { ComponentProps } from "react";

import { useTTS } from "../../accessibility/tts";
import type { CommunityPrivacy } from "../../types/community";

const PRIVACY_OPTIONS: {
  key: CommunityPrivacy;
  label: string;
  icon: ComponentProps<typeof Ionicons>["name"];
  description: string;
}[] = [
  {
    key: "PUBLIC",
    label: "Pública",
    icon: "globe-outline",
    description: "Qualquer pessoa entra na comunidade imediatamente.",
  },
  {
    key: "PRIVATE",
    label: "Privada",
    icon: "lock-closed-outline",
    description: "Novas entradas ficam pendentes até a aprovação de um administrador ou moderador.",
  },
];

export function CommunityPrivacySelector({
  value,
  onChange,
}: {
  value: CommunityPrivacy;
  onChange: (privacy: CommunityPrivacy) => void;
}) {
  const { speak } = useTTS();
  const selectedOption = PRIVACY_OPTIONS.find((option) => option.key === value);

  return (
    <View>
      <View className="flex-row rounded-2xl border border-[#3A3246] bg-[#1A1C1F] p-1.5">
        {PRIVACY_OPTIONS.map((option) => {
          const isActive = value === option.key;

          return (
            <Pressable
              key={option.key}
              className={`flex-1 flex-row items-center justify-center gap-2 rounded-xl px-4 py-3 ${
                isActive ? "bg-[#7C4DFF]" : "bg-transparent"
              }`}
              accessibilityRole="radio"
              accessibilityLabel={`Comunidade ${option.label.toLowerCase()}`}
              accessibilityState={{ selected: isActive }}
              onPress={() => {
                speak(`Comunidade ${option.label.toLowerCase()}. ${option.description}`);
                onChange(option.key);
              }}
            >
              <Ionicons
                name={option.icon}
                size={16}
                color={isActive ? "#FCF6FF" : "#CAC3D8"}
              />
              <Text
                className={`text-[13px] font-black ${
                  isActive ? "text-[#FCF6FF]" : "text-content-secondary"
                }`}
              >
                {option.label}
              </Text>
            </Pressable>
          );
        })}
      </View>

      {selectedOption ? (
        <Text className="mt-3 text-[14px] font-semibold leading-6 text-[#CAC3D8]">
          {selectedOption.description}
        </Text>
      ) : null}
    </View>
  );
}
