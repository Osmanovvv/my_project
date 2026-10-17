import assert from "node:assert/strict";
import { test } from "node:test";

const { isSameOriginRequest, readJsonRequest, readLimitedRequestBody } =
  await import("../src/server/http-security.server");

test("security API: same-origin and cross-site requests are separated", () => {
  assert.equal(
    isSameOriginRequest(
      new Request("https://itagent.ru/api/lead", {
        method: "POST",
        headers: { origin: "https://itagent.ru", host: "itagent.ru" },
      }),
    ),
    true,
  );
  assert.equal(
    isSameOriginRequest(
      new Request("https://itagent.ru/api/lead", {
        method: "POST",
        headers: { origin: "https://evil.example", host: "itagent.ru" },
      }),
    ),
    false,
  );
  assert.equal(
    isSameOriginRequest(
      new Request("https://itagent.ru/api/lead", {
        method: "POST",
        headers: { "sec-fetch-site": "cross-site", host: "itagent.ru" },
      }),
    ),
    false,
  );
});

test("security API: JSON parser rejects wrong type, malformed and oversized bodies", async () => {
  const wrongType = await readJsonRequest(
    new Request("https://itagent.ru/api/lead", { method: "POST", body: "{}" }),
    100,
  );
  assert.deepEqual(wrongType, { ok: false, status: 415, error: "unsupported_media_type" });

  const malformed = await readJsonRequest(
    new Request("https://itagent.ru/api/lead", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: "{",
    }),
    100,
  );
  assert.deepEqual(malformed, { ok: false, status: 400, error: "bad_request" });

  const oversized = await readJsonRequest(
    new Request("https://itagent.ru/api/lead", {
      method: "POST",
      headers: { "content-type": "application/json", "content-length": "101" },
      body: JSON.stringify({ value: "x" }),
    }),
    100,
  );
  assert.deepEqual(oversized, { ok: false, status: 413, error: "payload_too_large" });
});

test("security API: streamed body limit stops before unbounded accumulation", async () => {
  const body = new ReadableStream<Uint8Array>({
    start(controller) {
      controller.enqueue(new TextEncoder().encode("12345"));
      controller.enqueue(new TextEncoder().encode("67890"));
      controller.enqueue(new TextEncoder().encode("overflow"));
      controller.close();
    },
  });
  const bytes = await readLimitedRequestBody(
    new Request(
      "https://itagent.ru/api/lead",
      { method: "POST", body, duplex: "half" } as RequestInit,
    ),
    10,
  );
  assert.equal(bytes, null);
});
