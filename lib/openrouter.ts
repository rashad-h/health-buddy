const OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions";

export function getOpenRouterModel(): string {
  return process.env.OPENROUTER_MODEL || "deepseek/deepseek-v4-flash";
}

export async function chatCompletion(
  system: string,
  user: string,
  options?: { temperature?: number; maxTokens?: number }
): Promise<string> {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) {
    throw new Error("OPENROUTER_API_KEY is not configured");
  }

  const res = await fetch(OPENROUTER_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
      "HTTP-Referer": "https://swipe-to-ship.local",
      "X-Title": "Swipe-to-Ship",
    },
    body: JSON.stringify({
      model: getOpenRouterModel(),
      temperature: options?.temperature ?? 0.2,
      max_tokens: options?.maxTokens ?? 4096,
      messages: [
        { role: "system", content: system },
        { role: "user", content: user },
      ],
    }),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(
      `OpenRouter request failed (${res.status}): ${text.slice(0, 200) || res.statusText}`
    );
  }

  const data = (await res.json()) as {
    choices?: Array<{ message?: { content?: string } }>;
  };

  const content = data.choices?.[0]?.message?.content;
  if (!content || typeof content !== "string") {
    throw new Error("OpenRouter returned an empty response");
  }

  return content.trim();
}

/** Strip markdown fences and extract a JSON object string. */
export function stripJsonFences(raw: string): string {
  let text = raw.trim();
  const fenceMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fenceMatch) {
    text = fenceMatch[1].trim();
  }
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start !== -1 && end !== -1 && end > start) {
    text = text.slice(start, end + 1);
  }
  return text;
}

export function parseJsonWithRetryPrep(raw: string): unknown {
  return JSON.parse(stripJsonFences(raw));
}
