import { TextInput } from "react-native";
import { ChatComposer } from "../chat-composer";

jest.mock("../../../accessibility/tts", () => ({ useTTS: () => ({ speak: jest.fn() }) }));
jest.mock("../../../hooks/useAudioRecorder", () => ({
  MAX_AUDIO_DURATION_SECONDS: 60,
  useAudioRecorder: () => ({ recording: false }),
}));
jest.mock("@expo/vector-icons/Ionicons", () => "Icon");
jest.mock("expo-image-picker", () => ({}));
jest.mock("../../ui/action-sheet", () => ({ ActionSheet: () => null }));

// eslint-disable-next-line @typescript-eslint/no-require-imports
const { act, create } = require("react-test-renderer");

type Renderer = {
  root: {
    findByType: (type: unknown) => { props: { value: string; onChangeText: (text: string) => void } };
    findAll: (predicate: (node: { props: Record<string, unknown> }) => boolean) => { props: { onPress: () => void } }[];
  };
  unmount: () => void;
};

async function mount(onSendText: (body: string) => Promise<boolean>) {
  let renderer!: Renderer;
  await act(async () => {
    renderer = create(
      <ChatComposer editing={null} onCancelEdit={jest.fn()} onSendMedia={jest.fn()}
        onSendText={onSendText} onSubmitEdit={jest.fn()} sending={false} />
    );
  });
  const input = () => renderer.root.findByType(TextInput);
  await act(async () => { input().props.onChangeText("  Olá!  "); });
  const send = () => renderer.root.findAll(
    (node) => node.props.accessibilityLabel === "Enviar mensagem" && typeof node.props.onPress === "function"
  )[0].props.onPress();
  return { renderer, input, send };
}

it("preserves the draft on failure and allows retrying successfully", async () => {
  const onSendText = jest.fn().mockResolvedValueOnce(false).mockResolvedValueOnce(true);
  const { renderer, input, send } = await mount(onSendText);
  await act(async () => { send(); });
  expect(input().props.value).toBe("  Olá!  ");
  await act(async () => { send(); });
  expect(onSendText).toHaveBeenNthCalledWith(2, "Olá!");
  expect(input().props.value).toBe("");
  await act(async () => { renderer.unmount(); });
});

it("keeps the text while waiting and prevents duplicate submissions before render", async () => {
  let finish!: (success: boolean) => void;
  const onSendText = jest.fn(() => new Promise<boolean>((resolve) => { finish = resolve; }));
  const { renderer, input, send } = await mount(onSendText);
  await act(async () => { send(); send(); });
  expect(onSendText).toHaveBeenCalledTimes(1);
  expect(input().props.value).toBe("  Olá!  ");
  await act(async () => { finish(true); });
  expect(input().props.value).toBe("");
  await act(async () => { renderer.unmount(); });
});

it("does not discard new text when an earlier submission completes", async () => {
  let finish!: (success: boolean) => void;
  const { renderer, input, send } = await mount(
    () => new Promise<boolean>((resolve) => { finish = resolve; })
  );
  await act(async () => { send(); });
  await act(async () => { input().props.onChangeText("Outra mensagem"); });
  await act(async () => { finish(true); });
  expect(input().props.value).toBe("Outra mensagem");
  await act(async () => { renderer.unmount(); });
});
