import { vi } from "vitest";

/** fetch ni ketma-ket javoblar bilan almashtiradi. Har element: javob yoki tashlanadigan xato. */
export type Reply = { status?: number; body?: unknown; text?: string } | Error;
export function mockFetch(replies: Reply[]) {
  const calls: { url: string; init: RequestInit }[] = [];
  const fn = vi.fn(async (url: any, init: any) => {
    calls.push({ url: String(url), init });
    const r = replies.shift();
    if (!r) throw new Error("mockFetch: javob qolmadi");
    if (r instanceof Error) throw r;
    const text = r.text ?? JSON.stringify(r.body ?? {});
    return new Response(text, { status: r.status ?? 200, headers: { "content-type": "application/json" } });
  });
  vi.stubGlobal("fetch", fn);
  return { calls, fn };
}
export const groqReply = (content: string) => ({ body: { choices: [{ message: { content }, finish_reason: "stop" }] } });
