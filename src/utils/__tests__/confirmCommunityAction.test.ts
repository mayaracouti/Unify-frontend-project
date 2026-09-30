import { Alert, Platform } from "react-native";
import { confirmCommunityAction } from "../confirmCommunityAction";
const originalOS = Platform.OS;
const originalConfirm = window.confirm;
afterEach(() => {
  Object.defineProperty(Platform, "OS", { value: originalOS, configurable: true });
  window.confirm = originalConfirm;
  jest.restoreAllMocks();
});

it("cancelamento no navegador não executa ação destrutiva", () => {
  Object.defineProperty(Platform, "OS", { value: "web", configurable: true });
  window.confirm = jest.fn(() => false);
  const action = jest.fn();
  confirmCommunityAction("Excluir", "Tem certeza?", "Excluir", action);
  expect(action).not.toHaveBeenCalled();
  window.confirm = jest.fn(() => true);
  confirmCommunityAction("Excluir", "Tem certeza?", "Excluir", action);
  expect(action).toHaveBeenCalledTimes(1);
});

it("no celular só executa a exclusão após confirmar o alerta", () => {
  Object.defineProperty(Platform, "OS", { value: "android", configurable: true });
  const alert = jest.spyOn(Alert, "alert");
  const action = jest.fn();
  confirmCommunityAction("Excluir", "Tem certeza?", "Excluir", action);
  expect(action).not.toHaveBeenCalled();
  alert.mock.calls[0][2]?.[1].onPress?.();
  expect(action).toHaveBeenCalledTimes(1);
});
