import { Image, Text, View } from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";
import { AuthenticatedRemoteImage } from "../../profile/authenticated-remote-image";
import { postImageLabel } from "../../../community/post-content";
export interface PostImageProps {
  uri: string;
  description?: string | null;
  authorName: string;
  authToken: string | null;
  version?: string | null;
}
export function PostImage({ uri, description, authorName, authToken, version }: PostImageProps) {
  const label = postImageLabel(description, authorName);
  const local = /^(file:|content:|blob:|data:)/i.test(uri);
  const sourceUri = !local && version ? `${uri}${uri.includes("?") ? "&" : "?"}v=${encodeURIComponent(version)}` : uri;
  return (
    <View className="mt-4">
      <View className="aspect-video w-full overflow-hidden rounded-lg border border-[#494455] bg-[#1F1F23]">
        {local ? <Image source={{ uri: sourceUri }} className="h-full w-full" resizeMode="cover" accessible accessibilityLabel={label} /> : (
          <AuthenticatedRemoteImage uri={sourceUri} authToken={authToken} className="h-full w-full" resizeMode="cover"
            accessibilityLabel={label} fallback={<View accessible accessibilityRole="image" accessibilityLabel={`${label}. Imagem indisponível.`} className="flex-1 items-center justify-center"><Ionicons name="image-outline" size={30} color="#CAC3D8" /></View>} />
        )}
      </View>
      {description?.trim() ? <Text className="mt-2 text-[14px] leading-6 text-[#CAC3D8]">Descrição da imagem: {description.trim()}</Text> : null}
    </View>
  );
}
