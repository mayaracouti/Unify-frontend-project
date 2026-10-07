import { Image } from "react-native";
import { PostContent } from "../post-content";
import { PostImage } from "../post-image";
jest.mock("../../../profile/authenticated-remote-image", () => ({ AuthenticatedRemoteImage: "RemoteImage" }));
jest.mock("@expo/vector-icons/Ionicons", () => "Icon");
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { act, create } = require("react-test-renderer");
it("renders full body, independent description and accessible image", async () => {
  const read = jest.fn();
  let renderer!: { root: { findByType: (type: unknown) => { props: { accessibilityLabel: string; uri: string } }; findAllByProps: (props: object) => { props: { onPress: () => void } }[] }; unmount: () => void };
  await act(async () => { renderer = create(<PostContent body="Texto completo" imageDescription="Uma árvore" mediaUri="https://api/image" authorName="Ana" authToken="token" onRead={read} />); });
  expect(renderer.root.findByType("RemoteImage").props.accessibilityLabel).toBe("Descrição da imagem: Uma árvore");
  renderer.root.findAllByProps({ accessibilityLabel: "Texto completo" })[0].props.onPress();
  expect(read).toHaveBeenCalledTimes(1);
  await act(async () => { renderer.unmount(); });
});
it("keeps legacy images relevant and versions replaced media to avoid stale cache", async () => {
  let renderer!: { root: { findByType: (type: unknown) => { props: { accessibilityLabel: string; uri: string } } }; unmount: () => void };
  await act(async () => { renderer = create(<PostImage uri="https://api/image" description={null} version="2026-10-07" authorName="Ana" authToken="token" />); });
  const image = renderer.root.findByType("RemoteImage");
  expect(image.props.accessibilityLabel).toBe("Imagem da publicação de Ana, sem descrição");
  expect(image.props.uri).toBe("https://api/image?v=2026-10-07");
  await act(async () => { renderer.unmount(); });
});
it("previews local picker images without an authenticated HTTP request", async () => {
  let renderer!: { root: { findByType: (type: unknown) => { props: { accessible: boolean; accessibilityLabel: string } } }; unmount: () => void };
  await act(async () => { renderer = create(<PostImage uri="file:/image.jpg" description="Uma árvore" authorName="Ana" authToken="token" />); });
  expect(renderer.root.findByType(Image).props.accessible).toBe(true);
  expect(renderer.root.findByType(Image).props.accessibilityLabel).toContain("Uma árvore");
  await act(async () => { renderer.unmount(); });
});
