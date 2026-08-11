import { useCallback, useState } from "react";
import { formatApiErrorMessage } from "../utils/auth";

export type AsyncStatus = "idle" | "loading" | "success" | "error";

/**
 * Padroniza o trio loading / error / dados usado em praticamente toda tela.
 * Substitui os `useState` soltos espalhados pelo app.
 */
export function useAsyncState<T>(initialData: T) {
  const [data, setData] = useState<T>(initialData);
  const [status, setStatus] = useState<AsyncStatus>("idle");
  const [error, setError] = useState<string>("");

  const run = useCallback(
    async (task: () => Promise<T>, fallbackMessage: string) => {
      setStatus("loading");
      setError("");
      try {
        const result = await task();
        setData(result);
        setStatus("success");
        return result;
      } catch (caught) {
        setError(formatApiErrorMessage(caught, fallbackMessage));
        setStatus("error");
        return undefined;
      }
    },
    []
  );

  return { data, setData, status, error, setError, run,
           isLoading: status === "loading", isError: status === "error" };
}
