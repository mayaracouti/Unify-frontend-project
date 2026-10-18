import { useState } from "react";
import { customApiCall } from "../../../api/customApi";
import { Image, Text, View } from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";
import { AuthenticatedRemoteImage } from "../../profile/authenticated-remote-image";
import { postImageLabel } from "../../../community/post-content";
import { ImageDescriptionAudio } from "./image-description-audio";
export interface PostImageProps {
  uri: string;
  description?: string | null;
  authorName: string;
  authToken: string | null;
  version?: string | null;
  analyzeImage?: () => Promise<string>;
}
export function PostImage({ uri, description, authorName, authToken, version, analyzeImage }: PostImageProps) {
  const identity = `${uri}:${version ?? ""}:${authToken ?? ""}`;
  const [generated, setGenerated] = useState<{ identity: string; text: string } | null>(null);
  const effectiveDescription = description?.trim() || (generated?.identity === identity ? generated.text : null);
  const postPath = uri.match(/\/(communities|users)\/posts\/([^/?]+)\/media(?:[?].*)?$/);
  const requestDescription = postPath ? async () => {
    const path = `/${postPath[1]}/posts/${postPath[2]}`;
    // A cached card can be stale. Refresh before asking for another generation.
    let post = await customApiCall.get<{ imageDescription?: string | null }>(path, undefined, { requiresAuth: true });
    if (!post.imageDescription?.trim()) {
      await customApiCall.post(`${path}/image-description`, undefined, { requiresAuth: true });
      post = await customApiCall.get<{ imageDescription?: string | null }>(path, undefined, { requiresAuth: true });
    }
    const result = post.imageDescription?.trim() || "";
    if (result) setGenerated({ identity, text: result });
    return result;
  } : analyzeImage;
  const label = postImageLabel(effectiveDescription, authorName);
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
      {effectiveDescription ? <Text className="mt-2 text-[14px] leading-6 text-[#CAC3D8]">Descrição da imagem: {effectiveDescription}</Text> : null}
      {requestDescription || effectiveDescription ? <ImageDescriptionAudio key={`${uri}:${version ?? ""}:${authToken ?? ""}`} description={effectiveDescription} analyzeImage={requestDescription} /> : null}
    </View>
  );
}
