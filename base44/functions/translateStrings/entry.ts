import { createClientFromRequest } from "npm:@base44/sdk@0.8.52";

// Translates a batch of UI strings from English to the target language using
// InvokeLLM. Results are cached client-side, so this function is only called
// for strings the user hasn't seen before. No auth required — translation
// works on public pages too.

export default async function (req: Request): Promise<Response> {
  try {
    const body = await req.json();
    const texts = Array.isArray(body?.texts)
      ? body.texts.filter((t) => typeof t === "string" && t.trim())
      : [];
    const targetLanguage = typeof body?.targetLanguage === "string" ? body.targetLanguage.trim() : "";

    if (texts.length === 0 || !targetLanguage) {
      return Response.json(
        { translations: [], error: "texts and targetLanguage are required" },
        { status: 400 },
      );
    }
    if (texts.length > 50) {
      return Response.json({ error: "Too many texts per batch (max 50)" }, { status: 400 });
    }
    const totalChars = texts.reduce((sum, t) => sum + t.length, 0);
    if (totalChars > 5000) {
      return Response.json({ error: "Batch too large" }, { status: 400 });
    }

    const base44 = createClientFromRequest(req);
    const result = await base44.asServiceRole.integrations.Core.InvokeLLM({
      prompt: `You are a professional UI translator. Translate each string in the following JSON array from English to ${targetLanguage}.

Rules:
- Preserve placeholders like {name}, %s, {{...}}, {0} exactly as written.
- Keep brand names untranslated: "NaliChat", "NaliBase", "Nali", "NaliStudio", "Nali Transfer", "Nali AI", "NaliVision".
- Keep emojis and icons as-is.
- Keep URLs, email addresses, and code snippets untranslated.
- Translate naturally and concisely, as a real app UI would read.
- If a string is already in ${targetLanguage} or is a number/symbol only, return it unchanged.

Input strings (JSON array):
${JSON.stringify(texts)}

Return a JSON object with a "translations" array where translations[i] is the translation of texts[i]. The array must be the same length as the input.`,
      response_json_schema: {
        type: "object",
        properties: {
          translations: {
            type: "array",
            items: { type: "string" },
          },
        },
        required: ["translations"],
      },
    });

    let translations = Array.isArray(result?.translations) ? result.translations : [];
    while (translations.length < texts.length) {
      translations.push(texts[translations.length] || "");
    }
    return Response.json({ translations: translations.slice(0, texts.length) });
  } catch (error) {
    console.error("translateStrings error:", error);
    return Response.json({ error: error?.message || "Translation failed" }, { status: 500 });
  }
}