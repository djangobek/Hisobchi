/**
 * Groq — yagona NLU modeli (OpenAI-mos chat completions).
 * POST https://api.groq.com/openai/v1/chat/completions
 * GROQ_MODEL vergul bilan bir nechta model bo'lishi mumkin: model topilmasa (404/400 model xatosi) keyingisi sinaladi.
 */
import { AiError, Breaker, redact, shouldCoolDown } from "./errors";
import { assertOk, httpRequest, withRetry } from "./http";

const URL_CHAT = "https://api.groq.com/openai/v1/chat/completions";
const breaker = new Breaker(5 * 60_000);
export const groqBreaker = breaker;

export type GroqOptions = { models: string[]; timeoutMs: number; maxTokens?: number };

export async function groqComplete(system: string, user: string, opts: GroqOptions): Promise<string> {
  const key = process.env.GROQ_API_KEY;
  if (!key) throw new AiError("groq", "config", "GROQ_API_KEY sozlanmagan");
  if (breaker.isOpen("groq")) throw new AiError("groq", "quota", "Groq vaqtincha o'tkazib yuborildi (kalit/kvota xatosi)");

  let last: unknown;
  for (const model of opts.models) {
    try {
      return await withRetry(async () => {
        const isOss = /^openai\/gpt-oss/i.test(model);
        const body: Record<string, unknown> = {
          model,
          temperature: 0,
          // gpt-oss'da fikrlash tokenlari ham hisoblanadi — kichik limit javobni kesib, JSON'ni buzardi.
          max_completion_tokens: opts.maxTokens ?? 4096,
          response_format: { type: "json_object" },
          messages: [{ role: "system", content: system }, { role: "user", content: user }],
        };
        if (isOss) { body.reasoning_effort = "low"; body.include_reasoning = false; }
        const r = await httpRequest("groq", URL_CHAT, {
          method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` }, body: JSON.stringify(body),
        }, opts.timeoutMs);

        if (!r.ok) {
          // Groq JSON rejimida model noto'g'ri JSON chiqarsa 400 + failed_generation qaytaradi — undan foydalanamiz.
          const failed = r.json?.error?.failed_generation;
          if (r.status === 400 && typeof failed === "string" && failed.trim()) return failed;
          assertOk("groq", r);
        }
        const choice = r.json?.choices?.[0];
        const text = choice?.message?.content;
        if (typeof text !== "string" || !text.trim()) throw new AiError("groq", "empty", `Groq bo'sh javob qaytardi (${choice?.finish_reason ?? "no choice"})`, r.status);
        return text;
      }, 1);
    } catch (e) {
      last = e;
      if (e instanceof AiError && shouldCoolDown(e) && e.kind !== "config") { breaker.trip("groq"); break; }
      // Model topilmadi/ruxsat yo'q (404 yoki "model" haqidagi 400) → keyingi model
      console.warn(`[NLU] groq(${model}) xato: ${redact(e)}`);
    }
  }
  throw last instanceof Error ? last : new AiError("groq", "server", "Groq ishlamadi");
}
