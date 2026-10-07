import { PostImage } from "../post-image";
import { useTTS } from "../../../../accessibility/tts";
import { announceForAccessibility } from "../../../../utils/accessibilityAnnouncements";

jest.mock("../../../../accessibility/tts", () => ({ useTTS: jest.fn() }));
jest.mock("../../../../utils/accessibilityAnnouncements", () => ({ announceForAccessibility: jest.fn() }));
jest.mock("../../../profile/authenticated-remote-image", () => ({ AuthenticatedRemoteImage: "RemoteImage" }));
jest.mock("@expo/vector-icons/Ionicons", () => "Icon");
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { act, create } = require("react-test-renderer");
const speakSequence = jest.fn();
const stop = jest.fn();
type Renderer = { root: { findAllByProps: (props: object) => { props: { onPress: () => Promise<void> | void } }[] }; unmount: () => void; update: (node: React.ReactNode) => void };
let renderer: Renderer;
const button = (label = "Ouvir descrição da imagem") => renderer.root.findAllByProps({ accessibilityLabel: label })[0];
beforeEach(() => {
  jest.clearAllMocks();
  (useTTS as jest.Mock).mockReturnValue({ enabled: false, speakSequence, stop });
});
afterEach(async () => { if (renderer) await act(async () => renderer.unmount()); });
async function mount(analyzeImage?: () => Promise<string>, authToken = "token") {
  await act(async () => { renderer = create(<PostImage uri="https://api/image" description="Legenda escrita pelo autor"
    authorName="Ana" authToken={authToken} analyzeImage={analyzeImage} />); });
}

it("analyzes the actual image and speaks the generated description, never the author's caption", async () => {
  const generated = "Uma árvore na praça. ".repeat(30).trim();
  const analyze = jest.fn().mockResolvedValue(generated);
  await mount(analyze);
  await act(async () => { await button().props.onPress(); });
  expect(analyze).toHaveBeenCalledTimes(1);
  expect(speakSequence).toHaveBeenCalledWith(expect.any(Array), { force: true });
  expect(speakSequence.mock.calls[0][0].join(" ")).toBe(`Descrição gerada por inteligência artificial: ${generated}`);
  await act(async () => { await button().props.onPress(); });
  expect(analyze).toHaveBeenCalledTimes(1);
  await act(async () => { button("Parar áudio da descrição").props.onPress(); });
  expect(stop).toHaveBeenCalledTimes(1);
});

it("ignores a pending analysis after stop and prevents duplicate requests", async () => {
  let finish!: (text: string) => void;
  const analyze = jest.fn(() => new Promise<string>(resolve => { finish = resolve; }));
  await mount(analyze);
  let request!: Promise<void> | void;
  await act(async () => { request = button().props.onPress(); });
  await act(async () => { await button().props.onPress(); });
  expect(analyze).toHaveBeenCalledTimes(1);
  await act(async () => { button("Parar áudio da descrição").props.onPress(); });
  await act(async () => { finish("Uma bicicleta."); await request; });
  expect(speakSequence).not.toHaveBeenCalled();
});

it("reports unavailable IA audibly and permits retry without reading the authored caption", async () => {
  const analyze = jest.fn().mockRejectedValue(new Error("IA não configurada"));
  await mount(analyze);
  await act(async () => { await button().props.onPress(); });
  expect(announceForAccessibility).toHaveBeenCalledWith("IA não configurada");
  expect(speakSequence).toHaveBeenCalledWith(["IA não configurada"], { force: true });
  await act(async () => { await button().props.onPress(); });
  expect(analyze).toHaveBeenCalledTimes(2);
});

it("discards pending audio when the session changes", async () => {
  let finish!: (text: string) => void;
  await mount(() => new Promise<string>(resolve => { finish = resolve; }));
  let request!: Promise<void> | void;
  await act(async () => { request = button().props.onPress(); });
  await act(async () => { renderer.update(<PostImage uri="https://api/image" authorName="Ana" authToken="other-session" analyzeImage={async () => "Outra análise"} />); });
  await act(async () => { finish("Resultado da sessão anterior."); await request; });
  expect(speakSequence).not.toHaveBeenCalled();
});

it("does not add IA controls to other image previews without an analyzer", async () => {
  await mount();
  expect(renderer.root.findAllByProps({ accessibilityLabel: "Ouvir descrição da imagem" })).toHaveLength(0);
});
