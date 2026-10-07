import Ionicons from "@expo/vector-icons/Ionicons";
import { useEffect, useRef, useState } from "react";
import { ActivityIndicator, Pressable, Text, View } from "react-native";
import { useTTS } from "../../../accessibility/tts";
import { announceForAccessibility } from "../../../utils/accessibilityAnnouncements";
import { formatApiErrorMessage } from "../../../utils/auth";
import { splitPostSpeech } from "../../../utils/personalPostContent";

export function ImageDescriptionAudio({ analyzeImage }: { analyzeImage: () => Promise<string> }) {
  const { speakSequence, stop } = useTTS();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [description, setDescription] = useState<string | null>(null);
  const generation = useRef(0);
  const pending = useRef(false);
  useEffect(() => () => { generation.current++; }, []);

  async function readImage() {
    if (pending.current) return;
    const request = ++generation.current;
    pending.current = true;
    setLoading(true);
    setError(null);
    try {
      const result = description ?? (await analyzeImage()).trim();
      if (request !== generation.current) return;
      if (!result) throw new Error("A análise não retornou uma descrição. Tente novamente.");
      setDescription(result);
      const text = `Descrição gerada por inteligência artificial: ${result}`;
      speakSequence(splitPostSpeech(text), { force: true });
      announceForAccessibility(text);
    } catch (cause) {
      if (request !== generation.current) return;
      const message = formatApiErrorMessage(cause, "Não foi possível analisar a imagem. Tente novamente.");
      setError(message);
      speakSequence(splitPostSpeech(message), { force: true });
      announceForAccessibility(message);
    } finally {
      if (request === generation.current) {
        pending.current = false;
        setLoading(false);
      }
    }
  }

  return (
    <View className="mt-2">
      <Text className="text-[14px] text-[#CAC3D8]">A IA analisa a imagem para descrevê-la em áudio.</Text>
      <Pressable accessibilityRole="button" accessibilityLabel="Ouvir descrição da imagem"
        accessibilityHint="Analisa o conteúdo visual com inteligência artificial e lê o resultado em voz alta."
        accessibilityState={{ disabled: loading, busy: loading }} disabled={loading}
        className="min-h-[44px] flex-row items-center gap-2 py-2" onPress={readImage}>
        {loading ? <ActivityIndicator color="#EAEA00" /> : <Ionicons name="volume-high-outline" size={22} color="#EAEA00" importantForAccessibility="no" />}
        <Text className="flex-1 font-bold text-[#EAEA00]">{loading ? "Analisando imagem…" : "Ouvir descrição da imagem"}</Text>
      </Pressable>
      {error ? <Text accessibilityRole="alert" className="text-[14px] text-[#CAC3D8]">{error}</Text> : null}
      {description ? <Text className="text-[14px] leading-6 text-[#CAC3D8]">Descrição gerada por IA: {description}</Text> : null}
      <Pressable accessibilityRole="button" accessibilityLabel="Parar áudio da descrição"
        accessibilityHint="Interrompe a leitura e cancela a reprodução de uma análise pendente"
        className="min-h-[44px] justify-center py-2" onPress={() => {
          generation.current++;
          pending.current = false;
          setLoading(false);
          stop();
          announceForAccessibility("Leitura da descrição interrompida.");
        }}>
        <Text className="font-semibold text-[#CAC3D8]">Parar áudio</Text>
      </Pressable>
    </View>
  );
}
