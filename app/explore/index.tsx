import { useEffect, useState } from "react";
import { ActivityIndicator, ScrollView, Text, View } from "react-native";

import { AppTabScreen } from "../../src/components/navigation/app-tab-screen";
import { profileService } from "../../src/services/profileService";
import type { UserProfileDirectoryItemResponse } from "../../src/types/profile";
import { formatApiErrorMessage } from "../../src/utils/auth";

function displayName(profile: UserProfileDirectoryItemResponse, index: number) {
  const firstName = profile.user?.name ?? profile.name;
  const lastName = profile.user?.lastName ?? profile.lastName;
  const fullName = [firstName, lastName].filter(Boolean).join(" ").trim();

  return fullName || `Perfil ${index + 1}`;
}

function joinDescriptions(items: { description: string }[], fallback: string) {
  return items.length > 0
    ? items.map((item) => item.description).join(" • ")
    : fallback;
}

export default function Explore() {
  const [profiles, setProfiles] = useState<UserProfileDirectoryItemResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;

    async function loadProfiles() {
      try {
        const response = await profileService.getAllProfiles();

        if (!active) {
          return;
        }

        setProfiles(response);
      } catch (nextError) {
        if (active) {
          setError(
            formatApiErrorMessage(
              nextError,
              "Não foi possível carregar os perfis agora."
            )
          );
        }
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    }

    void loadProfiles();

    return () => {
      active = false;
    };
  }, []);

  return (
    <AppTabScreen
      title="Explorar"
      subtitle="Veja perfis disponíveis e descubra conexões com mais afinidade."
    >
      {loading ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator color="#EAEA00" />
        </View>
      ) : error ? (
        <View className="rounded-[28px] bg-[#111214] p-6">
          <Text className="text-[16px] font-bold text-red-300">{error}</Text>
        </View>
      ) : (
        <ScrollView
          className="flex-1"
          contentContainerClassName="pb-4"
          showsVerticalScrollIndicator={false}
        >
          {profiles.length === 0 ? (
            <View className="rounded-[28px] bg-[#111214] p-6">
              <Text className="text-[18px] font-black text-white">
                Nenhum perfil disponível agora
              </Text>
              <Text className="mt-3 text-[15px] font-semibold leading-6 text-[#CAC3D8]">
                Assim que novos perfis estiverem disponíveis, eles aparecerão aqui.
              </Text>
            </View>
          ) : (
            profiles.map((profile, index) => (
              <View key={profile.id ?? `profile-${index}`} className="mb-4 rounded-[28px] bg-[#111214] p-6">
                <Text className="text-[20px] font-black text-white">
                  {displayName(profile, index)}
                </Text>
                <Text className="mt-1 text-[13px] font-bold uppercase tracking-[1.2px] text-[#EAEA00]">
                  {profile.gender?.description ?? "Perfil disponível"}
                </Text>
                <Text className="mt-4 text-[15px] font-semibold leading-6 text-[#E5E2E1]">
                  {profile.bio?.trim() || "Este perfil ainda não adicionou uma bio."}
                </Text>

                <View className="mt-5 rounded-2xl bg-[#1A1C1F] p-4">
                  <Text className="text-[12px] font-black uppercase tracking-[1.2px] text-[#9DDCFF]">
                    Interesses
                  </Text>
                  <Text className="mt-2 text-[14px] font-semibold leading-6 text-[#CAC3D8]">
                    {joinDescriptions(profile.interestTypes, "Sem interesses públicos informados.")}
                  </Text>
                </View>

                <View className="mt-3 rounded-2xl bg-[#1A1C1F] p-4">
                  <Text className="text-[12px] font-black uppercase tracking-[1.2px] text-[#9DDCFF]">
                    Comunicação
                  </Text>
                  <Text className="mt-2 text-[14px] font-semibold leading-6 text-[#CAC3D8]">
                    {joinDescriptions(
                      profile.communicationForms,
                      "Sem preferências de comunicação públicas informadas."
                    )}
                  </Text>
                </View>
              </View>
            ))
          )}
        </ScrollView>
      )}
    </AppTabScreen>
  );
}