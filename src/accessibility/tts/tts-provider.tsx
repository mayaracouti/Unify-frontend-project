/**
 * Provider do TTS: dispara a hidratacao da preferencia persistida na
 * inicializacao do app, ANTES do gate de onboarding e de qualquer tela
 * interativa depender da fala. Deve envolver o navegador raiz.
 */
import { useEffect, type PropsWithChildren } from "react";

import { initializeTtsService } from "./tts-service";

export function TtsProvider({ children }: PropsWithChildren) {
  useEffect(() => {
    void initializeTtsService();
  }, []);

  return <>{children}</>;
}
