import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

// Generates an endless stream of movie / TV show recommendations on demand.
// Each call returns a fresh batch the user hasn't seen yet (caller passes the
// titles already loaded so we don't repeat them).
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);

    const { category = "movies", exclude = [], count = 12 } = await req.json().catch(() => ({}));

    const kind = category === "tv" ? "TV shows" : "movies";

    const excludeText = (exclude || []).slice(0, 120).join(", ");

    const result = await base44.integrations.Core.InvokeLLM({
      prompt: `Recommend ${count} excellent, popular and critically acclaimed ${kind} that people love to watch to relax and get inspired. Mix well-known classics, recent hits and hidden gems across different genres and eras.
${excludeText ? `Do NOT include any of these already-shown titles: ${excludeText}.` : ""}
For each one provide: the exact title, the release year, a one-sentence enticing description, the primary genre, and an IMDb-style rating out of 10 (e.g. 8.4).`,
      add_context_from_internet: true,
      model: "gemini_3_flash",
      response_json_schema: {
        type: "object",
        properties: {
          items: {
            type: "array",
            items: {
              type: "object",
              properties: {
                title: { type: "string" },
                year: { type: "string" },
                description: { type: "string" },
                genre: { type: "string" },
                rating: { type: "number" }
              },
              required: ["title"]
            }
          }
        },
        required: ["items"]
      }
    });

    const items = (result?.items || []).map((it) => ({
      title: it.title,
      year: it.year ? String(it.year) : undefined,
      description: it.description || "",
      rating: typeof it.rating === "number" ? it.rating : undefined,
      genre: it.genre || "",
      // Deep link out to a search so the card opens something useful.
      media_url: `https://www.google.com/search?q=${encodeURIComponent(`${it.title} ${it.year || ""} ${kind} watch`)}`,
      // Themed poster-style image from Unsplash keyed on genre for variety.
      thumbnail_url: `https://source.unsplash.com/400x600/?${encodeURIComponent((it.genre || "cinema movie") + ",film,poster")}&sig=${Math.floor(Math.random() * 100000)}`,
      media_type: "link",
      category
    }));

    return Response.json({ items });
  } catch (error) {
    console.error("recommendMedia error:", error);
    return Response.json({ error: error.message, items: [] }, { status: 500 });
  }
});