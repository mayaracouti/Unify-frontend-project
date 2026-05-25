import { type ComponentProps, type PropsWithChildren, useEffect, useState } from "react";
import Ionicons from "@expo/vector-icons/Ionicons";
import { useIsFocused } from "@react-navigation/native";
import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import { Image, Pressable, ScrollView, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { GlobalBottomNav } from "../../src/components/navigation/global-bottom-nav";
import { useRequireCompletedOnboarding } from "../../src/hooks/useRequireCompletedOnboarding";
import { requestForegroundLocationPermissionState } from "../../src/utils/location";

type MatchProfile = {
  accessibilityNeeds: string[];
  age: number;
  id: string;
  autonomyLevel: string;
  bio: string;
  communicationPreferences: string[];
  connectionPreferences: string[];
  disabilities: string[];
  distanceKm: number;
  energyLevel: string;
  gender: string;
  occupation: string;
  pronouns: string;
  interests: string[];
  lifestyleTypes: string[];
  location: string;
  loveLanguages: string[];
  name: string;
  photos: string[];
};

const matchProfiles: MatchProfile[] = [];

function ChipList({ items }: { items: string[] }) {
  if (items.length === 0) {
    return null;
  }

  return (
    <View className="mt-3 flex-row flex-wrap gap-2">
      {items.map((item) => (
        <View key={item} className="rounded-full bg-[#24262B] px-4 py-3">
          <Text className="text-[15px] font-bold text-white">{item}</Text>
        </View>
      ))}
    </View>
  );
}

function InfoRow({
  icon,
  label,
}: {
  icon: ComponentProps<typeof Ionicons>["name"];
  label: string;
}) {
  return (
    <View className="border-b border-white/10 py-3">
      <View className="flex-row items-center">
        <Ionicons name={icon} size={21} color="#A7A6B3" />
        <Text className="ml-3 text-[18px] font-semibold text-white">
          {label}
        </Text>
      </View>
    </View>
  );
}

function DetailCard({
  children,
  icon,
  title,
}: PropsWithChildren<{
  icon: ComponentProps<typeof Ionicons>["name"];
  title: string;
}>) {
  return (
    <View className="mb-4 rounded-[28px] bg-[#111214] p-5">
      <View className="flex-row items-center">
        <Ionicons name={icon} size={23} color="#A7A6B3" />
        <Text className="ml-3 text-[19px] font-black text-[#C9C6D3]">
          {title}
        </Text>
      </View>
      {children}
    </View>
  );
}

function ProfileDetailsPanel({
  onAccept,
  onClose,
  onReject,
  profile,
}: {
  onAccept: () => void;
  onClose: () => void;
  onReject: () => void;
  profile: MatchProfile;
}) {
  return (
    <View className="absolute inset-0 bg-black">
      <ScrollView
        className="flex-1"
        contentContainerClassName="px-4 pb-32 pt-10"
        showsVerticalScrollIndicator={false}
      >
        <View className="mb-5 flex-row items-start justify-between px-1">
          <Text className="text-[36px] font-semibold text-white">
            {profile.name}, {profile.age}
          </Text>
          <Pressable
            accessibilityLabel="Fechar detalhes"
            className="h-12 w-12 items-center justify-center rounded-full bg-white"
            onPress={onClose}
          >
            <Ionicons name="arrow-down" size={28} color="#111214" />
          </Pressable>
        </View>

        <DetailCard title="Sobre mim" icon="chatbubble-ellipses-outline">
          <Text className="mt-4 text-[20px] font-semibold leading-8 text-white">
            {profile.bio}
          </Text>
        </DetailCard>

        <DetailCard title="Informações básicas" icon="id-card-outline">
          <InfoRow icon="location-outline" label={`${profile.distanceKm} km de distância`} />
          <InfoRow icon="briefcase-outline" label={profile.occupation} />
          <InfoRow icon="home-outline" label={profile.location} />
          <InfoRow icon="person-circle-outline" label={profile.pronouns} />
          <InfoRow icon="male-female-outline" label={profile.gender} />
          <InfoRow icon="accessibility-outline" label={profile.disabilities.join(", ")} />
        </DetailCard>

        <DetailCard title="Tô procurando" icon="search-outline">
          <ChipList items={profile.connectionPreferences} />
        </DetailCard>

        <DetailCard title="Interesses" icon="sparkles-outline">
          <ChipList items={profile.interests} />
        </DetailCard>

        <DetailCard title="Acessibilidade e autonomia" icon="body-outline">
          <InfoRow icon="walk-outline" label={profile.autonomyLevel} />
          <ChipList items={profile.accessibilityNeeds} />
        </DetailCard>

        <DetailCard title="Comunicação" icon="chatbubbles-outline">
          <ChipList items={profile.communicationPreferences} />
        </DetailCard>

        <DetailCard title="Estilo de vida" icon="leaf-outline">
          <InfoRow icon="flash-outline" label={profile.energyLevel} />
          <ChipList items={profile.lifestyleTypes} />
        </DetailCard>

        <DetailCard title="Linguagem do amor" icon="heart-outline">
          <ChipList items={profile.loveLanguages} />
        </DetailCard>
      </ScrollView>

      <LinearGradient
        colors={["transparent", "rgba(0,0,0,0.9)"]}
        style={{
          bottom: 0,
          height: 132,
          left: 0,
          position: "absolute",
          right: 0,
        }}
      >
        <View className="absolute bottom-8 left-0 right-0 flex-row items-center justify-center gap-11">
          <Pressable
            className="h-[68px] w-[68px] items-center justify-center rounded-full bg-[#26282B]"
            onPress={onReject}
          >
            <Ionicons name="close" size={36} color="#FF2D73" />
          </Pressable>
          <Pressable
            accessibilityLabel="Dar match"
            className="h-[68px] w-[68px] items-center justify-center rounded-full bg-[#26282B]"
            onPress={onAccept}
          >
            <Ionicons name="heart" size={36} color="#65E568" />
          </Pressable>
        </View>
      </LinearGradient>
    </View>
  );
}

function getFirstAttachedPhoto(profile: Pick<MatchProfile, "photos">) {
  return profile.photos[0] ?? null;
}

function ProfilePhoto({ profile }: { profile: MatchProfile }) {
  const photoUrl = getFirstAttachedPhoto(profile);

  if (photoUrl) {
    return (
      <Image
        accessibilityIgnoresInvertColors
        className="h-full w-full"
        resizeMode="cover"
        source={{ uri: photoUrl }}
      />
    );
  }

  return (
    <LinearGradient
      colors={["#472D74", "#16151C"]}
      style={{
        alignItems: "center",
        height: "100%",
        justifyContent: "center",
        width: "100%",
      }}
    >
      <Ionicons name="person" size={132} color="#CDBDFF" />
    </LinearGradient>
  );
}

export default function Matches() {
  useRequireCompletedOnboarding();

  const isFocused = useIsFocused();
  const router = useRouter();
  const [currentProfileIndex, setCurrentProfileIndex] = useState(0);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const currentProfile = matchProfiles[currentProfileIndex] ?? null;

  useEffect(() => {
    if (!isFocused) {
      return;
    }

    let active = true;

    async function ensureLocationPermission() {
      try {
        await requestForegroundLocationPermissionState();

        if (!active) {
          return;
        }
      } catch {
        // Keep discovery available even when the permission prompt fails.
      }
    }

    void ensureLocationPermission();

    return () => {
      active = false;
    };
  }, [isFocused]);

  function showNextProfile() {
    setCurrentProfileIndex((previousIndex) => previousIndex + 1);
    setDetailsOpen(false);
  }

  function restartProfiles() {
    setCurrentProfileIndex(0);
    setDetailsOpen(false);
  }

  function acceptCurrentProfile() {
    if (!currentProfile) {
      return;
    }

    router.push({
      pathname: "/matches/success",
      params: {
        name: currentProfile.name,
      },
    });
  }

  return (
    <View className="flex-1 bg-black">
      <SafeAreaView className="flex-1 bg-black">
        <View className="flex-1 overflow-hidden rounded-b-[44px] bg-[#111214]">
          {currentProfile ? (
            <>
              <ProfilePhoto profile={currentProfile} />

              <LinearGradient
                colors={[
                  "rgba(0,0,0,0.02)",
                  "rgba(0,0,0,0.34)",
                  "rgba(0,0,0,0.92)",
                ]}
                locations={[0, 0.46, 1]}
                style={{
                  bottom: 0,
                  left: 0,
                  position: "absolute",
                  right: 0,
                  top: 0,
                }}
              />

              <View className="absolute left-8 right-8 top-6 flex-row items-center justify-between">
                <Pressable
                  className="h-12 w-12 items-center justify-center rounded-full bg-black/30"
                  onPress={() => router.push("/matches/my-profile")}
                >
                  <Ionicons name="options-outline" size={24} color="#ffffff" />
                </Pressable>
                <View className="h-12 w-12" />
              </View>

              <View className="absolute bottom-32 left-7 right-7">
                <View className="mb-3 flex-row justify-end">
                  <Pressable
                    accessibilityLabel="Ver gostos e preferências"
                    className="h-12 w-12 items-center justify-center rounded-full border border-white/35 bg-black/25"
                    onPress={() => setDetailsOpen((isOpen) => !isOpen)}
                  >
                    <Ionicons
                      name={detailsOpen ? "arrow-down" : "arrow-up"}
                      size={28}
                      color="#ffffff"
                    />
                  </Pressable>
                </View>

                <Text className="text-[34px] font-semibold text-white">
                  {currentProfile.name}{" "}
                  <Text className="text-[34px] font-normal text-white/75">
                    {currentProfile.age}
                  </Text>
                </Text>

                <View className="mt-3 flex-row items-center">
                  <Ionicons name="briefcase-outline" size={22} color="#ffffff" />
                  <Text className="ml-2.5 text-[18px] font-semibold text-white">
                    {currentProfile.occupation}
                  </Text>
                </View>

                <Text className="mt-4 text-[18px] font-semibold leading-7 text-white">
                  {currentProfile.bio}
                </Text>

              </View>

              <View className="absolute bottom-8 left-0 right-0 flex-row items-center justify-center gap-11">
                <Pressable
                  className="h-[68px] w-[68px] items-center justify-center rounded-full bg-[#26282B]"
                  onPress={showNextProfile}
                >
                  <Ionicons name="close" size={36} color="#FF2D73" />
                </Pressable>
                <Pressable
                  accessibilityLabel="Dar match"
                  className="h-[68px] w-[68px] items-center justify-center rounded-full bg-[#26282B]"
                  onPress={acceptCurrentProfile}
                >
                  <Ionicons name="heart" size={36} color="#65E568" />
                </Pressable>
              </View>

              {detailsOpen ? (
                <ProfileDetailsPanel
                  profile={currentProfile}
                  onAccept={acceptCurrentProfile}
                  onClose={() => setDetailsOpen(false)}
                  onReject={showNextProfile}
                />
              ) : null}
            </>
          ) : (
            <View className="flex-1 items-center justify-center px-8">
              <Text className="text-center text-[28px] font-black text-white">
                Você chegou ao fim da lista
              </Text>
              <Text className="mt-4 text-center text-[16px] font-semibold leading-6 text-[#CAC3D8]">
                Novos perfis aparecerão aqui quando estiverem disponíveis.
              </Text>
              <Pressable
                className="mt-8 rounded-full bg-[#EAEA00] px-8 py-4"
                onPress={restartProfiles}
              >
                <Text className="text-[16px] font-black text-[#202020]">
                  Ver novamente
                </Text>
              </Pressable>
            </View>
          )}
        </View>

        <GlobalBottomNav />
      </SafeAreaView>
    </View>
  );
}
