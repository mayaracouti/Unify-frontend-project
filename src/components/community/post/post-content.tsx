import { Pressable, Text, View } from "react-native";
import { PostImage } from "./post-image";
export function PostContent({ body, mediaUri, imageDescription, authorName, authToken, onRead, onStop, editedAt }: {
  body: string; mediaUri?: string | null; imageDescription?: string | null; authorName: string;
  editedAt?: string | null;
  authToken: string | null; onRead: () => void; onStop?: () => void;
}) {
  return <View>
    <Pressable onPress={onRead} accessibilityRole="button" accessibilityLabel={mediaUri ? `${body}. Publicação com imagem` : body} accessibilityHint="Lê o texto completo e a descrição da imagem em voz alta">
      <Text className="mt-4 text-[17px] font-semibold leading-7 text-[#E5E2E1]">{body}</Text>
    </Pressable>
    {mediaUri ? <PostImage version={editedAt} uri={mediaUri} description={imageDescription} authorName={authorName} authToken={authToken} /> : null}
    {onStop ? <Pressable onPress={onStop} accessibilityRole="button" accessibilityLabel="Parar leitura desta publicação" className="mt-2 min-h-[44px] justify-center"><Text className="text-[#CAC3D8]">Parar leitura</Text></Pressable> : null}
  </View>;
}
