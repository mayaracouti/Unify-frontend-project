import { useCommunityPostReader } from "../use-community-post-reader";
import { useTTS } from "../../accessibility/tts";
jest.mock("../../accessibility/tts", () => ({ useTTS: jest.fn() }));
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { act, create } = require("react-test-renderer");
it("sends the full body and independent description as bounded speech segments", async () => {
  const speakSequence = jest.fn(), stop = jest.fn();
  (useTTS as jest.Mock).mockReturnValue({ enabled: true, speakSequence, stop });
  const body = Array.from({ length: 110 }, () => "conteúdo").join(" ");
  let reader!: ReturnType<typeof useCommunityPostReader>;
  function Harness() { reader = useCommunityPostReader({ id: "p", author: { name: "Ana" }, body, mediaData: "/image", imageDescription: "Uma árvore" }); return null; }
  let renderer!: { unmount: () => void };
  await act(async () => { renderer = create(<Harness />); });
  reader.read();
  const parts: string[] = speakSequence.mock.calls[0][0];
  expect(parts[0]).toBe("Publicação de Ana");
  expect(parts.slice(1, -3).join(" ")).toBe(body);
  expect(parts.slice(-3)).toEqual(["Descrição da imagem.", "Uma árvore", "0 curtidas e 0 comentários"]);
  expect(parts.every((part) => part.length <= 350)).toBe(true);
  reader.stop?.(); expect(stop).toHaveBeenCalled();
  await act(async () => { renderer.unmount(); });
});
