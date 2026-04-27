export type GlobalToastVariant = "error" | "info" | "success" | "warning";

export interface GlobalToastInput {
  message: string;
  title?: string;
  variant?: GlobalToastVariant;
  durationMs?: number;
}

export interface GlobalToast extends Required<Omit<GlobalToastInput, "title" | "variant" | "durationMs">> {
  id: string;
  title: string;
  variant: GlobalToastVariant;
  durationMs: number;
}

type GlobalToastListener = (toast: GlobalToast) => void;

const listeners = new Set<GlobalToastListener>();

let toastId = 0;
let lastToastSignature = "";
let lastToastTimestamp = 0;

function getDefaultTitle(variant: GlobalToastVariant): string {
  switch (variant) {
    case "error":
      return "Erro";
    case "success":
      return "Concluído";
    case "warning":
      return "Atenção";
    default:
      return "Informação";
  }
}

export function showGlobalToast(input: GlobalToastInput): void {
  const message = input.message.trim();

  if (!message) {
    return;
  }

  const variant = input.variant ?? "info";
  const title = input.title?.trim() || getDefaultTitle(variant);
  const signature = `${variant}:${title}:${message}`;
  const timestamp = Date.now();

  if (signature === lastToastSignature && timestamp - lastToastTimestamp < 900) {
    return;
  }

  lastToastSignature = signature;
  lastToastTimestamp = timestamp;
  toastId += 1;

  const toast: GlobalToast = {
    id: `toast-${toastId}`,
    title,
    message,
    variant,
    durationMs: input.durationMs ?? 4200,
  };

  listeners.forEach((listener) => {
    try {
      listener(toast);
    } catch {
      // Toast consumers should not break global error reporting.
    }
  });
}

export function subscribeToGlobalToasts(listener: GlobalToastListener): () => void {
  listeners.add(listener);

  return () => {
    listeners.delete(listener);
  };
}