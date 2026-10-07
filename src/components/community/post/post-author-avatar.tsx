import { Pressable, Text, View } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { AuthenticatedRemoteImage } from "../../profile/authenticated-remote-image";
import { communityService } from "../../../services/communityService";
function getInitials(name?: string | null) {
  return (name ?? "")
    .trim()
    .split(" ")
    .filter(Boolean)
    .map((namePart) => namePart[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

export function AuthorAvatar({
  authToken,
  name,
  avatarData,
  userProfileId,
  onOpenProfile,
}: {
  authToken: string | null;
  name?: string | null;
  avatarData?: string | null;
  userProfileId?: string | null;
  onOpenProfile?: (userProfileId: string, name?: string | null) => void;
}) {
  const initials = getInitials(name);
  const avatarUrl = communityService.resolveAssetUrl(avatarData);
  const resolvedProfileId = userProfileId?.trim() || null;
  const canOpenProfile = Boolean(resolvedProfileId && onOpenProfile);

  const content = (
    <View
      className="h-14 w-14 items-center justify-center overflow-hidden rounded-full border-2 border-[#CDBDFF] bg-[#353534]"
      importantForAccessibility={canOpenProfile ? "no-hide-descendants" : "auto"}
    >
      {avatarUrl ? (
        <AuthenticatedRemoteImage
          uri={avatarUrl}
          authToken={authToken}
          className="h-full w-full"
          resizeMode="cover"
          fallback={
            <LinearGradient
              colors={["#CDBDFF", "#7C4DFF"]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              className="h-full w-full items-center justify-center"
            >
              <Text className="text-[16px] font-black text-white">{initials || "?"}</Text>
            </LinearGradient>
          }
        />
      ) : (
        <LinearGradient
          colors={["#CDBDFF", "#7C4DFF"]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          className="h-full w-full items-center justify-center"
        >
          <Text className="text-[16px] font-black text-white">{initials || "?"}</Text>
        </LinearGradient>
      )}
    </View>
  );

  if (!canOpenProfile || !resolvedProfileId) {
    return content;
  }

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`Abrir perfil de ${name?.trim() || "pessoa sem nome"}`}
      accessibilityHint="Abre o perfil público desta pessoa"
      hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
      onPress={() => onOpenProfile?.(resolvedProfileId, name)}
    >
      {content}
    </Pressable>
  );
}

