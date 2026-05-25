import Ionicons from "@expo/vector-icons/Ionicons";
import { LinearGradient } from "expo-linear-gradient";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Pressable, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { AuthenticatedRemoteImage } from "../../src/components/profile/authenticated-remote-image";
import { useAppShell } from "../../src/context/AppShellContext";
import { useAuth } from "../../src/context/AuthContext";
import { useRequireCompletedOnboarding } from "../../src/hooks/useRequireCompletedOnboarding";

function MatchPhoto({
  borderColor,
  initial,
  photoUrl,
  token,
}: {
  borderColor: string;
  initial: string;
  photoUrl?: string | null;
  token: string | null;
}) {
  return (
    <View
      className="h-[132px] w-[132px] items-center justify-center overflow-hidden rounded-full border-[4px] bg-[#353534]"
      style={{ borderColor }}
    >
      {photoUrl ? (
        <AuthenticatedRemoteImage
          authToken={token}
          className="h-full w-full"
          fallback={
            <LinearGradient
              colors={["#544066", "#27212F"]}
              style={{
                alignItems: "center",
                height: "100%",
                justifyContent: "center",
                width: "100%",
              }}
            >
              <Text className="text-[42px] font-black text-[#E8DEFF]">
                {initial}
              </Text>
            </LinearGradient>
          }
          resizeMode="cover"
          uri={photoUrl}
        />
      ) : (
        <LinearGradient
          colors={["#544066", "#27212F"]}
          style={{
            alignItems: "center",
            height: "100%",
            justifyContent: "center",
            width: "100%",
          }}
        >
          <Text className="text-[42px] font-black text-[#E8DEFF]">
            {initial}
          </Text>
        </LinearGradient>
      )}
    </View>
  );
}

export default function MatchSuccess() {
  useRequireCompletedOnboarding();

  const router = useRouter();
  const { session } = useAuth();
  const { currentUserPhotoUrl } = useAppShell();
  const { name, photo } = useLocalSearchParams<{ name?: string; photo?: string }>();
  const matchedName = typeof name === "string" && name.trim() ? name.trim() : "essa pessoa";
  const matchedInitial = matchedName.charAt(0).toUpperCase();
  const matchedPhoto = typeof photo === "string" && photo.trim() ? photo.trim() : null;
  const authToken = session?.accessToken ?? null;

  return (
    <LinearGradient
      colors={["#C600FF", "#6F1BC2", "#0B075A"]}
      locations={[0, 0.46, 1]}
      start={{ x: 0.15, y: 0 }}
      end={{ x: 0.65, y: 1 }}
      style={{ flex: 1 }}
    >
      <SafeAreaView className="flex-1 px-6">
        <View className="flex-1 items-center justify-center pb-10 pt-5">
          <View className="h-[66px] w-[226px] flex-row items-center justify-center rounded-full border-[2px] border-[#CDBDFF] bg-[#353534] px-4">
            <Ionicons name="checkmark-circle" size={26} color="#CDBDFF" />
            <Text className="ml-3 text-[18px] font-black leading-[22px] text-[#E5E2E1]">
              Nova conexão{"\n"}adicionada
            </Text>
          </View>

          <View className="mt-14 h-[166px] w-full max-w-[258px] items-center justify-center">
            <View className="absolute left-0 top-4 rotate-[-4deg]">
              <MatchPhoto
                borderColor="#CDBDFF"
                initial="U"
                photoUrl={currentUserPhotoUrl}
                token={authToken}
              />
            </View>
            <View className="absolute right-0 top-4 rotate-[3deg]">
              <MatchPhoto
                borderColor="#00DAF3"
                initial={matchedInitial}
                photoUrl={matchedPhoto}
                token={authToken}
              />
            </View>

            <View className="absolute top-[68px] h-[46px] w-[46px] items-center justify-center rounded-full bg-[#EAEA00]">
              <Ionicons name="heart" size={22} color="#686800" />
            </View>
          </View>

          <Text className="mt-10 text-center text-[34px] font-black text-[#E8DEFF]">
            Deu Match!
          </Text>

          <Text className="mt-4 max-w-[310px] text-center text-[20px] font-bold leading-8 text-[#CAC3D8]">
            Você e {matchedName} demonstraram interesse mútuo. Que tal quebrar o gelo?
          </Text>

          <View className="mb-4 mt-10 w-full max-w-[320px] gap-4">
            <Pressable className="h-[58px] w-full flex-row items-center justify-center rounded-[14px] border-b-[5px] border-[#494900] bg-[#EAEA00]">
              <Ionicons name="chatbox" size={24} color="#686800" />
              <Text className="ml-3 text-[20px] font-black text-[#686800]">
                Iniciar Conversa
              </Text>
            </Pressable>

            <Pressable
              className="h-[58px] w-full items-center justify-center rounded-[14px] border-[2px] border-[#948EA1] bg-transparent"
              onPress={() => router.replace("/matches")}
            >
              <Text className="text-[20px] font-black text-[#E5E2E1]">
                Continuar Navegando
              </Text>
            </Pressable>
          </View>

        </View>
      </SafeAreaView>
    </LinearGradient>
  );
}
