import { act, create, type ReactTestRenderer } from "react-test-renderer";
import { useCommunityPage } from "../use-community-page";
import type { PageResponse } from "../../types/pagination";

type Item = { id: string };
const key = (item: Item) => item.id;
const page = (ids: string[], number = 0, hasNext = false): PageResponse<Item> => ({
  content: ids.map(id => ({ id })), page: number, hasNext, size: 2, totalElements: 4, totalPages: 2,
});
let current: ReturnType<typeof useCommunityPage<Item>>;
function Harness({ load }: { load: (page: number) => Promise<PageResponse<Item>> }) {
  current = useCommunityPage(load, key);
  return null;
}
let root: ReactTestRenderer;
afterEach(async () => { if (root) await act(async () => root.unmount()); });

it("refresh invalida resposta antiga de carregar mais e evita itens duplicados", async () => {
  let resolveMore!: (value: PageResponse<Item>) => void;
  const load = jest.fn().mockResolvedValueOnce(page(["1", "2"], 0, true))
    .mockImplementationOnce(() => new Promise(resolve => { resolveMore = resolve; }))
    .mockResolvedValueOnce(page(["new"], 0, false));
  await act(async () => { root = create(<Harness load={load} />); });
  await act(async () => { await current.refresh(); });
  let more!: Promise<void>;
  await act(async () => { more = current.loadMore(); });
  await act(async () => { await current.refresh(); });
  await act(async () => { resolveMore(page(["2", "3"], 1)); await more; });
  expect(current.items).toEqual([{ id: "new" }]);
  expect(current.hasNext).toBe(false);
});

it("falha de paginação mantém itens e permite tentar a mesma página novamente", async () => {
  const load = jest.fn().mockResolvedValueOnce(page(["1", "2"], 0, true))
    .mockRejectedValueOnce(new Error("Sem rede"))
    .mockResolvedValueOnce(page(["2", "3"], 1));
  await act(async () => { root = create(<Harness load={load} />); });
  await act(async () => { await current.refresh(); });
  await act(async () => { await current.loadMore(); });
  expect(current.items).toHaveLength(2);
  expect(current.error).toBe("Sem rede");
  await act(async () => { await current.loadMore(); });
  expect(load.mock.calls.map(call => call[0])).toEqual([0, 1, 1]);
  expect(current.items.map(item => item.id)).toEqual(["1", "2", "3"]);
});

it("bloqueia dois pedidos simultâneos da mesma página", async () => {
  let finish!: (value: PageResponse<Item>) => void;
  const load = jest.fn().mockResolvedValueOnce(page(["1"], 0, true))
    .mockImplementationOnce(() => new Promise(resolve => { finish = resolve; }));
  await act(async () => { root = create(<Harness load={load} />); });
  await act(async () => { await current.refresh(); });
  let first!: Promise<void>;
  await act(async () => { first = current.loadMore(); void current.loadMore(); });
  expect(load).toHaveBeenCalledTimes(2);
  await act(async () => { finish(page(["2"], 1)); await first; });
});
