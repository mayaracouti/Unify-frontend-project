/**
 * Ponte entre a camada de API (baixo nivel, sem React) e o `AuthProvider`.
 *
 * O interceptor de erro precisa encerrar a sessao quando o backend responde
 * `USER_NOT_FOUND`, mas a limpeza completa do estado do cliente vive em
 * `storage/clientStorage`, que importa services/componentes que por sua vez
 * importam o proprio cliente HTTP. Importar aquele modulo aqui criaria um ciclo
 * de imports; por isso o `AuthProvider` REGISTRA o handler e este modulo (sem
 * nenhuma dependencia) apenas o repassa.
 */
type UserNotFoundHandler = () => Promise<void> | void;

let userNotFoundHandler: UserNotFoundHandler | null = null;

export function setUserNotFoundHandler(handler: UserNotFoundHandler | null): void {
  userNotFoundHandler = handler;
}

/**
 * Executa o handler registrado. Retorna `false` quando nao ha handler (ou
 * quando ele falha), para que quem chamou aplique o fallback de limpeza.
 */
export async function notifyUserNotFound(): Promise<boolean> {
  if (!userNotFoundHandler) {
    return false;
  }

  try {
    await userNotFoundHandler();
    return true;
  } catch {
    return false;
  }
}
