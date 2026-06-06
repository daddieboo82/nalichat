import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

// Daily job: ask AI for the current top 10 trending online stores and refresh
// the "shopping" RelaxMedia rows (titles, descriptions, ranking, links).
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);

    const result = await base44.asServiceRole.integrations.Core.InvokeLLM({
      prompt:
        "List the current top 10 trending / most popular online shopping stores worldwide right now. " +
        "Use real, well-known retailers. For each, give the store name, a short one-sentence description, " +
        "and its official homepage URL (https://...). Rank them 1-10 by current popularity.",
      add_context_from_internet: true,
      model: "gemini_3_flash",
      response_json_schema: {
        type: "object",
        properties: {
          stores: {
            type: "array",
            items: {
              type: "object",
              properties: {
                name: { type: "string" },
                description: { type: "string" },
                url: { type: "string" }
              },
              required: ["name", "description", "url"]
            }
          }
        },
        required: ["stores"]
      }
    });

    const stores = (result?.stores || []).slice(0, 10);
    if (stores.length === 0) {
      console.error("refreshTrendingStores: AI returned no stores");
      return Response.json({ error: "No stores returned" }, { status: 500 });
    }

    // Replace existing shopping cards with the fresh ranked list.
    const existing = await base44.asServiceRole.entities.RelaxMedia.filter({ category: "shopping" });
    for (const item of existing) {
      await base44.asServiceRole.entities.RelaxMedia.delete(item.id);
    }

    const records = stores.map((s, i) => ({
      title: s.name,
      description: s.description,
      category: "shopping",
      media_type: "link",
      media_url: s.url,
      thumbnail_url: "https://images.unsplash.com/photo-1481437156560-3205f6a55735?q=80&w=600&auto=format&fit=crop",
      sort_order: i + 1,
      tags: ["trending"]
    }));

    await base44.asServiceRole.entities.RelaxMedia.bulkCreate(records);

    console.log(`refreshTrendingStores: refreshed ${records.length} stores`);
    return Response.json({ success: true, count: records.length });
  } catch (error) {
    console.error("refreshTrendingStores error:", error.message);
    return Response.json({ error: error.message }, { status: 500 });
  }
});