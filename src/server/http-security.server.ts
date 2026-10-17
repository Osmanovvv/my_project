/** Ограничения HTTP для JSON API; проверка размера выполняется во время чтения. */
export async function readLimitedRequestBody(
  request: Request,
  maxBytes: number,
): Promise<Uint8Array | null> {
  const declared = request.headers.get("content-length");
  if (declared && Number(declared) > maxBytes) return null;
  const reader = request.body?.getReader();
  if (!reader) return new Uint8Array();
  const chunks: Uint8Array[] = [];
  let bytes = 0;
  try {
    while (true) {
      const chunk = await reader.read();
      if (chunk.done) break;
      bytes += chunk.value.byteLength;
      if (bytes > maxBytes) {
        await reader.cancel();
        return null;
      }
      chunks.push(chunk.value);
    }
  } finally {
    reader.releaseLock();
  }
  return Buffer.concat(chunks);
}

export function isSameOriginRequest(request: Request): boolean {
  const fetchSite = request.headers.get("sec-fetch-site");
  if (fetchSite === "cross-site") return false;
  const origin = request.headers.get("origin");
  if (!origin) return true; // Не браузерный клиент; JSON API не разрешает CORS.
  try {
    const target = new URL(request.url);
    const host = request.headers.get("host") || target.host;
    const proto = request.headers.get("x-forwarded-proto") || target.protocol.slice(0, -1);
    if (proto !== "http" && proto !== "https") return false;
    const expected = new URL(`${proto}://${host}`);
    const supplied = new URL(origin);
    return (
      supplied.origin !== "null" &&
      supplied.origin === expected.origin &&
      origin === supplied.origin
    );
  } catch {
    return false;
  }
}

export async function readJsonRequest(
  request: Request,
  maxBytes: number,
): Promise<
  | { ok: true; value: Record<string, unknown> }
  | { ok: false; status: 400 | 413 | 415; error: string }
> {
  if (
    request.headers.get("content-type")?.split(";")[0].trim().toLowerCase() !== "application/json"
  )
    return { ok: false, status: 415, error: "unsupported_media_type" };
  try {
    const bytes = await readLimitedRequestBody(request, maxBytes);
    if (bytes === null) return { ok: false, status: 413, error: "payload_too_large" };
    const value: unknown = JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(bytes));
    if (!value || typeof value !== "object" || Array.isArray(value))
      return { ok: false, status: 400, error: "bad_request" };
    return { ok: true, value: value as Record<string, unknown> };
  } catch {
    return { ok: false, status: 400, error: "bad_request" };
  }
}
