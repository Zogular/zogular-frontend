import { createServer } from "node:http";
import { expect, test } from "@playwright/test";
import { getRelatedProducts } from "../src/services/products";

const peer = { id: "peer", slug: "other-phone", title: "Other phone", price: 75, stock: 2 };
const envelope = (products: unknown[]) => ({ status: "success", results: products.length, data: { products } });

for (const scenario of [
  { name: "public peers only", body: envelope([peer, { ...peer, id: "source" }, { ...peer, slug: "source-phone" }, { ...peer, status: "HIDDEN" }]), ids: ["peer"] },
  { name: "genuine empty", body: envelope([]), ids: [] },
  { name: "HTTP 503", status: 503, body: { message: "private fixture diagnostic" } },
  { name: "missing list", body: { status: "success", results: 0, data: {} } },
  { name: "non-array list", body: { status: "success", results: 0, data: { products: {} } } },
  { name: "contradictory count", body: { ...envelope([]), results: 1 } },
  { name: "unsuccessful envelope", body: { ...envelope([]), status: "fail" } },
  { name: "invalid product identity", body: envelope([{}]) },
  { name: "malformed public status", body: envelope([{ ...peer, status: "UNKNOWN" }]) },
]) {
  test(`related products: ${scenario.name}`, async () => {
    const requests: string[] = [];
    const fixture = createServer((req, res) => {
      requests.push(`${req.method} ${req.url}`);
      res.writeHead(scenario.status ?? 200, { "Content-Type": "application/json" });
      res.end(JSON.stringify(scenario.body));
    });
    const fetch = globalThis.fetch;
    try {
      await new Promise<void>((resolve, reject) => {
        fixture.once("error", reject).listen(0, "127.0.0.1", resolve);
      });
      const address = fixture.address();
      if (!address || typeof address === "string") throw new Error("Expected a loopback TCP fixture");
      // Preserve the real HTTP status, body reader and service parser; replace only the origin.
      globalThis.fetch = (input, init) => {
        const url = new URL(input instanceof Request ? input.url : input.toString());
        return fetch(`http://127.0.0.1:${address.port}${url.pathname}${url.search}`, init);
      };
      const result = await getRelatedProducts({ productId: "source", excludeSlug: "source-phone" });
      expect(requests).toHaveLength(1);
      expect(requests[0]).toMatch(/^GET .*\/products\/source\/related\?limit=8$/);
      if (scenario.ids) {
        expect(result.status).toBe("available");
        expect(result.status === "available" && result.products.map(({ id }) => id)).toEqual(scenario.ids);
      } else {
        expect(result).toEqual({ status: "unavailable" });
      }
    } finally {
      globalThis.fetch = fetch;
      if (fixture.listening) await new Promise<void>((resolve) => fixture.close(() => resolve()));
    }
  });
}
