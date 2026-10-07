import { TextInput } from "react-native";
import * as ImagePicker from "expo-image-picker";
import { ChatComposer } from "../chat-composer";

jest.mock("../../../accessibility/tts", () => ({ useTTS: () => ({ speak: jest.fn() }) }));
jest.mock("../../../hooks/useAudioRecorder", () => ({
  MAX_AUDIO_DURATION_SECONDS: 60,
  useAudioRecorder: () => ({ recording: false }),
}));
jest.mock("@expo/vector-icons/Ionicons", () => "Icon");
jest.mock("expo-image-picker", () => ({
  requestCameraPermissionsAsync: jest.fn().mockResolvedValue({ granted: true }),
  requestMediaLibraryPermissionsAsync: jest.fn().mockResolvedValue({ granted: true }),
  launchCameraAsync: jest.fn(),
  launchImageLibraryAsync: jest.fn(),
}));
jest.mock("../../ui/action-sheet", () => ({ ActionSheet: "Sheet" }));
jest.mock("../../community/post/post-image", () => ({ PostImage: "Preview" }));

// eslint-disable-next-line @typescript-eslint/no-require-imports
const { act, create } = require("react-test-renderer");

type Renderer = {
  root: {
    findByType: (type: unknown) => { props: { value: string; onChangeText: (text: string) => void; options: { key: string; onPress: () => void }[] } };
    findAll: (predicate: (node: { props: Record<string, unknown> }) => boolean) => { props: { onPress: () => void } }[];
    findAllByProps: (props: object) => { props: { value: string; onChangeText: (text: string) => void; onPress: () => void } }[];
  };
  unmount: () => void;
};

async function mount(onSendText: (body: string) => Promise<boolean>, onSendMedia = jest.fn().mockResolvedValue(true)) {
  let renderer!: Renderer;
  await act(async () => {
    renderer = create(
      <ChatComposer editing={null} onCancelEdit={jest.fn()} onSendMedia={onSendMedia}
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

it("previews gallery images, retains description on failure and sends it on retry", async () => {
  (ImagePicker.launchImageLibraryAsync as jest.Mock).mockResolvedValue({ canceled: false, assets: [
    { uri: "file:/photo.jpg", fileName: "photo.jpg", mimeType: "image/jpeg" },
  ] });
  const onSendMedia = jest.fn().mockResolvedValueOnce(false).mockResolvedValueOnce(true);
  const { renderer, input } = await mount(jest.fn().mockResolvedValue(true), onSendMedia);
  await act(async () => { renderer.root.findByType("Sheet").props.options.find((option) => option.key === "library")!.onPress(); });
  expect(onSendMedia).not.toHaveBeenCalled();
  const description = () => renderer.root.findAllByProps({ accessibilityLabel: "Descrição da imagem" })[0];
  await act(async () => { description().props.onChangeText("  Uma árvore  "); });
  const sendImage = () => renderer.root.findAllByProps({ accessibilityLabel: "Enviar imagem selecionada" })[0].props.onPress();
  await act(async () => { sendImage(); });
  expect(description().props.value).toBe("  Uma árvore  ");
  expect(onSendMedia).toHaveBeenCalledWith(expect.objectContaining({ caption: "Descrição da imagem: Uma árvore", uri: "file:/photo.jpg" }));
  await act(async () => { sendImage(); });
  expect(renderer.root.findAllByProps({ accessibilityLabel: "Descrição da imagem" })).toHaveLength(0);
  expect(input().props.value).toBe("  Olá!  ");
  await act(async () => { renderer.unmount(); });
});

it("supports camera images without description and prevents duplicate image uploads", async () => {
  (ImagePicker.launchCameraAsync as jest.Mock).mockResolvedValue({ canceled: false, assets: [{ uri: "file:/camera.jpg" }] });
  let finish!: (success: boolean) => void;
  const onSendMedia = jest.fn(() => new Promise<boolean>((resolve) => { finish = resolve; }));
  const { renderer } = await mount(jest.fn().mockResolvedValue(true), onSendMedia);
  await act(async () => { renderer.root.findByType("Sheet").props.options.find((option) => option.key === "camera")!.onPress(); });
  const send = () => renderer.root.findAllByProps({ accessibilityLabel: "Enviar imagem selecionada" })[0].props.onPress();
  await act(async () => { send(); send(); });
  expect(onSendMedia).toHaveBeenCalledTimes(1);
  expect(onSendMedia).toHaveBeenCalledWith(expect.objectContaining({ caption: undefined, type: "IMAGE" }));
  await act(async () => { finish(true); renderer.unmount(); });
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
